// Grade de categorias da home.
//
// A foto de cada card vem do CATÁLOGO REAL, não de arte estática: buscamos
// algumas peças de cada categoria e usamos a primeira que tenha imagem. Duas
// razões — a vitrine passa a mostrar o que a loja realmente vende, e a arte
// não envelhece sozinha quando o catálogo muda.
//
// As peças que já aparecem em "As mais vendidas" são puladas: ver a mesma foto
// duas vezes na mesma tela faz o catálogo parecer pequeno. Se TODA a categoria
// estiver na vitrine de mais vendidas, aí sim repete — melhor repetir que
// mostrar card sem foto.
//
// Se a busca falhar ou a categoria estiver sem foto, o card cai na arte
// estática de src/assets/images/cat-*.webp. A home nunca fica com buraco.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { CATEGORY_LABEL, type Category } from "../catalogo/tipos";
import { listProducts, imageUrl } from "../catalogo/consultas";
import { img } from "../lib/images";
import Reveal from "./Reveal";

const FEATURED: Category[] = ["aneis", "colares", "pulseiras", "berloques"];

export default function CategoryGrid() {
  // categoria -> URL da foto de destaque (null enquanto carrega ou se falhar)
  const [destaques, setDestaques] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let ativo = true;

    (async () => {
      // Quem já está no pódio de mais vendidas sai da disputa aqui. O limite
      // acompanha o que MaisVendidos.tsx busca — se ele mudar, mude junto.
      let jaExibidas = new Set<string>();
      try {
        const top = await listProducts({ bestSellers: true, limit: 24 });
        jaExibidas = new Set(top.map((p) => p.id));
      } catch {
        // Sem a lista, no pior caso uma foto se repete. Não é motivo pra
        // deixar a grade de categorias sem imagem.
      }

      // Uma busca por categoria, em paralelo. `limit: 12` dá folga para achar
      // uma peça com foto que ainda não apareceu, sem arrastar catálogo à toa.
      const pares = await Promise.all(
        FEATURED.map(async (c) => {
          try {
            const pecas = await listProducts({ category: c, limit: 12 });
            const temFoto = pecas.filter((p) => imageUrl(p.images[0]));
            const inedita = temFoto.find((p) => !jaExibidas.has(p.id));
            // Categoria inteirinha no pódio: repetir é melhor que card vazio.
            const escolhida = inedita ?? temFoto[0];
            if (escolhida) jaExibidas.add(escolhida.id);
            return [c, imageUrl(escolhida?.images[0])] as const;
          } catch {
            return [c, null] as const;
          }
        }),
      );
      if (ativo) setDestaques(Object.fromEntries(pares));
    })();

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <section className="px-6 py-20 sm:px-16 lg:px-24">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <span className="font-script text-[26px] tracking-[0.06em] text-wine">Categorias</span>
          <h2 className="m-0 mt-1 font-serif text-[clamp(28px,3vw,36px)] leading-tight font-normal">
            Escolha por onde começar
          </h2>
        </div>
        <Link
          to="/categoria/colecoes/todos"
          className="group flex items-center gap-2 text-[12px] tracking-[0.14em] text-wine uppercase hover:text-wine-dark"
        >
          Ver tudo
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.8}
          />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {FEATURED.map((c, i) => {
          const foto = destaques[c] ?? img(`cat-${c}`);
          return (
            <Reveal key={c} delay={i * 90}>
              <Link
                to={`/categoria/colecoes/${c}`}
                className="group block overflow-hidden rounded-[18px]"
              >
                <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-[18px] bg-cream">
                  <img
                    src={foto}
                    alt=""
                    loading="lazy"
                    className="block h-full w-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.06]"
                  />
                  {/* Véu escuro só na base, para o nome ficar legível sobre
                      qualquer foto — inclusive as claras, de fundo branco. */}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(to_top,rgba(62,26,46,0.72),transparent)]" />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                    <span className="font-serif text-[19px] leading-tight text-white">
                      {CATEGORY_LABEL[c]}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/18 text-white backdrop-blur-sm transition group-hover:bg-white group-hover:text-wine">
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </span>
                  </span>
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
