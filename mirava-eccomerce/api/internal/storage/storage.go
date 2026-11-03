// Package storage guarda as fotos de produto no disco do próprio servidor.
//
// Substitui o Supabase Storage (decisão 15 em ARQUITETURA.md). Simples de
// propósito: baixa a imagem original da Lilly uma vez, salva local, serve
// via HTTP estático. Funciona local hoje e na VPS da Hostinger depois — o
// disco é que muda de lugar, não o código.
//
// Idempotente: se o arquivo já existe, não baixa de novo. Isso faz a
// sincronização repetida ser barata — só produto novo baixa foto.
package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Store struct {
	dir string
}

// New cria o diretório se não existir. dir é relativo ao cwd do processo
// (ou absoluto, se você preferir configurar assim).
func New(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("não consegui criar %s: %w", dir, err)
	}
	return &Store{dir: dir}, nil
}

// Handler serve os arquivos salvos. Monte em /images/ no servidor HTTP.
func (s *Store) Handler() http.Handler {
	return http.FileServer(http.Dir(s.dir))
}

// SaveFromURL baixa sourceURL e salva em <dir>/<sku>/<índice><extensão>.
// Devolve o caminho público (para prefixar com a URL da API) — não a URL
// completa, porque quem serve pode mudar de domínio sem reescrever o banco.
//
// Se o arquivo já existir no disco, não baixa de novo: sincronização
// repetida não deve rebaixar a mesma foto centenas de vezes.
func (s *Store) SaveFromURL(ctx context.Context, client *http.Client, sourceURL, sku string, index int) (publicPath string, err error) {
	ext := extensionOf(sourceURL)
	safeSKU := safeName(sku)
	relDir := filepath.Join(safeSKU)
	fileName := fmt.Sprintf("%d%s", index, ext)
	fullDir := filepath.Join(s.dir, relDir)
	fullPath := filepath.Join(fullDir, fileName)
	public := "/images/" + relDir + "/" + fileName

	if _, err := os.Stat(fullPath); err == nil {
		return public, nil // já baixada — sincronização repetida é barata
	}

	if err := os.MkdirAll(fullDir, 0o755); err != nil {
		return "", fmt.Errorf("não consegui criar %s: %w", fullDir, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")

	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d ao baixar %s", res.StatusCode, sourceURL)
	}

	// Escreve num arquivo temporário e renomeia no final: uma falha no meio
	// do download nunca deixa um arquivo corrompido com o nome final.
	tmp, err := os.CreateTemp(fullDir, "download-*")
	if err != nil {
		return "", err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath) // no-op se o rename já tiver acontecido

	if _, err := io.Copy(tmp, io.LimitReader(res.Body, 10<<20)); err != nil { // teto de 10 MB
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(tmpPath, fullPath); err != nil {
		return "", err
	}
	return public, nil
}

func extensionOf(sourceURL string) string {
	u, err := url.Parse(sourceURL)
	if err != nil {
		return ".jpg"
	}
	ext := strings.ToLower(filepath.Ext(u.Path))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp":
		return ext
	default:
		return ".jpg"
	}
}

// safeName garante um nome de pasta previsível mesmo se o SKU vier com
// caractere estranho — nunca deixa a extração da Lilly escrever fora do
// diretório de uploads (path traversal).
func safeName(s string) string {
	s = strings.TrimSpace(s)
	if s == "" || strings.ContainsAny(s, "/\\.") {
		sum := sha256.Sum256([]byte(s + time.Now().String()))
		return hex.EncodeToString(sum[:8])
	}
	return s
}

// MaxUploadBytes é o maior arquivo aceito do painel (foto, banner).
const MaxUploadBytes = 5 << 20

var uploadFolders = map[string]bool{"produtos": true, "banners": true, "galeria": true}

// SaveUpload guarda uma imagem enviada pelo painel (decisão 35) em
// <dir>/uploads/<pasta>/<hash><ext> e devolve o caminho público. O tipo é
// conferido pelo conteúdo, não pelo nome do arquivo: só JPEG, PNG e WebP.
// O nome vem do hash, então reenviar a mesma foto não duplica nada.
func (s *Store) SaveUpload(r io.Reader, folder string) (string, error) {
	if !uploadFolders[folder] {
		return "", fmt.Errorf("pasta de upload inválida")
	}
	data, err := io.ReadAll(io.LimitReader(r, MaxUploadBytes+1))
	if err != nil {
		return "", err
	}
	if len(data) > MaxUploadBytes {
		return "", fmt.Errorf("a imagem passa de 5 MB")
	}
	ext := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[http.DetectContentType(data)]
	if ext == "" {
		return "", fmt.Errorf("envie uma foto em JPG, PNG ou WebP")
	}
	sum := sha256.Sum256(data)
	name := hex.EncodeToString(sum[:12]) + ext
	dir := filepath.Join(s.dir, "uploads", folder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	full := filepath.Join(dir, name)
	if _, err := os.Stat(full); err != nil {
		if err := os.WriteFile(full, data, 0o644); err != nil {
			return "", err
		}
	}
	return "/images/uploads/" + folder + "/" + name, nil
}
