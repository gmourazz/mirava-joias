# Como rodar a Mirava num computador novo

Este guia é pra quando você (ou alguém no seu lugar) abrir o projeto pela
primeira vez numa máquina diferente. O código inteiro vai pelo Git — o que
**não** vai pelo Git são os segredos (senhas, chaves de API) e o Docker em
si, que é um programa que se instala no sistema, não um arquivo do projeto.

## 1. Instalar o que a máquina precisa ter

Três programas, uma vez só:

| Programa | Pra quê | Como instalar |
|---|---|---|
| **Docker Desktop** | roda o banco de dados (Postgres) | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) — baixa, instala, abre uma vez pra ele ficar rodando em segundo plano |
| **Go** (1.23 ou mais novo) | roda a API (o "motor" da loja) | [go.dev/dl](https://go.dev/dl/) |
| **Node.js** (20 ou mais novo) | roda o site (front-end) | [nodejs.org](https://nodejs.org/) — baixa a versão **LTS** |

Depois de instalar, confirma no Terminal que os três respondem:

```bash
docker --version
go version
node --version
```

Se algum desses comandos disser "command not found", a instalação não
terminou — reabre o instalador ou reinicia o computador.

## 2. Baixar o projeto

```bash
git clone https://github.com/gmourazz/mirava-joias.git
cd mirava-joias/mirava-eccomerce
```

## 3. Instalar as dependências do site

```bash
cd frontend
npm install
cd ..
```

## 4. Preencher os segredos (isso NÃO vem pelo Git, de propósito)

O Git nunca leva senha nem chave de API — é assim que se evita vazar um
segredo sem querer num repositório. Por isso, depois de clonar, faltam dois
arquivos que você precisa criar à mão nesta máquina nova.

### 4.1. `api/.env`

```bash
cp api/.env.exemplo api/.env
```

Abre `api/.env` e preenche com os MESMOS valores que estão no `.env` do seu
computador antigo (copie de lá — WhatsApp, mensagem ou um cofre de senhas
servem; não sobre por e-mail nem chat sem criptografia). Os principais:

- `AUTH_SECRET` — se trocar o valor, todo mundo que estava logado é
  desconectado. Se for continuar a mesma loja, use o valor antigo.
- `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` — credenciais do Mercado Pago.
- `RESEND_API_KEY` — envio de e-mail.
- `CRON_SECRET` — senha do painel de gestão (`/gestao`) e das tarefas
  agendadas.

### 4.2. `frontend/.env.local`

```bash
cp frontend/.env.exemplo frontend/.env.local
```

Esse aqui não tem segredo — só o endereço da API. Pode deixar o padrão
(`http://localhost:8080`) se for rodar tudo na mesma máquina.

## 5. Subir o banco de dados (Docker)

A configuração do banco já está no projeto (`db/docker-compose.yml`) —
não precisa instalar Postgres separado, o Docker cuida disso:

```bash
cd db
docker compose up -d
```

Espera uns 10 segundos o banco terminar de subir, depois cria as tabelas
(só precisa fazer isso uma vez por máquina):

```bash
docker exec -i mirava-postgres psql -U mirava -d mirava < schema.sql
```

Confirma que as tabelas foram criadas:

```bash
docker exec -it mirava-postgres psql -U mirava -d mirava -c '\dt public.*'
```

Deve listar várias tabelas (`products`, `orders`, `users`...). Se vier vazio,
o `schema.sql` não rodou — repete o comando de cima.

### Se você já tem os dados de antes (produtos, pedidos...)

O `docker compose up -d` acima cria um banco **vazio**. Se você quer os
mesmos produtos e pedidos do computador antigo, o jeito é copiar um backup
do banco antigo para o novo — isso é um passo à parte, avise que eu ajudo
na hora.

## 6. Subir tudo de uma vez

Com o banco no ar, um único comando liga a API e o site juntos:

```bash
cd ..    # volta pra mirava-eccomerce/
./rodar.sh
```

Ele confere se Docker/Go/Node estão instalados, sobe o banco (se ainda não
tiver subido), espera ficar pronto, e liga a API e o site em paralelo, com
os logs misturados na mesma janela — `[api]` e `[front]`. **Ctrl+C** nessa
janela derruba tudo de uma vez.

Quando aparecer "Tudo no ar", abre no navegador:

- Site: <http://localhost:5173>
- Painel de gestão: <http://localhost:5173/gestao> (pede o `CRON_SECRET`)

## 7. Se você é a admin, vira admin também nesta máquina

Cadastre sua conta pelo site (`/conta`) normalmente, depois pega o `id`
dela e roda:

```bash
docker exec -it mirava-postgres psql -U mirava -d mirava -c \
  "insert into public.admins (user_id) select id from public.users where email = 'SEU-EMAIL-AQUI';"
```

## Resumo — só os comandos, sem explicação

```bash
git clone https://github.com/gmourazz/mirava-joias.git
cd mirava-joias/mirava-eccomerce
cd frontend && npm install && cd ..
cp api/.env.exemplo api/.env          # preencha à mão com os segredos
cp frontend/.env.exemplo frontend/.env.local
cd db && docker compose up -d
docker exec -i mirava-postgres psql -U mirava -d mirava < schema.sql
cd ..
./rodar.sh
```
