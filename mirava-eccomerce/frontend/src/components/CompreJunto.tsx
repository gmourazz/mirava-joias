// "Compre junto e ganhe X%" (decisão 32). A conta exibida é só uma prévia: o
// desconto de verdade é calculado no servidor quando as duas peças estão na
// sacola (dominio.PriceOrder) e aparece como linha própria no checkout.

import { Link } from "react-router-dom";
import { imageUrl } from "../catalogo/consultas";
import type { Product } from "../catalogo/tipos";
import { useCart } from "../context/CartContext";
import { formatarBRL } from "../lib/dinheiro";

export default function CompreJunto({ product, partner, pct }: { product: Product; partner: Product; pct: number }) {
  const { addItem, openCart } = useCart();
  // Só funciona com peças sem escolha de tamanho: com tamanho, a cliente
  // precisa escolher antes — aí ela adiciona pelo botão normal.
  const semTamanho = product.variants.filter((v) => v.available).length <= 1 && partner.variants.filter((v) => v.available).length <= 1;
  const cheio = product.listPriceCents + partner.listPriceCents;
  const junto = cheio - Math.round((cheio * pct) / 100);
  // Se a promoção das duas já dá mais que o kit, o kit não acrescenta nada.
  const pago = Math.min(junto, product.priceCents + partner.priceCents);
  const fotoA = imageUrl(product.images[0]);
  const fotoB = imageUrl(partner.images[0]);

  const adicionar = () => {
    for (const p of [product, partner]) {
      const size = p.variants.find((v) => v.available)?.size ?? null;
      addItem({ productId: p.id, slug: p.slug, name: p.name, image: imageUrl(p.images[0]), priceCents: p.priceCents, size }, 1);
    }
    openCart();
  };

  return (
    <div className="grid gap-3 rounded-[22px] border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-[14.5px] font-bold text-text">Compre junto e ganhe {pct}%</span>
        <span className="rounded-full bg-teal px-2.5 py-1 text-[11.5px] font-bold text-white">−{pct}%</span>
      </div>
      <div className="flex items-center gap-2.5">
        {fotoA ? <img src={fotoA} alt="" className="h-16 w-16 rounded-[14px] bg-mist-3 object-cover" /> : <span className="h-16 w-16 rounded-[14px] bg-mist-3" />}
        <span className="text-[18px] text-muted">+</span>
        {fotoB ? <img src={fotoB} alt="" className="h-16 w-16 rounded-[14px] bg-mist-3 object-cover" /> : <span className="h-16 w-16 rounded-[14px] bg-mist-3" />}
        <span className="min-w-0 flex-1 text-[13px] leading-snug">
          <Link to={`/produto/${partner.slug}`} className="block truncate font-semibold text-text hover:text-teal">
            + {partner.name}
          </Link>
          <s className="text-muted">{formatarBRL(cheio)}</s>{" "}
          <strong className="text-[15px] text-teal">{formatarBRL(pago)}</strong>
        </span>
      </div>
      {semTamanho && product.available && partner.available ? (
        <button
          type="button"
          onClick={adicionar}
          className="cursor-pointer rounded-full border-[1.5px] border-teal bg-white px-5 py-3 text-[14px] font-semibold text-teal hover:bg-teal hover:text-white"
        >
          Adicionar as 2 à sacola
        </button>
      ) : (
        <span className="text-[12.5px] text-muted">Escolha o tamanho e adicione as duas peças: o desconto entra sozinho na sacola.</span>
      )}
    </div>
  );
}
