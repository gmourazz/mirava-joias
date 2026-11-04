package db

// Configurações da loja, categorias, promoções, kits, banners, galeria,
// novidades, anotações de cliente e recuperação de senha (design v5 completo,
// decisões 21, 27 e 32 a 35).

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/mirava/api/internal/dominio"
)

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

type StoreSettings struct {
	DefaultMarkupPct   float64 `json:"default_markup_pct"`
	RoundTo90          bool    `json:"round_to_90"`
	MinMarginPct       float64 `json:"min_margin_pct"`
	OutOfStockAction   string  `json:"out_of_stock_action"` // show | hide
	SyncEveryHours     int     `json:"sync_every_hours"`
	AutoImport         bool    `json:"auto_import"`
	SyncImages         bool    `json:"sync_images"`
	SyncDescriptions   bool    `json:"sync_descriptions"`
	StoreName          string  `json:"store_name"`
	StoreEmail         string  `json:"store_email"`
	StoreInstagram     string  `json:"store_instagram"`
	SenderName         string  `json:"sender_name"`
	SenderStreet       string  `json:"sender_street"`
	SenderNumber       string  `json:"sender_number"`
	SenderComplement   string  `json:"sender_complement"`
	SenderNeighborhood string  `json:"sender_neighborhood"`
	SenderCity         string  `json:"sender_city"`
	SenderState        string  `json:"sender_state"`
	SenderZip          string  `json:"sender_zip"`
	GoalRevenue        int     `json:"goal_revenue_cents"`
	GoalOrders         int     `json:"goal_orders"`
	GoalProfit         int     `json:"goal_profit_cents"`
	GiftWrapCost       int     `json:"gift_wrap_cost_cents"`
}

const settingsColumns = `default_markup_pct::float8, round_to_90, min_margin_pct::float8,
	out_of_stock_action, sync_every_hours, auto_import, sync_images, sync_descriptions,
	store_name, store_email, store_instagram,
	coalesce(sender_name,''), coalesce(sender_street,''), coalesce(sender_number,''),
	coalesce(sender_complement,''), coalesce(sender_neighborhood,''), coalesce(sender_city,''),
	coalesce(sender_state,''), coalesce(sender_zip,''),
	goal_revenue_cents, goal_orders, goal_profit_cents, gift_wrap_cost_cents`

func (d *DB) Settings(ctx context.Context) (StoreSettings, error) {
	var s StoreSettings
	err := d.pool.QueryRow(ctx, `select `+settingsColumns+` from store_settings limit 1`).Scan(
		&s.DefaultMarkupPct, &s.RoundTo90, &s.MinMarginPct, &s.OutOfStockAction, &s.SyncEveryHours,
		&s.AutoImport, &s.SyncImages, &s.SyncDescriptions, &s.StoreName, &s.StoreEmail, &s.StoreInstagram,
		&s.SenderName, &s.SenderStreet, &s.SenderNumber, &s.SenderComplement, &s.SenderNeighborhood,
		&s.SenderCity, &s.SenderState, &s.SenderZip, &s.GoalRevenue, &s.GoalOrders, &s.GoalProfit, &s.GiftWrapCost)
	return s, err
}

// SaveSettings grava tudo. Quem valida (faixa do markup, UF) é o handler; o
// banco ainda tem os CHECKs como segunda trava.
func (d *DB) SaveSettings(ctx context.Context, s StoreSettings) error {
	_, err := d.pool.Exec(ctx, `
		update store_settings set
			default_markup_pct = $1, round_to_90 = $2, min_margin_pct = $3,
			out_of_stock_action = $4, sync_every_hours = $5, auto_import = $6,
			sync_images = $7, sync_descriptions = $8, store_name = $9, store_email = $10,
			store_instagram = $11, sender_name = nullif($12,''), sender_street = nullif($13,''),
			sender_number = nullif($14,''), sender_complement = nullif($15,''),
			sender_neighborhood = nullif($16,''), sender_city = nullif($17,''),
			sender_state = nullif($18,''), sender_zip = nullif($19,''),
			goal_revenue_cents = $20, goal_orders = $21, goal_profit_cents = $22,
			gift_wrap_cost_cents = $23, updated_at = now()`,
		s.DefaultMarkupPct, s.RoundTo90, s.MinMarginPct, s.OutOfStockAction, s.SyncEveryHours,
		s.AutoImport, s.SyncImages, s.SyncDescriptions, s.StoreName, s.StoreEmail, s.StoreInstagram,
		s.SenderName, s.SenderStreet, s.SenderNumber, s.SenderComplement, s.SenderNeighborhood,
		s.SenderCity, s.SenderState, s.SenderZip, s.GoalRevenue, s.GoalOrders, s.GoalProfit, s.GiftWrapCost)
	return err
}

// RecalculatePrices reaplica o markup em camadas (e o ,90) em todas as peças
// de preço automático. É ação explícita da dona ("salvar regras e recalcular
// preços"), por isso não passa pelo disjuntor — o disjuntor protege contra a
// Lilly, não contra a própria dona. Devolve quantas peças mudaram de preço.
func (d *DB) RecalculatePrices(ctx context.Context) (int64, error) {
	tag, err := d.pool.Exec(ctx, `
		update products p set
			price_cents = public.price_from_cost(p.cost_cents, public.effective_markup(p.markup_pct, p.category)),
			suggested_price_cents = null, suggestion_reason = null
		where p.auto_price and p.cost_cents > 0
		  and p.price_cents <> public.price_from_cost(p.cost_cents, public.effective_markup(p.markup_pct, p.category))`)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// ---------------------------------------------------------------------------
// Categorias e mapeamento da Lilly
// ---------------------------------------------------------------------------

type Category struct {
	Slug      string   `json:"slug"`
	Label     string   `json:"label"`
	Position  int      `json:"position"`
	MarkupPct *float64 `json:"markup_pct"`
	Count     int      `json:"count"` // peças publicadas (loja) ou todas (painel)
}

// Categories em ordem do menu. onlyPublished conta só peças no ar (loja).
func (d *DB) Categories(ctx context.Context, onlyPublished bool) ([]Category, error) {
	rows, err := d.pool.Query(ctx, `
		select c.slug, c.label, c.position, c.markup_pct::float8,
		       (select count(*) from products p where p.category = c.slug and (not $1 or p.published))::int
		from categories c order by c.position, c.label`, onlyPublished)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Category{}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.Slug, &c.Label, &c.Position, &c.MarkupPct, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (d *DB) CreateCategory(ctx context.Context, slug, label string) error {
	_, err := d.pool.Exec(ctx, `
		insert into categories (slug, label, position)
		values ($1, $2, coalesce((select max(position) from categories), 0) + 1)`, slug, label)
	if isDuplicate(err) {
		return ErrDuplicate
	}
	return err
}

// UpdateCategory troca rótulo, posição e markup da categoria. O slug não
// muda aqui: ele é URL e chave de imagem.
func (d *DB) UpdateCategory(ctx context.Context, slug, label string, position int, markup *float64) (bool, error) {
	tag, err := d.pool.Exec(ctx, `
		update categories set label = $2, position = $3, markup_pct = $4 where slug = $1`,
		slug, label, position, markup)
	return tag.RowsAffected() > 0, err
}

// DeleteCategory só apaga categoria sem peça (o design pede isso, e a FK
// recusaria de qualquer jeito).
func (d *DB) DeleteCategory(ctx context.Context, slug string) error {
	tag, err := d.pool.Exec(ctx, `
		delete from categories c where c.slug = $1 and c.slug <> 'outros'
		and not exists (select 1 from products p where p.category = c.slug)`, slug)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotAllowed
	}
	return nil
}

type CategoryMapping struct {
	Keyword  string `json:"keyword"`
	Category string `json:"category"`
}

func (d *DB) CategoryMappings(ctx context.Context) ([]CategoryMapping, error) {
	rows, err := d.pool.Query(ctx, `select keyword, category from category_mappings order by position, keyword`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CategoryMapping{}
	for rows.Next() {
		var m CategoryMapping
		if err := rows.Scan(&m.Keyword, &m.Category); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// SetCategoryMappings troca a lista inteira, na ordem dada (a ordem decide
// quando o nome casa com mais de uma palavra).
func (d *DB) SetCategoryMappings(ctx context.Context, list []CategoryMapping) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `delete from category_mappings`); err != nil {
		return err
	}
	for i, m := range list {
		if _, err := tx.Exec(ctx, `insert into category_mappings (keyword, category, position) values ($1, $2, $3)`,
			m.Keyword, m.Category, i); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Promoções e kits (decisão 32)
// ---------------------------------------------------------------------------

type Promotion struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Pct        int       `json:"pct"`
	Scope      string    `json:"scope"` // all | category | products
	Category   *string   `json:"category"`
	ProductIDs []string  `json:"product_ids"`
	StartsAt   time.Time `json:"starts_at"`
	EndsAt     time.Time `json:"ends_at"`
	Products   int       `json:"products"` // peças publicadas que a promoção alcança
}

func (d *DB) Promotions(ctx context.Context) ([]Promotion, error) {
	rows, err := d.pool.Query(ctx, `
		select pr.id::text, pr.name, pr.pct, pr.scope, pr.category,
		       coalesce(array(select unnest(pr.product_ids)::text), '{}'), pr.starts_at, pr.ends_at,
		       (select count(*) from products p where p.published and (pr.scope = 'all'
		          or (pr.scope = 'category' and p.category = pr.category)
		          or (pr.scope = 'products' and p.id = any(pr.product_ids))))::int
		from promotions pr order by pr.starts_at desc`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Promotion{}
	for rows.Next() {
		var p Promotion
		if err := rows.Scan(&p.ID, &p.Name, &p.Pct, &p.Scope, &p.Category, &p.ProductIDs,
			&p.StartsAt, &p.EndsAt, &p.Products); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (d *DB) CreatePromotion(ctx context.Context, p Promotion) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
		insert into promotions (name, pct, scope, category, product_ids, starts_at, ends_at)
		values ($1, $2, $3, $4, $5::uuid[], $6, $7) returning id::text`,
		p.Name, p.Pct, p.Scope, p.Category, p.ProductIDs, p.StartsAt, p.EndsAt).Scan(&id)
	return id, err
}

func (d *DB) DeletePromotion(ctx context.Context, id string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `delete from promotions where id = $1`, id)
	return tag.RowsAffected() > 0, err
}

type AdminKit struct {
	ID     string `json:"id"`
	A      string `json:"product_a"`
	B      string `json:"product_b"`
	NameA  string `json:"name_a"`
	NameB  string `json:"name_b"`
	PriceA int    `json:"price_a_cents"`
	PriceB int    `json:"price_b_cents"`
	Pct    int    `json:"pct"`
	Active bool   `json:"active"`
}

func (d *DB) Kits(ctx context.Context) ([]AdminKit, error) {
	rows, err := d.pool.Query(ctx, `
		select k.id::text, k.product_a::text, k.product_b::text, a.name, b.name,
		       a.price_cents, b.price_cents, k.pct, k.active
		from kits k join products a on a.id = k.product_a join products b on b.id = k.product_b
		order by k.created_at desc`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminKit{}
	for rows.Next() {
		var k AdminKit
		if err := rows.Scan(&k.ID, &k.A, &k.B, &k.NameA, &k.NameB, &k.PriceA, &k.PriceB, &k.Pct, &k.Active); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func (d *DB) CreateKit(ctx context.Context, a, b string, pct int) error {
	_, err := d.pool.Exec(ctx, `insert into kits (product_a, product_b, pct) values ($1, $2, $3)`, a, b, pct)
	if isDuplicate(err) {
		return ErrDuplicate
	}
	return err
}

func (d *DB) SetKitActive(ctx context.Context, id string, active bool) (bool, error) {
	tag, err := d.pool.Exec(ctx, `update kits set active = $2 where id = $1`, id, active)
	return tag.RowsAffected() > 0, err
}

func (d *DB) DeleteKit(ctx context.Context, id string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `delete from kits where id = $1`, id)
	return tag.RowsAffected() > 0, err
}

// ---------------------------------------------------------------------------
// Banners da home e galeria (decisão 35)
// ---------------------------------------------------------------------------

type Banner struct {
	ID       string  `json:"id,omitempty"`
	Eyebrow  string  `json:"eyebrow"`
	Title    string  `json:"title"`
	Subtitle string  `json:"subtitle"`
	CTALabel string  `json:"cta_label"`
	CTAURL   string  `json:"cta_url"`
	Image    *string `json:"image"`
	Active   bool    `json:"active"`
}

func (d *DB) Banners(ctx context.Context, onlyActive bool) ([]Banner, error) {
	rows, err := d.pool.Query(ctx, `
		select id::text, eyebrow, title, subtitle, cta_label, cta_url, image, active
		from banners where not $1 or active order by position, created_at`, onlyActive)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Banner{}
	for rows.Next() {
		var b Banner
		if err := rows.Scan(&b.ID, &b.Eyebrow, &b.Title, &b.Subtitle, &b.CTALabel, &b.CTAURL, &b.Image, &b.Active); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// SetBanners troca a lista inteira, na ordem dada.
func (d *DB) SetBanners(ctx context.Context, list []Banner) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `delete from banners`); err != nil {
		return err
	}
	for i, b := range list {
		if _, err := tx.Exec(ctx, `
			insert into banners (eyebrow, title, subtitle, cta_label, cta_url, image, position, active)
			values ($1, $2, $3, $4, $5, $6, $7, $8)`,
			b.Eyebrow, b.Title, b.Subtitle, b.CTALabel, b.CTAURL, b.Image, i, b.Active); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

type GalleryImage struct {
	ID      string  `json:"id,omitempty"`
	Image   string  `json:"image"`
	Link    *string `json:"link"`
	Caption *string `json:"caption"`
}

func (d *DB) Gallery(ctx context.Context) ([]GalleryImage, error) {
	rows, err := d.pool.Query(ctx, `select id::text, image, link, caption from gallery_images order by position, created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []GalleryImage{}
	for rows.Next() {
		var g GalleryImage
		if err := rows.Scan(&g.ID, &g.Image, &g.Link, &g.Caption); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (d *DB) SetGallery(ctx context.Context, list []GalleryImage) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `delete from gallery_images`); err != nil {
		return err
	}
	for i, g := range list {
		if _, err := tx.Exec(ctx, `insert into gallery_images (image, link, caption, position) values ($1, $2, $3, $4)`,
			g.Image, g.Link, g.Caption, i); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Novidades (decisão 34)
// ---------------------------------------------------------------------------

// Subscribe guarda o e-mail (e o WhatsApp, se veio). Devolve created=false
// quando o e-mail já estava cadastrado — o cupom de boas-vindas não sai de
// novo, mas a resposta para a cliente é a mesma.
func (d *DB) Subscribe(ctx context.Context, email, whatsapp, source string, userID *string) (created bool, err error) {
	err = d.pool.QueryRow(ctx, `
		insert into subscribers (email, whatsapp, source, user_id)
		values ($1, nullif($2,''), $3, $4)
		on conflict (lower(email)) do update set
			whatsapp = coalesce(excluded.whatsapp, subscribers.whatsapp),
			unsubscribed_at = null
		returning (xmax = 0)`, email, whatsapp, source, userID).Scan(&created)
	return created, err
}

type Subscriber struct {
	Email     string    `json:"email"`
	WhatsApp  *string   `json:"whatsapp"`
	Source    string    `json:"source"`
	CreatedAt time.Time `json:"created_at"`
}

func (d *DB) Subscribers(ctx context.Context) ([]Subscriber, error) {
	rows, err := d.pool.Query(ctx, `
		select email, whatsapp, source, created_at from subscribers
		where unsubscribed_at is null order by created_at desc limit 2000`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Subscriber{}
	for rows.Next() {
		var s Subscriber
		if err := rows.Scan(&s.Email, &s.WhatsApp, &s.Source, &s.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Cupons da cliente ("Meus cupons" na conta)
// ---------------------------------------------------------------------------

type MyCoupon struct {
	Code        string     `json:"code"`
	Kind        string     `json:"kind"`
	Value       int        `json:"value"`
	MinSubtotal int        `json:"min_subtotal_cents"`
	EndsAt      *time.Time `json:"ends_at"`
	Description *string    `json:"description"`
	Usable      bool       `json:"usable"`
	Reason      string     `json:"reason"`
}

// CouponsForCustomer: cupons públicos ativos e no prazo, com a indicação de
// se ela ainda pode usar (primeira compra, uso único).
func (d *DB) CouponsForCustomer(ctx context.Context, userID string) ([]MyCoupon, error) {
	rows, err := d.pool.Query(ctx, `
		select c.code, c.kind, c.value, c.min_subtotal_cents, c.ends_at, c.description,
		       c.first_order_only, c.once_per_customer
		from coupons c
		where c.public and c.active
		  and (c.starts_at is null or c.starts_at <= now()) and (c.ends_at is null or c.ends_at > now())
		order by c.created_at desc`)
	if err != nil {
		return nil, err
	}
	type linha struct {
		MyCoupon
		first, once bool
	}
	var ls []linha
	for rows.Next() {
		var l linha
		if err := rows.Scan(&l.Code, &l.Kind, &l.Value, &l.MinSubtotal, &l.EndsAt, &l.Description, &l.first, &l.once); err != nil {
			rows.Close()
			return nil, err
		}
		ls = append(ls, l)
	}
	rows.Close()
	out := []MyCoupon{}
	for _, l := range ls {
		cctx, err := d.CouponContextFor(ctx, userID, l.Code)
		if err != nil {
			return nil, err
		}
		c := dominio.Coupon{FirstOrderOnly: l.first, OncePerCustomer: l.once}
		l.Usable = true
		if err := c.Eligible(cctx); err != nil {
			l.Usable, l.Reason = false, err.Error()
		}
		out = append(out, l.MyCoupon)
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Clientes no painel: etiquetas e anotações
// ---------------------------------------------------------------------------

type CustomerNotes struct {
	Tags  []string `json:"tags"`
	Notes string   `json:"notes"`
}

func (d *DB) CustomerNotes(ctx context.Context, userID string) (CustomerNotes, error) {
	n := CustomerNotes{Tags: []string{}}
	err := d.pool.QueryRow(ctx, `select tags, notes from customer_notes where user_id = $1`, userID).Scan(&n.Tags, &n.Notes)
	if errors.Is(err, pgx.ErrNoRows) {
		return n, nil
	}
	return n, err
}

func (d *DB) SaveCustomerNotes(ctx context.Context, userID string, n CustomerNotes) error {
	_, err := d.pool.Exec(ctx, `
		insert into customer_notes (user_id, tags, notes) values ($1, $2, $3)
		on conflict (user_id) do update set tags = excluded.tags, notes = excluded.notes, updated_at = now()`,
		userID, n.Tags, n.Notes)
	return err
}

// UserEmailName: para mandar e-mail a uma cliente pelo painel.
func (d *DB) UserEmailName(ctx context.Context, userID string) (email, name string, err error) {
	err = d.pool.QueryRow(ctx, `
		select u.email, coalesce(nullif(p.name,''), u.name) from users u
		left join profiles p on p.id = u.id where u.id = $1`, userID).Scan(&email, &name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil
	}
	return
}

// ---------------------------------------------------------------------------
// Esqueci minha senha
// ---------------------------------------------------------------------------

// UserIDByEmail: vazio quando não existe — quem chama responde igual nos dois
// casos, para não revelar quem tem conta.
func (d *DB) UserIDByEmail(ctx context.Context, email string) (id, name string, err error) {
	err = d.pool.QueryRow(ctx, `
		select u.id::text, coalesce(nullif(p.name,''), u.name) from users u
		left join profiles p on p.id = u.id where lower(u.email) = lower($1)`, email).Scan(&id, &name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil
	}
	return
}

func (d *DB) CreatePasswordReset(ctx context.Context, userID, tokenHash string, expires time.Time) error {
	_, err := d.pool.Exec(ctx, `insert into password_resets (token_hash, user_id, expires_at) values ($1, $2, $3)`,
		tokenHash, userID, expires)
	return err
}

// UsePasswordReset troca a senha se o token existir, não tiver sido usado e
// não tiver vencido. Marca como usado na mesma transação.
func (d *DB) UsePasswordReset(ctx context.Context, tokenHash, passwordHash string) (bool, error) {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	var userID string
	err = tx.QueryRow(ctx, `
		update password_resets set used_at = now()
		where token_hash = $1 and used_at is null and expires_at > now()
		returning user_id::text`, tokenHash).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `update users set password_hash = $2 where id = $1`, userID, passwordHash); err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Avisos que saíram para a cliente (drawer do pedido)
// ---------------------------------------------------------------------------

type OrderNotice struct {
	Kind    string    `json:"kind"`
	Channel string    `json:"channel"`
	SentAt  time.Time `json:"sent_at"`
}

func (d *DB) LogOrderNotice(ctx context.Context, orderID, kind string) {
	_, _ = d.pool.Exec(ctx, `insert into order_notices (order_id, kind) values ($1, $2)`, orderID, kind)
}

func (d *DB) OrderNotices(ctx context.Context, orderID string) ([]OrderNotice, error) {
	rows, err := d.pool.Query(ctx, `select kind, channel, sent_at from order_notices where order_id = $1 order by sent_at desc`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []OrderNotice{}
	for rows.Next() {
		var n OrderNotice
		if err := rows.Scan(&n.Kind, &n.Channel, &n.SentAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Papéis do painel (decisão 27)
// ---------------------------------------------------------------------------

// AdminRole: "" quando não é admin; "master" ou "dispatch".
func (d *DB) AdminRole(ctx context.Context, userID string) (string, error) {
	var role string
	err := d.pool.QueryRow(ctx, `select role from admins where user_id = $1`, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return role, err
}

type TeamMember struct {
	UserID string `json:"user_id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

func (d *DB) Team(ctx context.Context) ([]TeamMember, error) {
	rows, err := d.pool.Query(ctx, `
		select a.user_id::text, coalesce(nullif(p.name,''), u.name), u.email, a.role
		from admins a join users u on u.id = a.user_id left join profiles p on p.id = u.id
		order by a.created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TeamMember{}
	for rows.Next() {
		var m TeamMember
		if err := rows.Scan(&m.UserID, &m.Name, &m.Email, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// AddTeamMember dá acesso de despacho a uma conta já cadastrada na loja.
// Master só se cria pelo banco (ver db/README.md) — o painel não promove
// ninguém a master.
func (d *DB) AddTeamMember(ctx context.Context, email string) error {
	tag, err := d.pool.Exec(ctx, `
		insert into admins (user_id, role)
		select id, 'dispatch' from users where lower(email) = lower($1)
		on conflict (user_id) do nothing`, email)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotAllowed
	}
	return nil
}

// RemoveTeamMember tira só quem é de despacho.
func (d *DB) RemoveTeamMember(ctx context.Context, userID string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `delete from admins where user_id = $1 and role = 'dispatch'`, userID)
	return tag.RowsAffected() > 0, err
}

// ---------------------------------------------------------------------------
// Fila "novos na Lilly"
// ---------------------------------------------------------------------------

type QueueItem struct {
	ID       string        `json:"id"`
	SKU      string        `json:"sku"`
	Name     string        `json:"name"`
	URL      string        `json:"url"`
	Cost     dominio.Cents `json:"cost_cents"`
	Retail   *int          `json:"retail_cents"`
	Image    *string       `json:"image"`
	Category string        `json:"category"`
	Price    dominio.Cents `json:"price_cents"` // quanto vai custar na loja
}

// SupplierQueue: peças do espelho sem produto na loja, não ignoradas e ainda
// no site da Lilly. `guess` decide a categoria provável (mapeamento).
func (d *DB) SupplierQueue(ctx context.Context, guess func(name string) string) ([]QueueItem, error) {
	rows, err := d.pool.Query(ctx, `
		select sp.id::text, sp.sku, sp.name, sp.url, sp.cost_cents, sp.retail_cents, sp.source_images[1]
		from supplier_products sp
		where sp.ignored_at is null and sp.vanished_at is null
		  and not exists (select 1 from products p where p.supplier_product_id = sp.id)
		order by sp.created_at desc limit 200`)
	if err != nil {
		return nil, err
	}
	out := []QueueItem{}
	for rows.Next() {
		var q QueueItem
		if err := rows.Scan(&q.ID, &q.SKU, &q.Name, &q.URL, &q.Cost, &q.Retail, &q.Image); err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, q)
	}
	rows.Close()
	for i := range out {
		out[i].Category = guess(out[i].Name)
		if p, err := d.priceFor(ctx, out[i].Cost, nil, out[i].Category); err == nil {
			out[i].Price = p
		}
	}
	return out, rows.Err()
}

func (d *DB) IgnoreSupplierProduct(ctx context.Context, id string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `update supplier_products set ignored_at = now() where id = $1 and ignored_at is null`, id)
	return tag.RowsAffected() > 0, err
}

// MirrorForImport: o que a importação manual precisa do espelho.
type MirrorForImport struct {
	SKU, Name, Description string
	Cost                   dominio.Cents
	Available              bool
	Images                 []string
	Rating                 float64
	RatingCount            int
}

func (d *DB) MirrorByID(ctx context.Context, id string) (*MirrorForImport, error) {
	var m MirrorForImport
	err := d.pool.QueryRow(ctx, `
		select sku, name, coalesce(description,''), cost_cents, available, source_images,
		       coalesce(rating, 0)::float8, coalesce(rating_count, 0)
		from supplier_products where id = $1`, id).
		Scan(&m.SKU, &m.Name, &m.Description, &m.Cost, &m.Available, &m.Images, &m.Rating, &m.RatingCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &m, err
}

// LastSyncStarted: quando começou a última leitura (para a frequência
// configurada e o "próxima automática em").
func (d *DB) LastSyncStarted(ctx context.Context) (*time.Time, error) {
	var t *time.Time
	err := d.pool.QueryRow(ctx, `select max(started_at) from syncs`).Scan(&t)
	return t, err
}

// ---------------------------------------------------------------------------
// Automações: texto editável, sacolas e avise-me manual
// ---------------------------------------------------------------------------

type AutomationText struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

func (d *DB) AutomationTexts(ctx context.Context) (map[string]AutomationText, error) {
	rows, err := d.pool.Query(ctx, `select key, coalesce(subject,''), coalesce(body,'') from automation_settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]AutomationText{}
	for rows.Next() {
		var k string
		var t AutomationText
		if err := rows.Scan(&k, &t.Subject, &t.Body); err != nil {
			return nil, err
		}
		out[k] = t
	}
	return out, rows.Err()
}

// SetAutomationText: texto vazio volta para o padrão do código.
func (d *DB) SetAutomationText(ctx context.Context, key string, t AutomationText) (bool, error) {
	tag, err := d.pool.Exec(ctx, `update automation_settings set subject = nullif($2,''), body = nullif($3,'') where key = $1`,
		key, t.Subject, t.Body)
	return tag.RowsAffected() > 0, err
}

type AdminCart struct {
	UserID     string     `json:"user_id"`
	Name       string     `json:"name"`
	Email      string     `json:"email"`
	Items      int        `json:"items"`
	TotalCents int        `json:"total_cents"` // preço atual das peças
	UpdatedAt  time.Time  `json:"updated_at"`
	NotifiedAt *time.Time `json:"notified_at"`
	Recovered  bool       `json:"recovered"` // comprou depois
}

// AdminCarts: sacolas salvas dos últimos 30 dias, com o valor ao preço de hoje.
func (d *DB) AdminCarts(ctx context.Context) ([]AdminCart, error) {
	rows, err := d.pool.Query(ctx, `
		select c.user_id::text, coalesce(nullif(pf.name,''), u.name), u.email,
		       coalesce((select sum((l->>'quantity')::int) from jsonb_array_elements(c.items) l), 0)::int,
		       coalesce((select sum((l->>'quantity')::int * p.price_cents) from jsonb_array_elements(c.items) l
		                 join products p on p.id::text = l->>'product_id'), 0)::int,
		       c.updated_at, c.notified_at,
		       exists (select 1 from orders o where o.user_id = c.user_id and o.created_at > c.updated_at
		               and o.paid_at is not null)
		from carts c join users u on u.id = c.user_id left join profiles pf on pf.id = u.id
		where jsonb_array_length(c.items) > 0 and c.updated_at > now() - interval '30 days'
		order by c.updated_at desc`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminCart{}
	for rows.Next() {
		var c AdminCart
		if err := rows.Scan(&c.UserID, &c.Name, &c.Email, &c.Items, &c.TotalCents, &c.UpdatedAt, &c.NotifiedAt, &c.Recovered); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// MarkCartNotified: lembrete mandado à mão pelo painel. Devolve nome e e-mail.
func (d *DB) MarkCartNotified(ctx context.Context, userID string) (name, email string, err error) {
	err = d.pool.QueryRow(ctx, `
		update carts c set notified_at = now() from users u
		where c.user_id = $1 and u.id = c.user_id and jsonb_array_length(c.items) > 0
		returning u.name, u.email`, userID).Scan(&name, &email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil
	}
	return
}

// StockAlertsNow: avise-me de uma peça, disparado pelo painel. Só quando ela
// está disponível; marca como avisado na mesma consulta.
func (d *DB) StockAlertsNow(ctx context.Context, productID string) ([]PendingNotice, error) {
	return d.notices(ctx, `
		update stock_alerts a set notified_at = now()
		from products p left join supplier_products sp on sp.id = p.supplier_product_id
		where p.id = a.product_id and a.product_id = $1
		  and a.notified_at is null and p.published and coalesce(sp.available, true)
		returning '', 0, '', a.email, 0, p.name, p.slug`, productID)
}

// ---------------------------------------------------------------------------
// Visão geral e financeiro: alertas de estoque, mais vendidos, taxas
// ---------------------------------------------------------------------------

type StockAlertItem struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	SKU     *string `json:"sku"`
	Waiting int     `json:"waiting"` // avise-me esperando
}

// UnavailablePublished: peças no ar que esgotaram na Lilly.
func (d *DB) UnavailablePublished(ctx context.Context) ([]StockAlertItem, error) {
	rows, err := d.pool.Query(ctx, `
		select p.id::text, p.name, sp.sku,
		       (select count(*) from stock_alerts a where a.product_id = p.id and a.notified_at is null)::int
		from products p join supplier_products sp on sp.id = p.supplier_product_id
		where p.published and not sp.available
		order by p.units_sold desc limit 8`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []StockAlertItem{}
	for rows.Next() {
		var a StockAlertItem
		if err := rows.Scan(&a.ID, &a.Name, &a.SKU, &a.Waiting); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

type TopSeller struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Units   int    `json:"units"`
	Revenue int    `json:"revenue_cents"`
}

// TopSellers do mês corrente, em pedidos pagos que contam.
func (d *DB) TopSellers(ctx context.Context) ([]TopSeller, error) {
	rows, err := d.pool.Query(ctx, `
		select coalesce(i.product_id::text, ''), i.name_snapshot, sum(i.quantity)::int,
		       sum(i.unit_price_cents * i.quantity)::int
		from order_items i join orders o on o.id = i.order_id
		where o.paid_at >= date_trunc('month', now()) and o.status in `+revenueStatuses+`
		group by 1, 2 order by 3 desc, 4 desc limit 5`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TopSeller{}
	for rows.Next() {
		var t TopSeller
		if err := rows.Scan(&t.ID, &t.Name, &t.Units, &t.Revenue); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

type FeeByMethod struct {
	Method string `json:"method"` // pix | credit_card | ticket | outro
	Orders int    `json:"orders"`
	Amount int    `json:"amount_cents"`
	Fees   int    `json:"fees_cents"`
}

// FeesByMethod: taxas reais do Mercado Pago no período, por forma de pagamento.
func (d *DB) FeesByMethod(ctx context.Context, start, end time.Time) ([]FeeByMethod, error) {
	rows, err := d.pool.Query(ctx, `
		select case when p.method = 'pix' then 'pix'
		            when p.method in ('bolbradesco','pec') or p.method like '%boleto%' then 'boleto'
		            when p.method is null then 'outro' else 'cartao' end,
		       count(distinct p.order_id)::int, coalesce(sum(p.amount_cents), 0)::int, coalesce(sum(p.fee_cents), 0)::int
		from payments p join orders o on o.id = p.order_id
		where p.status = 'approved' and o.paid_at >= $1 and o.paid_at < $2
		group by 1 order by 3 desc`, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []FeeByMethod{}
	for rows.Next() {
		var f FeeByMethod
		if err := rows.Scan(&f.Method, &f.Orders, &f.Amount, &f.Fees); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}
