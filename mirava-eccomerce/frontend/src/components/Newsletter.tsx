export default function Newsletter() {
  return (
    <section className="grid grid-cols-1 items-center gap-10 border-t border-blush-2 bg-cream px-6 py-[70px] sm:px-16 md:grid-cols-2 lg:px-24">
      <div className="flex flex-col gap-3">
        <span className="font-script text-[28px] tracking-[0.06em] text-wine">Bem-vinda</span>
        <h2 className="m-0 font-serif text-[30px] font-normal">10% na sua primeira encomenda</h2>
        <p className="m-0 max-w-[420px] text-sm leading-relaxed text-ink-soft">
          Receba o cupom e avisos de abertura de agenda — trabalhamos com vagas limitadas de produção por mês.
        </p>
      </div>
      <form className="flex flex-wrap gap-2.5" onSubmit={(e) => e.preventDefault()}>
        <input
          type="email"
          placeholder="Seu melhor e-mail"
          className="min-w-[200px] flex-1 rounded-full border border-rose bg-paper px-5 py-3.5 font-sans text-[13.5px] text-ink"
        />
        <button type="submit" className="rounded-full border-none bg-wine px-7 py-3.5 font-serif text-sm font-semibold tracking-[0.2em] text-white uppercase cursor-pointer hover:bg-wine-dark">
          Quero meu cupom
        </button>
      </form>
    </section>
  );
}
