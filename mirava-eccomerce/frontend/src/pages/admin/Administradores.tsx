// Só quem é "system" chega aqui — a rota /admin/administradores nem aparece
// no menu pra quem é só "admin" (ver AdminLayout), e a API recusa com 403
// de qualquer jeito. Duas camadas, a mesma regra do resto do site: o front
// esconde por conveniência, o servidor é quem protege de verdade.

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api";
import { addAdmin, listAdmins, removeAdmin, type AdminUser } from "../../lib/admin";

const ROLE_LABEL: Record<"system" | "admin", string> = {
  system: "Master",
  admin: "Admin",
};

export default function AdminAdministradores() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "system">("admin");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      setAdmins(await listAdmins());
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui carregar");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await addAdmin(email.trim(), role);
      setEmail("");
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui adicionar");
    } finally {
      setEnviando(false);
    }
  }

  async function remover(userId: string) {
    setErro(null);
    try {
      await removeAdmin(userId);
      setAdmins((atual) => atual.filter((a) => a.user_id !== userId));
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui remover");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10">
      <h1 className="m-0 mb-1 font-serif text-[26px] font-normal text-wine">Administradores</h1>
      <p className="m-0 mb-6 text-[12.5px] text-ink-soft">
        Só quem está aqui acessa o painel. Master (system) pode gerenciar outros
        admins; Admin tem acesso operacional, sem esta tela.
      </p>

      <form
        onSubmit={adicionar}
        className="mb-6 flex flex-wrap items-center gap-2.5 rounded-[16px] border border-blush bg-white p-4 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail de quem já tem conta na loja"
          required
          className="min-w-0 flex-1 rounded-[10px] border border-mauve/50 bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-wine"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "system")}
          className="rounded-[10px] border border-mauve/50 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-wine"
        >
          <option value="admin">Admin</option>
          <option value="system">Master</option>
        </select>
        <button
          type="submit"
          disabled={enviando}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-wine px-4 py-2.5 text-[12px] font-medium tracking-[0.05em] text-white uppercase hover:bg-wine-dark disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" strokeWidth={1.8} />
          Adicionar
        </button>
      </form>

      {erro && (
        <p className="m-0 mb-4 flex items-center gap-2 rounded-[10px] bg-blush px-4 py-3 text-[12.5px] text-wine-dark">
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="m-0 text-[13px] text-mauve">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-blush bg-white shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-blush bg-cream/40 text-left text-[10.5px] tracking-[0.08em] text-ink-soft uppercase">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">E-mail</th>
                <th className="px-4 py-2.5 font-medium">Nível</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.user_id} className="border-b border-blush last:border-0">
                  <td className="px-4 py-2.5 text-ink">{a.name}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{a.email}</td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    <span
                      className={
                        a.role === "system"
                          ? "rounded-full bg-wine px-2.5 py-1 text-[10.5px] font-medium text-white uppercase"
                          : "rounded-full bg-cream px-2.5 py-1 text-[10.5px] font-medium text-wine-dark uppercase"
                      }
                    >
                      {ROLE_LABEL[a.role]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {a.user_id !== user?.id && (
                      <button
                        type="button"
                        onClick={() => void remover(a.user_id)}
                        aria-label={`Remover ${a.name}`}
                        className="cursor-pointer rounded-full border-none bg-none p-1.5 text-mauve hover:text-wine-dark"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
