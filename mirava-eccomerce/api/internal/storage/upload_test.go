package storage

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"os"
	"strings"
	"testing"
)

func pngPequeno(t *testing.T) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.White)
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func TestSaveUploadGuardaImagem(t *testing.T) {
	s, _ := New(t.TempDir())
	data := pngPequeno(t)
	path, err := s.SaveUpload(bytes.NewReader(data), "banners")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(path, "/images/uploads/banners/") || !strings.HasSuffix(path, ".png") {
		t.Fatalf("caminho %q", path)
	}
	// Mesma imagem, mesmo arquivo (nome pelo conteúdo).
	again, _ := s.SaveUpload(bytes.NewReader(data), "banners")
	if again != path {
		t.Fatalf("esperado o mesmo caminho, veio %q", again)
	}
	if _, err := os.Stat(s.dir + strings.TrimPrefix(path, "/images")); err != nil {
		t.Fatalf("arquivo não está no disco: %v", err)
	}
}

func TestSaveUploadRecusaOQueNaoEImagem(t *testing.T) {
	s, _ := New(t.TempDir())
	if _, err := s.SaveUpload(strings.NewReader("<html>oi</html>"), "banners"); err == nil {
		t.Error("HTML não pode virar imagem")
	}
	if _, err := s.SaveUpload(bytes.NewReader(pngPequeno(t)), "../fora"); err == nil {
		t.Error("pasta com .. não pode passar")
	}
	grande := append(pngPequeno(t), make([]byte, MaxUploadBytes)...)
	if _, err := s.SaveUpload(bytes.NewReader(grande), "banners"); err == nil {
		t.Error("arquivo acima do limite deveria ser recusado")
	}
}
