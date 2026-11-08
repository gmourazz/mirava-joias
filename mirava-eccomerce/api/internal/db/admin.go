package db

// Consultas do painel de gestão (admin do design v5).
//
// Aqui NÃO há filtro por user_id, de propósito: o painel enxerga todos os
// pedidos. A proteção é anterior — toda rota que chama estas funções passa
// pelo middleware requireAdmin (internal/web/admin.go), que confere a tabela
// `admins`. Não chame nada daqui a partir de rota de cliente.

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/mirava/api/internal/dominio"
)

// ErrBatchState: o lote não está no status que a ação exige (ex.: comprar um
// lote já comprado). É erro esperado — clique duplo, duas abas abertas.
var ErrBatchState = errors.New("lote não está no status esperado")

func (d *DB) IsAdmin(ctx context.Context, userID string) (bool, error) {
	var ok bool
	err := d.pool.QueryRow(ctx,
		`select exists (select 1 from admins where user_id = $1)`, userID).Scan(&ok)
	return ok, err
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

type AdminOrder struct {
	ID             string         `json:"id"`
	Number         int            `json:"number"`
	Status         dominio.Status `json:"status"`
	Stage          string         `json:"stage"`
	CustomerName   string         `json:"customer_name"`
	CustomerEmail  string         `json:"customer_email"`
	Total          dominio.Cents  `json:"total_cents"`
	Subtotal       dominio.Cents  `json:"subtotal_cents"`
	Shipping       dominio.Cents  `json:"shipping_cents"`
	Cost           dominio.Cents  `json:"cost_cents"`
	ItemsCount     int            `json:"items_count"`
	ShippingMethod *string        `json:"shipping_method"`
	TrackingCode   *string        `json:"tracking_code"`
	BatchNumber    *int           `json:"batch_number"`
	CreatedAt      time.Time      `json:"created_at"`
	PaidAt         *time.Time     `json:"paid_at"`
	ShippedAt      *time.Time     `json:"shipped_at"`

	// Prazo prometido (20 dias úteis desde o pagamento), só para pedido pago
	// que ainda não foi postado. Calculado no domínio, não na tela.
	Deadline *AdminDeadline `json:"deadline"`

	State string `json:"-"` // UF do endereço, para o prazo de transporte
}

type AdminDeadline struct {
	Due time.Time `json:"due"`
	// ShipBy: último dia útil para despachar e ainda chegar no prazo, com o
	// transporte da modalidade escolhida até o estado da cliente.
	ShipBy time.Time `json:"ship_by"`
	Used   int       `json:"used"`
	Left   int       `json:"left"`
	Near   bool      `json:"near"`
	Late   bool      `json:"late"`
}

func deadlineFor(o *AdminOrder) {
	switch dominio.AdminStageOf(o.Status) {
	case dominio.AdminToBuy, dominio.AdminAtSupplier, dominio.AdminToShip:
	default:
		return
	}
	if o.PaidAt == nil {
		return
	}
	d := dominio.DeadlineFor(*o.PaidAt, time.Now())
	service := dominio.ShippingEconomic
	if o.ShippingMethod != nil {
		service = dominio.ShippingService(*o.ShippingMethod)
	}
	shipBy := dominio.ShipBy(*o.PaidAt, dominio.ShippingTransitMaxDays(o.State, service))
	o.Deadline = &AdminDeadline{Due: d.Due, ShipBy: shipBy, Used: d.Used, Left: d.Left, Near: d.Near, Late: d.Late}
}

const adminOrderColumns = `
	o.id::text, o.number, o.status, o.customer_name, o.customer_email,
	o.total_cents, o.subtotal_cents, o.shipping_cents,
	coalesce((select sum(i.unit_cost_cents * i.quantity) from order_items i where i.order_id = o.id), 0),
	coalesce((select sum(i.quantity) from order_items i where i.order_id = o.id), 0),
	o.shipping_method, o.tracking_code, b.number,
	o.created_at, o.paid_at, o.shipped_at, coalesce(o.address->>'state', '')`

func scanAdminOrder(row pgx.Row, o *AdminOrder) error {
	err := row.Scan(&o.ID, &o.Number, &o.Status, &o.CustomerName, &o.CustomerEmail,
		&o.Total, &o.Subtotal, &o.Shipping, &o.Cost, &o.ItemsCount,
		&o.ShippingMethod, &o.TrackingCode, &o.BatchNumber,
		&o.CreatedAt, &o.PaidAt, &o.ShippedAt, &o.State)
	o.Stage = string(dominio.AdminStageOf(o.Status))
	deadlineFor(o)
	return err
}

// AdminOrders lista os pedidos mais recentes. Os filtros do painel (etapa,
// envio, prazo) são aplicados na tela: 300 linhas cabem com folga e a dona
// troca de filtro sem esperar o servidor.
func (d *DB) AdminOrders(ctx context.Context) ([]AdminOrder, error) {
	rows, err := d.pool.Query(ctx, `select `+adminOrderColumns+`
		from orders o left join batches b on b.id = o.batch_id
		order by o.created_at desc
		limit 300`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []AdminOrder{}
	for rows.Next() {
		var o AdminOrder
		if err := scanAdminOrder(rows, &o); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

type AdminOrderItem struct {
	Name     string        `json:"name"`
	SKU      *string       `json:"sku"`
	Size     *string       `json:"size"`
	Quantity int           `json:"quantity"`
	Price    dominio.Cents `json:"price_cents"`
	Cost     dominio.Cents `json:"cost_cents"`
	Image    *string       `json:"image"`
}

type AdminOrderEvent struct {
	From      *string   `json:"from_status"`
	To        string    `json:"to_status"`
	Origin    string    `json:"origin"`
	Detail    *string   `json:"detail"`
	CreatedAt time.Time `json:"created_at"`
}

type AdminOrderDetail struct {
	AdminOrder
	CustomerPhone *string           `json:"customer_phone"`
	Address       json.RawMessage   `json:"address"`
	Items         []AdminOrderItem  `json:"items"`
	Events        []AdminOrderEvent `json:"events"`
	Discount      dominio.Cents     `json:"discount_cents"`
	CouponCode    *string           `json:"coupon_code"`
	PointsUsed    int               `json:"points_used"`
	GiftWrap      bool              `json:"gift_wrap"`
	GiftWrapCents dominio.Cents     `json:"gift_wrap_cents"`
	GiftMessage   *string           `json:"gift_message"`
	Actions       []dominio.Status  `json:"actions"`
	CanRefund     bool              `json:"can_refund"`
}

func (d *DB) AdminOrderByID(ctx context.Context, id string) (*AdminOrderDetail, error) {
	var o AdminOrderDetail
	var addr []byte
	row := d.pool.QueryRow(ctx, `select `+adminOrderColumns+`, o.customer_phone, o.address,
		o.discount_cents, o.coupon_code, o.points_used, o.gift_wrap, o.gift_wrap_cents, o.gift_message
		from orders o left join batches b on b.id = o.batch_id
		where o.id = $1`, id)
	err := row.Scan(&o.ID, &o.Number, &o.Status, &o.CustomerName, &o.CustomerEmail,
		&o.Total, &o.Subtotal, &o.Shipping, &o.Cost, &o.ItemsCount,
		&o.ShippingMethod, &o.TrackingCode, &o.BatchNumber,
		&o.CreatedAt, &o.PaidAt, &o.ShippedAt, &o.State, &o.CustomerPhone, &addr,
		&o.Discount, &o.CouponCode, &o.PointsUsed, &o.GiftWrap, &o.GiftWrapCents, &o.GiftMessage)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	o.Stage = string(dominio.AdminStageOf(o.Status))
	deadlineFor(&o.AdminOrder)
	o.Address = json.RawMessage(addr)
	o.Actions = dominio.ManualActions(o.Status)
	o.CanRefund = dominio.CanRefund(o.Status)
	if o.Actions == nil {
		o.Actions = []dominio.Status{}
	}

	rows, err := d.pool.Query(ctx, `
		select i.name_snapshot, i.supplier_sku, i.size, i.quantity,
		       i.unit_price_cents, i.unit_cost_cents, p.images[1]
		from order_items i left join products p on p.id = i.product_id
		where i.order_id = $1 order by i.id`, id)
	if err != nil {
		return nil, err
	}
	o.Items = []AdminOrderItem{}
	for rows.Next() {
		var it AdminOrderItem
		if err := rows.Scan(&it.Name, &it.SKU, &it.Size, &it.Quantity, &it.Price, &it.Cost, &it.Image); err != nil {
			rows.Close()
			return nil, err
		}
		o.Items = append(o.Items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	evRows, err := d.pool.Query(ctx, `
		select from_status, to_status, origin, detail, created_at
		from order_events where order_id = $1 order by created_at asc, id asc`, id)
	if err != nil {
		return nil, err
	}
	defer evRows.Close()
	o.Events = []AdminOrderEvent{}
	for evRows.Next() {
		var e AdminOrderEvent
		if err := evRows.Scan(&e.From, &e.To, &e.Origin, &e.Detail, &e.CreatedAt); err != nil {
			return nil, err
		}
		o.Events = append(o.Events, e)
	}
	return &o, evRows.Err()
}

// AdminTransition move o pedido de `from` para `to`, só se ele ainda estiver
// em `from`. A condição no WHERE é a defesa contra corrida (duas abas, o
// webhook chegando junto): se o status mudou no meio, nada é alterado e
// devolve false. O gatilho do banco valida a transição e grava o evento com
// origem 'admin'.
func (d *DB) AdminTransition(ctx context.Context, id string, from, to dominio.Status) (bool, error) {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `select set_config('app.origin', 'admin', true)`); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `update orders set status = $3 where id = $1 and status = $2`, id, from, to)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}
	return true, tx.Commit(ctx)
}

// CancelUnpaidOrder cancela um pedido que nunca chegou a ser cobrado, como
// quando o Mercado Pago recusa a preferência. O evento sai com origem 'system'.
func (d *DB) CancelUnpaidOrder(ctx context.Context, id string) error {
	_, err := d.pool.Exec(ctx, `update orders set status = $2 where id = $1 and status = $3`,
		id, dominio.Cancelled, dominio.AwaitingPayment)
	return err
}

// ---------------------------------------------------------------------------
// Lotes — a "lista de compras Lilly" do painel
// ---------------------------------------------------------------------------

type BatchItem struct {
	SKU      *string       `json:"sku"`
	Name     string        `json:"name"`
	Size     *string       `json:"size"`
	Quantity int           `json:"quantity"`
	UnitCost dominio.Cents `json:"unit_cost_cents"`
	Subtotal dominio.Cents `json:"subtotal_cents"`
	Image    *string       `json:"image"`
}

type AdminBatch struct {
	ID           string              `json:"id"`
	Number       int                 `json:"number"`
	Status       dominio.BatchStatus `json:"status"`
	TotalCost    dominio.Cents       `json:"total_cost_cents"`
	Shipping     dominio.Cents       `json:"shipping_cents"`
	SupplierRef  *string             `json:"supplier_order_ref"`
	Notes        *string             `json:"notes"`
	OrdersCount  int                 `json:"orders_count"`
	OldestPaidAt *time.Time          `json:"oldest_paid_at"`
	OpenedAt     time.Time           `json:"opened_at"`
	ClosedAt     *time.Time          `json:"closed_at"`
	PurchasedAt  *time.Time          `json:"purchased_at"`
	Items        []BatchItem         `json:"items"`

	// Regra do lote (decisão 23): meta de frete grátis e teto de dias úteis
	// do pedido mais antigo. Vão junto para a tela mostrar a barra.
	OldestDays int           `json:"oldest_days"`
	GoalCents  dominio.Cents `json:"goal_cents"`
	DaysCap    int           `json:"days_cap"`
}

// AdminBatches traz os lotes que ainda pedem ação: aberto (acumulando),
// fechado (comprar na Lilly) e comprado (esperando chegar).
func (d *DB) AdminBatches(ctx context.Context) ([]AdminBatch, error) {
	rows, err := d.pool.Query(ctx, `
		select b.id::text, b.number, b.status, b.total_cost_cents, b.shipping_cents,
		       b.supplier_order_ref, b.notes,
		       (select count(*) from orders o where o.batch_id = b.id
		          and o.status not in ('cancelled','refunded','out_of_stock')),
		       (select min(o.paid_at) from orders o where o.batch_id = b.id
		          and o.status not in ('cancelled','refunded','out_of_stock')),
		       b.opened_at, b.closed_at, b.purchased_at
		from batches b
		where b.status in ('open','closed','purchased')
		order by b.number asc`)
	if err != nil {
		return nil, err
	}
	out := []AdminBatch{}
	for rows.Next() {
		var b AdminBatch
		if err := rows.Scan(&b.ID, &b.Number, &b.Status, &b.TotalCost, &b.Shipping,
			&b.SupplierRef, &b.Notes, &b.OrdersCount, &b.OldestPaidAt,
			&b.OpenedAt, &b.ClosedAt, &b.PurchasedAt); err != nil {
			rows.Close()
			return nil, err
		}
		b.Items = []BatchItem{}
		b.GoalCents = dominio.FreeShippingGoal
		b.DaysCap = dominio.DaysCap
		if b.OldestPaidAt != nil {
			b.OldestDays = dominio.BusinessDaysBetween(*b.OldestPaidAt, time.Now())
		}
		out = append(out, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Peças agrupadas por SKU, tamanho e custo: é a lista que a dona copia
	// para o carrinho da Lilly. Pedido cancelado, estornado ou sem estoque
	// não entra — a peça não precisa mais ser comprada.
	for i := range out {
		itemRows, err := d.pool.Query(ctx, `
			select i.supplier_sku, i.name_snapshot, i.size, sum(i.quantity)::int,
			       i.unit_cost_cents, sum(i.quantity * i.unit_cost_cents)::int,
			       (array_agg(p.images[1]))[1]
			from order_items i
			join orders o on o.id = i.order_id
			left join products p on p.id = i.product_id
			where o.batch_id = $1
			  and o.status not in ('cancelled','refunded','out_of_stock')
			group by i.supplier_sku, i.name_snapshot, i.size, i.unit_cost_cents
			order by i.supplier_sku nulls last, i.name_snapshot`, out[i].ID)
		if err != nil {
			return nil, err
		}
		for itemRows.Next() {
			var it BatchItem
			if err := itemRows.Scan(&it.SKU, &it.Name, &it.Size, &it.Quantity,
				&it.UnitCost, &it.Subtotal, &it.Image); err != nil {
				itemRows.Close()
				return nil, err
			}
			out[i].Items = append(out[i].Items, it)
		}
		itemRows.Close()
		if err := itemRows.Err(); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// PurchaseBatch registra que a dona comprou o lote na Lilly.
//
// Se o lote ainda estava aberto (ela decidiu antecipar), ele é fechado e um
// novo lote aberto nasce na mesma transação — pedido pago não pode ficar sem
// lote. Os pedidos do lote andam dois passos, um de cada vez, porque o
// gatilho do banco valida cada transição: pago → no lote → comprado.
func (d *DB) PurchaseBatch(ctx context.Context, batchID, supplierRef string) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `select set_config('app.origin', 'admin', true)`); err != nil {
		return err
	}

	var status dominio.BatchStatus
	err = tx.QueryRow(ctx, `select status from batches where id = $1 for update`, batchID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !dominio.BatchCanBePurchased(status)) {
		return ErrBatchState
	}
	if err != nil {
		return err
	}

	if status == dominio.BatchOpen {
		if _, err := tx.Exec(ctx, `update batches set status = 'closed', closed_at = now(),
			notes = coalesce(notes, 'fechado manualmente pela dona') where id = $1`, batchID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `insert into batches (status) values ('open')`); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx, `update batches set status = 'purchased', purchased_at = now(),
		supplier_order_ref = nullif($2, '') where id = $1`, batchID, supplierRef); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `update orders set status = 'in_batch'
		where batch_id = $1 and status = 'paid'`, batchID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `update orders set status = 'purchased_from_supplier'
		where batch_id = $1 and status = 'in_batch'`, batchID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ReceiveBatch registra que as peças do lote chegaram até a dona. Os pedidos
// comprados passam a "recebido" — prontos para reembalar e despachar.
func (d *DB) ReceiveBatch(ctx context.Context, batchID string) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `select set_config('app.origin', 'admin', true)`); err != nil {
		return err
	}

	var status dominio.BatchStatus
	err = tx.QueryRow(ctx, `select status from batches where id = $1 for update`, batchID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !dominio.BatchCanBeReceived(status)) {
		return ErrBatchState
	}
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `update batches set status = 'received', received_at = now()
		where id = $1`, batchID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `update orders set status = 'received_by_owner'
		where batch_id = $1 and status = 'purchased_from_supplier'`, batchID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

type DaySales struct {
	Day   time.Time     `json:"day"`
	Total dominio.Cents `json:"total_cents"`
}

type AdminSummary struct {
	ByStatus       map[string]int `json:"by_status"`
	NearDeadline   int            `json:"near_deadline"`
	Late           int            `json:"late"`
	MonthRevenue   dominio.Cents  `json:"month_revenue_cents"`
	MonthOrders    int            `json:"month_orders"`
	MonthProfit    dominio.Cents  `json:"month_profit_cents"`
	PriceAlerts    int            `json:"price_alerts"`
	Unpublished    int            `json:"unpublished"`
	Published      int            `json:"published"`
	LastSyncAt     *time.Time     `json:"last_sync_at"`
	LastSyncStatus *string        `json:"last_sync_status"`
	Sales          []DaySales     `json:"sales"`
}

func (d *DB) AdminSummary(ctx context.Context) (*AdminSummary, error) {
	s := &AdminSummary{ByStatus: map[string]int{}, Sales: []DaySales{}}

	rows, err := d.pool.Query(ctx, `select status, count(*) from orders group by status`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var st string
		var n int
		if err := rows.Scan(&st, &n); err != nil {
			rows.Close()
			return nil, err
		}
		s.ByStatus[st] = n
	}
	rows.Close()

	// Prazo: 20 dias úteis desde o pagamento, para pedido ainda não postado.
	if err := d.pool.QueryRow(ctx, `
		select
		  count(*) filter (where dias between $1 and $2),
		  count(*) filter (where dias > $2)
		from (
		  select public.business_days_since(paid_at) as dias
		  from orders
		  where paid_at is not null
		    and status in ('paid','in_batch','purchased_from_supplier','received_by_owner')
		) t`,
		dominio.PromisedBusinessDays-dominio.NearDeadlineDays, dominio.PromisedBusinessDays,
	).Scan(&s.NearDeadline, &s.Late); err != nil {
		return nil, err
	}

	// Mês corrente, só pedidos cujo dinheiro é da loja (fora cancelado,
	// estornado, sem estoque e aguardando). Lucro = venda − custo congelado
	// no item; frete e taxa ficam para o financeiro.
	if err := d.pool.QueryRow(ctx, `
		with mes as (
		  select id, total_cents from orders
		  where paid_at >= date_trunc('month', now())
		    and status not in ('cancelled','refunded','out_of_stock','awaiting_payment')
		)
		select coalesce(sum(total_cents), 0), count(*),
		       coalesce((select sum((i.unit_price_cents - i.unit_cost_cents) * i.quantity)
		                   from order_items i where i.order_id in (select id from mes)), 0)
		from mes`).Scan(&s.MonthRevenue, &s.MonthOrders, &s.MonthProfit); err != nil {
		return nil, err
	}

	if err := d.pool.QueryRow(ctx, `
		select count(*) filter (where suggested_price_cents is not null),
		       count(*) filter (where not published),
		       count(*) filter (where published)
		from products`).Scan(&s.PriceAlerts, &s.Unpublished, &s.Published); err != nil {
		return nil, err
	}

	err = d.pool.QueryRow(ctx, `select coalesce(finished_at, started_at), status
		from syncs order by started_at desc limit 1`).Scan(&s.LastSyncAt, &s.LastSyncStatus)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	salesRows, err := d.pool.Query(ctx, `
		select d::date, coalesce(sum(o.total_cents), 0)
		from generate_series(current_date - 13, current_date, interval '1 day') d
		left join orders o on o.paid_at::date = d::date
		  and o.status not in ('cancelled','refunded','out_of_stock','awaiting_payment')
		group by d order by d`)
	if err != nil {
		return nil, err
	}
	defer salesRows.Close()
	for salesRows.Next() {
		var ds DaySales
		if err := salesRows.Scan(&ds.Day, &ds.Total); err != nil {
			return nil, err
		}
		s.Sales = append(s.Sales, ds)
	}
	return s, salesRows.Err()
}

// ---------------------------------------------------------------------------
// Produtos — catálogo no painel (inclui as despublicadas)
// ---------------------------------------------------------------------------

type AdminProduct struct {
	ID          string        `json:"id"`
	Slug        string        `json:"slug"`
	Name        string        `json:"name"`
	Description *string       `json:"description"`
	Category    string        `json:"category"`
	Metal       string        `json:"metal"`
	Price       dominio.Cents `json:"price_cents"`
	Cost        dominio.Cents `json:"cost_cents"`
	// Markup da própria peça (nulo = herda) e o que vale de fato (decisão 21).
	MarkupPct        *float64  `json:"markup_pct"`
	EffectiveMarkup  float64   `json:"effective_markup_pct"`
	AutoPrice        bool      `json:"auto_price"`
	SuggestedPrice   *int      `json:"suggested_price_cents"`
	SuggestionReason *string   `json:"suggestion_reason"`
	Published        bool      `json:"published"`
	Featured         bool      `json:"featured"`
	Image            *string   `json:"image"`
	SKU              *string   `json:"sku"`
	SupplierURL      *string   `json:"supplier_url"`
	RetailCents      *int      `json:"supplier_retail_cents"`
	UnitsSold        int       `json:"units_sold"`
	UpdatedAt        time.Time `json:"updated_at"`

	Images         []string `json:"images"`
	SEOTitle       *string  `json:"seo_title"`
	SEODescription *string  `json:"seo_description"`
	KeepOwnPhotos  bool     `json:"keep_own_photos"`
	Available      bool     `json:"available"` // na Lilly
	Manual         bool     `json:"manual"`    // cadastrada à mão, sem espelho
	PromoPct       int      `json:"promo_pct"`
	Showcase       []string `json:"showcase"` // espaços da vitrine onde aparece
	// Dias desde a última venda paga (nulo = nunca vendeu).
	LastSaleDays *int `json:"last_sale_days"`
}

type AdminProductFilter struct {
	Search   string
	Category string
	Metal    string
	Status   string // "publicados" | "despublicados" | "alerta" | "destaque"
	Price    string // "ate60" | "60a100" | "acima100"
	Vitrine  string // "capa" | "home" | "fora"
	Sales    string // "promocao" | "parados"
	Limit    int
	Offset   int
}

const adminProductColumns = `
	p.id::text, p.slug, p.name, p.description, p.category, p.metal,
	p.price_cents, p.cost_cents, p.markup_pct::float8, p.auto_price,
	p.suggested_price_cents, p.suggestion_reason, p.published, p.featured,
	p.images[1], sp.sku, sp.url, sp.retail_cents, p.units_sold, p.updated_at,
	p.images, p.seo_title, p.seo_description, p.keep_own_photos,
	coalesce(sp.available, true), p.supplier_product_id is null,
	public.promo_pct(p.id, p.category),
	coalesce(array(select s.slot from showcase_items s where s.product_id = p.id order by s.slot), '{}'),
	public.effective_markup(p.markup_pct, p.category)::float8,
	(select extract(day from now() - max(o.paid_at))::int from order_items i join orders o on o.id = i.order_id
	  where i.product_id = p.id and o.status in ` + revenueStatuses + `)`

func scanAdminProduct(row pgx.Row, p *AdminProduct) error {
	return row.Scan(&p.ID, &p.Slug, &p.Name, &p.Description, &p.Category, &p.Metal,
		&p.Price, &p.Cost, &p.MarkupPct, &p.AutoPrice,
		&p.SuggestedPrice, &p.SuggestionReason, &p.Published, &p.Featured,
		&p.Image, &p.SKU, &p.SupplierURL, &p.RetailCents, &p.UnitsSold, &p.UpdatedAt,
		&p.Images, &p.SEOTitle, &p.SEODescription, &p.KeepOwnPhotos,
		&p.Available, &p.Manual, &p.PromoPct, &p.Showcase, &p.EffectiveMarkup, &p.LastSaleDays)
}

// AdminProducts pagina o catálogo no servidor: são milhares de peças, e a
// tela mostra 50 por vez. Devolve também o total para a paginação.
func (d *DB) AdminProducts(ctx context.Context, f AdminProductFilter) ([]AdminProduct, int, error) {
	where := `where ($1 = '' or p.name ilike '%' || $1 || '%' or sp.sku ilike $1 || '%')
	  and ($2 = '' or p.category = $2)
	  and ($3 = '' or p.metal = $3)
	  and (case $4
	         when 'publicados'    then p.published
	         when 'despublicados' then not p.published
	         when 'alerta'        then p.suggested_price_cents is not null
	         when 'destaque'      then p.featured
	         when 'margem'        then p.price_cents > 0 and (p.price_cents - p.cost_cents) * 100.0 / p.price_cents
	                                   < (select min_margin_pct from store_settings limit 1)
	         else true end)
	  and (case $7
	         when 'ate60'    then p.price_cents <= 6000
	         when '60a100'   then p.price_cents > 6000 and p.price_cents <= 10000
	         when 'acima100' then p.price_cents > 10000
	         else true end)
	  and (case $8
	         when 'capa' then p.featured
	         when 'home' then exists (select 1 from showcase_items s where s.product_id = p.id)
	         when 'fora' then not p.featured and not exists (select 1 from showcase_items s where s.product_id = p.id)
	         else true end)
	  and (case $9
	         when 'promocao' then public.promo_pct(p.id, p.category) > 0
	         when 'parados'  then not exists (select 1 from order_items i join orders o on o.id = i.order_id
	                              where i.product_id = p.id and o.paid_at > now() - interval '30 days'
	                                and o.status in ` + revenueStatuses + `)
	         else true end)`
	from := ` from products p left join supplier_products sp on sp.id = p.supplier_product_id `

	var total int
	if err := d.pool.QueryRow(ctx, `select count(*)`+from+where+` and $5::int >= 0 and $6::int >= 0`,
		f.Search, f.Category, f.Metal, f.Status, 0, 0, f.Price, f.Vitrine, f.Sales).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := d.pool.Query(ctx, `select `+adminProductColumns+from+where+`
		order by (p.suggested_price_cents is not null) desc, p.units_sold desc, p.name
		limit $5 offset $6`,
		f.Search, f.Category, f.Metal, f.Status, f.Limit, f.Offset, f.Price, f.Vitrine, f.Sales)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []AdminProduct{}
	for rows.Next() {
		var p AdminProduct
		if err := scanAdminProduct(rows, &p); err != nil {
			return nil, 0, err
		}
		out = append(out, p)
	}
	return out, total, rows.Err()
}

func (d *DB) AdminProductByID(ctx context.Context, id string) (*AdminProduct, error) {
	var p AdminProduct
	err := scanAdminProduct(d.pool.QueryRow(ctx, `select `+adminProductColumns+`
		from products p left join supplier_products sp on sp.id = p.supplier_product_id
		where p.id = $1`, id), &p)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &p, err
}

// AdminProductUpdate são os campos que o painel edita. Ponteiro nulo = não
// mexe. Preço não está aqui de propósito: preço só muda por markup
// (ApplyMarkup) ou aceitando a sugestão do disjuntor.
type AdminProductUpdate struct {
	Name           *string   `json:"name"`
	Description    *string   `json:"description"`
	Published      *bool     `json:"published"`
	Featured       *bool     `json:"featured"`
	Category       *string   `json:"category"`
	Metal          *string   `json:"metal"`
	SEOTitle       *string   `json:"seo_title"`
	SEODescription *string   `json:"seo_description"`
	Images         *[]string `json:"images"`
	KeepOwnPhotos  *bool     `json:"keep_own_photos"`
}

// UpdateProduct grava o que a dona editou. Mexeu no nome/descrição, na
// categoria ou nas fotos: a sincronização para de sobrescrever aquilo
// (keep_own_text, category_locked, keep_own_photos).
func (d *DB) UpdateProduct(ctx context.Context, id string, u AdminProductUpdate) (bool, error) {
	var images []string
	if u.Images != nil {
		images = *u.Images
	}
	tag, err := d.pool.Exec(ctx, `
		update products set
		  name            = coalesce($2, name),
		  description     = coalesce($3, description),
		  published       = coalesce($4, published),
		  featured        = coalesce($5, featured),
		  category        = coalesce($6, category),
		  metal           = coalesce($7, metal),
		  seo_title       = case when $8::text is null then seo_title else nullif($8, '') end,
		  seo_description = case when $9::text is null then seo_description else nullif($9, '') end,
		  images          = case when $10::boolean then $11 else images end,
		  keep_own_photos = coalesce($12, keep_own_photos or $10::boolean),
		  keep_own_text   = keep_own_text or $2::text is not null or $3::text is not null,
		  category_locked = category_locked or $6::text is not null,
		  hidden_by_sync  = case when $4::boolean is not null then false else hidden_by_sync end
		where id = $1`, id, u.Name, u.Description, u.Published, u.Featured, u.Category, u.Metal,
		u.SEOTitle, u.SEODescription, u.Images != nil, images, u.KeepOwnPhotos)
	return tag.RowsAffected() > 0, err
}

// NewManualProduct: peça cadastrada à mão no painel (sem espelho da Lilly).
type NewManualProduct struct {
	Name        string
	Description string
	Category    string
	Metal       string
	Cost        dominio.Cents
	MarkupPct   *float64
	Images      []string
	Published   bool
}

// CreateManualProduct grava a peça com o preço calculado no Go (markup em
// camadas e ,90 — decisão 21).
func (d *DB) CreateManualProduct(ctx context.Context, p NewManualProduct) (string, error) {
	price, err := d.priceFor(ctx, p.Cost, p.MarkupPct, p.Category)
	if err != nil {
		return "", err
	}
	var id string
	err = d.pool.QueryRow(ctx, `
		insert into products (slug, name, description, price_cents, cost_cents, category, metal,
			images, published, auto_price, markup_pct, keep_own_text, keep_own_photos, category_locked)
		values (public.generate_slug($1 || ' ' || substr(md5(random()::text), 1, 5)), $1, nullif($2,''),
			$3, $4, $5, $6, $7, $8, true, $9, true, true, true)
		returning id::text`,
		p.Name, p.Description, price, p.Cost, p.Category, p.Metal, p.Images, p.Published, p.MarkupPct).Scan(&id)
	return id, err
}

// priceFor: preço a partir do custo com o markup em camadas, em Go.
func (d *DB) priceFor(ctx context.Context, cost dominio.Cents, own *float64, category string) (dominio.Cents, error) {
	var cat *float64
	var global float64
	var round90 bool
	err := d.pool.QueryRow(ctx, `
		select (select markup_pct::float8 from categories where slug = $1),
		       default_markup_pct::float8, round_to_90 from store_settings limit 1`, category).
		Scan(&cat, &global, &round90)
	if err != nil {
		return 0, err
	}
	price := dominio.PriceFromMarkupRounded(cost, dominio.EffectiveMarkup(own, cat, global), round90)
	if price <= 0 {
		return 0, errors.New("custo zerado: preço não pode ser calculado")
	}
	return price, nil
}

// ApplyMarkup grava o markup e o preço que sai dele. O preço é calculado no
// domínio (dominio.PriceFromMarkup), com o mesmo arredondamento da função SQL
// do disjuntor. Volta o preço para automático e descarta sugestão pendente:
// a dona acabou de decidir o preço.
//
// markupPct nulo = a peça volta a herdar o markup da categoria ou o padrão.
func (d *DB) ApplyMarkup(ctx context.Context, id string, markupPct *float64) (bool, error) {
	var cost dominio.Cents
	var category string
	err := d.pool.QueryRow(ctx, `select cost_cents, category from products where id = $1`, id).Scan(&cost, &category)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	price, err := d.priceFor(ctx, cost, markupPct, category)
	if err != nil {
		return false, err
	}
	tag, err := d.pool.Exec(ctx, `
		update products set markup_pct = $2, price_cents = $3, auto_price = true,
		  suggested_price_cents = null, suggestion_reason = null
		where id = $1 and cost_cents = $4`, id, markupPct, price, cost)
	return tag.RowsAffected() > 0, err
}

// ResolveSuggestion decide o alerta do disjuntor: aceitar grava o preço
// sugerido; recusar mantém o preço atual e limpa o alerta.
func (d *DB) ResolveSuggestion(ctx context.Context, id string, accept bool) (bool, error) {
	q := `update products set suggested_price_cents = null, suggestion_reason = null
	      where id = $1 and suggested_price_cents is not null`
	if accept {
		q = `update products set price_cents = suggested_price_cents,
		       suggested_price_cents = null, suggestion_reason = null
		     where id = $1 and suggested_price_cents is not null`
	}
	tag, err := d.pool.Exec(ctx, q, id)
	return tag.RowsAffected() > 0, err
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

// Pedidos cujo dinheiro é da loja: o mesmo critério de
// dominio.Status.CountsForRevenue, repetido aqui porque o filtro roda no SQL.
const revenueStatuses = `('paid','in_batch','purchased_from_supplier','received_by_owner','shipped','delivered')`

type FinanceOrder struct {
	ID             string        `json:"id"`
	Number         int           `json:"number"`
	CustomerName   string        `json:"customer_name"`
	PaidAt         time.Time     `json:"paid_at"`
	ShippingMethod *string       `json:"shipping_method"`
	Subtotal       dominio.Cents `json:"subtotal_cents"`
	Shipping       dominio.Cents `json:"shipping_cents"`
	Total          dominio.Cents `json:"total_cents"`
	Cost           dominio.Cents `json:"cost_cents"`
	Fee            dominio.Cents `json:"fee_cents"`
	Discount       dominio.Cents `json:"discount_cents"`
	GiftWrap       dominio.Cents `json:"gift_wrap_cents"`
}

type FinanceGroup struct {
	Label  string        `json:"label"`
	Units  int           `json:"units"`
	Sales  dominio.Cents `json:"sales_cents"`
	Profit dominio.Cents `json:"profit_cents"`
}

type FinanceMonthData struct {
	Input      dominio.FinanceInput
	Orders     []FinanceOrder
	Categories []FinanceGroup
	TopPieces  []FinanceGroup
}

// FinanceMonth junta o que o fechamento de [start, end) precisa. Pedido entra
// no mês em que foi PAGO; taxa é a real que o Mercado Pago descontou
// (payments.fee_cents de pagamento aprovado); frete de lote entra no mês em
// que o lote foi comprado na Lilly.
func (d *DB) FinanceMonth(ctx context.Context, start, end time.Time, packagingEach dominio.Cents) (*FinanceMonthData, error) {
	out := &FinanceMonthData{Orders: []FinanceOrder{}, Categories: []FinanceGroup{}, TopPieces: []FinanceGroup{}}

	rows, err := d.pool.Query(ctx, `
		select o.id::text, o.number, o.customer_name, o.paid_at, o.shipping_method,
		       o.subtotal_cents, o.shipping_cents, o.total_cents, o.discount_cents, o.gift_wrap_cents,
		       coalesce((select sum(i.unit_cost_cents * i.quantity) from order_items i where i.order_id = o.id), 0),
		       coalesce((select sum(p.fee_cents) from payments p
		                  where p.order_id = o.id and p.status = 'approved'), 0)
		from orders o
		where o.paid_at >= $1 and o.paid_at < $2
		  and o.status in `+revenueStatuses+`
		order by o.paid_at desc`, start, end)
	if err != nil {
		return nil, err
	}
	in := dominio.FinanceInput{PackagingEach: packagingEach}
	for rows.Next() {
		var o FinanceOrder
		if err := rows.Scan(&o.ID, &o.Number, &o.CustomerName, &o.PaidAt, &o.ShippingMethod,
			&o.Subtotal, &o.Shipping, &o.Total, &o.Discount, &o.GiftWrap, &o.Cost, &o.Fee); err != nil {
			rows.Close()
			return nil, err
		}
		in.Orders++
		in.Subtotal += o.Subtotal
		in.Discount += o.Discount
		in.GiftWrap += o.GiftWrap
		if o.GiftWrap > 0 {
			in.GiftWraps++
		}
		in.ShippingCharged += o.Shipping
		in.Cost += o.Cost
		in.Fees += o.Fee
		out.Orders = append(out.Orders, o)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := d.pool.QueryRow(ctx, `
		select coalesce(sum(shipping_cents), 0) from batches
		where purchased_at >= $1 and purchased_at < $2`, start, end).Scan(&in.BatchFreight); err != nil {
		return nil, err
	}
	out.Input = in

	group := func(sql string) ([]FinanceGroup, error) {
		rows, err := d.pool.Query(ctx, sql, start, end)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		res := []FinanceGroup{}
		for rows.Next() {
			var g FinanceGroup
			if err := rows.Scan(&g.Label, &g.Units, &g.Sales, &g.Profit); err != nil {
				return nil, err
			}
			res = append(res, g)
		}
		return res, rows.Err()
	}
	// Por categoria e por peça a conta é item a item, antes do desconto do
	// pedido (cupom e pontos valem para o pedido inteiro, não para uma peça).
	base := `from order_items i join orders o on o.id = i.order_id
		left join products pr on pr.id = i.product_id
		where o.paid_at >= $1 and o.paid_at < $2 and o.status in ` + revenueStatuses
	if out.Categories, err = group(`
		select coalesce(pr.category, 'outros'), sum(i.quantity)::int,
		       sum(i.unit_price_cents * i.quantity)::int,
		       sum((i.unit_price_cents - i.unit_cost_cents) * i.quantity)::int ` + base + `
		group by 1 order by 4 desc`); err != nil {
		return nil, err
	}
	if out.TopPieces, err = group(`
		select i.name_snapshot, sum(i.quantity)::int,
		       sum(i.unit_price_cents * i.quantity)::int,
		       sum((i.unit_price_cents - i.unit_cost_cents) * i.quantity)::int ` + base + `
		group by 1 order by 4 desc limit 5`); err != nil {
		return nil, err
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Sincronização com a Lilly
// ---------------------------------------------------------------------------

type SyncRun struct {
	ID           string     `json:"id"`
	Status       string     `json:"status"`
	SitemapURLs  int        `json:"sitemap_urls"`
	Processed    int        `json:"processed"`
	Created      int        `json:"created"`
	Updated      int        `json:"updated"`
	Failed       int        `json:"failed"`
	Vanished     int        `json:"vanished"`
	LockedPrices int        `json:"locked_prices"`
	Error        *string    `json:"error"`
	StartedAt    time.Time  `json:"started_at"`
	FinishedAt   *time.Time `json:"finished_at"`
	// Interrupted: ficou "running" por mais tempo do que uma leitura leva —
	// o processo morreu no meio (deploy, queda) e nunca gravou o fim.
	Interrupted bool `json:"interrupted"`
}

// Uma leitura completa do catálogo (≈2 mil páginas com pausa de 1–2 s) leva
// cerca de uma hora. Rodando há mais que isto, morreu no meio.
const syncStaleAfter = 3 * time.Hour

type SyncFailure struct {
	URL       string    `json:"url"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

type SyncOverview struct {
	Runs            []SyncRun     `json:"runs"`
	Failures        []SyncFailure `json:"failures"`
	MirrorTotal     int           `json:"mirror_total"`
	MirrorAvailable int           `json:"mirror_available"`
	MirrorVanished  int           `json:"mirror_vanished"`
	Published       int           `json:"published"`
	Unpublished     int           `json:"unpublished"`
	PriceAlerts     int           `json:"price_alerts"`
}

func (d *DB) SyncOverview(ctx context.Context) (*SyncOverview, error) {
	o := &SyncOverview{Runs: []SyncRun{}, Failures: []SyncFailure{}}

	rows, err := d.pool.Query(ctx, `
		select id::text, status, sitemap_urls, processed, created_count, updated_count,
		       failed, vanished, locked_prices, error, started_at, finished_at
		from syncs order by started_at desc limit 15`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var r SyncRun
		if err := rows.Scan(&r.ID, &r.Status, &r.SitemapURLs, &r.Processed, &r.Created, &r.Updated,
			&r.Failed, &r.Vanished, &r.LockedPrices, &r.Error, &r.StartedAt, &r.FinishedAt); err != nil {
			rows.Close()
			return nil, err
		}
		r.Interrupted = r.Status == "running" && time.Since(r.StartedAt) > syncStaleAfter
		o.Runs = append(o.Runs, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Falhas da última rodada que teve falha — as anteriores já foram
	// superadas ou repetidas.
	fRows, err := d.pool.Query(ctx, `
		select url, reason, created_at from sync_failures
		where sync_id = (select sync_id from sync_failures order by created_at desc limit 1)
		order by created_at desc limit 30`)
	if err != nil {
		return nil, err
	}
	for fRows.Next() {
		var f SyncFailure
		if err := fRows.Scan(&f.URL, &f.Reason, &f.CreatedAt); err != nil {
			fRows.Close()
			return nil, err
		}
		o.Failures = append(o.Failures, f)
	}
	fRows.Close()
	if err := fRows.Err(); err != nil {
		return nil, err
	}

	err = d.pool.QueryRow(ctx, `
		select (select count(*) from supplier_products),
		       (select count(*) from supplier_products where available and vanished_at is null),
		       (select count(*) from supplier_products where vanished_at is not null),
		       (select count(*) from products where published),
		       (select count(*) from products where not published),
		       (select count(*) from products where suggested_price_cents is not null)`).
		Scan(&o.MirrorTotal, &o.MirrorAvailable, &o.MirrorVanished, &o.Published, &o.Unpublished, &o.PriceAlerts)
	return o, err
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

type AdminCustomer struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Email       string        `json:"email"`
	Phone       *string       `json:"phone"`
	CreatedAt   time.Time     `json:"created_at"`
	Orders      int           `json:"orders"`
	Spent       dominio.Cents `json:"spent_cents"`
	LastOrderAt *time.Time    `json:"last_order_at"`
	Favorites   int           `json:"favorites"`
	IsAdmin     bool          `json:"is_admin"`
	// Design v5: nível do Mirava Club (pelos pontos já ganhos) e etiquetas.
	Level dominio.ClubLevel `json:"level"`
	Tags  []string          `json:"tags"`
}

// AdminCustomers lista as contas com o que cada uma comprou. "Pedidos" e
// "gasto" contam só pedidos cujo dinheiro é da loja.
func (d *DB) AdminCustomers(ctx context.Context, search string) ([]AdminCustomer, error) {
	rows, err := d.pool.Query(ctx, `
		select u.id::text, coalesce(nullif(p.name, ''), u.name), u.email, p.phone, u.created_at,
		       count(o.id) filter (where o.status in `+revenueStatuses+`)::int,
		       coalesce(sum(o.total_cents) filter (where o.status in `+revenueStatuses+`), 0)::int,
		       max(o.paid_at),
		       (select count(*) from favorites f where f.user_id = u.id)::int,
		       exists (select 1 from admins a where a.user_id = u.id),
		       coalesce(sum(o.points_earned) filter (where o.status = 'delivered'), 0)::int,
		       coalesce((select n.tags from customer_notes n where n.user_id = u.id), '{}')
		from users u
		left join profiles p on p.id = u.id
		left join orders o on o.user_id = u.id
		where ($1 = '' or u.email ilike '%' || $1 || '%' or coalesce(p.name, u.name) ilike '%' || $1 || '%')
		group by u.id, p.name, p.phone
		order by max(o.paid_at) desc nulls last, u.created_at desc
		limit 300`, search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminCustomer{}
	for rows.Next() {
		var c AdminCustomer
		var earned int
		if err := rows.Scan(&c.ID, &c.Name, &c.Email, &c.Phone, &c.CreatedAt,
			&c.Orders, &c.Spent, &c.LastOrderAt, &c.Favorites, &c.IsAdmin, &earned, &c.Tags); err != nil {
			return nil, err
		}
		c.Level = dominio.ClubLevelFor(earned)
		out = append(out, c)
	}
	return out, rows.Err()
}

// AdminCustomerOrders são os pedidos de uma conta, no formato da lista do
// painel.
func (d *DB) AdminCustomerOrders(ctx context.Context, userID string) ([]AdminOrder, error) {
	rows, err := d.pool.Query(ctx, `select `+adminOrderColumns+`
		from orders o left join batches b on b.id = o.batch_id
		where o.user_id = $1
		order by o.created_at desc limit 100`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminOrder{}
	for rows.Next() {
		var o AdminOrder
		if err := scanAdminOrder(rows, &o); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Atividades — o histórico de status de todos os pedidos
// ---------------------------------------------------------------------------

type AdminActivity struct {
	OrderID      string    `json:"order_id"`
	OrderNumber  int       `json:"order_number"`
	CustomerName string    `json:"customer_name"`
	From         *string   `json:"from_status"`
	To           string    `json:"to_status"`
	Origin       string    `json:"origin"`
	Detail       *string   `json:"detail"`
	CreatedAt    time.Time `json:"created_at"`
}

// AdminActivities lê order_events, que o gatilho do banco grava a cada
// mudança de status, com a origem: 'admin' (painel) ou 'system' (webhook,
// tarefas).
func (d *DB) AdminActivities(ctx context.Context, origin string) ([]AdminActivity, error) {
	rows, err := d.pool.Query(ctx, `
		select o.id::text, o.number, o.customer_name, e.from_status, e.to_status,
		       e.origin, e.detail, e.created_at
		from order_events e join orders o on o.id = e.order_id
		where ($1 = '' or e.origin = $1)
		order by e.created_at desc, e.id desc
		limit 200`, origin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminActivity{}
	for rows.Next() {
		var a AdminActivity
		if err := rows.Scan(&a.OrderID, &a.OrderNumber, &a.CustomerName, &a.From, &a.To,
			&a.Origin, &a.Detail, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
