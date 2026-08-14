import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, Package, ShieldCheck, Sparkles } from "lucide-react";
import { useProduto } from "../catalogo/hooks";
import { urlImagem } from "../catalogo/consultas";
import { ROTULO_CATEGORIA, ROTULO_METAL } from "../catalogo/tipos";
import { formatarBRL, textoParcelas, textoPix, textoPrazo } from "../lib/dinheiro";
import ProductCard from "../components/ProductCard";
import { CatalogoErro } from "../components/EstadosCatalogo";
import Reveal from "../components/Reveal";

export default function Produto() {
  const { slug } = useParams();
  const { dado: produto, carregando, erro, similares } = useProduto(slug);

  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [gravacao, setGravacao] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setImagemAtiva(0);
    setTamanho(null);
  }, [slug]);

  // Pré-seleciona quando só existe uma opção: obrigar a escolher entre uma
  // coisa só é atrito à toa.
  useEffect(() => {
    const disponiveis = produto?.variantes.filter((v) => v.disponivel) ?? [];
    if (disponiveis.length === 1) setTamanho(disponiveis[0].tamanho);
  }, [produto]);

  if (carregando) return <EsqueletoProduto />;

  if (erro) {
    return (
      <div className="px-6 py-24 sm:px-16 lg:px-24">
        <CatalogoErro mensagem={erro} />
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-32 text-center">
        <h1 className="m-0 font-serif text-2xl font-normal">Peça não encontrada</h1>
        <p className="m-0 text-sm text-ink-soft">
          Ela pode ter saído do catálogo. Veja as outras — tem coisa bonita por lá.
        </p>
        <Link
          to="/categoria/colecoes/todos"
          className="rounded-full bg-wine px-6 py-2.5 font-serif text-[13px] font-semibold tracking-[0.18em] text-white uppercase hover:bg-wine-dark"
        >
          Ver coleções
        </Link>
      </div>
    );
  }

  const variantes = produto.variantes.filter((v) => v.disponivel);
  const precisaEscolherTamanho = variantes.length > 1 && !tamanho;
  const ajuste = variantes.find((v) => v.tamanho === tamanho)?.ajustePrecoCentavos ?? 0;
  const preco = produto.precoCentavos + ajuste;
  const capa = urlImagem(produto.imagens[imagemAtiva]);

  return (
    <div className="px-6 pt-8 pb-20 sm:px-16 lg:px-24">
      <nav className="mb-6 text-[11px] tracking-[0.16em] text-mauve uppercase">
        <Link to="/" className="hover:text-wine">Início</Link>
        <span className="mx-2">/</span>
        <Link to={`/categoria/${produto.metal}/${produto.categoria}`} className="hover:text-wine">
          {ROTULO_CATEGORIA[produto.categoria]}
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Galeria */}
        <div className="flex flex-col gap-3">
          <div className="aspect-[4/5] overflow-hidden rounded-[18px] bg-[#FBF6F8]">
            {capa ? (
              <img src={capa} alt={produto.nome} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-mauve">
                sem foto
              </div>
            )}
          </div>

          {produto.imagens.length > 1 && (
            <div className="flex gap-2.5">
              {produto.imagens.slice(0, 5).map((caminho, i) => (
                <button
                  key={caminho}
                  type="button"
                  onClick={() => setImagemAtiva(i)}
                  aria-label={`Foto ${i + 1}`}
                  className="h-16 w-16 cursor-pointer overflow-hidden rounded-[10px] border transition"
                  style={{ borderColor: i === imagemAtiva ? "#8E3B6B" : "#E3B1C8" }}
                >
                  <img
                    src={urlImagem(caminho) ?? ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-plum px-3.5 py-1.5 text-[9.5px] tracking-[0.18em] text-blush uppercase">
              Sob encomenda
            </span>
            <span className="rounded-full border border-mauve px-3 py-1.5 text-[9.5px] tracking-[0.14em] text-ink-soft uppercase">
              {ROTULO_METAL[produto.metal]}
            </span>
          </div>

          <h1 className="m-0 font-serif text-[clamp(26px,3vw,38px)] leading-tight font-normal">
            {produto.nome}
          </h1>

          <div className="flex flex-col gap-1">
            <span className="font-serif text-[30px] text-ink">{formatarBRL(preco)}</span>
            <span className="text-[13px] text-ink-soft">{textoParcelas(preco)}</span>
            <span className="text-[13px] text-wine">{textoPix(preco)}</span>
          </div>

          {!produto.disponivel && (
            <div className="rounded-[12px] bg-veu px-4 py-3 text-[13px] text-ink">
              Esta peça está indisponível no momento. Se quiser, chame no WhatsApp
              que a gente avisa assim que voltar.
            </div>
          )}

          {variantes.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] tracking-[0.16em] text-ink-soft uppercase">
                Tamanho
              </span>
              <div className="flex flex-wrap gap-2">
                {variantes.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setTamanho(v.tamanho)}
                    className="min-w-12 cursor-pointer rounded-full border px-4 py-2 text-[13px] transition"
                    style={{
                      borderColor: tamanho === v.tamanho ? "#8E3B6B" : "#E3B1C8",
                      background: tamanho === v.tamanho ? "#8E3B6B" : "transparent",
                      color: tamanho === v.tamanho ? "#fff" : "#8E3B6B",
                    }}
                  >
                    {v.tamanho}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="gravacao"
              className="text-[11px] tracking-[0.16em] text-ink-soft uppercase"
            >
              Gravação <span className="normal-case tracking-normal">(opcional, até 14 caracteres)</span>
            </label>
            <input
              id="gravacao"
              type="text"
              maxLength={14}
              value={gravacao}
              onChange={(e) => setGravacao(e.target.value)}
              placeholder="uma inicial, uma data, um nome"
              className="rounded-full border border-mauve px-4 py-2.5 text-[14px] outline-none focus:border-wine"
            />
          </div>

          <button
            type="button"
            disabled={!produto.disponivel || precisaEscolherTamanho}
            className="cursor-pointer rounded-full bg-wine px-6 py-3.5 font-serif text-[14px] font-semibold tracking-[0.2em] text-white uppercase transition hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-45"
          >
            {precisaEscolherTamanho ? "Escolha um tamanho" : "Adicionar à sacola"}
          </button>

          <ul className="m-0 flex list-none flex-col gap-3 p-0 pt-2">
            <Fato icone={<Clock className="h-4 w-4" />}>
              Produção e entrega em <strong className="font-medium">{textoPrazo()}</strong> após a confirmação do pagamento
            </Fato>
            <Fato icone={<Sparkles className="h-4 w-4" />}>
              Cada peça é encomendada depois do seu pedido — nada fica parado em estoque
            </Fato>
            <Fato icone={<Package className="h-4 w-4" />}>
              Chega até nós, é conferida e reembalada na embalagem Mirava
            </Fato>
            <Fato icone={<ShieldCheck className="h-4 w-4" />}>
              Pagamento seguro pelo Mercado Pago · Pix, cartão ou parcelado
            </Fato>
          </ul>

          {produto.descricao && (
            <div className="border-t border-veu pt-5">
              <h2 className="m-0 mb-3 font-serif text-[17px] font-normal">Sobre a peça</h2>
              <p className="m-0 text-[14px] leading-relaxed whitespace-pre-line text-ink-soft">
                {produto.descricao}
              </p>
            </div>
          )}
        </div>
      </div>

      {similares.length > 0 && (
        <Reveal>
          <section className="pt-20">
            <h2 className="m-0 mb-7 text-center font-serif text-[clamp(22px,2.4vw,30px)] font-normal">
              Você também pode gostar
            </h2>
            <div className="grid grid-cols-2 gap-[22px] md:grid-cols-4">
              {similares.map((p) => <ProductCard key={p.id} produto={p} />)}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
}

function Fato({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] text-ink-soft">
      <span className="mt-0.5 shrink-0 text-wine">{icone}</span>
      <span>{children}</span>
    </li>
  );
}

function EsqueletoProduto() {
  return (
    <div className="grid animate-pulse gap-10 px-6 pt-14 pb-20 sm:px-16 lg:grid-cols-2 lg:gap-16 lg:px-24">
      <div className="aspect-[4/5] rounded-[18px] bg-[#FBF6F8]" />
      <div className="flex flex-col gap-4">
        <div className="h-5 w-28 rounded-full bg-[#FBF6F8]" />
        <div className="h-10 w-4/5 rounded bg-[#FBF6F8]" />
        <div className="h-8 w-40 rounded bg-[#FBF6F8]" />
        <div className="h-4 w-56 rounded bg-[#FBF6F8]" />
        <div className="mt-4 h-12 w-full rounded-full bg-[#FBF6F8]" />
      </div>
    </div>
  );
}
