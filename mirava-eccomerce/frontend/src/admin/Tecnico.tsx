// Área técnica do painel, só do papel dev (decisão 47): integrações e equipe.
// A API recusa estas rotas para quem não é dev.

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { lojaApi, techApi, type TechStatus, type TeamMember } from "./api";
import { Bloco, Linha, Status, campo } from "./blocos";
import Select from "../components/Select";

const ROTULO: Record<TeamMember["role"], string> = { dev: "DEV", master: "MASTER", dispatch: "DESPACHO" };

export default function Tecnico() {
  const [t, setT] = useState<TechStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    techApi.status().then(setT).catch((e: Error) => setErro(e.message));
  }, []);

  return (
    <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
      <Bloco titulo="Integrações">
        {erro && <span className="text-[13px] text-[#B4443C]">{erro}</span>}
        {t && (
          <>
            <Status ok={t.payment_ready} rotulo="Mercado Pago" detalhe={t.payment_ready ? (t.payment_test_mode ? "credenciais de TESTE" : "produção") : "sem credenciais: o checkout recusa"} />
            <Status ok={t.email_ready} rotulo="E-mails às clientes" detalhe={t.email_ready ? "configurado" : "RESEND_API_KEY não configurada"} />
            <Linha rotulo="Endereço do site" valor={t.site_url || "—"} onde="SITE_URL no .env" />
            <Linha rotulo="Aviso de pagamento (webhook)" valor={t.webhook_url || "—"} onde="WEBHOOK_URL no .env" />
          </>
        )}
        <span className="pt-2 text-[12px] text-muted">
          "Configurado" quer dizer que a chave existe, não que o provedor aceita: confira um envio de teste em Automações.
        </span>
      </Bloco>
      <Equipe />
    </div>
  );
}

function Equipe() {
  const [lista, setLista] = useState<TeamMember[]>([]);
  const [novo, setNovo] = useState<{ username: string; name: string; password: string; role: "master" | "dispatch" }>({
    username: "", name: "", password: "", role: "dispatch",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = () => lojaApi.team().then(setLista).catch((e: Error) => setMsg(e.message));
  useEffect(() => {
    void carregar();
  }, []);

  return (
    <Bloco titulo="Equipe do painel">
      {lista.map((m) => (
        <div key={m.id} className="flex items-center gap-3 border-t border-[#EEF3F2] py-2 text-[13.5px] first-of-type:border-t-0">
          <span className="flex-1">
            <strong className="text-text">{m.name}</strong>
            <span className="block text-[12px] text-muted">usuário {m.username}</span>
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${m.role === "dispatch" ? "bg-mist text-teal" : "bg-teal-dark text-white"}`}>
            {ROTULO[m.role]}
          </span>
          {m.role !== "dev" && (
            <button type="button" aria-label="Tirar acesso" onClick={() => void lojaApi.removeTeam(m.id).then(carregar)} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          void lojaApi
            .addTeam(novo.username.trim(), novo.name.trim(), novo.password, novo.role)
            .then(() => {
              setNovo({ username: "", name: "", password: "", role: "dispatch" });
              void carregar();
              setMsg("Acesso criado. Passe o usuário e a senha para a pessoa.");
            })
            .catch((err: Error) => setMsg(err.message));
        }}
        className="mt-2 grid gap-2 sm:grid-cols-2"
      >
        <input required value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} placeholder="Nome" className={campo} />
        <input required value={novo.username} onChange={(e) => setNovo({ ...novo, username: e.target.value.toLowerCase() })} placeholder="Usuário" autoCapitalize="none" className={campo} />
        <input required minLength={8} type="password" value={novo.password} onChange={(e) => setNovo({ ...novo, password: e.target.value })} placeholder="Senha (8+)" autoComplete="new-password" className={campo} />
        <Select
          variant="field"
          ariaLabel="Papel"
          value={novo.role}
          onChange={(v) => setNovo({ ...novo, role: v as "master" | "dispatch" })}
          options={[{ value: "dispatch", label: "Despacho" }, { value: "master", label: "Master (admin da loja)" }]}
        />
        <button type="submit" className="cursor-pointer rounded-full border-none bg-teal px-4 py-2.5 text-[13px] font-semibold text-white sm:col-span-2">Criar acesso</button>
      </form>
      {msg && <span className="text-[13px] text-text-2">{msg}</span>}
      <span className="text-[12px] text-muted">
        Despacho vê só pedidos e lote. Master vê a loja inteira, menos esta área técnica. Dev só se cria pelo comando criar-admin (db/README.md).
      </span>
    </Bloco>
  );
}

