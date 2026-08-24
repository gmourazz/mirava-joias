import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Package } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { formatarBRL } from "../lib/dinheiro";
import {
  STAGE_LABEL,
  formatDate,
  listOrders,
  stageOf,
  type Order,
} from "../lib/pedidos";

export default function Conta() {
  const { user, loading, login, signup, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Quando o painel manda pra cá porque ninguém estava logada (ver
  // AdminLayout.tsx), guarda pra onde voltar depois do login — senão a
  // cliente entra e cai em "Minha conta", em vez do lugar que queria.
  const from = (location.state as { from?: string } | null)?.from;
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && from) navigate(from, { replace: true });
  }, [user, from, navigate]);

  if (loading) return null;

  if (user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
        <h1 className="m-0 font-serif text-[26px] font-normal text-wine">Minha conta</h1>
        <p className="mt-2 mb-10 text-[14px] text-ink-soft">
          Olá, {user.name || user.email}.
        </p>

        <MeusPedidos />

        <button
          type="button"
          onClick={logout}
          className="mt-12 cursor-pointer rounded-full border border-mauve bg-none px-5 py-2.5 text-[12px] tracking-[0.14em] text-ink uppercase hover:border-wine hover:text-wine"
        >
          Sair
        </button>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-8">
      <h1 className="font-serif text-2xl text-wine">
        {mode === "login" ? "Entrar" : "Criar conta"}
      </h1>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border border-mauve/40 bg-paper px-4 py-3 text-sm text-ink outline-none focus:border-wine"
          />
        )}
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border border-mauve/40 bg-paper px-4 py-3 text-sm text-ink outline-none focus:border-wine"
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="border border-mauve/40 bg-paper px-4 py-3 text-sm text-ink outline-none focus:border-wine"
        />

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 bg-wine px-5 py-3 text-[13px] tracking-[0.14em] text-white uppercase cursor-pointer disabled:opacity-60"
        >
          {submitting ? "Enviando…" : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-5 border-none bg-none p-0 text-[13px] text-mauve underline cursor-pointer"
      >
        {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}

// MeusPedidos lista as compras da cliente, da mais recente para a mais antiga.
//
// Mostra a etapa pública ("Em preparação", "A caminho"), não o status interno:
// lote e compra na fornecedora são detalhe de operação, não informação útil
// para quem está esperando a peça chegar.
function MeusPedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="m-0 text-[13px] text-mauve">Carregando seus pedidos…</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[16px] border border-blush py-14 text-center">
        <Package className="h-7 w-7 text-mauve" strokeWidth={1.3} />
        <p className="m-0 font-serif text-[18px] text-ink">Nenhum pedido ainda</p>
        <Link
          to="/categoria/colecoes/todos"
          className="mt-1 rounded-full bg-wine px-6 py-2.5 font-serif text-[12.5px] font-semibold tracking-[0.16em] text-white uppercase hover:bg-wine-dark"
        >
          Ver coleções
        </Link>
      </div>
    );
  }

  return (
    <section>
      <h2 className="m-0 mb-4 font-serif text-[19px] font-normal">Meus pedidos</h2>
      <div className="flex flex-col gap-2.5">
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/pedido/${o.id}`}
            className="flex items-center gap-4 rounded-[14px] border border-blush p-4 transition hover:border-rose"
          >
            <div className="flex-1">
              <span className="block font-serif text-[16px] text-ink">Pedido #{o.number}</span>
              <span className="text-[12px] text-mauve">{formatDate(o.created_at)}</span>
            </div>
            <span className="rounded-full bg-cream px-3 py-1 text-[11px] tracking-[0.08em] text-wine-dark">
              {STAGE_LABEL[stageOf(o.status)]}
            </span>
            <span className="text-[14px] text-ink">{formatarBRL(o.total_cents)}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-mauve" strokeWidth={1.6} />
          </Link>
        ))}
      </div>
    </section>
  );
}
