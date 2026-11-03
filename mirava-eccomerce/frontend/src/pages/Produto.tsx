import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Clock, Gem, Heart, Minus, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { useProduct } from "../catalogo/hooks";
import { imageUrl } from "../catalogo/consultas";
import { CATEGORY_LABEL, METAL_LABEL } from "../catalogo/tipos";
import { formatarBRL, precoPix, temDescontoPix, textoParcelas, textoPrazo } from "../lib/dinheiro";
import { formatZip, lookupZip, onlyDigits } from "../lib/enderecos";
import { quoteShipping, shippingPrazo, type ShippingOption } from "../lib/frete";
import { FAQ } from "../data/content";
import ProductCard from "../components/ProductCard";
import { CatalogError } from "../components/EstadosCatalogo";
import Reveal from "../components/Reveal";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";

// Página de produto do design v5: galeria grudada à esquerda (foto quadrada e
// miniaturas embaixo), informações à direita — preço com Pix e parcelas,
// tamanho, quantidade, "Adicionar" e "Comprar agora", caixa de encomenda com
// cálculo de frete por CEP e um acordeão com descrição, prazo e trocas.
//
// Ficam de fora do protótipo, de propósito:
//  • escolher o banho (prata/ouro) — cada peça da Lilly tem um banho só;
//  • "compre junto e ganhe 10%" — não existe desconto de kit no backend;
//  • avaliações, prova social e fotos de clientes — decisão 28.

const resposta = (inicio: string) => FAQ.find((f) => f.q.startsWith(inicio))?.a ?? "";

export default function ProdutoPage() {
  const { slug } = useParams();
  const { data: product, loading, error, related } = useProduct(slug);
  const { addItem, closeCart } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const navigate = useNavigate();

  const [activeImage, setActiveImage] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [aberto, setAberto] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveImage(0);
    setSize(null);
    setQty(1);
    setAberto(0);
  }, [slug]);

  // Pré-seleciona quando só existe uma opção: obrigar a escolher entre uma
  // coisa só é atrito à toa.
  useEffect(() => {
    const available = product?.variants.filter((v) => v.available) ?? [];
    if (available.length === 1) setSize(available[0].size);
  }, [product]);

  if (loading) return <ProductSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-[1280px] px-[clamp(16px,3vw,40px)] py-24">
        <CatalogError message={error} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-32 text-center">
        <h1 className="m-0 font-serif text-[32px] font-normal text-teal-dark">Peça não encontrada</h1>
        <p className="m-0 text-[15px] text-text-2">Ela pode ter saído do catálogo. Veja as outras, tem coisa bonita por lá.</p>
        <Link to="/categoria/colecoes/todos" className="rounded-full bg-teal px-6 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white">
          Ver todas as joias
        </Link>
      </div>
    );
  }

  const variants = product.variants.filter((v) => v.available);
  const needsSize = variants.length > 1 && !size;
  const adjust = variants.find((v) => v.size === size)?.priceAdjustCents ?? 0;
  const price = product.priceCents + adjust;
  const fotos = product.images.map((p) => imageUrl(p)).filter((u): u is string => Boolean(u));
  const cover = fotos[activeImage] ?? null;
  const podeComprar = product.available && !needsSize;

  const adicionar = () =>
    addItem(
      { productId: product.id, slug: product.slug, name: product.name, image: fotos[0] ?? null, priceCents: price, size },
      qty,
    );

  const secoes = [
    { t: "Descrição", d: product.description ?? `Peça ${METAL_LABEL[product.metal].toLowerCase()}, delicada e feita para o dia a dia.` },
    { t: "Prazo de entrega", d: `Peça feita sob encomenda: a Mirava encomenda a sua joia assim que o pagamento é confirmado e entrega em ${textoPrazo()}. Você recebe o código de rastreio por e-mail.` },
    { t: "Trocas e devoluções", d: resposta("Posso trocar") },
    { t: "Cuidados", d: resposta("Como cuido") },
  ].filter((s) => s.d);

  return (
    <div className="mx-auto max-w-[1280px] px-[clamp(16px,3vw,40px)] pt-7">
      <nav className="mb-6 text-[12px] tracking-[0.1em] text-[#5E7473] uppercase">
        <Link to="/" className="text-[#5E7473] hover:text-teal">Início</Link>
        <span className="mx-2">/</span>
        <Link to={`/categoria/colecoes/${product.category}`} className="text-[#5E7473] hover:text-teal">
          {CATEGORY_LABEL[product.category]}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-teal">{product.name}</span>
      </nav>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-[clamp(24px,4vw,56px)]">
        <div className="grid content-start gap-3 lg:sticky lg:top-[150px] lg:self-start">
          <div className="aspect-square overflow-hidden rounded-[28px] bg-mist-3">
            {cover ? (
              <img src={cover} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-[13px] text-muted">sem foto</div>
            )}
          </div>
          {fotos.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {fotos.slice(0, 4).map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`Foto ${i + 1}`}
                  className={`aspect-square cursor-pointer overflow-hidden rounded-2xl border-none bg-mist-3 p-0 transition-shadow duration-500 ${
                    i === activeImage ? "shadow-[0_0_0_3px_#0F6E73]" : ""
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid content-start gap-5">
          <span className="w-fit rounded-full bg-mist px-3.5 py-1.5 text-[12px] font-semibold text-teal">
            {METAL_LABEL[product.metal]}
          </span>
          <div className="flex items-start justify-between gap-3">
            <h1 className="m-0 font-serif text-[clamp(32px,3.4vw,44px)] leading-[1.08] font-normal text-teal-dark">{product.name}</h1>
            <button
              type="button"
              aria-label={isFavorite(product.id) ? "Tirar dos favoritos" : "Salvar nos favoritos"}
              onClick={() => toggle(product.id)}
              className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full border-[1.5px] border-line-strong bg-white text-teal-soft"
            >
              <Heart size={21} strokeWidth={1.8} fill={isFavorite(product.id) ? "#5FB8B0" : "none"} />
            </button>
          </div>

          <div className="grid gap-1">
            <span className="text-[30px] font-bold text-teal [font-variant-numeric:tabular-nums]">{formatarBRL(price)}</span>
            <span className="text-[14px] text-muted">
              {textoParcelas(price)}
              {temDescontoPix && <> · <strong className="text-teal">{formatarBRL(precoPix(price))} no Pix</strong></>}
            </span>
          </div>

          {!product.available && (
            <div className="rounded-[18px] bg-mist px-4 py-3 text-[14px] text-text-2">
              Esta peça está indisponível no momento. Escreve pra gente por e-mail que avisamos quando voltar.
            </div>
          )}

          {variants.length > 0 && (
            <div className="grid gap-2.5">
              {/* O rótulo vem da Lilly: "Tamanho" num anel, "Letras" num colar
                  de letra. Fixar "Tamanho" mostraria "Tamanho: A". */}
              <span className="text-[13px] font-semibold text-text-2">{product.variantLabel ?? "Tamanho"}</span>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSize(v.size)}
                    className={`grid h-[46px] min-w-[46px] cursor-pointer place-items-center rounded-full border-[1.5px] px-3 text-[14px] font-semibold transition-colors ${
                      size === v.size ? "border-teal bg-teal text-white" : "border-[#DDE4E4] bg-white text-text hover:border-teal"
                    }`}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Não existe campo de gravação: a Lilly não faz gravação por texto
              livre. O que ela oferece é escolha de valor — tamanho num anel,
              letra num colar de letra — e isso é o seletor acima. */}

          {product.available && (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 rounded-full bg-chip p-1">
                <button type="button" aria-label="Diminuir" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-[42px] w-[42px] cursor-pointer place-items-center rounded-full border-none bg-white text-text">
                  <Minus size={15} strokeWidth={2} />
                </button>
                <span className="min-w-8 text-center text-[15px] font-semibold">{qty}</span>
                <button type="button" aria-label="Aumentar" onClick={() => setQty((q) => q + 1)} className="grid h-[42px] w-[42px] cursor-pointer place-items-center rounded-full border-none bg-white text-text">
                  <Plus size={15} strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                disabled={!podeComprar}
                onClick={adicionar}
                className="min-w-[180px] flex-1 cursor-pointer rounded-full border-none bg-mist-2 px-6 py-[15px] text-[15px] font-semibold text-teal transition-colors hover:bg-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {needsSize ? `Escolha ${(product.variantLabel ?? "o tamanho").toLowerCase()}` : "Adicionar à sacola"}
              </button>
              <button
                type="button"
                disabled={!podeComprar}
                onClick={() => {
                  adicionar();
                  closeCart();
                  navigate("/checkout");
                }}
                className="min-w-[160px] flex-1 cursor-pointer rounded-full border-none bg-teal px-6 py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Comprar agora →
              </button>
            </div>
          )}

          <CaixaEncomenda subtotalCents={price * qty} />

          <div className="flex flex-wrap gap-2">
            <Chip icon={<Gem size={14} strokeWidth={1.8} />}>Feita sob encomenda</Chip>
            <Chip icon={<ShieldCheck size={14} strokeWidth={1.8} />}>Pagamento seguro</Chip>
            <Chip icon={<RefreshCw size={14} strokeWidth={1.8} />}>Troca em 7 dias</Chip>
          </div>

          <div className="grid gap-2.5">
            {secoes.map((s, i) => {
              const ativo = aberto === i;
              return (
                <div key={s.t} className={`rounded-[22px] border border-line transition-colors ${ativo ? "bg-[#F7FAFA]" : "bg-white"}`}>
                  <button
                    type="button"
                    onClick={() => setAberto(ativo ? -1 : i)}
                    aria-expanded={ativo}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 border-none bg-transparent px-5 py-4 text-left text-[15px] font-semibold text-text"
                  >
                    {s.t}
                    <span className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-mist text-teal transition-transform duration-300 ${ativo ? "rotate-45" : ""}`}>
                      <Plus size={15} strokeWidth={2} />
                    </span>
                  </button>
                  {ativo && (
                    <p className="animate-fade-in m-0 px-5 pb-5 text-[14.5px] leading-[1.7] whitespace-pre-line text-text-2">{s.d}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <Reveal>
          <section className="pt-20">
            <h2 className="m-0 mb-7 font-serif text-[clamp(30px,3.2vw,42px)] font-normal text-teal-dark">
              Combina <em className="text-teal">com</em>
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-[18px]">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
}

/** Caixa "Peça feita sob encomenda" com o cálculo de frete por CEP. O preço
 *  do frete vem da API — a mesma regra que o checkout cobra. */
function CaixaEncomenda({ subtotalCents }: { subtotalCents: number }) {
  const [cep, setCep] = useState("");
  const [opcoes, setOpcoes] = useState<ShippingOption[] | null>(null);
  const [estado, setEstado] = useState<"idle" | "loading" | "erro">("idle");

  const calcular = async (e: FormEvent) => {
    e.preventDefault();
    if (onlyDigits(cep).length !== 8) {
      setEstado("erro");
      return;
    }
    setEstado("loading");
    const endereco = await lookupZip(cep);
    if (!endereco?.state) {
      setEstado("erro");
      return;
    }
    try {
      const q = await quoteShipping(endereco.state, subtotalCents);
      setOpcoes(q.options ?? []);
      setEstado("idle");
    } catch {
      setEstado("erro");
    }
  };

  return (
    <div className="grid gap-3.5 rounded-[22px] bg-mist p-5">
      <div className="flex items-start gap-3">
        <Clock size={20} strokeWidth={1.8} className="mt-0.5 shrink-0 text-teal" />
        <div className="grid gap-0.5">
          <strong className="text-[15px] text-text">Peça feita sob encomenda</strong>
          <span className="text-[13.5px] text-text-2">Encomendada depois do pagamento · chega em {textoPrazo()}</span>
        </div>
      </div>
      <form onSubmit={calcular} className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-4">
        <input
          inputMode="numeric"
          value={cep}
          onChange={(e) => setCep(formatZip(e.target.value))}
          placeholder="Digite seu CEP"
          className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] text-text outline-none placeholder:text-[#8A9A9B]"
        />
        <button type="submit" className="cursor-pointer rounded-full border-none bg-teal px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-dark">
          {estado === "loading" ? "Calculando…" : "Calcular"}
        </button>
      </form>
      {estado === "erro" && <span className="text-[13px] text-[#C4483D]">Não encontramos esse CEP. Confira e tente de novo.</span>}
      {opcoes && opcoes.length > 0 && (
        <div className="animate-fade-in grid gap-2">
          {opcoes.map((o) => (
            <div key={o.service} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${o.service === "sedex" ? "bg-teal-dark text-white" : "bg-mist text-teal"}`}>
                {o.label}
              </span>
              <span className="flex-1 text-[13px] text-text-2">+ {shippingPrazo(o)} de transporte</span>
              <span className={`text-[14px] font-bold ${o.free ? "text-teal" : "text-text"}`}>{o.free ? "Grátis" : formatarBRL(o.cents)}</span>
            </div>
          ))}
          <span className="text-[12px] text-muted">Prazo total, com a encomenda, de {textoPrazo()}.</span>
        </div>
      )}
    </div>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-chip px-3.5 py-2 text-[13px] font-medium text-text-2">
      <span className="text-teal">{icon}</span>
      {children}
    </span>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto grid max-w-[1280px] animate-pulse gap-10 px-[clamp(16px,3vw,40px)] pt-14 lg:grid-cols-2 lg:gap-14">
      <div className="aspect-square rounded-[28px] bg-mist-3" />
      <div className="flex flex-col gap-4">
        <div className="h-6 w-28 rounded-full bg-mist-3" />
        <div className="h-10 w-4/5 rounded-xl bg-mist-3" />
        <div className="h-8 w-40 rounded-xl bg-mist-3" />
        <div className="mt-4 h-12 w-full rounded-full bg-mist-3" />
      </div>
    </div>
  );
}
