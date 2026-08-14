# Build em duas etapas: a imagem final não carrega compilador nem código-fonte.
# Resultado: ~15 MB, sem shell e sem gerenciador de pacotes — nada para um
# invasor usar se conseguir execução dentro do container.

FROM golang:1.23-alpine AS build

WORKDIR /src

# Copiar go.mod antes do código aproveita o cache do Docker: mudar um .go
# não refaz o download das dependências.
COPY go.mod go.sum* ./
RUN go mod download

COPY . .

# CGO desligado gera binário estático, que roda em imagem sem libc.
# -trimpath e -ldflags="-s -w" tiram caminhos locais e símbolos de debug.
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath -ldflags="-s -w" \
    -o /bin/servidor ./cmd/servidor

# ---------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot

# Certificados para falar HTTPS com Mercado Pago, Supabase e uselilly.com.
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /bin/servidor /servidor

# Roda como usuário sem privilégio.
USER nonroot:nonroot

EXPOSE 8080
ENTRYPOINT ["/servidor"]
