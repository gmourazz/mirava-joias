import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { ApiError } from "../../lib/api";
import { formatarBRL } from "../../lib/dinheiro";
import { listAdminProducts, updateAdminProduct, type AdminProduct } from "../../lib/admin";

export default function AdminProdutos() {
  const [produtos, setProdutos] = useState<AdminProduct[]>([]);
  const [busca, setBusca] = useState("");
  const [pendentes, setPendentes] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setProdutos(await listAdminProducts({ search: busca || undefined, pendingOnly: pendentes }));
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui carregar os produtos");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 300); // debounce da busca
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, pendentes]);

  function atualizarNaLista(id: string, patch: Partial<AdminProduct>) {
    setProdutos((atual) => atual.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const pendentesCount = produtos.filter((p) => p.suggested_price_cents != null).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
      <h1 className="m-0 mb-1 font-serif text-[26px] font-normal text-wine">Produtos</h1>
      <p className="m-0 mb-6 text-[12.5px] text-ink-soft">
        Publicar, despublicar e corrigir preço. Custo vem sempre da sincronização — não dá pra editar aqui.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome…"
          className="min-w-0 flex-1 rounded-[10px] border border-mauve/50 bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-wine"
        />
        <button
          type="button"
          onClick={() => setPendentes((v) => !v)}
          className={`shrink-0 cursor-pointer rounded-full border px-4 py-2 text-[12px] font-medium transition-colors ${
            pendentes ? "border-wine bg-wine text-white" : "border-mauve text-ink hover:border-wine"
          }`}
        >
          Só travados pelo disjuntor{pendentesCount > 0 && !pendentes ? ` (${pendentesCount})` : ""}
        </button>
      </div>

      {erro && (
        <p className="m-0 mb-5 flex items-center gap-2 rounded-[10px] bg-blush px-4 py-3 text-[12.5px] text-wine-dark">
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="m-0 text-[13px] text-mauve">Carregando…</p>
      ) : produtos.length === 0 ? (
        <p className="m-0 text-[13px] text-mauve">Nenhum produto encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {produtos.map((p) => (
            <ProdutoLinha key={p.id} produto={p} onMudou={(patch) => atualizarNaLista(p.id, patch)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProdutoLinha({
  produto,
  onMudou,
}: {
  produto: AdminProduct;
  onMudou: (patch: Partial<AdminProduct>) => void;
}) {
  const [preco, setPreco] = useState((produto.price_cents / 100).toFixed(2));
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const margemPct = produto.price_cents > 0
    ? Math.round(((produto.price_cents - produto.cost_cents) / produto.price_cents) * 100)
    : 0;

  async function salvarPreco() {
    const cents = Math.round(parseFloat(preco.replace(",", ".")) * 100);
    if (!cents || cents <= 0) {
      setErro("Preço inválido");
      return;
    }
    setErro(null);
    setSalvando("preco");
    try {
      await updateAdminProduct(produto.id, { price_cents: cents });
      onMudou({ price_cents: cents, suggested_price_cents: null, suggestion_reason: null });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 1500);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui salvar");
    } finally {
      setSalvando(null);
    }
  }

  async function aceitarSugestao() {
    setSalvando("sugestao");
    setErro(null);
    try {
      await updateAdminProduct(produto.id, { accept_suggestion: true });
      if (produto.suggested_price_cents != null) {
        setPreco((produto.suggested_price_cents / 100).toFixed(2));
        onMudou({ price_cents: produto.suggested_price_cents, suggested_price_cents: null, suggestion_reason: null });
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui aplicar a sugestão");
    } finally {
      setSalvando(null);
    }
  }

  async function alternar(campo: "published" | "featured") {
    setSalvando(campo);
    setErro(null);
    try {
      await updateAdminProduct(produto.id, { [campo]: !produto[campo] });
      onMudou({ [campo]: !produto[campo] });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui salvar");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="rounded-[14px] border border-blush bg-white p-4 shadow-[0_6px_18px_-12px_rgba(92,42,70,0.18)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[13.5px] text-ink">{produto.name}</p>
          <p className="m-0 text-[11px] text-mauve">
            {produto.category} · {produto.metal} · custo {formatarBRL(produto.cost_cents)} · margem {margemPct}%
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[12px] text-ink-soft">R$</span>
          <input
            type="text"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className="w-24 rounded-[8px] border border-mauve/50 px-2.5 py-1.5 text-[13px] outline-none focus:border-wine"
          />
          <button
            type="button"
            onClick={() => void salvarPreco()}
            disabled={salvando !== null}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-mauve px-3 py-1.5 text-[11.5px] text-ink hover:border-wine hover:text-wine disabled:opacity-50"
          >
            {salvando === "preco" ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : salvo ? <Check className="h-3 w-3" strokeWidth={2.2} /> : null}
            Salvar
          </button>
        </div>

        <button
          type="button"
          onClick={() => void alternar("published")}
          disabled={salvando !== null}
          className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase transition-colors disabled:opacity-50 ${
            produto.published ? "border-wine bg-wine text-white" : "border-mauve text-ink-soft"
          }`}
        >
          {produto.published ? "Publicado" : "Fora do ar"}
        </button>

        <button
          type="button"
          onClick={() => void alternar("featured")}
          disabled={salvando !== null}
          className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase transition-colors disabled:opacity-50 ${
            produto.featured ? "border-wine bg-cream text-wine-dark" : "border-mauve text-ink-soft"
          }`}
        >
          Destaque
        </button>
      </div>

      {produto.suggested_price_cents != null && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-blush px-3.5 py-2.5">
          <p className="m-0 text-[12px] text-wine-dark">
            Disjuntor travou o preço: sugestão {formatarBRL(produto.suggested_price_cents)}
            {produto.suggestion_reason && ` — ${produto.suggestion_reason}`}
          </p>
          <button
            type="button"
            onClick={() => void aceitarSugestao()}
            disabled={salvando !== null}
            className="shrink-0 cursor-pointer rounded-full bg-wine px-3.5 py-1.5 text-[11px] font-medium text-white hover:bg-wine-dark disabled:opacity-50"
          >
            {salvando === "sugestao" ? "Aplicando…" : "Aceitar sugestão"}
          </button>
        </div>
      )}

      {erro && <p className="m-0 mt-2 text-[11.5px] text-wine-dark">{erro}</p>}
    </div>
  );
}
