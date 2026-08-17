// Endereços de entrega — fala com /enderecos na API Go.
//
// Os campos espelham `db.Address` do Go, com os mesmos nomes JSON. Se um deles
// mudar lá, muda aqui: não existe geração automática de tipo entre os dois
// projetos, é acordo escrito à mão.

import { api } from "./api";

export interface Address {
  id: string;
  label: string;
  recipient: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  primary: boolean;
}

/** O que o formulário monta. O `id` vem do servidor. */
export type NewAddress = Omit<Address, "id">;

export function listAddresses(): Promise<Address[]> {
  return api<Address[] | null>("/enderecos", { authenticated: true }).then((r) => r ?? []);
}

export function createAddress(address: NewAddress): Promise<{ id: string }> {
  return api<{ id: string }>("/enderecos", {
    method: "POST",
    body: address,
    authenticated: true,
  });
}

export function deleteAddress(id: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/enderecos/${id}`, {
    method: "DELETE",
    authenticated: true,
  });
}

/** "01310-100" → "01310100". O ViaCEP e a API só querem os dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** "01310100" → "01310-100", para exibir. */
export function formatZip(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

/** Preenche rua, bairro, cidade e estado a partir do CEP.
 *
 *  Usa o ViaCEP, que é público e não pede chave. Devolve `null` em qualquer
 *  problema — CEP inexistente, serviço fora do ar, sem internet — porque o
 *  formulário sempre permite digitar à mão. Buscar o CEP é conveniência, não
 *  requisito. */
export async function lookupZip(zip: string): Promise<Partial<NewAddress> | null> {
  const digits = onlyDigits(zip);
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) return null;
    return {
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
