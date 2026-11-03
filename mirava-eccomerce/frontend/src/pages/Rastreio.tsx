// "Acompanhe seu pedido" (v5), sem precisar entrar na conta: número do pedido
// + e-mail usado na compra. Os dois precisam bater (o número sozinho é
// sequencial e mostraria pedido alheio) — a conferência é da API, em
// POST /pedidos/rastrear.

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Order } from "../lib/pedidos";
import AcompanhamentoPedido from "../components/AcompanhamentoPedido";

export default function Rastreio() {
  const [numero, setNumero] = useState("");
  const [email, setEmail] = useState("");
  const [pedido, setPedido] = useState<Order | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setPedido(null);
    const n = Number(numero.replace(/\D/g, ""));
    if (!n) {
      setErro("Digite o número do pedido, como aparece no e-mail (ex.: #1043).");
      return;
    }
    setBuscando(true);
    try {
      setPedido(await api<Order>("/pedidos/rastrear", { method: "POST", body: { number: n, email: email.trim() } }));
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui buscar o pedido agora.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <div className="bg-mist">
        <div className="mx-auto flex max-w-[880px] flex-col items-center gap-4 px-[clamp(16px,3vw,40px)] py-12 text-center">
          <span className="grid h-[62px] w-[62px] place-items-center rounded-full bg-white text-teal">
            <Truck size={28} strokeWidth={1.6} />
          </span>
          <h1 className="m-0 font-serif text-[clamp(34px,4vw,52px)] leading-[1.05] font-normal text-teal-dark">Acompanhe seu pedido</h1>
          <p className="m-0 text-[15px] text-text-2">Digite o número do pedido que enviamos por e-mail e o e-mail usado na compra.</p>
          <form
            onSubmit={buscar}
            className="mt-2 grid w-full max-w-[640px] gap-2 rounded-[28px] bg-white p-1.5 shadow-[0_12px_30px_rgba(11,74,77,0.08)] sm:grid-cols-[150px_1fr_auto]"
          >
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex.: #1043"
              inputMode="numeric"
              className="min-w-0 rounded-full border-none bg-transparent px-4 py-3 text-[15px] outline-none"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail da compra"
              required
              className="min-w-0 rounded-full border-none bg-transparent px-4 py-3 text-[15px] outline-none sm:border-l sm:border-line"
            />
            <button type="submit" disabled={buscando} className="cursor-pointer rounded-full border-none bg-teal px-6 py-3 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-60">
              {buscando ? "Buscando…" : "Rastrear →"}
            </button>
          </form>
          <span className="text-[13px] text-muted">
            Tem conta? Seus pedidos também ficam em{" "}
            <Link to="/conta?aba=pedidos" className="font-semibold text-teal">
              Minha conta
            </Link>
            .
          </span>
        </div>
      </div>

      <div className="mx-auto grid max-w-[880px] gap-5 px-[clamp(16px,3vw,40px)] pt-8">
        {erro && (
          <p className="animate-fade-in m-0 rounded-[22px] bg-[#FDECEC] px-5 py-4 text-[14.5px] text-[#B4443C]">
            {erro} Se precisar, fale com a gente por e-mail.
          </p>
        )}
        {pedido && (
          <div className="animate-pop">
            <AcompanhamentoPedido order={pedido} />
          </div>
        )}
      </div>
    </div>
  );
}
