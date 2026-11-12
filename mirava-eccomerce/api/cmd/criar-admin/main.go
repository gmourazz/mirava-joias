// criar-admin cria um usuário do painel (decisão 46). A senha vem pela entrada
// padrão, para não ficar no histórico do terminal nem em arquivo:
//
//	printf '%s' 'a-senha' | go run ./cmd/criar-admin -usuario fulana -nome "Fulana" -papel master
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/mirava/api/internal/auth"
	"github.com/mirava/api/internal/db"
)

func main() {
	usuario := flag.String("usuario", "", "nome de usuário (minúsculas)")
	nome := flag.String("nome", "", "nome de quem usa o painel")
	papel := flag.String("papel", "master", "master ou dispatch")
	flag.Parse()

	if *usuario == "" || *nome == "" || (*papel != "master" && *papel != "dispatch") {
		fmt.Fprintln(os.Stderr, "uso: (senha pela entrada padrão) | criar-admin -usuario fulana -nome \"Fulana\" [-papel master|dispatch]")
		os.Exit(2)
	}
	senha, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	senha = strings.TrimRight(senha, "\r\n")
	if auth.WeakPassword(senha) {
		fmt.Fprintln(os.Stderr, "a senha precisa ter pelo menos 8 caracteres")
		os.Exit(1)
	}

	carregarEnv(".env")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	banco, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Fprintln(os.Stderr, "banco:", err)
		os.Exit(1)
	}
	hash, err := auth.HashPassword(senha)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if _, err := banco.CreateAdminUser(ctx, *usuario, *nome, hash, *papel); err != nil {
		fmt.Fprintln(os.Stderr, "não criei:", err)
		os.Exit(1)
	}
	fmt.Printf("usuário %s criado (%s)\n", strings.ToLower(*usuario), *papel)
}

// carregarEnv lê DATABASE_URL do .env quando ela não veio do ambiente.
func carregarEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, linha := range strings.Split(string(data), "\n") {
		chave, valor, ok := strings.Cut(strings.TrimSpace(linha), "=")
		if !ok || strings.HasPrefix(chave, "#") {
			continue
		}
		if _, existe := os.LookupEnv(chave); !existe {
			_ = os.Setenv(strings.TrimSpace(chave), strings.Trim(strings.TrimSpace(valor), `"'`))
		}
	}
}
