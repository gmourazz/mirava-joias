import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, Package, ShieldCheck, Sparkles, Star } from "lucide-react";
import { useProduct } from "../catalogo/hooks";
import { imageUrl } from "../catalogo/consultas";
import { CATEGORY_LABEL, METAL_LABEL } from "../catalogo/tipos";
import { formatarBRL, textoParcelas, textoPix, textoPrazo } from "../lib/dinheiro";
import ProductCard from "../components/ProductCard";
import { CatalogError } from "../components/EstadosCatalogo";
import Reveal from "../components/Reveal";
import { useCart } from "../context/CartContext";

export default function ProdutoPage() {
  const { slug } = useParams();
  const { data: product, loading, error, related } = useProduct(slug);
  const { addItem } = useCart();

  const [activeImage, setActiveImage] = useState(0);
  const [size, setSize] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveImage(0);
    setSize(null);
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
      <div className="px-6 py-24 sm:px-16 lg:px-24">
        <CatalogError message={error} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-32 text-center">
        <h1 className="m-0 font-serif text-2xl font-normal">Peça não encontrada</h1>
        <p className="m-0 text-sm text-ink-soft">
          Ela pode ter saído do catálogo. Veja as outras, tem coisa bonita por lá.
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

  const variants = product.variants.filter((v) => v.available);
  const needsSize = variants.length > 1 && !size;
  const adjust = variants.find((v) => v.size === size)?.priceAdjustCents ?? 0;
  const price = product.priceCents + adjust;
  const cover = imageUrl(product.images[activeImage]);

  return (
    <div className="px-6 pt-8 pb-20 sm:px-16 lg:px-24">
      <nav className="mb-6 text-[11px] tracking-[0.16em] text-mauve uppercase">
        <Link to="/" className="hover:text-wine">Início</Link>
        <span className="mx-2">/</span>
        <Link to={`/categoria/${product.metal}/${product.category}`} className="hover:text-wine">
          {CATEGORY_LABEL[product.category]}
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Galeria */}
        <div className="flex flex-col gap-3">
          <div className="aspect-[4/5] overflow-hidden rounded-[18px] bg-[#FBF6F8]">
            {cover ? (
              <img src={cover} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-mauve">
                sem foto
              </div>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="flex gap-2.5">
              {product.images.slice(0, 5).map((path, i) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`Foto ${i + 1}`}
                  className="h-16 w-16 cursor-pointer overflow-hidden rounded-[10px] border transition"
                  style={{ borderColor: i === activeImage ? "#8E3B6B" : "#E3B1C8" }}
                >
                  <img
                    src={imageUrl(path) ?? ""}
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
              {METAL_LABEL[product.metal]}
            </span>
            {product.rating != null && (
              <span className="flex items-center gap-1 text-[13px] text-ink-soft">
                <Star className="h-3.5 w-3.5 fill-wine text-wine" />
                {product.rating.toFixed(1)}
                {product.ratingCount > 0 && ` (${product.ratingCount})`}
              </span>
            )}
          </div>

          <h1 className="m-0 font-serif text-[clamp(26px,3vw,38px)] leading-tight font-normal">
            {product.name}
          </h1>

          <div className="flex flex-col gap-1">
            <span className="font-serif text-[30px] text-ink">{formatarBRL(price)}</span>
            <span className="text-[13px] text-ink-soft">{textoParcelas(price)}</span>
            <span className="text-[13px] text-wine">{textoPix(price)}</span>
          </div>

          {!product.available && (
            <div className="rounded-[12px] bg-veu px-4 py-3 text-[13px] text-ink">
              Esta peça está indisponível no momento. Se quiser, escreve pra
              gente por e-mail que a gente avisa assim que voltar.
            </div>
          )}

          {variants.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {/* O rótulo vem da Lilly: "Tamanho" num anel, "Letras" num colar
                  de letra. Fixar "Tamanho" mostraria "Tamanho: A". */}
              <span className="text-[11px] tracking-[0.16em] text-ink-soft uppercase">
                {product.variantLabel ?? "Tamanho"}
              </span>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSize(v.size)}
                    className="min-w-12 cursor-pointer rounded-full border px-4 py-2 text-[13px] transition"
                    style={{
                      borderColor: size === v.size ? "#8E3B6B" : "#E3B1C8",
                      background: size === v.size ? "#8E3B6B" : "transparent",
                      color: size === v.size ? "#fff" : "#8E3B6B",
                    }}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Não existe campo de gravação: a Lilly não faz gravação por texto
              livre. O que ela oferece é escolha de valor — tamanho num anel,
              letra num colar de letra — e isso é o seletor acima. Prometer
              gravação seria vender algo que a fornecedora não entrega. */}

          <button
            type="button"
            disabled={!product.available || needsSize}
            onClick={() =>
              addItem({
                productId: product.id,
                slug: product.slug,
                name: product.name,
                image: cover,
                priceCents: price,
                size,
              })
            }
            className="cursor-pointer rounded-full bg-wine px-6 py-3.5 font-serif text-[14px] font-semibold tracking-[0.2em] text-white uppercase transition hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-45"
          >
            {needsSize
              ? `Escolha ${(product.variantLabel ?? "o tamanho").toLowerCase()}`
              : "Adicionar à sacola"}
          </button>

          <ul className="m-0 flex list-none flex-col gap-3 p-0 pt-2">
            <Fact icon={<Clock className="h-4 w-4" />}>
              Produção e entrega em <strong className="font-medium">{textoPrazo()}</strong> após a confirmação do pagamento
            </Fact>
            <Fact icon={<Sparkles className="h-4 w-4" />}>
              Cada peça é separada depois do seu pedido, com cuidado
            </Fact>
            <Fact icon={<Package className="h-4 w-4" />}>
              Chega até nós, é conferida e reembalada na embalagem Mirava
            </Fact>
            <Fact icon={<ShieldCheck className="h-4 w-4" />}>
              Pagamento 100% seguro · Pix, cartão ou parcelado
            </Fact>
          </ul>

          {product.description && (
            <div className="border-t border-veu pt-5">
              <h2 className="m-0 mb-3 font-serif text-[17px] font-normal">Sobre a peça</h2>
              <p className="m-0 text-[14px] leading-relaxed whitespace-pre-line text-ink-soft">
                {product.description}
              </p>
            </div>
          )}

          {product.reviews.length > 0 && (
            <div className="border-t border-veu pt-5">
              <h2 className="m-0 mb-4 flex items-center gap-2 font-serif text-[17px] font-normal">
                Avaliações da peça
                {product.rating != null && (
                  <span className="flex items-center gap-1 text-[13px] font-sans text-ink-soft">
                    <Star className="h-3.5 w-3.5 fill-wine text-wine" />
                    {product.rating.toFixed(1)} · {product.ratingCount} avaliações
                  </span>
                )}
              </h2>
              <div className="flex flex-col gap-4">
                {product.reviews.map((r, i) => (
                  <div key={i} className="flex flex-col gap-1 border-b border-veu pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-serif text-[14px] text-ink">{r.author}</span>
                      <span className="text-[11px] text-mauve">{r.date}</span>
                    </div>
                    {r.text && (
                      <p className="m-0 text-[13px] leading-relaxed text-ink-soft">{r.text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <Reveal>
          <section className="pt-20">
            <h2 className="m-0 mb-7 text-center font-serif text-[clamp(22px,2.4vw,30px)] font-normal">
              Você também pode gostar
            </h2>
            <div className="grid grid-cols-2 gap-[22px] md:grid-cols-4">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
}

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] text-ink-soft">
      <span className="mt-0.5 shrink-0 text-wine">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

function ProductSkeleton() {
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
