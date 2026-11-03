package db

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

// ---------------------------------------------------------------------------
// Favoritos da cliente — TODA consulta filtra por user_id (ver db.go).
// ---------------------------------------------------------------------------

// FavoriteProducts devolve as peças favoritas publicadas, da mais recente
// para a mais antiga. Peça despublicada some da lista sem apagar o favorito:
// se voltar ao ar, volta para a lista.
func (d *DB) FavoriteProducts(ctx context.Context, userID string) ([]CatalogProduct, error) {
	rows, err := d.pool.Query(ctx, `
		select f.product_id::text from favorites f
		join products p on p.id = f.product_id and p.published
		where f.user_id = $1
		order by f.created_at desc
		limit 100`, userID)
	if err != nil {
		return nil, err
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
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
	return out, nil
}

func (d *DB) productByID(ctx context.Context, id string) (*CatalogProduct, error) {
	var slug string
	err := d.pool.QueryRow(ctx, `select slug from products where id = $1 and published`, id).Scan(&slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return d.ProductBySlug(ctx, slug)
}

// AddFavorite é idempotente: favoritar duas vezes não é erro. Só aceita peça
// publicada — favorito de peça fora do ar seria um coração apontando pro nada.
func (d *DB) AddFavorite(ctx context.Context, userID, productID string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `
		insert into favorites (user_id, product_id)
		select $1, id from products where id = $2 and published
		on conflict do nothing`, userID, productID)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		// Ou já era favorito (ok), ou a peça não existe/está fora do ar.
		var exists bool
		err := d.pool.QueryRow(ctx, `select exists (select 1 from products where id = $1 and published)`, productID).Scan(&exists)
		return exists, err
	}
	return true, nil
}

func (d *DB) RemoveFavorite(ctx context.Context, userID, productID string) error {
	_, err := d.pool.Exec(ctx, `delete from favorites where user_id = $1 and product_id = $2`, userID, productID)
	return err
}

// ---------------------------------------------------------------------------
// Acompanhar pedido sem login
// ---------------------------------------------------------------------------

// OrderByNumberAndEmail é o "Acompanhar pedido" da loja: a cliente informa o
// número e o e-mail da compra. Os dois precisam bater — só o número seria
// sequencial e adivinhável, e mostraria o pedido de outra pessoa. Não devolve
// endereço nem telefone: só o andamento, as peças e o rastreio.
func (d *DB) OrderByNumberAndEmail(ctx context.Context, number int, email string) (*CustomerOrder, error) {
	var userID *string
	var id string
	err := d.pool.QueryRow(ctx, `
		select id::text, user_id::text from orders
		where number = $1 and lower(customer_email) = $2`,
		number, strings.ToLower(strings.TrimSpace(email))).Scan(&id, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if userID == nil {
		return nil, nil
	}
	return d.OrderForUser(ctx, *userID, id)
}
