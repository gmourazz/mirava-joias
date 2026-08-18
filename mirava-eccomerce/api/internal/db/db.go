// Package db concentra o acesso ao Postgres próprio da Mirava.
//
// Este serviço conecta com credencial de dono do banco, então RLS não se
// aplica aqui — é por isso que TODA consulta que envolve dado de cliente
// filtra por user_id explicitamente. Esquecer esse filtro é o equivalente,
// deste lado, a esquecer uma policy.
package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mirava/api/internal/dominio"
)

var ErrDuplicate = errors.New("registro já existe")

type DB struct{ pool *pgxpool.Pool }

func Connect(ctx context.Context, url string) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	// Cloud Run escala a zero e sobe várias instâncias; o pooler do banco
	// tem limite. Poucas conexões por instância evita esgotá-lo.
	cfg.MaxConns = 5
	cfg.MaxConnIdleTime = 2 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping falhou: %w", err)
	}
	return &DB{pool: pool}, nil
}

func (d *DB) Close() { d.pool.Close() }

func (d *DB) Ping(ctx context.Context) error { return d.pool.Ping(ctx) }

func isDuplicate(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505" // unique_violation
	}
	return false
}

// ---------------------------------------------------------------------------
// Catálogo público — o front lia isso direto do Supabase via supabase-js.
// Agora o front só fala com esta API; select 'published = true' vai
// explícito na query, não depende de RLS (que não existe mais aqui).
// ---------------------------------------------------------------------------

type ProductVariant struct {
	ID              string `json:"id"`
	Size            string `json:"size"`
	PriceAdjustCents int   `json:"price_adjust_cents"`
	Available       bool   `json:"available"`
}

// Review é a avaliação tal como veio da Lilly — nome, data e comentário
// (quando teve). Guardada como jsonb em products.reviews.
type Review struct {
	Author string `json:"author"`
	Date   string `json:"date"`
	Text   string `json:"text"`
}

// unmarshalReviews decodifica o jsonb bruto vindo do banco. Não usamos o
// jsonb->struct automático do driver — o resto do código sempre trata jsonb
// como bytes crus decodificados à mão, então seguimos a mesma convenção
// aqui em vez de confiar num comportamento implícito.
func unmarshalReviews(raw []byte, out *[]Review) error {
	if len(raw) == 0 {
		*out = []Review{}
		return nil
	}
	return json.Unmarshal(raw, out)
}

type CatalogProduct struct {
	ID          string           `json:"id"`
	Slug        string           `json:"slug"`
	Name        string           `json:"name"`
	Description *string          `json:"description"`
	PriceCents  int              `json:"price_cents"`
	Category    string           `json:"category"`
	Metal       string           `json:"metal"`
	Images      []string         `json:"images"`
	Featured    bool             `json:"featured"`
	Rating      *float64         `json:"rating"`
	RatingCount int              `json:"rating_count"`
	Reviews     []Review         `json:"reviews"`
	Available   bool             `json:"available"`
	// Como chamar o grupo de opção desta peça: "Tamanho" num anel, "Letras"
	// num colar de letra. Vazio quando a peça não tem escolha nenhuma.
	VariantLabel *string          `json:"variant_label"`
	Variants     []ProductVariant `json:"variants"`
}

type ProductFilter struct {
	Category string
	Metal    string
	Featured bool
	// BestSellers ordena pela venda da Mirava e, como desempate, pela posição
	// na vitrine da fornecedora. Ver a coluna units_sold no schema.
	BestSellers bool
	Search      string
	Limit       int
}

// ListProducts busca a vitrine. Teto de itens sempre presente: sem limite,
// uma categoria grande arrastaria o catálogo inteiro pro navegador da cliente.
func (d *DB) ListProducts(ctx context.Context, f ProductFilter) ([]CatalogProduct, error) {
	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 48
	}

	sql := `
		select p.id::text, p.slug, p.name, p.description, p.price_cents,
		       p.category, p.metal, p.images, p.featured,
		       coalesce(sp.available, true),
		       p.rating::float8, coalesce(p.rating_count, 0), coalesce(p.reviews, '[]'::jsonb),
		       p.variant_label
		from products p
		left join supplier_products sp on sp.id = p.supplier_product_id
		where p.published = true`
	args := []any{}
	i := 1
	arg := func(v any) string { args = append(args, v); s := fmt.Sprintf("$%d", i); i++; return s }

	if f.Category != "" {
		sql += " and p.category = " + arg(f.Category)
	}
	if f.Metal != "" {
		sql += " and p.metal = " + arg(f.Metal)
	}
	if f.Featured {
		sql += " and p.featured = true"
	}
	if f.Search != "" {
		sql += " and p.name ilike " + arg("%"+f.Search+"%")
	}
	if f.BestSellers {
		// Só entra quem tem algum sinal: sem isso a lista completaria com peça
		// qualquer e "mais vendidos" viraria "catálogo em outra ordem".
		sql += " and (p.units_sold > 0 or p.supplier_rank is not null)"
		sql += " order by p.units_sold desc, p.supplier_rank asc nulls last, p.created_at desc"
	} else {
		sql += " order by p.created_at desc"
	}
	sql += " limit " + arg(limit)

	rows, err := d.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := []CatalogProduct{}
	ids := []string{}
	for rows.Next() {
		var p CatalogProduct
		var reviewsRaw []byte
		if err := rows.Scan(&p.ID, &p.Slug, &p.Name, &p.Description, &p.PriceCents,
			&p.Category, &p.Metal, &p.Images, &p.Featured, &p.Available,
			&p.Rating, &p.RatingCount, &reviewsRaw, &p.VariantLabel); err != nil {
			return nil, err
		}
		if err := unmarshalReviews(reviewsRaw, &p.Reviews); err != nil {
			return nil, err
		}
		p.Variants = []ProductVariant{}
		products = append(products, p)
		ids = append(ids, p.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	variantsByProduct, err := d.variantsFor(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range products {
		products[i].Variants = variantsByProduct[products[i].ID]
	}
	return products, nil
}

// ProductBySlug busca uma peça publicada pelo slug da vitrine.
func (d *DB) ProductBySlug(ctx context.Context, slug string) (*CatalogProduct, error) {
	var p CatalogProduct
	var reviewsRaw []byte
	err := d.pool.QueryRow(ctx, `
		select p.id::text, p.slug, p.name, p.description, p.price_cents,
		       p.category, p.metal, p.images, p.featured,
		       coalesce(sp.available, true),
		       p.rating::float8, coalesce(p.rating_count, 0), coalesce(p.reviews, '[]'::jsonb),
		       p.variant_label
		from products p
		left join supplier_products sp on sp.id = p.supplier_product_id
		where p.slug = $1 and p.published = true`, slug).
		Scan(&p.ID, &p.Slug, &p.Name, &p.Description, &p.PriceCents,
			&p.Category, &p.Metal, &p.Images, &p.Featured, &p.Available,
			&p.Rating, &p.RatingCount, &reviewsRaw, &p.VariantLabel)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := unmarshalReviews(reviewsRaw, &p.Reviews); err != nil {
		return nil, err
	}

	variantsByProduct, err := d.variantsFor(ctx, []string{p.ID})
	if err != nil {
		return nil, err
	}
	p.Variants = variantsByProduct[p.ID]
	return &p, nil
}

// RelatedProducts: mesma categoria, exclui a própria peça.
func (d *DB) RelatedProducts(ctx context.Context, category, excludeID string, quantity int) ([]CatalogProduct, error) {
	return d.listProductsExcluding(ctx, ProductFilter{Category: category, Limit: quantity}, excludeID)
}

// listProductsExcluding é ListProducts + "id != excludeID", usado só pela
// seção de relacionados. Separado para não complicar o filtro comum.
func (d *DB) listProductsExcluding(ctx context.Context, f ProductFilter, excludeID string) ([]CatalogProduct, error) {
	products, err := d.ListProducts(ctx, f)
	if err != nil {
		return nil, err
	}
	out := make([]CatalogProduct, 0, len(products))
	for _, p := range products {
		if p.ID != excludeID {
			out = append(out, p)
		}
	}
	return out, nil
}

func (d *DB) variantsFor(ctx context.Context, productIDs []string) (map[string][]ProductVariant, error) {
	out := map[string][]ProductVariant{}
	if len(productIDs) == 0 {
		return out, nil
	}
	rows, err := d.pool.Query(ctx, `
		select product_id::text, id::text, size, price_adjust_cents, available
		from product_variants
		where product_id = any($1::uuid[])
		order by size`, productIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var productID string
		var v ProductVariant
		if err := rows.Scan(&productID, &v.ID, &v.Size, &v.PriceAdjustCents, &v.Available); err != nil {
			return nil, err
		}
		out[productID] = append(out[productID], v)
	}
	return out, rows.Err()
}

// CountByCategory alimenta os contadores do menu de navegação.
func (d *DB) CountByCategory(ctx context.Context) (map[string]int, error) {
	rows, err := d.pool.Query(ctx, `
		select category, count(*) from products
		where published = true group by category`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]int{}
	for rows.Next() {
		var category string
		var n int
		if err := rows.Scan(&category, &n); err != nil {
			return nil, err
		}
		out[category] = n
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Checkout — preço REAL, lido do banco.
// ---------------------------------------------------------------------------

type CheckoutProduct struct {
	ID        string
	Slug      string
	Name      string
	Price     dominio.Cents
	Cost      dominio.Cents
	SKU       string
	Available bool
}

// ProductsForCheckout busca preço REAL no banco.
//
// É a função que impede alguém de comprar uma joia por um real: o preço nunca
// vem da requisição, sempre daqui.
func (d *DB) ProductsForCheckout(ctx context.Context, ids []string) (map[string]CheckoutProduct, error) {
	rows, err := d.pool.Query(ctx, `
		select p.id::text, p.slug, p.name, p.price_cents, p.cost_cents,
		       coalesce(sp.sku, ''), coalesce(sp.available, true)
		from products p
		left join supplier_products sp on sp.id = p.supplier_product_id
		where p.id = any($1::uuid[]) and p.published = true`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]CheckoutProduct{}
	for rows.Next() {
		var p CheckoutProduct
		if err := rows.Scan(&p.ID, &p.Slug, &p.Name, &p.Price, &p.Cost, &p.SKU, &p.Available); err != nil {
			return nil, err
		}
		out[p.ID] = p
	}
	return out, rows.Err()
}

func (d *DB) VariantAdjustment(ctx context.Context, productID, size string) (dominio.Cents, bool, error) {
	var adjust dominio.Cents
	var available bool
	err := d.pool.QueryRow(ctx, `
		select price_adjust_cents, available
		from product_variants where product_id = $1 and size = $2`,
		productID, size).Scan(&adjust, &available)

	if errors.Is(err, pgx.ErrNoRows) {
		return 0, true, nil // produto sem variantes cadastradas
	}
	return adjust, available, err
}

// ---------------------------------------------------------------------------
// Conta
// ---------------------------------------------------------------------------

type Address struct {
	ID           string `json:"id"`
	Label        string `json:"label"`
	Recipient    string `json:"recipient"`
	ZipCode      string `json:"zip_code"`
	Street       string `json:"street"`
	Number       string `json:"number"`
	Complement   string `json:"complement"`
	Neighborhood string `json:"neighborhood"`
	City         string `json:"city"`
	State        string `json:"state"`
	Primary      bool   `json:"primary"`
}

// AddressForUser filtra por user_id de propósito: sem isso, alguém mandaria
// o id de um endereço alheio e descobriria onde outra pessoa mora.
func (d *DB) AddressForUser(ctx context.Context, userID, addressID string) (*Address, error) {
	var a Address
	err := d.pool.QueryRow(ctx, `
		select recipient, zip_code, street, number, coalesce(complement,''),
		       neighborhood, city, state
		from addresses where id = $1 and user_id = $2`,
		addressID, userID).Scan(&a.Recipient, &a.ZipCode, &a.Street, &a.Number,
		&a.Complement, &a.Neighborhood, &a.City, &a.State)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("endereço não encontrado")
	}
	return &a, err
}

func (d *DB) AddressesForUser(ctx context.Context, userID string) ([]Address, error) {
	rows, err := d.pool.Query(ctx, `
		select id::text, coalesce(label,''), recipient, zip_code, street, number,
		       coalesce(complement,''), neighborhood, city, state, is_primary
		from addresses where user_id = $1
		order by is_primary desc, created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Address{}
	for rows.Next() {
		var a Address
		if err := rows.Scan(&a.ID, &a.Label, &a.Recipient, &a.ZipCode, &a.Street,
			&a.Number, &a.Complement, &a.Neighborhood, &a.City, &a.State, &a.Primary); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// CreateAddress marca o primeiro endereço da cliente como principal
// automaticamente — sem isso o checkout não teria endereço padrão pra sugerir.
func (d *DB) CreateAddress(ctx context.Context, userID string, a Address) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
		insert into addresses (user_id, label, recipient, zip_code, street, number,
			complement, neighborhood, city, state, is_primary)
		values ($1, nullif($2,''), $3, $4, $5, $6, nullif($7,''), $8, $9, $10,
			not exists (select 1 from addresses where user_id = $1))
		returning id::text`,
		userID, a.Label, a.Recipient, a.ZipCode, a.Street, a.Number,
		a.Complement, a.Neighborhood, a.City, a.State).Scan(&id)
	return id, err
}

// DeleteAddress filtra por user_id: sem isso, alguém apagaria endereço
// alheio só adivinhando o uuid.
func (d *DB) DeleteAddress(ctx context.Context, userID, addressID string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `
		delete from addresses where id = $1 and user_id = $2`, addressID, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

type Profile struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
	CPF   string `json:"cpf"`
}

func (d *DB) GetProfile(ctx context.Context, userID string) (Profile, error) {
	var p Profile
	err := d.pool.QueryRow(ctx, `
		select name, coalesce(phone,''), coalesce(cpf,'')
		from profiles where id = $1`, userID).Scan(&p.Name, &p.Phone, &p.CPF)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil
	}
	return p, err
}

// UpdateProfile sobrescreve nome/telefone/cpf — chamado só pela própria
// cliente logada (id vem do token, nunca do corpo da requisição).
func (d *DB) UpdateProfile(ctx context.Context, userID string, p Profile) error {
	_, err := d.pool.Exec(ctx, `
		update profiles set name = $2, phone = nullif($3,''), cpf = nullif($4,'')
		where id = $1`, userID, p.Name, p.Phone, p.CPF)
	return err
}

// ---------------------------------------------------------------------------
// Login e cadastro — antes disso era o Supabase Auth (auth.users + trigger).
// ---------------------------------------------------------------------------

type NewUser struct {
	Name, Email, PasswordHash string
}

type User struct {
	ID, Name, Email string
}

// CreateUser grava a conta e o perfil na mesma transação — usuário sem
// perfil era exatamente o bug que o trigger do Supabase existia para evitar.
func (d *DB) CreateUser(ctx context.Context, u NewUser) (id string, err error) {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		insert into users (name, email, password_hash) values ($1, $2, $3)
		returning id::text`, u.Name, u.Email, u.PasswordHash).Scan(&id)
	if err != nil {
		if isDuplicate(err) {
			return "", ErrDuplicate
		}
		return "", err
	}

	if _, err = tx.Exec(ctx, `insert into profiles (id, name) values ($1, $2)`, id, u.Name); err != nil {
		return "", err
	}

	return id, tx.Commit(ctx)
}

// UserByEmail devolve o hash da senha separado do resto — ele nunca deve
// vazar para fora deste pacote além do necessário para conferir a senha.
func (d *DB) UserByEmail(ctx context.Context, email string) (User, string, error) {
	var u User
	var hash string
	err := d.pool.QueryRow(ctx, `
		select u.id::text, coalesce(p.name, ''), u.email, u.password_hash
		from users u
		left join profiles p on p.id = u.id
		where u.email = $1`, email).Scan(&u.ID, &u.Name, &u.Email, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, "", fmt.Errorf("usuário não encontrado")
	}
	return u, hash, err
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

type OrderItem struct {
	ProductID string
	Name      string
	SKU       string
	Size      string
	Quantity  int
	Price     dominio.Cents
	Cost      dominio.Cents
}

type NewOrder struct {
	UserID    string
	Name      string
	Email     string
	Phone     string
	CPF       string
	Address   any
	Subtotal dominio.Cents
	Shipping dominio.Cents
	Discount dominio.Cents
	Total    dominio.Cents
	// Qual serviço a cliente escolheu ("economico" ou "sedex"). Guardado para
	// você saber o que despachar quando o lote fechar — o valor sozinho não
	// diz se ela pagou por urgência.
	ShippingMethod string
	Engraving      string
	Items          []OrderItem
}

// CreateOrder grava pedido e itens numa transação: pedido sem item é um
// estado inválido que dá muito trabalho para limpar depois.
func (d *DB) CreateOrder(ctx context.Context, o NewOrder) (id string, number int, err error) {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return "", 0, err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		insert into orders (user_id, status, customer_name, customer_email,
			customer_phone, customer_cpf, address, subtotal_cents,
			shipping_cents, discount_cents, total_cents, engraving,
			shipping_method)
		values ($1,'awaiting_payment',$2,$3,
			nullif($4,''), nullif($5,''), $6, $7, $8, $9, $10, nullif($11,''),
			nullif($12,''))
		returning id::text, number`,
		o.UserID, o.Name, o.Email, o.Phone, o.CPF, o.Address,
		o.Subtotal, o.Shipping, o.Discount, o.Total, o.Engraving,
		o.ShippingMethod,
	).Scan(&id, &number)
	if err != nil {
		return "", 0, err
	}

	for _, i := range o.Items {
		if _, err = tx.Exec(ctx, `
			insert into order_items (order_id, product_id, name_snapshot,
				supplier_sku, size, quantity,
				unit_price_cents, unit_cost_cents)
			values ($1,$2,$3,nullif($4,''),nullif($5,''),$6,$7,$8)`,
			id, i.ProductID, i.Name, i.SKU, i.Size, i.Quantity, i.Price, i.Cost,
		); err != nil {
			return "", 0, err
		}
	}
	return id, number, tx.Commit(ctx)
}

type OrderSummary struct {
	ID       string
	Number   int
	Status   dominio.Status
	Total    dominio.Cents
	Email    string
	UserID   string
	Discount dominio.Cents
}

func (d *DB) OrderByID(ctx context.Context, id string) (*OrderSummary, error) {
	var o OrderSummary
	var userID *string
	err := d.pool.QueryRow(ctx, `
		select id::text, number, status, total_cents, customer_email,
		       user_id::text, discount_cents
		from orders where id = $1`, id).
		Scan(&o.ID, &o.Number, &o.Status, &o.Total, &o.Email, &userID, &o.Discount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if userID != nil {
		o.UserID = *userID
	}
	return &o, err
}

// ---------------------------------------------------------------------------
// Cupom de boas-vindas
// ---------------------------------------------------------------------------

// WelcomeCouponEligible diz se esta conta ainda não usou o cupom de
// boas-vindas — é o que garante que a promoção vale só para conta nova,
// uma vez cada.
func (d *DB) WelcomeCouponEligible(ctx context.Context, userID string) (bool, error) {
	var redeemed bool
	err := d.pool.QueryRow(ctx,
		`select welcome_coupon_redeemed_at is not null from users where id = $1`, userID,
	).Scan(&redeemed)
	if err != nil {
		return false, err
	}
	return !redeemed, nil
}

// RedeemWelcomeCoupon marca o cupom como usado. Só grava se ainda estiver
// livre: se o webhook do Mercado Pago chegar mais de uma vez para o mesmo
// pedido (comportamento normal dele), a segunda chamada é um no-op em vez de
// reescrever a data original.
func (d *DB) RedeemWelcomeCoupon(ctx context.Context, userID string) error {
	_, err := d.pool.Exec(ctx,
		`update users set welcome_coupon_redeemed_at = now()
		 where id = $1 and welcome_coupon_redeemed_at is null`, userID)
	return err
}

// AddNewsletterSubscriber grava o e-mail capturado pelo banner "Bem-vinda".
// E-mail repetido não é erro — a pessoa só clicou de novo.
func (d *DB) AddNewsletterSubscriber(ctx context.Context, email string) error {
	_, err := d.pool.Exec(ctx,
		`insert into newsletter_subscribers (email) values ($1)
		 on conflict (email) do nothing`, email)
	return err
}

type PaymentRecord struct {
	OrderID      string
	MPPaymentID  string
	Status       string
	Method       string
	Installments int
	Amount       dominio.Cents
	Fee          dominio.Cents
	Net          dominio.Cents
	Payload      []byte
}

// RegisterPayment devolve ErrDuplicate quando o webhook já foi processado.
// O Mercado Pago reenvia o mesmo evento várias vezes — é o comportamento
// normal dele, e o unique em mp_payment_id transforma a repetição num no-op.
func (d *DB) RegisterPayment(ctx context.Context, r PaymentRecord) error {
	_, err := d.pool.Exec(ctx, `
		insert into payments (order_id, mp_payment_id, status, method,
			installments, amount_cents, fee_cents, net_cents, payload)
		values ($1,$2,$3,nullif($4,''),nullif($5,0),$6,nullif($7,0),nullif($8,0),$9)`,
		r.OrderID, r.MPPaymentID, r.Status, r.Method, r.Installments,
		r.Amount, r.Fee, r.Net, r.Payload)

	if isDuplicate(err) {
		return ErrDuplicate
	}
	return err
}

// MarkPaid só age se o pedido ainda estiver aguardando: a cláusula extra
// no where é a trava contra dois webhooks simultâneos.
func (d *DB) MarkPaid(ctx context.Context, orderID string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `
		update orders set status='paid', paid_at=now()
		where id=$1 and status='awaiting_payment'`, orderID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (d *DB) UpdateStatus(ctx context.Context, orderID string, status dominio.Status) error {
	_, err := d.pool.Exec(ctx, `update orders set status=$2 where id=$1`, orderID, status)
	return err
}

func (d *DB) RegisterAlert(ctx context.Context, orderID, detail string) error {
	_, err := d.pool.Exec(ctx, `
		insert into order_events (order_id, from_status, to_status, origin, detail)
		select id, status, status, 'webhook', $2 from orders where id = $1`,
		orderID, detail)
	return err
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

type MirrorProduct struct {
	SupplierID      string
	SKU, URL, Name  string
	Description     string
	Warranty        string
	Cost, Retail    dominio.Cents
	CostConfirmed   bool
	Available       bool
	Images          []string
	Rating          float64
	RatingCount     int
	Reviews         []Review
}

// UpsertMirror grava no ESPELHO — nunca no catálogo da dona.
// Devolve true quando é produto novo.
func (d *DB) UpsertMirror(ctx context.Context, e MirrorProduct) (created bool, id string, err error) {
	reviews, err := json.Marshal(e.Reviews)
	if err != nil {
		return false, "", fmt.Errorf("avaliações: %w", err)
	}

	err = d.pool.QueryRow(ctx, `
		insert into supplier_products (supplier_id, sku, url, name, description,
			warranty, cost_cents, retail_cents, cost_confirmed,
			available, source_images, rating, rating_count, reviews, last_seen_at, vanished_at)
		values ($1,$2,$3,$4,nullif($5,''),nullif($6,''),$7,$8,$9,$10,$11,
			nullif($12,0)::numeric, nullif($13,0), $14, now(), null)
		on conflict (supplier_id, sku) do update set
			url = excluded.url, name = excluded.name,
			description = coalesce(excluded.description, supplier_products.description),
			warranty = coalesce(excluded.warranty, supplier_products.warranty),
			cost_cents = excluded.cost_cents,
			retail_cents = excluded.retail_cents,
			cost_confirmed = excluded.cost_confirmed,
			available = excluded.available,
			source_images = excluded.source_images,
			rating = excluded.rating,
			rating_count = excluded.rating_count,
			reviews = excluded.reviews,
			last_seen_at = now(), vanished_at = null
		returning id::text, (xmax = 0) as inserted`,
		e.SupplierID, e.SKU, e.URL, e.Name, e.Description, e.Warranty,
		e.Cost, e.Retail, e.CostConfirmed, e.Available, e.Images,
		e.Rating, e.RatingCount, reviews,
	).Scan(&id, &created)
	return created, id, err
}

// EnsureProduct publica (ou atualiza) a peça no catálogo público a partir do
// espelho — nome, descrição, categoria, metal e fotos ficam sempre iguais ao
// que a Lilly mostra. O PREÇO não é tocado aqui: quem decide preço é
// ApplyCost, com o disjuntor. Produto novo nasce publicado direto (decisão da
// dona: peça é a mesma da Lilly, não precisa de revisão manual antes de ir
// ao ar) — markup de 200% aplicado na criação.
func (d *DB) EnsureProduct(ctx context.Context, mirrorID string, p EnsureProductInput) (id string, created bool, err error) {
	reviews, err := json.Marshal(p.Reviews)
	if err != nil {
		return "", false, fmt.Errorf("avaliações: %w", err)
	}

	err = d.pool.QueryRow(ctx, `
		insert into products (supplier_product_id, slug, name, description,
			price_cents, cost_cents, category, metal, images, published, auto_price, markup_pct,
			rating, rating_count, reviews, variant_label)
		values ($1,
			public.generate_slug($2 || ' ' || $3),
			$2, nullif($4,''), $5, $6, $7, $8, $9, true, true, 200.00,
			nullif($10,0)::numeric, nullif($11,0), $12, nullif($13,''))
		on conflict (supplier_product_id) do update set
			name = excluded.name,
			description = excluded.description,
			category = excluded.category,
			metal = excluded.metal,
			images = excluded.images,
			cost_cents = excluded.cost_cents,
			rating = excluded.rating,
			rating_count = excluded.rating_count,
			reviews = excluded.reviews,
			variant_label = excluded.variant_label
		returning id::text, (xmax = 0) as inserted`,
		mirrorID, p.Name, p.SKU, p.Description,
		int64(p.Cost)*3, int64(p.Cost), p.Category, p.Metal, p.Images,
		p.Rating, p.RatingCount, reviews, p.VariantLabel,
	).Scan(&id, &created)
	if err != nil {
		return "", false, err
	}

	return id, created, d.syncVariants(ctx, id, p.Variants)
}

// syncVariants deixa product_variants igual ao que a Lilly mostra hoje.
//
// Marca como indisponível o que sumiu, em vez de apagar: a variante pode estar
// citada num pedido antigo, e apagar a linha faria o histórico perder o
// tamanho que a cliente escolheu. Some da vitrine, continua no registro.
func (d *DB) syncVariants(ctx context.Context, productID string, sizes []string) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		update product_variants set available = false
		where product_id = $1 and size <> all($2)`,
		productID, sizes,
	); err != nil {
		return err
	}

	for i, size := range sizes {
		if _, err := tx.Exec(ctx, `
			insert into product_variants (product_id, size, sort_order, available)
			values ($1, $2, $3, true)
			on conflict (product_id, size) do update set
				available = true, sort_order = excluded.sort_order`,
			productID, size, i,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

type EnsureProductInput struct {
	SKU, Name, Description string
	Cost                    dominio.Cents
	Category, Metal         string
	Images                  []string
	Rating                  float64
	RatingCount             int
	Reviews                 []Review
	// Grupo de opção da Lilly: rótulo ("Tamanho", "Letras") e os valores.
	VariantLabel string
	Variants     []string
}

// ApplyCost chama a função SQL com o disjuntor de preço.
// A regra mora no banco para valer mesmo se este serviço tiver bug.
func (d *DB) ApplyCost(ctx context.Context, mirrorID string, cost dominio.Cents) (string, error) {
	var result string
	err := d.pool.QueryRow(ctx, `
		select public.apply_synced_cost(p.id, $2, $3)
		from products p where p.supplier_product_id = $1`,
		mirrorID, int64(cost), dominio.PriceVariationLimit).Scan(&result)

	if errors.Is(err, pgx.ErrNoRows) {
		return "sem produto no catálogo", nil // ainda não promovido pela dona
	}
	return result, err
}

// MarkVanished despublica o que sumiu do site da Lilly.
// Não apaga: pedidos antigos referenciam esses produtos.
func (d *DB) MarkVanished(ctx context.Context, supplierID string, seen []string) (int64, error) {
	tag, err := d.pool.Exec(ctx, `
		update supplier_products
		set available = false, vanished_at = coalesce(vanished_at, now())
		where supplier_id = $1 and not (sku = any($2::text[]))
		  and vanished_at is null`, supplierID, seen)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (d *DB) ActiveSupplier(ctx context.Context) (id, sitemap string, ratio float64, err error) {
	err = d.pool.QueryRow(ctx, `
		select id::text, coalesce(sitemap_url,''), wholesale_ratio::float8
		from suppliers where active order by created_at limit 1`).
		Scan(&id, &sitemap, &ratio)
	return
}

func (d *DB) StartSync(ctx context.Context, supplierID string, total int) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
		insert into syncs (supplier_id, sitemap_urls)
		values ($1,$2) returning id::text`, supplierID, total).Scan(&id)
	return id, err
}

type SyncResult struct {
	Processed, Created, Updated, Failed, Vanished, LockedPrices int
	Status, Error                                                string
}

func (d *DB) FinishSync(ctx context.Context, syncID string, r SyncResult) error {
	_, err := d.pool.Exec(ctx, `
		update syncs set status=$2, processed=$3, created_count=$4,
			updated_count=$5, failed=$6, vanished=$7, locked_prices=$8,
			error=nullif($9,''), finished_at=now()
		where id=$1`,
		syncID, r.Status, r.Processed, r.Created,
		r.Updated, r.Failed, r.Vanished, r.LockedPrices, r.Error)
	return err
}

func (d *DB) RecordSyncFailure(ctx context.Context, syncID, url, reason string) {
	_, _ = d.pool.Exec(ctx, `
		insert into sync_failures (sync_id, url, reason) values ($1,$2,$3)`,
		syncID, url, reason)
}

// ---------------------------------------------------------------------------
// Mais vendidos
//
// Dois sinais, e uma sucessão pensada de propósito:
//
//   supplier_rank  posição na vitrine da fornecedora. Emprestado. Serve
//                  enquanto a Mirava não tem venda própria para saber o que sai.
//   units_sold     unidades vendidas PELA MIRAVA em pedidos pagos. Dado nosso,
//                  fica no banco e não depende de a Lilly existir amanhã.
//
// A vitrine ordena por units_sold e só usa supplier_rank no desempate. Conforme
// a loja vende, a lista vira dela sozinha — sem trocar código no dia da virada.
// ---------------------------------------------------------------------------

// SetSupplierRanks reescreve a posição de mais vendido da fornecedora.
//
// Zera TODAS antes de gravar: peça que saiu da vitrine da Lilly precisa perder
// o posto, senão a lista acumularia campeões antigos para sempre. Roda em
// transação para a vitrine nunca ser lida no instante em que está vazia.
//
// `slugsEmOrdem` é a ordem exibida pela fornecedora — a posição é o dado.
func (d *DB) SetSupplierRanks(ctx context.Context, slugsEmOrdem []string) (int, error) {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`update products set supplier_rank = null where supplier_rank is not null`); err != nil {
		return 0, err
	}
	if len(slugsEmOrdem) == 0 {
		return 0, tx.Commit(ctx)
	}

	// O casamento é pela URL da peça no espelho: o slug da Lilly é o fim da
	// URL que a sincronização já guardou em supplier_products.url. O slug da
	// Mirava é outro (pode ter sido renomeado pela dona), então não serve.
	//
	// category <> 'outros' exclui embalagem e brinde (caixinha, saquinho...)
	// que aparecem na vitrine "mais vendidos" da Lilly misturados com joia de
	// verdade — a categoria "outros" é o catch-all de GuessCategory para tudo
	// que não bateu em nenhuma palavra-chave de joia.
	tag, err := tx.Exec(ctx, `
		update products p
		   set supplier_rank = r.pos
		  from (select unnest($1::text[]) as slug,
		               generate_subscripts($1::text[], 1) as pos) r
		  join supplier_products sp
		    on sp.url like '%/' || r.slug || '/'
		    or sp.url like '%/' || r.slug
		 where p.supplier_product_id = sp.id
		   and p.category <> 'outros'`, slugsEmOrdem)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), tx.Commit(ctx)
}

// RefreshUnitsSold recalcula a venda própria a partir dos pedidos.
//
// Conta só pedido que virou dinheiro de verdade: cancelado, estornado e sem
// estoque ficam de fora, senão um pedido que deu errado empurraria a peça pro
// topo da vitrine. Recalcula do zero em vez de somar incrementos — assim um
// estorno tardio se corrige sozinho na próxima rodada.
func (d *DB) RefreshUnitsSold(ctx context.Context) (int, error) {
	tag, err := d.pool.Exec(ctx, `
		with vendidos as (
			select oi.product_id, sum(oi.quantity)::int as unidades
			  from order_items oi
			  join orders o on o.id = oi.order_id
			 where oi.product_id is not null
			   and o.status not in ('awaiting_payment','cancelled','refunded','out_of_stock')
			 group by oi.product_id
		)
		update products p
		   set units_sold = coalesce(v.unidades, 0)
		  from (select id from products) todos
		  left join vendidos v on v.product_id = todos.id
		 where p.id = todos.id
		   and p.units_sold is distinct from coalesce(v.unidades, 0)`)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

// ---------------------------------------------------------------------------
// Lote
// ---------------------------------------------------------------------------

type OpenBatch struct {
	ID           string
	Cost         dominio.Cents
	OldestPaidAt time.Time
}

func (d *DB) GetOpenBatch(ctx context.Context) (*OpenBatch, error) {
	var b OpenBatch
	var oldest *time.Time
	err := d.pool.QueryRow(ctx, `
		select b.id::text, b.total_cost_cents,
		       (select min(o.paid_at) from orders o
		         where o.batch_id = b.id
		           and o.status not in ('cancelled','refunded','out_of_stock'))
		from batches b where b.status = 'open' limit 1`).
		Scan(&b.ID, &b.Cost, &oldest)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if oldest != nil {
		b.OldestPaidAt = *oldest
	}
	return &b, err
}

func (d *DB) CloseBatch(ctx context.Context, batchID string, shipping dominio.Cents, notes string) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(ctx, `
		update batches set status='closed', closed_at=now(),
			shipping_cents=$2, notes=$3
		where id=$1 and status='open'`, batchID, shipping, notes); err != nil {
		return err
	}
	// Abre o próximo imediatamente: pedido pago não pode ficar sem lote.
	if _, err = tx.Exec(ctx, `insert into batches (status) values ('open')`); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Pedidos da cliente — para ela acompanhar depois de pagar.
//
// TODA consulta aqui filtra por user_id. Não é zelo: sem esse filtro, trocar
// o id na URL mostraria o pedido, o endereço e o telefone de outra pessoa.
// É o mesmo motivo pelo qual RLS existia antes de o banco virar próprio.
// ---------------------------------------------------------------------------

type CustomerOrderItem struct {
	Name     string        `json:"name"`
	Size     *string       `json:"size"`
	Quantity int           `json:"quantity"`
	Price    dominio.Cents `json:"price_cents"`
}

type CustomerOrder struct {
	ID             string         `json:"id"`
	Number         int            `json:"number"`
	Status         dominio.Status `json:"status"`
	Subtotal       dominio.Cents  `json:"subtotal_cents"`
	Shipping       dominio.Cents  `json:"shipping_cents"`
	Total          dominio.Cents  `json:"total_cents"`
	ShippingMethod *string        `json:"shipping_method"`
	TrackingCode   *string        `json:"tracking_code"`
	Address        []byte         `json:"-"`
	CreatedAt      time.Time      `json:"created_at"`
	PaidAt         *time.Time     `json:"paid_at"`
	ShippedAt      *time.Time     `json:"shipped_at"`
	Items          []CustomerOrderItem `json:"items"`
}

// OrdersForUser lista os pedidos da cliente, do mais recente para o mais
// antigo. Sem os itens: a lista mostra número, status e total, e o detalhe
// carrega o resto — evita puxar o catálogo inteiro de quem já comprou muito.
func (d *DB) OrdersForUser(ctx context.Context, userID string) ([]CustomerOrder, error) {
	rows, err := d.pool.Query(ctx, `
		select id::text, number, status, subtotal_cents, shipping_cents,
		       total_cents, shipping_method, tracking_code,
		       created_at, paid_at, shipped_at
		from orders
		where user_id = $1
		order by created_at desc
		limit 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := []CustomerOrder{}
	for rows.Next() {
		var o CustomerOrder
		if err := rows.Scan(&o.ID, &o.Number, &o.Status, &o.Subtotal, &o.Shipping,
			&o.Total, &o.ShippingMethod, &o.TrackingCode,
			&o.CreatedAt, &o.PaidAt, &o.ShippedAt); err != nil {
			return nil, err
		}
		o.Items = []CustomerOrderItem{}
		orders = append(orders, o)
	}
	return orders, rows.Err()
}

// OrderForUser traz um pedido com os itens — e só se ele for da própria
// cliente. Devolve nil quando não é: do lado de fora, "não é seu" e "não
// existe" respondem igual, para não confirmar a existência de pedido alheio.
func (d *DB) OrderForUser(ctx context.Context, userID, orderID string) (*CustomerOrder, error) {
	var o CustomerOrder
	err := d.pool.QueryRow(ctx, `
		select id::text, number, status, subtotal_cents, shipping_cents,
		       total_cents, shipping_method, tracking_code,
		       created_at, paid_at, shipped_at
		from orders
		where id = $1 and user_id = $2`, orderID, userID).
		Scan(&o.ID, &o.Number, &o.Status, &o.Subtotal, &o.Shipping,
			&o.Total, &o.ShippingMethod, &o.TrackingCode,
			&o.CreatedAt, &o.PaidAt, &o.ShippedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	rows, err := d.pool.Query(ctx, `
		select name_snapshot, size, quantity, unit_price_cents
		from order_items where order_id = $1 order by id`, o.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	o.Items = []CustomerOrderItem{}
	for rows.Next() {
		var it CustomerOrderItem
		if err := rows.Scan(&it.Name, &it.Size, &it.Quantity, &it.Price); err != nil {
			return nil, err
		}
		o.Items = append(o.Items, it)
	}
	return &o, rows.Err()
}

// OrderForNotification junta o que um aviso precisa: quem avisar e sobre o
// quê. Não filtra por user_id de propósito — quem chama é o webhook do
// Mercado Pago, que não tem sessão de cliente nenhuma.
type OrderNotification struct {
	ID           string
	Number       int
	Status       dominio.Status
	Total        dominio.Cents
	Name         string
	Email        string
	TrackingCode *string
}

func (d *DB) OrderForNotification(ctx context.Context, orderID string) (*OrderNotification, error) {
	var o OrderNotification
	err := d.pool.QueryRow(ctx, `
		select id::text, number, status, total_cents,
		       customer_name, customer_email, tracking_code
		from orders where id = $1`, orderID).
		Scan(&o.ID, &o.Number, &o.Status, &o.Total, &o.Name, &o.Email, &o.TrackingCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &o, err
}

// MarkShipped grava o código de rastreio e move o pedido para 'shipped'.
//
// O `and status <> 'shipped'` na condição é a defesa contra despacho
// repetido: se duas requisições chegarem juntas, só uma altera linha, e o
// aviso à cliente sai uma vez só. O gatilho do banco preenche shipped_at.
func (d *DB) MarkShipped(ctx context.Context, orderID, trackingCode string) error {
	_, err := d.pool.Exec(ctx, `
		update orders
		set status = 'shipped', tracking_code = $2
		where id = $1 and status <> 'shipped'`, orderID, trackingCode)
	return err
}

// PendingShipment é uma linha da fila de despacho da dona.
type PendingShipment struct {
	ID        string         `json:"id"`
	Number    int            `json:"number"`
	Status    dominio.Status `json:"status"`
	Stage     string         `json:"stage"`
	Name      string         `json:"customer_name"`
	Total     dominio.Cents  `json:"total_cents"`
	Method    *string        `json:"shipping_method"`
	Address   []byte         `json:"address"`
	PaidAt    *time.Time     `json:"paid_at"`
	Items     []CustomerOrderItem `json:"items"`
}

// OrdersToShip traz os pedidos pagos que ainda não foram postados.
//
// Ordem por paid_at: quem pagou primeiro sai primeiro. É a mesma regra que o
// lote usa para decidir quando fechar, e evita que um pedido antigo fique
// esquecido no fim da fila enquanto os novos passam na frente.
func (d *DB) OrdersToShip(ctx context.Context) ([]PendingShipment, error) {
	rows, err := d.pool.Query(ctx, `
		select id::text, number, status, customer_name, total_cents,
		       shipping_method, address, paid_at
		from orders
		where status in ('paid','in_batch','purchased_from_supplier','received_by_owner')
		order by paid_at asc nulls last
		limit 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pedidos := []PendingShipment{}
	ids := []string{}
	for rows.Next() {
		var p PendingShipment
		if err := rows.Scan(&p.ID, &p.Number, &p.Status, &p.Name, &p.Total,
			&p.Method, &p.Address, &p.PaidAt); err != nil {
			return nil, err
		}
		p.Stage = string(dominio.PublicStage(p.Status))
		p.Items = []CustomerOrderItem{}
		pedidos = append(pedidos, p)
		ids = append(ids, p.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return pedidos, nil
	}

	// Os itens vêm numa consulta só, não uma por pedido: com 50 pedidos na
	// fila, o laço viraria 50 idas ao banco para montar uma tela.
	itemRows, err := d.pool.Query(ctx, `
		select order_id::text, name_snapshot, size, quantity, unit_price_cents
		from order_items where order_id = any($1) order by id`, ids)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()

	porPedido := map[string][]CustomerOrderItem{}
	for itemRows.Next() {
		var orderID string
		var it CustomerOrderItem
		if err := itemRows.Scan(&orderID, &it.Name, &it.Size, &it.Quantity, &it.Price); err != nil {
			return nil, err
		}
		porPedido[orderID] = append(porPedido[orderID], it)
	}
	if err := itemRows.Err(); err != nil {
		return nil, err
	}
	for i := range pedidos {
		if its := porPedido[pedidos[i].ID]; its != nil {
			pedidos[i].Items = its
		}
	}
	return pedidos, nil
}
