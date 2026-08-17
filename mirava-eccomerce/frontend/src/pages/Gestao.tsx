// Painel de despacho — a tela que a dona abre no sábado, voltando dos Correios.
//
// É o começo do painel de gestão, não o painel inteiro: faz a única coisa que
// depende de uma informação que só ela tem, o código de rastreio. Todo o resto
// do caminho do pedido o sistema movimenta sozinho.
//
// SEGURANÇA: a autorização aqui é o CRON_SECRET, digitado uma vez e guardado
// em sessionStorage — some quando fecha o navegador. É solução de transição,
// honesta sobre o que é: o segredo trafega do navegador para a API, então só
// use nesta máquina. Quando existir login de admin de verdade (a tabela
// `admins` já está no schema), esta tela troca a chave por sessão e o resto
// continua igual.

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Check, Loader2, PackageCheck, RefreshCw } from "lucide-react";
import { BASE_URL } from "../lib/api";
import { formatarBRL } from "../lib/dinheiro";
import { formatDate } from "../lib/pedidos";

const CHAVE = "mirava.gestao.segredo";

interface ItemFila {
  name: string;
  size: string | null;
  quantity: number;
  price_cents: number;
}

interface PedidoFila {
  id: string;
  number: number;
  status: string;
  stage: string;
  customer_name: string;
  total_cents: number;
  shipping_method: string | null;
  address: Record<string, string> | null;
  paid_at: string | null;
  items: ItemFila[];
}

async function gestaoFetch<T>(segredo: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${segredo}`,
    },
  });
  const texto = await res.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!res.ok) throw new Error(dados?.error ?? "Algo deu errado");
  return dados as T;
}

export default function Gestao() {
  const [segredo, setSegredo] = useState(() => sessionStorage.getItem(CHAVE) ?? "");
  const [autenticado, setAutenticado] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoFila[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(chave: string) {
    setCarregando(true);
    setErro(null);
    try {
      const fila = await gestaoFetch<PedidoFila[] | null>(chave, "/gestao/pedidos");
      setPedidos(fila ?? []);
      setAutenticado(true);
      sessionStorage.setItem(CHAVE, chave);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar");
      setAutenticado(false);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (segredo) void carregar(segredo);
    // Só na montagem: recarregar a cada tecla digitada no campo do segredo
    // faria uma requisição por caractere.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!autenticado) {
    return (
      <div className="mx-auto max-w-sm px-4 py-24 sm:px-8">
        <h1 className="m-0 font-serif text-[24px] font-normal">Painel da Mirava</h1>
        <p className="m-0 mt-2 mb-6 text-[13px] leading-relaxed text-ink-soft">
          Cole a chave de gestão (o <code>CRON_SECRET</code> do seu <code>.env</code>).
        </p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void carregar(segredo);
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            value={segredo}
            onChange={(e) => setSegredo(e.target.value)}
            placeholder="chave de gestão"
            className="rounded-[10px] border border-mauve/50 px-4 py-3 text-[14px] outline-none focus:border-wine"
          />
          {erro && <p className="m-0 text-[12.5px] text-wine-dark">{erro}</p>}
          <button
            type="submit"
            disabled={carregando || !segredo}
            className="cursor-pointer rounded-full bg-wine p-3.5 font-serif text-[13px] font-semibold tracking-[0.18em] text-white uppercase hover:bg-wine-dark disabled:opacity-50"
          >
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="mb-8 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="m-0 font-serif text-[26px] font-normal">Pedidos para despachar</h1>
          <p className="m-0 mt-1 text-[12.5px] text-mauve">
            {pedidos.length === 0
              ? "Nenhum pedido na fila."
              : `${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"} · o mais antigo primeiro`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar(segredo)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-mauve px-4 py-2 text-[11.5px] text-ink hover:border-wine hover:text-wine"
        >
          <RefreshCw className="h-3 w-3" strokeWidth={1.8} />
          Atualizar
        </button>
      </div>

      {erro && (
        <p className="m-0 mb-5 flex items-center gap-2 rounded-[10px] bg-blush px-4 py-3 text-[12.5px] text-wine-dark">
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          {erro}
        </p>
      )}

      {pedidos.length === 0 && !carregando && (
        <div className="flex flex-col items-center gap-3 rounded-[16px] border border-blush py-16 text-center">
          <PackageCheck className="h-8 w-8 text-mauve" strokeWidth={1.3} />
          <p className="m-0 font-serif text-[18px]">Tudo despachado</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {pedidos.map((p) => (
          <CartaoPedido
            key={p.id}
            pedido={p}
            segredo={segredo}
            onDespachado={() => setPedidos((atual) => atual.filter((x) => x.id !== p.id))}
          />
        ))}
      </div>
    </div>
  );
}

function CartaoPedido({
  pedido,
  segredo,
  onDespachado,
}: {
  pedido: PedidoFila;
  segredo: string;
  onDespachado: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  const end = pedido.address ?? {};

  async function despachar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await gestaoFetch(segredo, `/gestao/pedidos/${pedido.id}/despachar`, {
        method: "POST",
        body: JSON.stringify({ tracking_code: codigo }),
      });
      setPronto(true);
      // Espera o "pronto" aparecer antes de tirar o cartão da lista — some
      // instantaneamente daria a sensação de que nada aconteceu.
      setTimeout(onDespachado, 1200);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui despachar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-[16px] border border-blush p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-serif text-[18px] text-ink">Pedido #{pedido.number}</span>
        <span className="text-[12px] text-mauve">
          pago em {formatDate(pedido.paid_at)} · {formatarBRL(pedido.total_cents)}
          {pedido.shipping_method === "sedex" && (
            <strong className="ml-2 rounded-full bg-wine px-2 py-0.5 text-[10px] font-medium text-white uppercase">
              SEDEX
            </strong>
          )}
        </span>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="m-0 text-[10.5px] tracking-[0.14em] text-ink-soft uppercase">Peças</p>
          <ul className="m-0 mt-1.5 list-none p-0">
            {pedido.items.map((it, i) => (
              <li key={i} className="text-[13px] text-ink-soft">
                {it.quantity}× {it.name}
                {it.size && ` · ${it.size}`}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="m-0 text-[10.5px] tracking-[0.14em] text-ink-soft uppercase">Entregar em</p>
          <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            {end.recipient ?? pedido.customer_name}
            <br />
            {end.street}, {end.number}
            {end.complement ? ` · ${end.complement}` : ""}
            <br />
            {end.neighborhood} · {end.city}/{end.state}
            <br />
            CEP {end.zip_code}
          </p>
        </div>
      </div>

      {pronto ? (
        <p className="m-0 mt-4 flex items-center gap-2 rounded-[10px] bg-cream px-4 py-3 text-[13px] text-wine-dark">
          <Check className="h-4 w-4" strokeWidth={2.2} />
          Despachado. A cliente já recebeu o e-mail com o rastreio.
        </p>
      ) : (
        <form onSubmit={despachar} className="mt-4 flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="AA123456789BR"
            required
            className="min-w-0 flex-1 rounded-[10px] border border-mauve/50 px-3.5 py-2.5 text-[14px] tracking-[0.06em] outline-none focus:border-wine"
          />
          <button
            type="submit"
            disabled={enviando}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-wine px-5 py-2.5 font-serif text-[12.5px] font-semibold tracking-[0.14em] text-white uppercase hover:bg-wine-dark disabled:opacity-50"
          >
            {enviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
            ) : (
              <PackageCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
            )}
            Despachar
          </button>
          {erro && <p className="m-0 w-full text-[12px] text-wine-dark">{erro}</p>}
        </form>
      )}
    </div>
  );
}
