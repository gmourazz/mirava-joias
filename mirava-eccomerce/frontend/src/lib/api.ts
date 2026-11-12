// Cliente HTTP da API Go da Mirava.
//
// Substitui supabase-js: o front não fala mais direto com o Postgres. Toda
// leitura de catálogo e toda ação de conta passa por aqui.

export const BASE_URL = import.meta.env.VITE_API_URL;

if (!BASE_URL) {
  throw new Error(
    "VITE_API_URL não configurada — copie .env.exemplo para .env.local e preencha.",
  );
}

const TOKEN_KEY = "mirava.token";

/** "Lembrar de mim" desmarcado: a sessão fica só nesta aba (sessionStorage)
 *  e some quando o navegador fecha. */
export function saveToken(token: string, remember = true) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function currentToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

// Sessão do painel (decisão 46): login próprio, guardado à parte. Entrar ou
// sair da loja não mexe nela, e ela não vale na loja.
const PAINEL_KEY = "mirava.painel.token";

export function savePainelToken(token: string) {
  localStorage.setItem(PAINEL_KEY, token);
}

export function clearPainelToken() {
  localStorage.removeItem(PAINEL_KEY);
}

export function currentPainelToken(): string | null {
  return localStorage.getItem(PAINEL_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** true = sessão da loja; "painel" = sessão do painel. */
  authenticated?: boolean | "painel";
}

/** Chamada genérica. Lança ApiError com a mensagem que o servidor já
 *  escreveu em português — as telas mostram `error.message` direto. */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.authenticated) {
    const painel = options.authenticated === "painel";
    const token = painel ? currentPainelToken() : currentToken();
    if (!token) throw new ApiError(painel ? "Entre no painel para continuar" : "Faça login para continuar", 401);
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Não consegui falar com o servidor. Verifique sua conexão.", 0);
  }

  // 204 e afins não têm corpo — não tenta fazer parse de JSON vazio.
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data && typeof data === "object" && "error" in data)
      ? String((data as { error: unknown }).error)
      : "Algo deu errado. Tente de novo.";
    throw new ApiError(message, response.status);
  }

  return data as T;
}
