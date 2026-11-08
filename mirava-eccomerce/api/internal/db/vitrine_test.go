package db

import "testing"

func TestAvailableFirst(t *testing.T) {
	ps := []CatalogProduct{
		{Slug: "a", Available: false},
		{Slug: "b", Available: true},
		{Slug: "c", Available: false},
		{Slug: "d", Available: true},
	}
	availableFirst(ps)
	want := []string{"b", "d", "a", "c"}
	for i, slug := range want {
		if ps[i].Slug != slug {
			t.Fatalf("posição %d: veio %q, quero %q", i, ps[i].Slug, slug)
		}
	}
}
