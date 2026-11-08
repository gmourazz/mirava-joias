package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/mirava/api/internal/dominio"
)

// Cupons e Mirava Club — o lado do banco. As regras (desconto, teto, pontos
// por real) moram em dominio/descontos.go.

// couponUsesSQL: usos contam em pedido que não foi cancelado nem estornado —
// inclusive o aguardando pagamento, para o limite não estourar com vários
// checkouts abertos.
const couponUsesSQL = `
	select count(*) from orders
	where coupon_code = $1 and status not in ('cancelled','refunded')`

// pointsBalanceSQL: saldo derivado dos pedidos, sem livro-caixa separado.
// Ganho = pontos de pedidos ENTREGUES; gasto = pontos usados em pedidos que
// não foram cancelados nem estornados (cancelou, os pontos voltam sozinhos).
// Devolve (saldo, total já ganho) — o ganho define o nível.
const pointsBalanceSQL = `
	select
	  coalesce((select sum(points_earned) from orders where user_id = $1 and status = 'delivered'), 0)
	  - coalesce((select sum(points_used) from orders where user_id = $1 and status not in ('cancelled','refunded')), 0),
	  coalesce((select sum(points_earned) from orders where user_id = $1 and status = 'delivered'), 0)`

func (d *DB) PointsBalance(ctx context.Context, userID string) (balance, earned int, err error) {
	err = d.pool.QueryRow(ctx, pointsBalanceSQL, userID).Scan(&balance, &earned)
	return balance, earned, err
}

// CouponByCode devolve o cupom e quantas vezes já foi usado; nil se não existe.
func (d *DB) CouponByCode(ctx context.Context, code string) (*dominio.Coupon, int, error) {
	var c dominio.Coupon
	var kind string
	err := d.pool.QueryRow(ctx, `
		select code, kind, value, min_subtotal_cents, starts_at, ends_at, max_uses, active,
		       first_order_only, once_per_customer
		from coupons where code = $1`, code).
		Scan(&c.Code, &kind, &c.Value, &c.MinSubtotal, &c.StartsAt, &c.EndsAt, &c.MaxUses, &c.Active,
			&c.FirstOrderOnly, &c.OncePerCustomer)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, nil
	}
	if err != nil {
		return nil, 0, err
	}
	c.Kind = dominio.CouponKind(kind)
	var uses int
	err = d.pool.QueryRow(ctx, couponUsesSQL, code).Scan(&uses)
	return &c, uses, err
}

// ClubEntry é uma linha do extrato de pontos na conta da cliente.
type ClubEntry struct {
	OrderID     string    `json:"order_id"`
	OrderNumber int       `json:"order_number"`
	Earned      int       `json:"earned"`
	Used        int       `json:"used"`
	Status      string    `json:"status"`
	Date        time.Time `json:"date"`
}

// ClubStatement: pedidos da cliente que ganharam ou usaram pontos.
func (d *DB) ClubStatement(ctx context.Context, userID string) ([]ClubEntry, error) {
	rows, err := d.pool.Query(ctx, `
		select id::text, number,
		       case when status = 'delivered' then points_earned else 0 end,
		       case when status in ('cancelled','refunded') then 0 else points_used end,
		       status, coalesce(delivered_at, paid_at, created_at)
		from orders
		where user_id = $1 and (points_earned > 0 or points_used > 0)
		order by created_at desc limit 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ClubEntry{}
	for rows.Next() {
		var e ClubEntry
		if err := rows.Scan(&e.OrderID, &e.OrderNumber, &e.Earned, &e.Used, &e.Status, &e.Date); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Cupons no painel
// ---------------------------------------------------------------------------

type AdminCoupon struct {
	Code        string     `json:"code"`
	Kind        string     `json:"kind"`
	Value       int        `json:"value"`
	MinSubtotal int        `json:"min_subtotal_cents"`
	StartsAt    *time.Time `json:"starts_at"`
	EndsAt      *time.Time `json:"ends_at"`
	MaxUses     int        `json:"max_uses"`
	Active      bool       `json:"active"`
	Description *string    `json:"description"`
	Uses        int        `json:"uses"`
	Discounted  int        `json:"discounted_cents"` // quanto o cupom já deu de desconto
	CreatedAt   time.Time  `json:"created_at"`
}

func (d *DB) AdminCoupons(ctx context.Context) ([]AdminCoupon, error) {
	rows, err := d.pool.Query(ctx, `
		select c.code, c.kind, c.value, c.min_subtotal_cents, c.starts_at, c.ends_at,
		       c.max_uses, c.active, c.description, c.created_at,
		       count(o.id)::int, coalesce(sum(o.discount_cents), 0)::int
		from coupons c
		left join orders o on o.coupon_code = c.code and o.status not in ('cancelled','refunded')
		group by c.code
		order by c.active desc, c.created_at desc`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminCoupon{}
	for rows.Next() {
		var c AdminCoupon
		if err := rows.Scan(&c.Code, &c.Kind, &c.Value, &c.MinSubtotal, &c.StartsAt, &c.EndsAt,
			&c.MaxUses, &c.Active, &c.Description, &c.CreatedAt, &c.Uses, &c.Discounted); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (d *DB) CreateCoupon(ctx context.Context, c dominio.Coupon, description string) error {
	_, err := d.pool.Exec(ctx, `
		insert into coupons (code, kind, value, min_subtotal_cents, starts_at, ends_at, max_uses, active, description)
		values ($1, $2, $3, $4, $5, $6, $7, true, nullif($8, ''))`,
		dominio.NormalizeCouponCode(c.Code), string(c.Kind), c.Value, c.MinSubtotal,
		c.StartsAt, c.EndsAt, c.MaxUses, description)
	if isDuplicate(err) {
		return ErrDuplicate
	}
	return err
}

func (d *DB) SetCouponActive(ctx context.Context, code string, active bool) (bool, error) {
	tag, err := d.pool.Exec(ctx, `update coupons set active = $2 where code = $1`, code, active)
	return tag.RowsAffected() > 0, err
}

// querier é o que pgxpool.Pool e pgx.Tx têm em comum para uma consulta só.
type querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// customerCouponContext: quantos pedidos pagos a cliente já tem e se ela já
// usou o cupom num pedido pago que conta (não cancelado nem estornado). Pedido
// esperando pagamento não gasta o cupom: quem desiste no Mercado Pago ou tem o
// pagamento recusado precisa poder tentar de novo.
func customerCouponContext(ctx context.Context, q querier, userID, code string) (prior int, used bool, err error) {
	err = q.QueryRow(ctx, `
		select count(*) filter (where paid_at is not null and status not in ('cancelled','refunded')),
		       coalesce(bool_or(coupon_code = $2 and paid_at is not null and status not in ('cancelled','refunded')), false)
		from orders where user_id = $1`, userID, code).Scan(&prior, &used)
	return
}

// CouponContextFor é a mesma conta, para a prévia do checkout.
func (d *DB) CouponContextFor(ctx context.Context, userID, code string) (dominio.CouponContext, error) {
	prior, used, err := customerCouponContext(ctx, d.pool, userID, code)
	return dominio.CouponContext{PriorPaidOrders: prior, UsedByCustomer: used}, err
}

// ActiveKits: kits ativos em que as duas peças estão entre as dadas.
func (d *DB) ActiveKits(ctx context.Context, productIDs []string) ([]dominio.Kit, error) {
	rows, err := d.pool.Query(ctx, `
		select product_a::text, product_b::text, pct from kits
		where active and product_a = any($1::uuid[]) and product_b = any($1::uuid[])
		order by pct desc, created_at`, productIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dominio.Kit
	for rows.Next() {
		var k dominio.Kit
		if err := rows.Scan(&k.A, &k.B, &k.Pct); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}
