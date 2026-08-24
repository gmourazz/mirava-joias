// Avaliações reais para a seção "Quem já comprou conta" da home.
//
// Vêm da sincronização com a Lilly (nome, data, texto — ver ARQUITETURA.md).
// Nunca depoimento inventado: a versão antiga desta seção foi desativada por
// isso mesmo (ver components/Testimonials.tsx, git blame).

import { api } from "./api";

export interface ShowcaseReview {
  author: string;
  text: string;
  product_name: string;
  product_slug: string;
  rating: number | null;
}

export function listShowcaseReviews(): Promise<ShowcaseReview[]> {
  return api<ShowcaseReview[] | null>("/avaliacoes").then((r) => r ?? []);
}
