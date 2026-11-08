package db

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/mirava/api/internal/dominio"
)

// Avaliações, avise-me, trocas, vitrine, avisos do topo, sacola salva e as
// filas das automações (decisão 31). Consultas de cliente filtram por
// user_id; as do painel só são chamadas atrás do requireAdmin.

// ---------------------------------------------------------------------------
// Avaliações
// ---------------------------------------------------------------------------

type PublicReview struct {
	Author    string    `json:"author"` // "Juliana M." — só o primeiro nome e a inicial
	Rating    int       `json:"rating"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

// ProductReviews: só as aprovadas, com média e total.
// ProductReviews devolve as avaliações aprovadas, a média e o total. Quem
// recomenda (nota 4 ou 5) sai de RecommendShare.
func (d *DB) ProductReviews(ctx context.Context, slug string) ([]PublicReview, float64, int, error) {
	rows, err := d.pool.Query(ctx, `
		select coalesce(nullif(pf.name, ''), u.name), r.rating, r.text, r.created_at
		from reviews r
		join products p on p.id = r.product_id
		join users u on u.id = r.user_id
		left join profiles pf on pf.id = u.id
		where p.slug = $1 and r.status = 'approved'
		order by r.created_at desc limit 50`, slug)
	if err != nil {
		return nil, 0, 0, err
	}
	defer rows.Close()
	out := []PublicReview{}
	soma := 0
	for rows.Next() {
		var r PublicReview
		var nome string
		if err := rows.Scan(&nome, &r.Rating, &r.Text, &r.CreatedAt); err != nil {
			return nil, 0, 0, err
		}
		r.Author = shortName(nome)
		soma += r.Rating
		out = append(out, r)
	}
	var media float64
	if len(out) > 0 {
		media = float64(soma) / float64(len(out))
	}
	return out, media, len(out), rows.Err()
}

func shortName(nome string) string {
	p := strings.Fields(nome)
	switch len(p) {
	case 0:
		return "Cliente Mirava"
	case 1:
		return p[0]
	}
	return p[0] + " " + string([]rune(p[len(p)-1])[0]) + "."
}

// Reviewable é uma peça que a cliente recebeu e ainda não avaliou.
type Reviewable struct {
	ProductID   string    `json:"product_id"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Image       *string   `json:"image"`
	OrderNumber int       `json:"order_number"`
	DeliveredAt time.Time `json:"delivered_at"`
}

func (d *DB) Reviewables(ctx context.Context, userID string) ([]Reviewable, error) {
	rows, err := d.pool.Query(ctx, `
		select distinct on (p.id) p.id::text, p.slug, p.name, p.images[1], o.number, o.delivered_at
		from orders o
		join order_items i on i.order_id = o.id
		join products p on p.id = i.product_id and p.published
		where o.user_id = $1 and o.status = 'delivered' and o.delivered_at is not null
		  and not exists (select 1 from reviews r where r.user_id = $1 and r.product_id = p.id)
		order by p.id, o.delivered_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Reviewable{}
	for rows.Next() {
		var r Reviewable
		if err := rows.Scan(&r.ProductID, &r.Slug, &r.Name, &r.Image, &r.OrderNumber, &r.DeliveredAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// CreateReview só aceita peça que a cliente recebeu (pedido entregue). A
// avaliação entra pendente: aparece na loja depois de aprovada no painel.
func (d *DB) CreateReview(ctx context.Context, userID, productID string, rating int, text string) error {
	var orderID string
	err := d.pool.QueryRow(ctx, `
		select o.id::text from orders o join order_items i on i.order_id = o.id
		where o.user_id = $1 and i.product_id = $2 and o.status = 'delivered'
		order by o.delivered_at desc nulls last limit 1`, userID, productID).Scan(&orderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotAllowed
	}
	if err != nil {
		return err
	}
	_, err = d.pool.Exec(ctx, `
		insert into reviews (product_id, user_id, order_id, rating, text)
		values ($1, $2, $3, $4, $5)`, productID, userID, orderID, rating, text)
	if isDuplicate(err) {
		return ErrDuplicate
	}
	return err
}

// ErrNotAllowed: a cliente não pode fazer isso (avaliar peça que não recebeu,
// trocar pedido fora do prazo).
var ErrNotAllowed = errors.New("ação não permitida")

type AdminReview struct {
	ID           string    `json:"id"`
	ProductName  string    `json:"product_name"`
	ProductSlug  string    `json:"product_slug"`
	ProductImage *string   `json:"product_image"`
	Customer     string    `json:"customer"`
	Email        string    `json:"email"`
	Rating       int       `json:"rating"`
	Text         string    `json:"text"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

func (d *DB) AdminReviews(ctx context.Context, status string) ([]AdminReview, error) {
	rows, err := d.pool.Query(ctx, `
		select r.id::text, p.name, p.slug, p.images[1], coalesce(nullif(pf.name, ''), u.name), u.email,
		       r.rating, r.text, r.status, r.created_at
		from reviews r
		join products p on p.id = r.product_id
		join users u on u.id = r.user_id
		left join profiles pf on pf.id = u.id
		where ($1 = '' or r.status = $1)
		order by (r.status = 'pending') desc, r.created_at desc limit 200`, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminReview{}
	for rows.Next() {
		var r AdminReview
		if err := rows.Scan(&r.ID, &r.ProductName, &r.ProductSlug, &r.ProductImage, &r.Customer, &r.Email,
			&r.Rating, &r.Text, &r.Status, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) DecideReview(ctx context.Context, id, status string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `update reviews set status = $2, decided_at = now() where id = $1`, id, status)
	return tag.RowsAffected() > 0, err
}

// ---------------------------------------------------------------------------
// Avise-me
// ---------------------------------------------------------------------------

// CreateStockAlert: só para peça publicada que está indisponível agora.
func (d *DB) CreateStockAlert(ctx context.Context, productID, email string, userID *string) error {
	var available bool
	err := d.pool.QueryRow(ctx, `
		select coalesce(sp.available, true) from products p
		left join supplier_products sp on sp.id = p.supplier_product_id
		where p.id = $1 and p.published`, productID).Scan(&available)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotAllowed
	}
	if err != nil {
		return err
	}
	if available {
		return ErrNotAllowed
	}
	_, err = d.pool.Exec(ctx, `
		insert into stock_alerts (product_id, email, user_id) values ($1, lower($2), $3)
		on conflict (product_id, email) do update set notified_at = null`,
		productID, strings.TrimSpace(email), userID)
	return err
}

type AdminStockAlert struct {
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Slug      string  `json:"slug"`
	Image     *string `json:"image"`
	Waiting   int     `json:"waiting"`
	Notified  int     `json:"notified"`
	Available bool    `json:"available"`
}

func (d *DB) AdminStockAlerts(ctx context.Context) ([]AdminStockAlert, error) {
	rows, err := d.pool.Query(ctx, `
		select p.id::text, p.name, p.slug, p.images[1],
		       count(*) filter (where a.notified_at is null)::int,
		       count(*) filter (where a.notified_at is not null)::int,
		       coalesce(sp.available, true)
		from stock_alerts a
		join products p on p.id = a.product_id
		left join supplier_products sp on sp.id = p.supplier_product_id
		group by p.id, sp.available
		order by 5 desc, p.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminStockAlert{}
	for rows.Next() {
		var a AdminStockAlert
		if err := rows.Scan(&a.ProductID, &a.Name, &a.Slug, &a.Image, &a.Waiting, &a.Notified, &a.Available); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Trocas
// ---------------------------------------------------------------------------

type Return struct {
	ID           string              `json:"id"`
	OrderID      string              `json:"order_id"`
	OrderNumber  int                 `json:"order_number"`
	Customer     string              `json:"customer"`
	Email        string              `json:"email"`
	Kind         string              `json:"kind"`
	Reason       string              `json:"reason"`
	Stage        dominio.ReturnStage `json:"stage"`
	AdminNote    *string             `json:"admin_note"`
	CreatedAt    time.Time           `json:"created_at"`
	UpdatedAt    time.Time           `json:"updated_at"`
	ItemsSummary string              `json:"items_summary"`
}

const returnColumns = `
	r.id::text, r.order_id::text, o.number, o.customer_name, o.customer_email, r.kind, r.reason,
	r.stage, r.admin_note, r.created_at, r.updated_at,
	coalesce((select string_agg(i.name_snapshot, ', ') from order_items i where i.order_id = o.id), '')`

func scanReturn(row pgx.Row, r *Return) error {
	return row.Scan(&r.ID, &r.OrderID, &r.OrderNumber, &r.Customer, &r.Email, &r.Kind, &r.Reason,
		&r.Stage, &r.AdminNote, &r.CreatedAt, &r.UpdatedAt, &r.ItemsSummary)
}

func (d *DB) listReturns(ctx context.Context, where string, args ...any) ([]Return, error) {
	rows, err := d.pool.Query(ctx, `select `+returnColumns+`
		from returns r join orders o on o.id = r.order_id `+where+`
		order by (r.stage in ('done','rejected')), r.created_at desc limit 200`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Return{}
	for rows.Next() {
		var r Return
		if err := scanReturn(rows, &r); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) ReturnsForUser(ctx context.Context, userID string) ([]Return, error) {
	return d.listReturns(ctx, `where r.user_id = $1`, userID)
}

func (d *DB) AdminReturns(ctx context.Context) ([]Return, error) {
	return d.listReturns(ctx, ``)
}

// CreateReturn: pedido da própria cliente, entregue, dentro dos 7 dias, e
// sem outra troca em aberto para o mesmo pedido.
func (d *DB) CreateReturn(ctx context.Context, userID, orderID, kind, reason string, now time.Time) (string, error) {
	var deliveredAt *time.Time
	var status string
	err := d.pool.QueryRow(ctx, `select status, delivered_at from orders where id = $1 and user_id = $2`,
		orderID, userID).Scan(&status, &deliveredAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotAllowed
	}
	if err != nil {
		return "", err
	}
	if status != string(dominio.Delivered) || deliveredAt == nil || !dominio.ReturnWindowOpen(*deliveredAt, now) {
		return "", ErrNotAllowed
	}
	var id string
	err = d.pool.QueryRow(ctx, `
		insert into returns (order_id, user_id, kind, reason)
		select $1, $2, $3, $4
		where not exists (select 1 from returns where order_id = $1 and stage not in ('done','rejected'))
		returning id::text`, orderID, userID, kind, reason).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrDuplicate
	}
	return id, err
}

// AdvanceReturn move a troca de etapa, só se ela ainda estiver em `from`.
func (d *DB) AdvanceReturn(ctx context.Context, id string, from, to dominio.ReturnStage, note string) (*Return, error) {
	tag, err := d.pool.Exec(ctx, `
		update returns set stage = $3, admin_note = coalesce(nullif($4, ''), admin_note), updated_at = now()
		where id = $1 and stage = $2`, id, from, to, note)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, nil
	}
	var r Return
	err = scanReturn(d.pool.QueryRow(ctx, `select `+returnColumns+`
		from returns r join orders o on o.id = r.order_id where r.id = $1`, id), &r)
	return &r, err
}

// ---------------------------------------------------------------------------
// Vitrine e avisos do topo
// ---------------------------------------------------------------------------

// ShowcaseLimits: quantas peças cabem em cada espaço da home.
var ShowcaseLimits = map[string]int{"queridinhas": 8, "lancamentos": 6, "presentes": 6}

// ShowcaseIDs devolve, por espaço, os ids das peças escolhidas, na ordem.
// Peça despublicada fica de fora da loja (mas continua na escolha do painel).
func (d *DB) ShowcaseIDs(ctx context.Context, onlyPublished bool) (map[string][]string, error) {
	rows, err := d.pool.Query(ctx, `
		select s.slot, s.product_id::text from showcase_items s
		join products p on p.id = s.product_id
		where not $1 or p.published
		order by s.slot, s.position`, onlyPublished)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string][]string{"queridinhas": {}, "lancamentos": {}, "presentes": {}}
	for rows.Next() {
		var slot, id string
		if err := rows.Scan(&slot, &id); err != nil {
			return nil, err
		}
		out[slot] = append(out[slot], id)
	}
	return out, rows.Err()
}

func (d *DB) ProductsByIDs(ctx context.Context, ids []string) ([]CatalogProduct, error) {
	out := []CatalogProduct{}
	for _, id := range ids {
		p, err := d.productByID(ctx, id)
		if err != nil {
			return nil, err
		}
		if p != nil {
			out = append(out, *p)
		}
	}
	availableFirst(out)
	return out, nil
}

// SetShowcase troca a lista inteira de um espaço, na ordem dada.
func (d *DB) SetShowcase(ctx context.Context, slot string, ids []string) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `delete from showcase_items where slot = $1`, slot); err != nil {
		return err
	}
	for i, id := range ids {
		if _, err := tx.Exec(ctx, `insert into showcase_items (slot, product_id, position) values ($1, $2, $3)`,
			slot, id, i); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

type Announcement struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	Position int    `json:"position"`
	Active   bool   `json:"active"`
}

func (d *DB) Announcements(ctx context.Context, onlyActive bool) ([]Announcement, error) {
	rows, err := d.pool.Query(ctx, `
		select id::text, text, position, active from announcements
		where not $1 or active order by position, created_at`, onlyActive)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Announcement{}
	for rows.Next() {
		var a Announcement
		if err := rows.Scan(&a.ID, &a.Text, &a.Position, &a.Active); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// SetAnnouncements substitui a lista inteira (texto, ordem e ativo) — o
// painel edita a faixa como um todo.
func (d *DB) SetAnnouncements(ctx context.Context, list []Announcement) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `delete from announcements`); err != nil {
		return err
	}
	for i, a := range list {
		if _, err := tx.Exec(ctx, `insert into announcements (text, position, active) values ($1, $2, $3)`,
			strings.TrimSpace(a.Text), i, a.Active); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Sacola salva (carrinho abandonado)
// ---------------------------------------------------------------------------

type CartLine struct {
	ProductID string `json:"product_id"`
	Size      string `json:"size"`
	Quantity  int    `json:"quantity"`
}

// SaveCart guarda a sacola da cliente logada. Mudou a sacola, o aviso de
// carrinho abandonado volta a valer (notified_at zera).
func (d *DB) SaveCart(ctx context.Context, userID string, lines []CartLine) error {
	if len(lines) == 0 {
		_, err := d.pool.Exec(ctx, `delete from carts where user_id = $1`, userID)
		return err
	}
	raw, err := json.Marshal(lines)
	if err != nil {
		return err
	}
	_, err = d.pool.Exec(ctx, `
		insert into carts (user_id, items, updated_at) values ($1, $2, now())
		on conflict (user_id) do update set items = excluded.items, updated_at = now(), notified_at = null
		where carts.items is distinct from excluded.items`, userID, raw)
	return err
}

// ---------------------------------------------------------------------------
// Automações
// ---------------------------------------------------------------------------

type AutomationStatus struct {
	Key     string `json:"key"`
	Enabled bool   `json:"enabled"`
	Sent    int    `json:"sent"`
	Pending int    `json:"pending"`
}

func (d *DB) AutomationEnabled(ctx context.Context, key string) bool {
	var on bool
	if err := d.pool.QueryRow(ctx, `select enabled from automation_settings where key = $1`, key).Scan(&on); err != nil {
		return false
	}
	return on
}

func (d *DB) SetAutomation(ctx context.Context, key string, enabled bool) (bool, error) {
	tag, err := d.pool.Exec(ctx, `update automation_settings set enabled = $2 where key = $1`, key, enabled)
	return tag.RowsAffected() > 0, err
}

func (d *DB) AutomationStatuses(ctx context.Context) ([]AutomationStatus, error) {
	out := []AutomationStatus{}
	rows, err := d.pool.Query(ctx, `select key, enabled from automation_settings order by key`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var a AutomationStatus
		if err := rows.Scan(&a.Key, &a.Enabled); err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, a)
	}
	rows.Close()
	contagens := map[string]string{
		"payment_reminder": `select count(*) filter (where reminder_sent_at is not null), 0 from orders`,
		"abandoned_cart":   `select count(*) filter (where notified_at is not null), count(*) filter (where notified_at is null) from carts`,
		"review_request":   `select count(*) filter (where review_request_sent_at is not null), 0 from orders`,
		"stock_alert":      `select count(*) filter (where notified_at is not null), count(*) filter (where notified_at is null) from stock_alerts`,
		"return_update":    `select count(*) filter (where stage <> 'requested'), 0 from returns`,
	}
	for i := range out {
		if q, ok := contagens[out[i].Key]; ok {
			_ = d.pool.QueryRow(ctx, q).Scan(&out[i].Sent, &out[i].Pending)
		}
	}
	return out, rows.Err()
}

// Cada fila devolve o que deve ser avisado agora e marca como avisado na
// mesma consulta (update … returning): duas execuções seguidas da tarefa
// nunca mandam o mesmo e-mail duas vezes.

type PendingNotice struct {
	OrderID string
	Number  int
	Name    string
	Email   string
	Total   dominio.Cents
	Product string
	Slug    string
}

// DuePaymentReminders: pedidos aguardando pagamento entre 24h e 72h.
func (d *DB) DuePaymentReminders(ctx context.Context) ([]PendingNotice, error) {
	return d.notices(ctx, `
		update orders set reminder_sent_at = now()
		where status = 'awaiting_payment' and reminder_sent_at is null
		  and created_at < now() - interval '24 hours' and created_at > now() - interval '72 hours'
		returning id::text, number, customer_name, customer_email, total_cents, '', ''`)
}

// DueReviewRequests: entregues há 7 a 30 dias, sem pedido de avaliação ainda.
func (d *DB) DueReviewRequests(ctx context.Context) ([]PendingNotice, error) {
	return d.notices(ctx, `
		update orders set review_request_sent_at = now()
		where status = 'delivered' and review_request_sent_at is null
		  and delivered_at < now() - interval '7 days' and delivered_at > now() - interval '30 days'
		returning id::text, number, customer_name, customer_email, total_cents, '', ''`)
}

// DueAbandonedCarts: sacola parada há mais de 1h, sem pedido criado depois.
func (d *DB) DueAbandonedCarts(ctx context.Context) ([]PendingNotice, error) {
	return d.notices(ctx, `
		update carts c set notified_at = now()
		from users u
		where u.id = c.user_id and c.notified_at is null
		  and c.updated_at < now() - interval '1 hour' and c.updated_at > now() - interval '7 days'
		  and jsonb_array_length(c.items) > 0
		  and not exists (select 1 from orders o where o.user_id = c.user_id and o.created_at > c.updated_at)
		returning '', 0, u.name, u.email, 0, '', ''`)
}

// DueStockAlerts: avise-me de peça que voltou a ficar disponível.
func (d *DB) DueStockAlerts(ctx context.Context) ([]PendingNotice, error) {
	return d.notices(ctx, `
		update stock_alerts a set notified_at = now()
		from products p join supplier_products sp on sp.id = p.supplier_product_id
		where p.id = a.product_id and a.notified_at is null and p.published and sp.available
		returning '', 0, '', a.email, 0, p.name, p.slug`)
}

func (d *DB) notices(ctx context.Context, sql string, args ...any) ([]PendingNotice, error) {
	rows, err := d.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PendingNotice{}
	for rows.Next() {
		var n PendingNotice
		if err := rows.Scan(&n.OrderID, &n.Number, &n.Name, &n.Email, &n.Total, &n.Product, &n.Slug); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Página do produto: venda real da semana e kit "compre junto"
// ---------------------------------------------------------------------------

type ProductKit struct {
	Partner CatalogProduct `json:"partner"`
	Pct     int            `json:"pct"`
}

// ProductExtras: unidades vendidas nos últimos 7 dias (pedidos pagos que
// contam — dado real, decisão 28) e o kit ativo da peça, se houver.
func (d *DB) ProductExtras(ctx context.Context, slug string) (soldWeek int, kit *ProductKit, err error) {
	var productID string
	err = d.pool.QueryRow(ctx, `
		select p.id::text,
		       coalesce((select sum(i.quantity) from order_items i join orders o on o.id = i.order_id
		                 where i.product_id = p.id and o.paid_at > now() - interval '7 days'
		                   and o.status in `+revenueStatuses+`), 0)::int
		from products p where p.slug = $1 and p.published`, slug).Scan(&productID, &soldWeek)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, nil
	}
	if err != nil {
		return 0, nil, err
	}
	var partnerID string
	var pct int
	err = d.pool.QueryRow(ctx, `
		select case when k.product_a = $1 then k.product_b else k.product_a end::text, k.pct
		from kits k
		join products p on p.id = case when k.product_a = $1 then k.product_b else k.product_a end
		left join supplier_products sp on sp.id = p.supplier_product_id
		where k.active and (k.product_a = $1 or k.product_b = $1)
		  and p.published and coalesce(sp.available, true)
		order by k.pct desc limit 1`, productID).Scan(&partnerID, &pct)
	if errors.Is(err, pgx.ErrNoRows) {
		return soldWeek, nil, nil
	}
	if err != nil {
		return 0, nil, err
	}
	partner, err := d.productByID(ctx, partnerID)
	if err != nil || partner == nil {
		return soldWeek, nil, err
	}
	return soldWeek, &ProductKit{Partner: *partner, Pct: pct}, nil
}

// RecommendShare: % das avaliações aprovadas com nota 4 ou 5 (dado real).
func RecommendShare(list []PublicReview) int {
	if len(list) == 0 {
		return 0
	}
	n := 0
	for _, r := range list {
		if r.Rating >= 4 {
			n++
		}
	}
	return int(math.Round(float64(n) * 100 / float64(len(list))))
}

type RecentReview struct {
	PublicReview
	ProductName string `json:"product_name"`
	ProductSlug string `json:"product_slug"`
}

// RecentReviews: avaliações aprovadas mais recentes da loja toda (home,
// "Quem usa, ama"). Só dado real e aprovado (decisão 28).
func (d *DB) RecentReviews(ctx context.Context, limit int) ([]RecentReview, error) {
	rows, err := d.pool.Query(ctx, `
		select coalesce(nullif(pf.name, ''), u.name), r.rating, r.text, r.created_at, p.name, p.slug
		from reviews r
		join products p on p.id = r.product_id and p.published
		join users u on u.id = r.user_id
		left join profiles pf on pf.id = u.id
		where r.status = 'approved' and r.text <> ''
		order by r.created_at desc limit $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RecentReview{}
	for rows.Next() {
		var r RecentReview
		var nome string
		if err := rows.Scan(&nome, &r.Rating, &r.Text, &r.CreatedAt, &r.ProductName, &r.ProductSlug); err != nil {
			return nil, err
		}
		r.Author = shortName(nome)
		out = append(out, r)
	}
	return out, rows.Err()
}
