import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import ProductCard from "../components/ProductCard";

export default function Favoritos() {
  const { user, loading: authLoading } = useAuth();
  const { products, loading } = useFavorites();

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
        <h1 className="m-0 font-serif text-[26px] font-normal text-wine">Meus favoritos</h1>
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[16px] border border-blush py-14 text-center">
          <Heart className="h-7 w-7 text-mauve" strokeWidth={1.3} />
          <p className="m-0 font-serif text-[18px] text-ink">Entre para ver seus favoritos</p>
          <p className="m-0 max-w-xs text-[13px] text-ink-soft">
            Suas peças salvas ficam guardadas na sua conta.
          </p>
          <Link
            to="/conta"
            className="mt-1 rounded-full bg-wine px-6 py-2.5 font-serif text-[12.5px] font-semibold tracking-[0.16em] text-white uppercase hover:bg-wine-dark"
          >
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
      <h1 className="m-0 font-serif text-[26px] font-normal text-wine">Meus favoritos</h1>

      {loading && (
        <p className="mt-6 text-[13px] text-ink-soft">Carregando seus favoritos…</p>
      )}

      {!loading && products.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[16px] border border-blush py-14 text-center">
          <Heart className="h-7 w-7 text-mauve" strokeWidth={1.3} />
          <p className="m-0 font-serif text-[18px] text-ink">Nenhuma peça favoritada ainda</p>
          <Link
            to="/categoria/colecoes/todos"
            className="mt-1 rounded-full bg-wine px-6 py-2.5 font-serif text-[12.5px] font-semibold tracking-[0.16em] text-white uppercase hover:bg-wine-dark"
          >
            Ver coleções
          </Link>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="mt-10 grid grid-cols-2 gap-[22px] md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
