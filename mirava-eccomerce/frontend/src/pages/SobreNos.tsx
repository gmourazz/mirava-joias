// Sobre nós: a história das duas fundadoras. Fica em página própria
// (menu "Mais" e rodapé levam até aqui), fora da home. Cada sócia ganha uma
// faixa com foto em arco; os valores da marca fecham numa faixa escura.

import { Link } from "react-router-dom";
import { ArrowRight, Gem, Heart, PiggyBank, Sparkles, type LucideIcon } from "lucide-react";
import Reveal from "../components/Reveal";
import fotoGeovanna from "../assets/socias/geovanna.webp";
import fotoGiselle from "../assets/socias/giselle.webp";

const VALORES: { Icon: LucideIcon; t: string; d: string }[] = [
  { Icon: Sparkles, t: "Delicado", d: "Peças leves, que combinam com o dia a dia e com as ocasiões especiais." },
  { Icon: PiggyBank, t: "Acessível", d: "Preço justo, porque estilo não precisa pesar no bolso." },
  { Icon: Gem, t: "Boa qualidade", d: "Prata e semijoias pensadas para durar e para brilhar." },
];

const SOCIAS: {
  foto: string;
  nome: string;
  papel: string;
  texto: string[];
  gosta: string[];
  horasVagas: string;
}[] = [
  {
    foto: fotoGeovanna,
    nome: "Geovanna Moura",
    papel: "Engenheira de software · mineira de coração",
    texto: [
      "Nasci em Santos (SP), em 2002, mas moro em Minas Gerais há 10 anos, então já me considero mineira de coração. Sou engenheira de software e quebro o estereótipo da “menina do TI” trevosa e gótica com um estilo bem mais patricinha moderna. Sou vaidosa demais, e assumo!",
      "Sou apaixonada por prata e acessórios desde os da Xuxa, em 2005. Com meu lado pisciana romântica, vivo trocando de acessório conforme o look e a ocasião. Amo pontos de luz e tudo que brilha muito.",
    ],
    gosta: ["Pontos de luz", "Berloques", "Anéis", "Animais", "Livros", "Café"],
    horasVagas: "Ler, jogar, musculação, Hyrox, vôlei e qualquer coisa ao ar livre.",
  },
  {
    foto: fotoGiselle,
    nome: "Giselle Anjos",
    papel: "Engenheira agrônoma · designer de interiores",
    texto: [
      "Nasci em 1997 e sou engenheira agrônoma de formação e designer de interiores por paixão, apaixonada por paisagismo e mamãe do Manu, de 3 aninhos.",
      "Adoro me cuidar e acredito que os acessórios exalam a nossa personalidade e o nosso estilo. Sempre sonhei em empreender e ter um negócio de sucesso, e a Mirava é esse sonho saindo do papel.",
    ],
    gosta: ["Paisagismo", "Design de interiores", "Se cuidar"],
    horasVagas: "Pole dance, vôlei e musculação. Posso dizer que sou uma atleta híbrida!",
  },
];

export default function SobreNos() {
  return (
    <div>
      <div className="relative overflow-hidden bg-mist">
        <span aria-hidden className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-white/60" />
        <span aria-hidden className="absolute -right-16 -bottom-28 h-80 w-80 rounded-full bg-teal-pale/30" />
        <div className="relative mx-auto flex max-w-[900px] flex-col items-center gap-5 px-[clamp(16px,3vw,40px)] py-16 text-center">
          <nav className="text-[12px] tracking-[0.1em] text-[#5E7473] uppercase">
            <Link to="/" className="text-[#5E7473] hover:text-teal">Início</Link>
            <span className="mx-2">/</span>
            <span className="font-semibold text-teal">Sobre nós</span>
          </nav>
          <span className="flex items-center gap-2 text-[12px] font-bold tracking-[0.18em] text-teal-mid uppercase">
            <Sparkles size={14} strokeWidth={1.8} />
            Quem está por trás da Mirava
          </span>
          <h1 className="m-0 font-serif text-[clamp(40px,5vw,68px)] leading-[1.04] font-normal text-teal-dark">
            Duas amigas, uma paixão por <em className="text-teal">acessórios</em>
          </h1>
          <p className="m-0 max-w-[62ch] text-[17px] leading-[1.8] text-text-2">
            A Mirava nasceu de uma amizade e de um jeito de enxergar o look: um acessório escolhido com carinho muda a
            produção inteira e ainda mostra quem a gente é. Nós duas amamos acessórios e a personalidade que eles
            trazem ao visual, e decidimos transformar essa paixão em negócio. Juntas.
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-[clamp(56px,8vw,96px)] px-[clamp(16px,3vw,40px)] pt-[clamp(48px,7vw,88px)]">
        {SOCIAS.map((s, i) => (
          <Reveal key={s.nome}>
            <article className="grid items-center gap-[clamp(28px,5vw,64px)] md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
              <div className={`relative mx-auto w-full max-w-[420px] ${i % 2 ? "md:order-2" : ""}`}>
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-t-[999px] rounded-b-[56px] bg-teal-pale/40 ${i % 2 ? "-translate-x-4" : "translate-x-4"} translate-y-4`}
                />
                <img
                  src={s.foto}
                  alt={s.nome}
                  loading="lazy"
                  className="relative aspect-[4/5] w-full rounded-t-[999px] rounded-b-[56px] object-cover object-[50%_22%] shadow-[0_24px_60px_rgba(11,74,77,0.18)]"
                />
              </div>

              <div className="grid content-center gap-5">
                <div className="grid gap-2">
                  <h2 className="m-0 font-serif text-[clamp(34px,4vw,50px)] leading-[1.05] font-normal text-teal-dark">{s.nome}</h2>
                  <span className="w-fit rounded-full bg-mist px-4 py-1.5 text-[12.5px] font-semibold text-teal">{s.papel}</span>
                </div>
                {s.texto.map((p) => (
                  <p key={p.slice(0, 24)} className="m-0 text-[16px] leading-[1.8] text-text-2">{p}</p>
                ))}
                <div className="flex flex-wrap gap-2">
                  {s.gosta.map((g) => (
                    <span key={g} className="rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] text-text-2">{g}</span>
                  ))}
                </div>
                <p className="m-0 flex items-start gap-3 rounded-[24px] bg-mist px-5 py-4 text-[14.5px] leading-[1.65] text-text-2">
                  <Heart size={18} strokeWidth={1.7} className="mt-0.5 shrink-0 text-teal" />
                  <span>
                    <strong className="font-semibold text-teal-dark">Nas horas vagas: </strong>
                    {s.horasVagas}
                  </span>
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mx-auto max-w-[1200px] px-[clamp(16px,3vw,40px)] pt-[clamp(56px,8vw,96px)]">
          <div className="grid gap-8 rounded-[40px] bg-teal-dark p-[clamp(28px,4vw,56px)] text-white">
            <div className="grid gap-2 text-center">
              <span className="text-[12px] font-bold tracking-[0.18em] text-teal-pale uppercase">O que a gente acredita</span>
              <h2 className="m-0 font-serif text-[clamp(30px,3.4vw,44px)] leading-[1.1] font-normal">
                Aqui você encontra prata e acessórios delicados, de boa qualidade e com preço que cabe no bolso
              </h2>
            </div>
            <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
              {VALORES.map(({ Icon, t, d }) => (
                <li key={t} className="grid content-start justify-items-center gap-3 rounded-[28px] bg-white/8 p-6 text-center">
                  <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white/12 text-teal-pale">
                    <Icon size={22} strokeWidth={1.6} />
                  </span>
                  <span className="font-serif text-[24px]">{t}</span>
                  <span className="text-[14.5px] leading-[1.65] text-[#D6EEEB]">{d}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/categoria/colecoes/todos"
                className="flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[12px] font-semibold tracking-[0.14em] text-teal-dark uppercase transition-colors hover:bg-teal-pale hover:text-teal-dark"
              >
                Conheça as peças
                <ArrowRight size={14} strokeWidth={1.8} />
              </Link>
              <Link
                to="/perguntas-frequentes"
                className="rounded-full border border-white/30 px-7 py-3.5 text-[12px] font-semibold tracking-[0.14em] text-white uppercase transition-colors hover:bg-white/10 hover:text-white"
              >
                Precisa de ajuda?
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
