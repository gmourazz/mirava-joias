// Package auth valida o JWT emitido pelo Supabase Auth.
//
// A Mirava não implementa login próprio: hash de senha, recuperação, OAuth do
// Google e rotação de sessão são exatamente onde mais se erra em segurança.
// O Supabase cuida disso; aqui só conferimos a assinatura do token.
//
// Projetos Supabase criados a partir de 2025 assinam com uma chave
// assimétrica (ES256, curva P-256) publicada em
// /auth/v1/.well-known/jwks.json — não existe mais um segredo compartilhado
// (SUPABASE_JWT_SECRET) para buscar no painel. Por isso validamos contra a
// chave pública, buscada aqui e mantida em cache com refresh periódico (o
// Supabase pode rotacionar a chave).
package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const ttlCache = 10 * time.Minute

type Validador struct {
	jwksURL string
	cliente *http.Client

	mu        sync.RWMutex
	chaves    map[string]*ecdsa.PublicKey
	buscadoEm time.Time
}

// Novo recebe a URL do projeto Supabase (ex.: https://SEUPROJETO.supabase.co).
func Novo(supabaseURL string) *Validador {
	return &Validador{
		jwksURL: strings.TrimRight(supabaseURL, "/") + "/auth/v1/.well-known/jwks.json",
		cliente: &http.Client{Timeout: 5 * time.Second},
		chaves:  map[string]*ecdsa.PublicKey{},
	}
}

type Usuario struct {
	ID    string
	Email string
}

// DoRequest extrai e valida o token do header Authorization.
func (v *Validador) DoRequest(r *http.Request) (*Usuario, error) {
	cabecalho := r.Header.Get("Authorization")
	if !strings.HasPrefix(cabecalho, "Bearer ") {
		return nil, fmt.Errorf("sem token")
	}
	return v.Validar(r.Context(), strings.TrimPrefix(cabecalho, "Bearer "))
}

func (v *Validador) Validar(ctx context.Context, token string) (*Usuario, error) {
	t, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		// Trava o algoritmo. Sem isto, um atacante manda alg=none ou troca
		// para HS256 assinado com a chave pública (que é... pública) e a
		// validação passaria.
		if _, ok := t.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("algoritmo inesperado: %v", t.Header["alg"])
		}
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, fmt.Errorf("token sem kid")
		}
		return v.chavePara(ctx, kid)
	}, jwt.WithValidMethods([]string{"ES256"}), jwt.WithLeeway(30*time.Second))

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

	return &Usuario{ID: sub, Email: email}, nil
}

// chavePara devolve a chave pública do kid pedido, buscando (ou reusando o
// cache) do JWKS. Se o refresh falhar mas já houver uma chave em cache para
// esse kid, usa a antiga em vez de derrubar a requisição — o Supabase avisa
// a rotação com antecedência, uma falha de rede não pode virar apagão de
// login.
func (v *Validador) chavePara(ctx context.Context, kid string) (*ecdsa.PublicKey, error) {
	v.mu.RLock()
	chave, encontrada := v.chaves[kid]
	expirado := time.Since(v.buscadoEm) > ttlCache
	v.mu.RUnlock()

	if encontrada && !expirado {
		return chave, nil
	}

	if err := v.atualizar(ctx); err != nil {
		if encontrada {
			return chave, nil
		}
		return nil, err
	}

	v.mu.RLock()
	defer v.mu.RUnlock()
	chave, encontrada = v.chaves[kid]
	if !encontrada {
		return nil, fmt.Errorf("kid %q não encontrado no JWKS", kid)
	}
	return chave, nil
}

type jwk struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	Kid string `json:"kid"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type conjuntoJWKS struct {
	Keys []jwk `json:"keys"`
}

func (v *Validador) atualizar(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return fmt.Errorf("montar requisição do jwks: %w", err)
	}

	resp, err := v.cliente.Do(req)
	if err != nil {
		return fmt.Errorf("buscar jwks: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("jwks respondeu status %d", resp.StatusCode)
	}

	var doc conjuntoJWKS
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return fmt.Errorf("decodificar jwks: %w", err)
	}

	novas := make(map[string]*ecdsa.PublicKey, len(doc.Keys))
	for _, k := range doc.Keys {
		if k.Kty != "EC" || k.Crv != "P-256" {
			continue // só assinamos com ES256/P-256 — o resto não nos serve
		}
		pub, err := chavePublicaDe(k.X, k.Y)
		if err != nil {
			continue
		}
		novas[k.Kid] = pub
	}
	if len(novas) == 0 {
		return fmt.Errorf("jwks sem nenhuma chave EC P-256 utilizável")
	}

	v.mu.Lock()
	v.chaves = novas
	v.buscadoEm = time.Now()
	v.mu.Unlock()
	return nil
}

func chavePublicaDe(xB64, yB64 string) (*ecdsa.PublicKey, error) {
	xb, err := base64.RawURLEncoding.DecodeString(xB64)
	if err != nil {
		return nil, fmt.Errorf("decodificar x: %w", err)
	}
	yb, err := base64.RawURLEncoding.DecodeString(yB64)
	if err != nil {
		return nil, fmt.Errorf("decodificar y: %w", err)
	}
	return &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xb),
		Y:     new(big.Int).SetBytes(yb),
	}, nil
}
