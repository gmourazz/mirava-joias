// Package auth emite e valida a sessão da Mirava.
package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const SessionDuration = 30 * 24 * time.Hour // 30 dias

// Sessão do painel (decisão 46): login próprio, por usuário, separado da loja.
// O "aud" é o que impede um token de valer no lugar do outro.
const (
	AdminSessionDuration = 12 * time.Hour
	adminAudience        = "mirava-painel"
)

type User struct {
	ID    string
	Email string
}

type Validator struct {
	secret []byte
}

func New(secret string) *Validator {
	return &Validator{secret: []byte(secret)}
}

func (v *Validator) IssueToken(userID, email string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":   userID,
		"email": email,
		"iat":   now.Unix(),
		"exp":   now.Add(SessionDuration).Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(v.secret)
}

func (v *Validator) DoRequest(r *http.Request) (*User, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, fmt.Errorf("sem token")
	}
	return v.Validate(r.Context(), strings.TrimPrefix(header, "Bearer "))
}

func (v *Validator) Validate(_ context.Context, token string) (*User, error) {
	t, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("algoritmo inesperado: %v", t.Header["alg"])
		}
		return v.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithLeeway(30*time.Second))

	if err != nil {
		return nil, fmt.Errorf("token inválido: %w", err)
	}
	claims, ok := t.Claims.(jwt.MapClaims)
	if !ok || !t.Valid {
		return nil, fmt.Errorf("claims inválidas")
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return nil, fmt.Errorf("token sem sub")
	}
	if _, painel := claims["aud"]; painel {
		return nil, fmt.Errorf("token do painel não vale na loja")
	}
	email, _ := claims["email"].(string)
	return &User{ID: sub, Email: email}, nil
}

// IssueAdminToken emite a sessão do painel para um usuário de admin_users.
func (v *Validator) IssueAdminToken(adminID string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub": adminID,
		"aud": adminAudience,
		"iat": now.Unix(),
		"exp": now.Add(AdminSessionDuration).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(v.secret)
}

// ValidateAdmin devolve o id do usuário do painel. Token da loja é recusado.
func (v *Validator) ValidateAdmin(token string) (string, error) {
	t, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		return v.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithLeeway(30*time.Second),
		jwt.WithAudience(adminAudience), jwt.WithExpirationRequired())
	if err != nil {
		return "", fmt.Errorf("sessão do painel inválida: %w", err)
	}
	sub, err := t.Claims.GetSubject()
	if err != nil || sub == "" {
		return "", fmt.Errorf("sessão do painel sem usuário")
	}
	return sub, nil
}

// AdminRequest lê a sessão do painel do cabeçalho Authorization.
func (v *Validator) AdminRequest(r *http.Request) (string, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return "", fmt.Errorf("sem token")
	}
	return v.ValidateAdmin(strings.TrimPrefix(header, "Bearer "))
}
