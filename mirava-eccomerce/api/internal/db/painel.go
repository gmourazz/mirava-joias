package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// Usuários do painel (decisão 46). Login por nome de usuário, separado das
// contas da loja.

type AdminUser struct {
	ID           string     `json:"id"`
	Username     string     `json:"username"`
	Name         string     `json:"name"`
	Role         string     `json:"role"`
	Active       bool       `json:"active"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	PasswordHash string     `json:"-"`
}

const adminUserCols = `id::text, username, name, role, active, last_login_at, password_hash`

func scanAdminUser(row pgx.Row) (*AdminUser, error) {
	var u AdminUser
	err := row.Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.Active, &u.LastLoginAt, &u.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (d *DB) AdminUserByUsername(ctx context.Context, username string) (*AdminUser, error) {
	return scanAdminUser(d.pool.QueryRow(ctx, `select `+adminUserCols+` from admin_users where username = lower($1)`, username))
}

func (d *DB) AdminUserByID(ctx context.Context, id string) (*AdminUser, error) {
	return scanAdminUser(d.pool.QueryRow(ctx, `select `+adminUserCols+` from admin_users where id::text = $1`, id))
}

// CreateAdminUser cria o acesso. ErrDuplicate quando o usuário já existe.
func (d *DB) CreateAdminUser(ctx context.Context, username, name, hash, role string) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
		insert into admin_users (username, name, password_hash, role) values (lower($1), $2, $3, $4)
		returning id::text`, username, name, hash, role).Scan(&id)
	if isDuplicate(err) {
		return "", ErrDuplicate
	}
	return id, err
}

func (d *DB) AdminUsers(ctx context.Context) ([]AdminUser, error) {
	rows, err := d.pool.Query(ctx, `select `+adminUserCols+` from admin_users where active order by role desc, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminUser{}
	for rows.Next() {
		u, err := scanAdminUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *u)
	}
	return out, rows.Err()
}

// DeactivateAdminUser tira o acesso de quem é do despacho. Master não sai por
// aqui, para a loja nunca ficar sem quem administre.
func (d *DB) DeactivateAdminUser(ctx context.Context, id string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `update admin_users set active = false where id::text = $1 and role = 'dispatch'`, id)
	return tag.RowsAffected() > 0, err
}

func (d *DB) TouchAdminLogin(ctx context.Context, id string) {
	_, _ = d.pool.Exec(ctx, `update admin_users set last_login_at = now() where id::text = $1`, id)
}
