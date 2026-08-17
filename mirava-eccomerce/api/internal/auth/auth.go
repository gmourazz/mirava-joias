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
	email, _ := claims["email"].(string)
	return &User{ID: sub, Email: email}, nil
}
