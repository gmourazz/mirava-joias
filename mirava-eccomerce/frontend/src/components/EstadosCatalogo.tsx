// Estados de carregamento, erro e vazio do catálogo.
//
// Existem separados porque são três coisas diferentes e a cliente precisa
// entender qual aconteceu. Mostrar "nenhuma peça encontrada" quando na verdade
// a conexão falhou faz ela ir embora achando que a loja está vazia.

export function CatalogLoading({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden className="animate-pulse rounded-3xl border border-line-soft p-2.5 pb-4">
          <div className="aspect-square rounded-[18px] bg-mist-3" />
          <div className="flex flex-col gap-2 px-1.5 pt-3.5">
            <div className="h-4 w-4/5 rounded-full bg-mist-3" />
            <div className="h-4 w-2/5 rounded-full bg-mist-3" />
            <div className="mt-2 h-10 w-full rounded-full bg-mist-3" />
          </div>
        </div>
      ))}
    </>
  );
}

export function CatalogError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="col-span-full flex flex-col items-center gap-4 py-16 text-center">
      <p className="m-0 font-serif text-[24px] text-teal-dark">
        Não consegui carregar as peças agora
      </p>
      <p className="m-0 max-w-md text-[14.5px] text-text-2">
        Pode ser a sua conexão ou uma instabilidade nossa. Suas peças continuam
        aqui. É só tentar de novo.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-full border-none bg-teal px-6 py-3.5 font-sans text-[14px] font-semibold text-white hover:bg-teal-dark"
        >
          Tentar de novo
        </button>
      )}
      {/* Detalhe técnico fica discreto: útil para a dona, irrelevante para a cliente. */}
      <p className="m-0 text-[11px] text-faint">{message}</p>
    </div>
  );
}

export function CatalogEmpty({ message }: { message?: string }) {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 py-16 text-center">
      <p className="m-0 font-serif text-[24px] text-teal-dark">
        {message ?? "Nenhuma peça por aqui ainda"}
      </p>
      <p className="m-0 max-w-md text-[14.5px] text-text-2">
        Estamos preparando novidades. Volte em breve.
      </p>
    </div>
  );
}
