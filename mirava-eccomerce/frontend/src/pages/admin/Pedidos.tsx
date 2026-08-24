import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatarBRL } from "../../lib/dinheiro";
import { formatDate } from "../../lib/pedidos";
import { listAllOrders, STATUS_LABEL, type AdminOrder } from "../../lib/admin";

const PRONTOS_PARA_DESPACHAR = ["paid", "in_batch", "purchased_from_supplier", "received_by_owner"];

export default function AdminPedidos() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<AdminOrder[]>([]);
  const [status, setStatus] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    listAllOrders(status || undefined)
      .then(setPedidos)
      .catch(() => setPedidos([]))
      .finally(() => setCarregando(false));
  }, [status]);

  const prontos = pedidos.filter((p) => PRONTOS_PARA_DESPACHAR.includes(p.status)).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      <h1 className="m-0 mb-1 font-serif text-[26px] font-normal text-wine">Pedidos</h1>
      {!status && !carregando && prontos > 0 && (
        <p className="m-0 mb-6 text-[12.5px] text-ink-soft">
          {prontos} {prontos === 1 ? "pedido pronto" : "pedidos prontos"} pra despachar.
        </p>
      )}

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="mb-5 rounded-[10px] border border-mauve/50 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-wine"
      >
        <option value="">Todos os status</option>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      {carregando ? (
        <p className="m-0 text-[13px] text-mauve">Carregando…</p>
      ) : pedidos.length === 0 ? (
        <p className="m-0 text-[13px] text-mauve">Nenhum pedido encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-blush bg-white shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-blush bg-cream/40 text-left text-[10.5px] tracking-[0.08em] text-ink-soft uppercase">
                <th className="px-4 py-2.5 font-medium">Pedido</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/admin/pedidos/${p.id}`)}
                  className="cursor-pointer border-b border-blush last:border-0 hover:bg-cream/30"
                >
                  <td className="px-4 py-2.5 text-ink">#{p.number}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{p.customer_name}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="px-4 py-2.5 text-ink">{formatarBRL(p.total_cents)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
