// Página do pedido — serve para dois momentos.
//
// 1. O retorno do Mercado Pago (?status=sucesso|pendente|falha), logo depois
//    de pagar.
// 2. A cliente voltando dias depois para saber onde a peça está.
//
// O QUE ESTA PÁGINA NUNCA FAZ: afirmar que o pagamento foi aprovado com base
// no `?status` da URL. Qualquer pessoa digita `?status=sucesso` na barra do
// navegador. O status exibido vem SEMPRE do banco, e quem escreve no banco é
// o webhook, depois de validar assinatura e reconsultar o Mercado Pago. O
// `?status` só decide o tom da faixa no topo — e some quando o dado real
// chega.

import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Check, Clock, CreditCard, Gem, Truck, XCircle } from "lucide-react";
import { textoPrazo } from "../lib/dinheiro";
import { useCart } from "../context/CartContext";
import { getOrder, type Order } from "../lib/pedidos";
import { ApiError } from "../lib/api";
import AcompanhamentoPedido from "../components/AcompanhamentoPedido";
import CancelarPedido from "../components/CancelarPedido";

export default function Pedido() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const retorno = params.get("status");
  const { clearCart } = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    // Esvazia a sacola só quando o Mercado Pago disse que deu certo. Em falha,
    // a cliente volta com tudo no lugar e tenta de novo sem reescolher peça.
    if (retorno === "sucesso") clearCart();
    // Depende só de `retorno`: `clearCart` é recriada a cada render e
    // incluí-la aqui faria o efeito rodar em laço.
  }, [retorno]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getOrder(id)
      .then(setOrder)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 401
            ? "Entre na sua conta para ver este pedido."
            : e instanceof ApiError
              ? e.message
              : "Não consegui carregar o pedido.",
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const recemCriado = retorno === "sucesso" || retorno === "pendente";

  return (
    <div className="bg-snow pb-20">
      <div className="mx-auto grid max-w-[760px] gap-5 px-[clamp(16px,3vw,40px)] pt-10">
        {/* Retorno do Mercado Pago: recado do momento, não estado do pedido.
            "Recebemos o pedido" é verdade sempre; "pago" só quando o webhook
            confirmar — e aí quem mostra é a linha do tempo, vinda do banco. */}
        {recemCriado && (
          <div className="animate-pop flex flex-col items-center gap-3 rounded-3xl border border-line bg-white px-6 py-9 text-center">
            <span className="grid h-[70px] w-[70px] place-items-center rounded-full bg-teal text-white">
              <Check size={34} strokeWidth={2.4} />
            </span>
            <h1 className="m-0 font-serif text-[clamp(28px,3.4vw,38px)] leading-[1.1] font-normal text-teal-dark">
              {order ? `Pedido #${order.number} recebido!` : "Pedido recebido!"}
            </h1>
            <p className="m-0 max-w-[46ch] text-[15px] leading-relaxed text-text-2">
              {retorno === "pendente"
                ? "Seu pagamento ainda está sendo processado. Pode levar alguns minutos; avisamos por e-mail assim que for aprovado."
                : "Assim que o pagamento for confirmado, o acompanhamento abaixo muda sozinho e você recebe um e-mail nosso."}
            </p>
          </div>
        )}

        {retorno === "falha" && (
          <div className="flex items-start gap-3 rounded-[22px] bg-[#FDECEC] px-5 py-4 text-[14px] leading-relaxed text-[#B4443C]">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.8} />
            <span>
              O pagamento não foi concluído e nada foi cobrado. Sua sacola continua do jeito que você deixou.{" "}
              <Link to="/checkout" className="font-semibold text-[#B4443C] underline">Tentar de novo</Link>
            </span>
          </div>
        )}

        {recemCriado && (
          <div className="rounded-3xl border border-line bg-white p-6">
            <h2 className="m-0 mb-4 font-serif text-[22px] font-normal text-teal-dark">E agora?</h2>
            <ol className="m-0 grid list-none gap-4 p-0">
              {PROXIMOS.map(({ Icon, t, d }) => (
                <li key={t} className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mist text-teal">
                    <Icon size={18} strokeWidth={1.7} />
                  </span>
                  <span className="grid">
                    <span className="text-[15px] font-semibold text-text">{t}</span>
                    <span className="text-[13.5px] text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {loading && <p className="m-0 py-16 text-center text-[14px] text-muted">Carregando…</p>}

        {!loading && error && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="m-0 font-serif text-[24px] text-teal-dark">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/conta" className="rounded-full bg-teal px-7 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white">
                Ir para minha conta
              </Link>
              <Link to="/rastreio" className="rounded-full border-[1.5px] border-line-strong px-7 py-3.5 text-[14px] font-semibold text-teal">
                Acompanhar sem entrar
              </Link>
            </div>
          </div>
        )}

        {!loading && order && <AcompanhamentoPedido order={order} />}
        {!loading && order && (
          <CancelarPedido order={order} onCancelado={() => void getOrder(order.id).then(setOrder).catch(() => {})} />
        )}

        {recemCriado && (
          <Link to="/" className="mx-auto rounded-full border-[1.5px] border-line-strong bg-white px-7 py-3.5 text-[14px] font-semibold text-teal hover:border-teal">
            Continuar comprando
          </Link>
        )}
      </div>
    </div>
  );
}

const PROXIMOS = [
  { Icon: CreditCard, t: "Confirmamos o pagamento", d: "Pix aprova na hora; cartão, em poucos minutos" },
  { Icon: Gem, t: "Encomendamos a sua peça", d: "Logo depois da confirmação" },
  { Icon: Truck, t: "Despachamos com rastreio", d: "Código por e-mail" },
  { Icon: Clock, t: `Chega em ${textoPrazo()}`, d: "Contados a partir da confirmação do pagamento" },
];
