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
import { Clock, XCircle } from "lucide-react";
import { useCart } from "../context/CartContext";
import { getOrder, type Order } from "../lib/pedidos";
import { ApiError } from "../lib/api";
import AcompanhamentoPedido from "../components/AcompanhamentoPedido";

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

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 pb-20 sm:px-8">
      {/* Faixa do retorno do pagamento. Some depois que a cliente sai e
          volta — é recado do momento, não estado do pedido. */}
      {retorno === "sucesso" && (
        <Faixa tom="bom">
          Recebemos seu pedido! Assim que o pagamento for confirmado, o
          acompanhamento abaixo muda sozinho e você recebe um e-mail nosso.
        </Faixa>
      )}
      {retorno === "pendente" && (
        <Faixa tom="neutro" icone={<Clock className="h-4 w-4" strokeWidth={1.6} />}>
          Seu pagamento ainda está sendo processado. Pode levar alguns
          minutos.
        </Faixa>
      )}
      {retorno === "falha" && (
        <Faixa tom="ruim" icone={<XCircle className="h-4 w-4" strokeWidth={1.6} />}>
          O pagamento não foi concluído e nada foi cobrado. Sua sacola continua
          do jeito que você deixou.
        </Faixa>
      )}

      {loading && <p className="m-0 py-16 text-center text-[13px] text-mauve">Carregando…</p>}

      {!loading && error && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="m-0 font-serif text-[20px]">{error}</p>
          <Link
            to="/conta"
            className="rounded-full bg-wine px-7 py-3 font-serif text-[13px] font-semibold tracking-[0.18em] text-white uppercase hover:bg-wine-dark"
          >
            Ir para minha conta
          </Link>
        </div>
      )}

      {!loading && order && <AcompanhamentoPedido order={order} />}
    </div>
  );
}

function Faixa({
  tom,
  icone,
  children,
}: {
  tom: "bom" | "neutro" | "ruim";
  icone?: React.ReactNode;
  children: React.ReactNode;
}) {
  const fundo = tom === "bom" ? "#FFF7FB" : tom === "ruim" ? "#FFE5F0" : "#FFF7FB";
  return (
    <div
      className="mb-8 flex items-start gap-2.5 rounded-[14px] px-4 py-3.5 text-[13px] leading-relaxed text-ink-soft"
      style={{ background: fundo }}
    >
      {icone && <span className="mt-0.5 shrink-0 text-wine">{icone}</span>}
      <span>{children}</span>
    </div>
  );
}
