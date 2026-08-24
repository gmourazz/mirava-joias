// Checkout — a última tela antes do Mercado Pago.
//
// O que esta página manda para a API: `product_id`, tamanho e quantidade de
// cada item, o id do endereço e os dados de contato. O que ela NÃO manda:
// preço. O total mostrado aqui é para a cliente conferir; o total cobrado é
// recalculado no servidor a partir do banco (ver api/internal/web/checkout.go).
// Se os dois divergirem, quem manda é o servidor — e é assim que tem que ser.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Loader2, Lock, MapPin, Plus, Tag, Trash2, Truck, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { api, ApiError } from "../lib/api";
import { validateCoupon } from "../lib/cupom";
import {
  createAddress,
  deleteAddress,
  formatZip,
  listAddresses,
  lookupZip,
  onlyDigits,
  type Address,
  type NewAddress,
} from "../lib/enderecos";
import {
  quoteShipping,
  shippingPrazo,
  type ShippingOption,
  type ShippingService,
} from "../lib/frete";
import { formatarBRL, textoParcelas } from "../lib/dinheiro";

const EMPTY_ADDRESS: NewAddress = {
  label: "Casa",
  recipient: "",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  primary: false,
};

interface CheckoutResponse {
  order_id: string;
  number: number;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_url: string;
}

export default function Checkout() {
  const { user, loading: loadingUser } = useAuth();
  const { items, subtotalCents } = useCart();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewAddress>(EMPTY_ADDRESS);
  const [savingAddress, setSavingAddress] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shipping, setShipping] = useState<ShippingService>("economico");

  const [phone, setPhone] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<string | null>(null);
  const [discountCents, setDiscountCents] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  // Pré-preenche contato com o que já está no perfil.
  useEffect(() => {
    if (!user) return;
    api<{ name: string; phone?: string }>("/auth/eu", { authenticated: true })
      .then((me) => {
        setPhone((p) => p || me.phone || "");
        setForm((f) => (f.recipient ? f : { ...f, recipient: me.name ?? "" }));
      })
      .catch(() => {
        // Perfil é conveniência; a cliente digita se não vier.
      });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoadingAddresses(false);
      return;
    }
    listAddresses()
      .then((list) => {
        setAddresses(list);
        const preferred = list.find((a) => a.primary) ?? list[0];
        setSelected(preferred?.id ?? null);
        if (list.length === 0) setShowForm(true);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Não consegui carregar seus endereços"))
      .finally(() => setLoadingAddresses(false));
  }, [user]);

  // Recotiza sempre que mudar o endereço escolhido ou o valor da sacola: o
  // preço depende do estado de destino e da regra de frete grátis.
  const selectedUf = addresses.find((a) => a.id === selected)?.state ?? "";
  useEffect(() => {
    if (!selectedUf) {
      setShippingOptions([]);
      return;
    }
    let atual = true;
    quoteShipping(selectedUf, subtotalCents)
      .then((q) => {
        if (atual) setShippingOptions(q.options ?? []);
      })
      .catch(() => {
        if (atual) setShippingOptions([]);
      });
    return () => {
      atual = false;
    };
  }, [selectedUf, subtotalCents]);

  // Carrinho só com o produto de teste: sem frete, pra dar pra fechar um
  // pedido de verdade gastando só o R$ 1,00 da peça. Some sozinho quando a
  // peça de teste for despublicada — não é um desconto que precisa lembrar
  // de tirar depois.
  const somenteTeste = items.length > 0 && items.every((i) => i.slug === "peca-de-teste-mirava");

  const chosen = shippingOptions.find((o) => o.service === shipping);
  const shippingCents = somenteTeste ? 0 : (chosen?.cents ?? 0);
  const totalCents = subtotalCents + shippingCents - discountCents;

  async function applyCoupon(e: FormEvent) {
    e.preventDefault();
    const code = couponInput.trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await validateCoupon(code, subtotalCents);
      if (res.valid) {
        setCouponApplied(code.toUpperCase());
        setDiscountCents(res.discount_cents ?? 0);
      } else {
        setDiscountCents(0);
        setCouponApplied(null);
        setCouponError(res.error ?? "Cupom inválido");
      }
    } catch (e) {
      setDiscountCents(0);
      setCouponApplied(null);
      setCouponError(e instanceof ApiError ? e.message : "Não consegui checar o cupom");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCouponApplied(null);
    setDiscountCents(0);
    setCouponInput("");
    setCouponError(null);
  }

  // Busca o CEP assim que o 8º dígito é digitado — não espera a cliente sair
  // do campo. `buscadoRef` evita repetir a busca pro mesmo CEP (o efeito
  // também dispara quando `street`/`city` mudam, porque eles são preenchidos
  // pela própria busca) e corta a resposta se a cliente já apagou e digitou
  // outro CEP enquanto a primeira busca ainda estava no ar.
  const cepDigits = onlyDigits(form.zip_code);
  const buscadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (cepDigits.length !== 8 || buscadoRef.current === cepDigits) return;
    buscadoRef.current = cepDigits;
    let atual = true;
    setZipLoading(true);
    lookupZip(cepDigits).then((found) => {
      if (!atual) return;
      setZipLoading(false);
      if (found) setForm((f) => ({ ...f, ...found }));
    });
    return () => {
      atual = false;
    };
  }, [cepDigits]);

  async function saveAddress(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingAddress(true);
    try {
      const { id } = await createAddress({
        ...form,
        zip_code: onlyDigits(form.zip_code),
        primary: addresses.length === 0,
      });
      const list = await listAddresses();
      setAddresses(list);
      setSelected(id);
      setShowForm(false);
      setForm(EMPTY_ADDRESS);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não consegui salvar o endereço");
    } finally {
      setSavingAddress(false);
    }
  }

  async function removeAddress(id: string) {
    try {
      await deleteAddress(id);
      const list = await listAddresses();
      setAddresses(list);
      if (selected === id) setSelected(list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não consegui excluir");
    }
  }

  async function pay() {
    setError(null);
    if (!selected) {
      setError("Escolha um endereço de entrega.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<CheckoutResponse>("/checkout", {
        method: "POST",
        authenticated: true,
        body: {
          items: items.map((i) => ({
            product_id: i.productId,
            size: i.size ?? "",
            quantity: i.quantity,
          })),
          address_id: selected,
          shipping,
          phone: onlyDigits(phone),
          coupon_code: couponApplied ?? "",
        },
      });
      // O carrinho NÃO é limpo aqui. Se a cliente desistir dentro do Mercado
      // Pago e voltar, a sacola precisa estar do jeito que ela deixou. Quem
      // limpa é a página /pedido, depois do pagamento aprovado.
      window.location.href = res.payment_url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não consegui iniciar o pagamento");
      setSubmitting(false);
    }
  }

  if (loadingUser) return null;

  if (!user) {
    return (
      <Aviso titulo="Entre para finalizar">
        <p className="m-0 text-[14px] leading-relaxed text-ink-soft">
          A conta guarda seu endereço e o histórico dos pedidos, e é como a
          gente te avisa quando a peça for despachada.
        </p>
        <Link
          to="/conta"
          className="mt-2 rounded-full bg-wine px-7 py-3 font-serif text-[13px] font-semibold tracking-[0.18em] text-white uppercase hover:bg-wine-dark"
        >
          Entrar ou criar conta
        </Link>
      </Aviso>
    );
  }

  if (items.length === 0) {
    return (
      <Aviso titulo="Sua sacola está vazia">
        <p className="m-0 text-[14px] leading-relaxed text-ink-soft">
          Escolha uma peça e ela aparece aqui.
        </p>
        <Link
          to="/categoria/colecoes/todos"
          className="mt-2 rounded-full bg-wine px-7 py-3 font-serif text-[13px] font-semibold tracking-[0.18em] text-white uppercase hover:bg-wine-dark"
        >
          Ver coleções
        </Link>
      </Aviso>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-20 sm:px-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 flex cursor-pointer items-center gap-1 border-none bg-none p-0 text-[12px] tracking-[0.12em] text-mauve uppercase hover:text-wine"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      <h1 className="m-0 font-serif text-[clamp(26px,3vw,34px)] leading-tight font-normal">
        Finalizar compra
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-14">
        <div className="flex flex-col gap-9">
          {/* Endereço */}
          <section>
            <Passo numero={1} icone={<MapPin className="h-4 w-4" strokeWidth={1.6} />}>
              Endereço de entrega
            </Passo>

            {loadingAddresses ? (
              <p className="m-0 text-[13px] text-ink-soft">Carregando…</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-start gap-3 rounded-[14px] border p-4 transition"
                    style={{
                      borderColor: selected === a.id ? "#8E3B6B" : "#FFE5F0",
                      background: selected === a.id ? "#FFF7FB" : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="endereco"
                      checked={selected === a.id}
                      onChange={() => setSelected(a.id)}
                      className="mt-1 accent-wine-dark"
                    />
                    <span className="flex-1 text-[13px] leading-relaxed text-ink-soft">
                      <span className="block font-serif text-[15px] text-ink">{a.recipient}</span>
                      {a.street}, {a.number}
                      {a.complement && ` · ${a.complement}`}
                      <br />
                      {a.neighborhood} · {a.city}/{a.state} · CEP {formatZip(a.zip_code)}
                    </span>
                    <button
                      type="button"
                      // O botão vive dentro do <label>: sem parar o evento, um
                      // clique na lixeira também marcaria o endereço.
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void removeAddress(a.id);
                      }}
                      aria-label="Excluir endereço"
                      className="shrink-0 cursor-pointer border-none bg-none p-1 text-mauve hover:text-wine"
                    >
                      <Trash2 className="pointer-events-none h-3.5 w-3.5" strokeWidth={1.6} />
                    </button>
                  </label>
                ))}

                {!showForm && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-mauve bg-none px-4 py-2 text-[12px] tracking-[0.1em] text-ink uppercase hover:border-wine hover:text-wine"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.8} /> Novo endereço
                  </button>
                )}
              </div>
            )}

            {showForm && (
              <form onSubmit={saveAddress} className="mt-3 grid gap-3.5 rounded-[16px] border border-blush bg-cream/40 p-5 sm:grid-cols-2">
                <Campo
                  label="Quem recebe"
                  value={form.recipient}
                  onChange={(v) => setForm({ ...form, recipient: v })}
                  required
                  className="sm:col-span-2"
                />
                <Campo
                  label={zipLoading ? "CEP (buscando…)" : "CEP"}
                  value={formatZip(form.zip_code)}
                  onChange={(v) => setForm({ ...form, zip_code: v })}
                  required
                  inputMode="numeric"
                />
                <Campo
                  label="Apelido (casa, trabalho…)"
                  value={form.label}
                  onChange={(v) => setForm({ ...form, label: v })}
                />
                <Campo
                  label="Rua"
                  value={form.street}
                  onChange={(v) => setForm({ ...form, street: v })}
                  required
                  className="sm:col-span-2"
                />
                <Campo
                  label="Número"
                  value={form.number}
                  onChange={(v) => setForm({ ...form, number: v })}
                  required
                />
                <Campo
                  label="Complemento"
                  value={form.complement}
                  onChange={(v) => setForm({ ...form, complement: v })}
                />
                <Campo
                  label="Bairro"
                  value={form.neighborhood}
                  onChange={(v) => setForm({ ...form, neighborhood: v })}
                  required
                />
                <div className="grid min-w-0 grid-cols-[1fr_76px] gap-3">
                  <Campo
                    label="Cidade"
                    value={form.city}
                    onChange={(v) => setForm({ ...form, city: v })}
                    required
                  />
                  <Campo
                    label="UF"
                    value={form.state}
                    onChange={(v) => setForm({ ...form, state: v.toUpperCase().slice(0, 2) })}
                    required
                  />
                </div>

                <div className="flex items-center gap-3 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={savingAddress}
                    className="cursor-pointer rounded-full bg-wine px-6 py-2.5 font-serif text-[12.5px] font-semibold tracking-[0.16em] text-white uppercase hover:bg-wine-dark disabled:opacity-50"
                  >
                    {savingAddress ? "Salvando…" : "Salvar endereço"}
                  </button>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="cursor-pointer border-none bg-none p-0 text-[12.5px] text-mauve underline hover:text-wine"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>

          {/* Entrega */}
          {shippingOptions.length > 0 && !somenteTeste && (
            <section>
              <Passo numero={2} icone={<Truck className="h-4 w-4" strokeWidth={1.6} />}>
                Forma de entrega
              </Passo>
              <div className="flex flex-col gap-2.5">
                {shippingOptions.map((o) => (
                  <label
                    key={o.service}
                    className="flex cursor-pointer items-center gap-3 rounded-[14px] border p-4 transition"
                    style={{
                      borderColor: shipping === o.service ? "#8E3B6B" : "#FFE5F0",
                      background: shipping === o.service ? "#FFF7FB" : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="frete"
                      checked={shipping === o.service}
                      onChange={() => setShipping(o.service)}
                      className="accent-wine-dark"
                    />
                    <span className="flex-1">
                      <span className="block font-serif text-[15px] text-ink">{o.label}</span>
                      <span className="text-[12px] text-ink-soft">
                        {shippingPrazo(o)} após a confirmação
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] text-ink">
                      {o.free ? <span className="text-wine">Grátis</span> : formatarBRL(o.cents)}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Contato */}
          <section>
            <Passo numero={3} icone={<User className="h-4 w-4" strokeWidth={1.6} />}>
              Contato
            </Passo>
            {/* Só telefone: é o que a transportadora pede para a entrega. CPF
                a gente não pede aqui — é exigência do processamento do
                pagamento e é pedido na tela de pagamento, não nossa. */}
            <Campo label="Telefone" value={phone} onChange={setPhone} inputMode="tel" />
          </section>

        </div>

        {/* Resumo */}
        <aside className="h-fit lg:sticky lg:top-24">
          <div className="rounded-[18px] border border-blush p-6">
            <h2 className="m-0 mb-4 font-serif text-[19px] font-normal">Seu pedido</h2>

            <div className="flex flex-col gap-3.5">
              {items.map((item) => (
                <div key={item.key} className="flex items-center gap-3 text-[13px]">
                  {item.image && (
                    <img
                      src={item.image}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-[10px] object-cover"
                    />
                  )}
                  <span className="flex-1 text-ink-soft">
                    <span className="block font-serif text-[14.5px] leading-tight text-ink">
                      {item.name}
                    </span>
                    <span className="text-[11.5px]">
                      {item.size && `${item.size} · `}
                      {item.quantity} un.
                    </span>
                  </span>
                  <span className="shrink-0 text-ink">
                    {formatarBRL(item.priceCents * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Cupom */}
            <div className="mt-5 border-t border-blush pt-4">
              {couponApplied ? (
                <div className="flex items-center justify-between gap-2 rounded-[12px] border border-rose/60 bg-cream/50 px-3.5 py-2.5">
                  <span className="flex items-center gap-2 text-[12.5px] text-ink">
                    <Check className="h-3.5 w-3.5 text-wine" strokeWidth={2} />
                    Cupom <span className="font-semibold">{couponApplied}</span> aplicado
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    aria-label="Remover cupom"
                    className="cursor-pointer border-none bg-none p-0.5 text-mauve hover:text-wine"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ) : (
                <form onSubmit={applyCoupon} className="flex items-center gap-2">
                  <label className="relative flex-1">
                    <Tag className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-mauve" strokeWidth={1.6} />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Cupom de desconto"
                      className="w-full rounded-full border border-mauve/50 bg-paper py-2.5 pr-3 pl-9 font-sans text-[12.5px] tracking-[0.04em] text-ink uppercase outline-none focus:border-wine"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={couponLoading || !couponInput.trim()}
                    className="shrink-0 cursor-pointer rounded-full border border-wine px-4 py-2.5 font-serif text-[11.5px] font-semibold tracking-[0.12em] text-wine uppercase transition-colors hover:bg-wine hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : "Aplicar"}
                  </button>
                </form>
              )}
              {couponError && (
                <p className="m-0 mt-2 text-[12px] leading-relaxed text-wine-dark">{couponError}</p>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1.5 text-[13px]">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>{formatarBRL(subtotalCents)}</span>
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between text-wine">
                  <span>Desconto</span>
                  <span>−{formatarBRL(discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-soft">
                <span>Frete{!somenteTeste && chosen ? ` · ${chosen.label}` : ""}</span>
                <span>
                  {somenteTeste ? (
                    <span className="text-wine">Grátis</span>
                  ) : !selected ? (
                    <span className="text-mauve">escolha o endereço</span>
                  ) : chosen?.free ? (
                    <span className="text-wine">Grátis</span>
                  ) : (
                    formatarBRL(shippingCents)
                  )}
                </span>
              </div>
            </div>

            <div className="mt-3.5 border-t border-blush pt-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] tracking-[0.18em] text-ink-soft uppercase">Total</span>
                <span className="text-[22px] leading-none text-ink">
                  {formatarBRL(totalCents)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-col items-end gap-0.5">
                <span className="text-xs text-ink-soft">{textoParcelas(totalCents)}</span>
              </div>
            </div>

            {error && (
              <p className="m-0 mt-4 rounded-[10px] bg-blush px-3.5 py-2.5 text-[12.5px] leading-relaxed text-wine-dark">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={pay}
              disabled={submitting || !selected}
              className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border-none bg-wine p-4 font-serif text-[14px] font-semibold tracking-[0.2em] text-white uppercase transition-colors hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                  Abrindo pagamento…
                </>
              ) : (
                <>
                  <Lock className="h-[15px] w-[15px]" strokeWidth={1.6} />
                  Ir para o pagamento
                </>
              )}
            </button>

            <p className="m-0 mt-3.5 text-center text-[11px] leading-relaxed text-mauve">
              Você será levada para uma tela segura de pagamento, com Pix ou cartão.
              {chosen && ` Entrega em ${shippingPrazo(chosen)} após a confirmação.`}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Passo({
  numero,
  icone,
  children,
}: {
  numero: number;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 className="m-0 mb-4 flex items-center gap-2.5 font-serif text-[19px] font-normal">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cream text-wine">
        {icone}
      </span>
      {children}
      <span className="sr-only">passo {numero}</span>
    </h2>
  );
}

function Campo({
  label,
  value,
  onChange,
  onBlur,
  required,
  inputMode,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  required?: boolean;
  inputMode?: "numeric" | "tel";
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[10.5px] tracking-[0.14em] text-ink-soft uppercase">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        inputMode={inputMode}
        className="w-full min-w-0 rounded-[10px] border border-mauve/50 bg-paper px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-wine"
      />
    </label>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-28 text-center">
      <h1 className="m-0 font-serif text-[26px] font-normal">{titulo}</h1>
      {children}
    </div>
  );
}
