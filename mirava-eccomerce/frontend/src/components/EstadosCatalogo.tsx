// Estados de carregamento, erro e vazio do catálogo.
//
// Existem separados porque são três coisas diferentes e a cliente precisa
// entender qual aconteceu. Mostrar "nenhuma peça encontrada" quando na verdade
// a conexão falhou faz ela ir embora achando que a loja está vazia.

export function CatalogoCarregando({ quantidade = 8 }: { quantidade?: number }) {
  return (
    <>
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} aria-hidden className="animate-pulse">
          <div className="aspect-[4/5] rounded-[14px] bg-[#FBF6F8]" />
          <div className="flex flex-col gap-2 pt-3.5">
            <div className="h-4 w-4/5 rounded bg-[#FBF6F8]" />
            <div className="h-4 w-2/5 rounded bg-[#FBF6F8]" />
            <div className="h-3 w-3/5 rounded bg-[#FBF6F8]" />
          </div>
        </div>
      ))}
    </>
  );
}

export function CatalogoErro({
  mensagem,
  aoTentarDeNovo,
}: {
  mensagem: string;
  aoTentarDeNovo?: () => void;
}) {
  return (
    <div className="col-span-full flex flex-col items-center gap-4 py-16 text-center">
      <p className="m-0 font-serif text-lg text-ink">
        Não consegui carregar as peças agora
      </p>
      <p className="m-0 max-w-md text-sm text-ink-soft">
        Pode ser a sua conexão ou uma instabilidade nossa. Suas peças continuam
        aqui — é só tentar de novo.
      </p>
      {aoTentarDeNovo && (
        <button
          type="button"
          onClick={aoTentarDeNovo}
          className="cursor-pointer rounded-full bg-wine px-6 py-2.5 font-serif text-[13px] font-semibold tracking-[0.18em] text-white uppercase hover:bg-wine-dark"
        >
          Tentar de novo
        </button>
      )}
      {/* Detalhe técnico fica discreto: útil para a dona, irrelevante para a cliente. */}
      <p className="m-0 text-[11px] text-mauve">{mensagem}</p>
    </div>
  );
}

export function CatalogoVazio({ mensagem }: { mensagem?: string }) {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 py-16 text-center">
      <p className="m-0 font-serif text-lg text-ink">
        {mensagem ?? "Nenhuma peça por aqui ainda"}
      </p>
      <p className="m-0 max-w-md text-sm text-ink-soft">
        Estamos preparando novidades. Volte em breve.
      </p>
    </div>
  );
}
