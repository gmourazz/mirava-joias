// Checkout — a última tela antes do Mercado Pago.
//
// O que esta página manda para a API: `product_id`, tamanho e quantidade de
// cada item, o id do endereço e os dados de contato. O que ela NÃO manda:
// preço. O total mostrado aqui é para a cliente conferir; o total cobrado é
// recalculado no servidor a partir do banco (ver api/internal/web/checkout.go).
// Se os dois divergirem, quem manda é o servidor — e é assim que tem que ser.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLogin } from "../context/LoginContext";
import logoTurquesa from "../assets/logos/2 - Logo sem SEMIJOIAS/mirava-logo-turquesa.svg";
import { Link } from "react-router-dom";
import { ArrowRight, Barcode, Check, CreditCard, Gift, Loader2, Lock, Plus, QrCode, Sparkles, Ticket, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { api, ApiError } from "../lib/api";
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
import { formatarBRL, temDescontoPix, textoParcelas, textoPrazo } from "../lib/dinheiro";
import { LOJA } from "../config/loja";
import { checkoutPreview, type CheckoutPreview, type PaymentChoice, myCoupons } from "../lib/extras";

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
  total_cents: number;
  payment_url: string;
}

export default function Checkout() {
  const { user, loading: loadingUser } = useAuth();
  const { abrirLogin } = useLogin();
  const { items, subtotalCents, giftWrap: embrulhoSacola, setGiftWrap: setEmbrulhoSacola } = useCart();

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

  const [aceitePrazo, setAceitePrazo] = useState(false);
  const [aceiteTrocas, setAceiteTrocas] = useState(false);

  // Descontos e embrulho (decisão 31). Cupom OU pontos, nunca os dois — a
  // tela já troca um pelo outro, e o servidor recusa se chegarem juntos.
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const giftWrap = LOJA.embrulhoAtivo && embrulhoSacola;
  const setGiftWrap = setEmbrulhoSacola;
  const [giftMessage, setGiftMessage] = useState("");
  // Forma de pagamento escolhida aqui (decisão 33). O Mercado Pago abre só
  // com ela, e o desconto do Pix só vale no Pix.
  const [payment, setPayment] = useState<PaymentChoice>("pix");
  const [cpf, setCpf] = useState("");
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  // Primeira compra: o cupom de boas-vindas já vem aplicado (decisão 42). Roda
  // uma vez só: se a cliente tirar o cupom, ele não volta sozinho.
  const boasVindasVista = useRef(false);
  useEffect(() => {
    if (!user || boasVindasVista.current) return;
    boasVindasVista.current = true;
    myCoupons()
      .then((lista) => {
        if (lista.some((c) => c.code === LOJA.cupomBoasVindas && c.usable)) setCoupon((atual) => atual || LOJA.cupomBoasVindas);
      })
      .catch(() => {});
  }, [user]);

  // Prévia do servidor: subtotal, desconto, frete, embrulho e total saem da
  // mesma conta que vai ser cobrada. A conta local abaixo só cobre o instante
  // antes da primeira resposta.
  const cartKey = items.map((i) => `${i.productId}:${i.size ?? ""}:${i.quantity}`).join("|");
  useEffect(() => {
    if (!user || items.length === 0) return;
    let atual = true;
    const t = setTimeout(() => {
      checkoutPreview({
        items: items.map((i) => ({ product_id: i.productId, size: i.size ?? "", quantity: i.quantity })),
        address_id: selected ?? undefined,
        shipping,
        coupon: coupon || undefined,
        use_points: usePoints,
        gift_wrap: giftWrap,
        payment_choice: payment,
      })
        .then((p) => {
          if (atual) setPreview(p);
        })
        .catch(() => {
          if (atual) setPreview(null);
        });
    }, 150);
    return () => {
      atual = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cartKey resume `items`
  }, [user, cartKey, selected, shipping, coupon, usePoints, giftWrap, payment]);

  const shippingCents = preview ? preview.shipping_cents : somenteTeste ? 0 : (chosen?.cents ?? 0);
  const giftWrapCents = preview ? preview.gift_wrap_cents : giftWrap ? LOJA.embrulhoCentavos : 0;
  const totalCents = preview ? preview.total_cents : subtotalCents + shippingCents + giftWrapCents;
  const discountError = preview?.discount_error ?? "";
  const pointsBalance = preview?.points_balance ?? 0;

  function applyCoupon(e: FormEvent) {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setUsePoints(false);
    setCoupon(code);
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
    if (!aceitePrazo || !aceiteTrocas) {
      setError("Confirme o prazo da encomenda e a política de trocas para finalizar.");
      return;
    }
    if (discountError) {
      setError(discountError);
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
          coupon: coupon || undefined,
          use_points: usePoints,
          gift_wrap: giftWrap,
          gift_message: giftWrap ? giftMessage.trim() : undefined,
          payment_choice: payment,
          cpf: onlyDigits(cpf) || undefined,
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
        <p className="m-0 text-[15px] leading-relaxed text-text-2">
          A conta guarda seu endereço e o histórico dos pedidos, e é como a
          gente te avisa quando a peça for despachada.
        </p>
        <button type="button" onClick={() => abrirLogin()} className={`${botaoPrimario} cursor-pointer border-none`}>
          Entrar ou criar conta
        </button>
      </Aviso>
    );
  }

  if (items.length === 0) {
    return (
      <Aviso titulo="Sua sacola está vazia">
        <p className="m-0 text-[15px] leading-relaxed text-text-2">Escolha uma peça e ela aparece aqui.</p>
        <Link to="/categoria/colecoes/todos" className={botaoPrimario}>
          Ver as joias
        </Link>
      </Aviso>
    );
  }

  const podePagar = Boolean(selected) && aceitePrazo && aceiteTrocas && !discountError && !submitting;

  return (
    <div className="min-h-screen bg-snow">
      <BarraCheckout />

      <div className="mx-auto flex max-w-[1180px] flex-wrap items-start gap-6 px-[clamp(16px,3vw,40px)] pt-8 pb-20">
        <div className="flex min-w-0 flex-[1.6_1_480px] flex-col gap-5">
          {/* 1 · Entrega */}
          <Cartao numero={1} titulo="Endereço de entrega">
            {loadingAddresses ? (
              <p className="m-0 text-[14px] text-muted">Carregando…</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-[18px] border-[1.5px] p-4 transition-colors ${
                      selected === a.id ? "border-teal bg-[#F1F8F7]" : "border-line bg-white"
                    }`}
                  >
                    <input type="radio" name="endereco" checked={selected === a.id} onChange={() => setSelected(a.id)} className="sr-only" />
                    <Radio ativo={selected === a.id} />
                    <span className="flex-1 text-[14px] leading-relaxed text-text-2">
                      <span className="block text-[15px] font-semibold text-text">
                        {a.recipient}
                        {a.label && <span className="ml-2 text-[12px] font-medium text-muted">{a.label}</span>}
                      </span>
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
                      className="shrink-0 cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]"
                    >
                      <Trash2 className="pointer-events-none h-4 w-4" strokeWidth={1.6} />
                    </button>
                  </label>
                ))}

                {!showForm && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-white px-4 py-2.5 text-[13.5px] font-semibold text-teal hover:border-teal"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} /> Novo endereço
                  </button>
                )}
              </div>
            )}

            {showForm && (
              <form onSubmit={saveAddress} className="animate-fade-in mt-3 grid gap-3.5 rounded-[18px] bg-snow p-5 sm:grid-cols-2">
                <Campo label="Quem recebe" value={form.recipient} onChange={(v) => setForm({ ...form, recipient: v })} required className="sm:col-span-2" />
                <Campo
                  label={zipLoading ? "CEP (buscando…)" : "CEP"}
                  value={formatZip(form.zip_code)}
                  onChange={(v) => setForm({ ...form, zip_code: v })}
                  required
                  inputMode="numeric"
                  placeholder="00000-000"
                />
                <Campo label="Apelido (casa, trabalho…)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} />
                <Campo label="Rua" value={form.street} onChange={(v) => setForm({ ...form, street: v })} required className="sm:col-span-2" />
                <Campo label="Número" value={form.number} onChange={(v) => setForm({ ...form, number: v })} required />
                <Campo label="Complemento" value={form.complement} onChange={(v) => setForm({ ...form, complement: v })} placeholder="Apto, bloco" />
                <Campo label="Bairro" value={form.neighborhood} onChange={(v) => setForm({ ...form, neighborhood: v })} required />
                <div className="grid min-w-0 grid-cols-[1fr_76px] gap-3">
                  <Campo label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
                  <Campo label="UF" value={form.state} onChange={(v) => setForm({ ...form, state: v.toUpperCase().slice(0, 2) })} required />
                </div>

                <div className="flex items-center gap-4 sm:col-span-2">
                  <button type="submit" disabled={savingAddress} className={`${botaoPrimario} mt-0 border-none disabled:opacity-50`}>
                    {savingAddress ? "Salvando…" : "Salvar endereço"}
                  </button>
                  {addresses.length > 0 && (
                    <button type="button" onClick={() => setShowForm(false)} className="cursor-pointer border-none bg-transparent p-0 text-[13.5px] font-semibold text-muted hover:text-teal">
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            )}
          </Cartao>

          {/* 2 · Envio */}
          {shippingOptions.length > 0 && !somenteTeste && (
            <Cartao numero={2} titulo="Forma de envio">
              <div className="flex flex-col gap-2.5">
                {shippingOptions.map((o) => (
                  <label
                    key={o.service}
                    className={`flex cursor-pointer items-center gap-3 rounded-[18px] border-[1.5px] p-4 transition-colors ${
                      shipping === o.service ? "border-teal bg-[#F1F8F7]" : "border-line bg-white"
                    }`}
                  >
                    <input type="radio" name="frete" checked={shipping === o.service} onChange={() => setShipping(o.service)} className="sr-only" />
                    <Radio ativo={shipping === o.service} />
                    <span className="flex-1">
                      <span className="block text-[15px] font-semibold text-text">Correios {o.label}</span>
                      <span className="text-[13px] text-muted">Encomenda + {shippingPrazo(o)} de transporte</span>
                    </span>
                    <span className={`shrink-0 text-[15px] font-bold ${o.free ? "text-teal" : "text-text"}`}>
                      {o.free ? "Grátis" : formatarBRL(o.cents)}
                    </span>
                  </label>
                ))}
              </div>
            </Cartao>
          )}

          {/* Embrulho para presente */}
          {LOJA.embrulhoAtivo && (
            <div className="rounded-3xl border border-line bg-white p-[22px]">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="sr-only" />
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] ${giftWrap ? "border-teal bg-teal text-white" : "border-line-strong bg-white"}`}>
                  {giftWrap && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
                    <Gift size={17} strokeWidth={1.7} className="text-teal" /> Embrulhar para presente
                    <span className="ml-auto text-[14px] font-bold text-text">+ {formatarBRL(LOJA.embrulhoCentavos)}</span>
                  </span>
                  <span className="text-[13px] text-muted">Caixinha com laço e um cartão escrito à mão com a sua mensagem.</span>
                </span>
              </label>
              {giftWrap && (
                <div className="animate-fade-in mt-3.5">
                  <textarea
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value.slice(0, 200))}
                    rows={3}
                    placeholder="Mensagem do cartão (opcional)"
                    className="w-full resize-none rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-3 text-[14px] text-text outline-none focus:border-teal"
                  />
                  <span className="block text-right text-[12px] text-muted">{giftMessage.length}/200</span>
                </div>
              )}
            </div>
          )}

          {/* 3 · Contato */}
          <Cartao numero={3} titulo="Contato">
            {/* Só telefone: é o que a transportadora pede para a entrega. CPF
                a gente não pede aqui — é exigência do processamento do
                pagamento e é pedido na tela de pagamento, não nossa. */}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Campo label="Celular / WhatsApp" value={phone} onChange={setPhone} inputMode="tel" placeholder="(00) 00000-0000" />
              <Campo label="CPF (opcional)" value={cpf} onChange={setCpf} inputMode="numeric" placeholder="000.000.000-00" />
            </div>
            {preview?.club_free_shipping && (
              <p className="m-0 mt-3 text-[13px] text-teal">Você é nível Encanto do Mirava Club: o envio econômico sai grátis.</p>
            )}
          </Cartao>

          {/* 4 · Pagamento — escolhido na tela do Mercado Pago (Checkout Pro,
              decisão 25): nenhum dado de cartão passa pelo nosso site. */}
          <Cartao numero={4} titulo="Pagamento">
            <div className="grid gap-2.5">
              <Tile ativo={payment === "pix"} onClick={() => setPayment("pix")} icone={<QrCode size={20} strokeWidth={1.6} />} titulo="Pix" texto={temDescontoPix ? `${LOJA.descontoPixPct}% de desconto · aprovação na hora` : "aprovação na hora"} />
              <Tile ativo={payment === "card"} onClick={() => setPayment("card")} icone={<CreditCard size={20} strokeWidth={1.6} />} titulo="Cartão de crédito" texto={`até ${LOJA.parcelasSemJuros}x sem juros`} />
              <Tile ativo={payment === "boleto"} onClick={() => setPayment("boleto")} icone={<Barcode size={20} strokeWidth={1.6} />} titulo="Boleto" texto="a encomenda começa depois da compensação (até 3 dias úteis)" />
            </div>
            <p className="m-0 mt-3 flex items-start gap-2 text-[13.5px] leading-relaxed text-text-2">
              <Lock size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-teal" />
              {payment === "pix"
                ? "Na próxima tela, segura, do Mercado Pago, aparecem o QR Code e o código copia e cola."
                : payment === "card"
                  ? "Você digita os dados do cartão na próxima tela, segura, do Mercado Pago. Nada de cartão passa pelo nosso site."
                  : "O boleto é gerado na próxima tela, segura, do Mercado Pago. Ele vence em 2 dias úteis."}
            </p>
          </Cartao>
        </div>

        {/* Resumo */}
        <aside className="flex-[1_1_320px] lg:sticky lg:top-5">
          <div className="rounded-3xl border border-line bg-white p-[22px]">
            <h2 className="m-0 mb-4 font-serif text-[24px] font-normal text-teal-dark">Resumo</h2>

            <div className="flex flex-col gap-3.5">
              {items.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="relative shrink-0">
                    {item.image ? (
                      <img src={item.image} alt="" className="h-[58px] w-[58px] rounded-[14px] bg-mist-3 object-cover" />
                    ) : (
                      <span className="block h-[58px] w-[58px] rounded-[14px] bg-mist-3" />
                    )}
                    <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-teal-dark px-1 text-[11px] font-bold text-white">
                      {item.quantity}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-text">{item.name}</span>
                    {item.size && <span className="text-[12.5px] text-muted">{item.size}</span>}
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold text-text">{formatarBRL(item.priceCents * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-[14px] text-text-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatarBRL(preview?.list_subtotal_cents ?? subtotalCents)}</span>
              </div>
              {/* Cada desconto numa linha, como o servidor calculou (decisões 31-33). */}
              {preview && preview.list_subtotal_cents > preview.subtotal_cents && (
                <LinhaDesconto rotulo="Promoção" valor={preview.list_subtotal_cents - preview.subtotal_cents} />
              )}
              {preview && preview.kit_discount_cents > 0 && <LinhaDesconto rotulo="Compre junto" valor={preview.kit_discount_cents} />}
              {preview && preview.coupon_discount_cents > 0 && (
                <LinhaDesconto
                  rotulo={preview.coupon_code ? `Cupom ${preview.coupon_code}` : `${preview.points_used} pontos do Club`}
                  valor={preview.coupon_discount_cents}
                />
              )}
              {preview && preview.pix_discount_cents > 0 && (
                <LinhaDesconto rotulo={`Desconto Pix (${preview.pix_discount_pct}%)`} valor={preview.pix_discount_cents} />
              )}
              <div className="flex justify-between">
                <span>Frete{!somenteTeste && chosen ? ` (${chosen.label})` : ""}</span>
                <span>
                  {somenteTeste || (selected && preview && preview.shipping_cents === 0) || chosen?.free ? (
                    <span className="font-semibold text-teal">Grátis</span>
                  ) : !selected ? (
                    <span className="text-muted">escolha o endereço</span>
                  ) : (
                    formatarBRL(shippingCents)
                  )}
                </span>
              </div>
              {giftWrapCents > 0 && (
                <div className="flex justify-between">
                  <span>Embrulho para presente</span>
                  <span>{formatarBRL(giftWrapCents)}</span>
                </div>
              )}
            </div>

            <Descontos
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              coupon={coupon}
              onApply={applyCoupon}
              onRemove={() => {
                setCoupon("");
                setCouponInput("");
              }}
              usePoints={usePoints}
              onTogglePoints={(v) => {
                setUsePoints(v);
                if (v) {
                  setCoupon("");
                  setCouponInput("");
                }
              }}
              pointsBalance={pointsBalance}
              discountError={discountError}
              earned={preview?.points_earned ?? 0}
            />

            <div className="mt-3.5 border-t border-line pt-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-semibold text-text">Total</span>
                <span className="text-[24px] font-bold text-teal">{formatarBRL(totalCents)}</span>
              </div>
              <div className="mt-1 flex flex-col items-end gap-0.5 text-[12.5px]">
                <span className="text-muted">{textoParcelas(totalCents)}</span>
                {/* Com Pix escolhido, o desconto já está numa linha acima; com
                    cartão ou boleto, só lembra que o Pix tem desconto. */}
                {temDescontoPix && payment !== "pix" && (
                  <button type="button" onClick={() => setPayment("pix")} className="cursor-pointer border-none bg-transparent p-0 font-semibold text-teal">
                    Pague com Pix e ganhe {LOJA.descontoPixPct}% nas peças
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-[18px] bg-[#F7FAFA] p-4">
              <Aceite marcado={aceitePrazo} onChange={setAceitePrazo}>
                <strong className="text-text">Entendi que as peças são feitas sob encomenda</strong> e chegam em {textoPrazo()} após a confirmação do pagamento.
              </Aceite>
              <Aceite marcado={aceiteTrocas} onChange={setAceiteTrocas}>
                Li a{" "}
                <Link to="/politicas/trocas" target="_blank" className="font-semibold text-teal underline">
                  política de trocas e devoluções
                </Link>
                .
              </Aceite>
            </div>

            {error && (
              <p className="m-0 mt-4 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#B4443C]">{error}</p>
            )}

            <button
              type="button"
              onClick={pay}
              disabled={submitting}
              className={`mt-4 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border-none bg-teal p-[17px] text-[15px] font-semibold text-white transition-[background,opacity] hover:bg-teal-dark ${
                podePagar ? "" : "opacity-55"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                  Abrindo pagamento…
                </>
              ) : (
                <>
                  <Lock size={17} strokeWidth={1.9} />
                  Ir para o pagamento
                  <ArrowRight size={17} strokeWidth={1.9} />
                </>
              )}
            </button>

            <p className="m-0 mt-3.5 text-center text-[12.5px] leading-relaxed text-muted">
              Peças sob encomenda: entrega em <strong className="text-text">{textoPrazo()}</strong>. Você recebe o código de rastreio por e-mail.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Cupom ou pontos do Mirava Club. Só mostra o que o servidor devolveu: o
 *  desconto e o erro vêm da prévia, não de conta feita aqui. */
function Descontos(props: {
  couponInput: string;
  setCouponInput: (v: string) => void;
  coupon: string;
  onApply: (e: FormEvent) => void;
  onRemove: () => void;
  usePoints: boolean;
  onTogglePoints: (v: boolean) => void;
  pointsBalance: number;
  discountError: string;
  earned: number;
}) {
  const podeUsarPontos = props.pointsBalance >= 100;
  return (
    <div className="mt-4 grid gap-3 border-t border-line pt-4">
      {props.coupon ? (
        <div className={`flex items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-[13.5px] ${props.discountError ? "bg-fog" : "bg-[#F1F8F7]"}`}>
          <Ticket size={16} strokeWidth={1.7} className={props.discountError ? "text-muted" : "text-teal"} />
          <span className={`flex-1 font-semibold ${props.discountError ? "text-muted line-through" : "text-teal-dark"}`}>Cupom {props.coupon}</span>
          <button type="button" onClick={props.onRemove} aria-label="Remover cupom" className="cursor-pointer border-none bg-transparent p-0.5 text-muted hover:text-[#B4443C]">
            <X size={16} />
          </button>
        </div>
      ) : (
        <form onSubmit={props.onApply} className="flex gap-2">
          <input
            value={props.couponInput}
            onChange={(e) => props.setCouponInput(e.target.value.toUpperCase())}
            placeholder="Cupom de desconto"
            className="min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-white px-4 py-2.5 text-[13.5px] uppercase tracking-wide text-text outline-none placeholder:normal-case placeholder:tracking-normal focus:border-teal"
          />
          <button type="submit" className="cursor-pointer rounded-full border-[1.5px] border-teal bg-white px-4 text-[13px] font-semibold text-teal hover:bg-teal hover:text-white">
            Aplicar
          </button>
        </form>
      )}

      {podeUsarPontos && (
        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-text-2">
          <input type="checkbox" checked={props.usePoints} onChange={(e) => props.onTogglePoints(e.target.checked)} className="sr-only" />
          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] ${props.usePoints ? "border-teal bg-teal text-white" : "border-line-strong bg-white"}`}>
            {props.usePoints && <Check size={13} strokeWidth={3} />}
          </span>
          <span>
            Usar meus pontos do <strong className="text-text">Mirava Club</strong>{" "}
            <span className="text-muted">({props.pointsBalance} pontos)</span>
          </span>
        </label>
      )}

      {props.discountError && (
        <p className="m-0 rounded-[14px] bg-[#FDF3E6] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#8A5A14]">{props.discountError}</p>
      )}

      {props.earned > 0 && (
        <p className="m-0 flex items-center gap-1.5 text-[12.5px] text-muted">
          <Sparkles size={14} strokeWidth={1.7} className="text-teal" />
          Esta compra rende <strong className="text-text">{props.earned} pontos</strong> quando for entregue.
        </p>
      )}
    </div>
  );
}

function LinhaDesconto({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between font-semibold text-teal">
      <span>{rotulo}</span>
      <span>− {formatarBRL(valor)}</span>
    </div>
  );
}

const botaoPrimario =
  "mt-2 cursor-pointer rounded-full bg-teal px-7 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white";

/** Topo próprio do checkout (v5): logotipo, passos e selo de segurança. A
 *  faixa de avisos, o menu e o rodapé da loja somem nesta tela. */
function BarraCheckout() {
  const passos = [
    { n: 1, label: "Sacola", feito: true },
    { n: 2, label: "Entrega e pagamento", ativo: true },
    { n: 3, label: "Confirmação" },
  ];
  return (
    <header className="flex h-[76px] items-center border-b border-line bg-white">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-[clamp(16px,3vw,40px)]">
        <Link to="/" aria-label="Mirava Semijoias, início" className="block">
          <img src={logoTurquesa} alt="Mirava" className="h-11 w-auto" />
        </Link>
        <ol className="m-0 hidden list-none items-center gap-5 p-0 md:flex">
          {passos.map((p) => (
            <li key={p.n} className={`flex items-center gap-2 text-[13.5px] font-semibold ${p.feito || p.ativo ? "text-teal-dark" : "text-faint"}`}>
              <span
                className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-bold ${
                  p.feito || p.ativo ? "bg-teal text-white" : "bg-[#EEF3F2] text-faint"
                }`}
              >
                {p.feito ? <Check size={13} strokeWidth={3} /> : p.n}
              </span>
              {p.label}
            </li>
          ))}
        </ol>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-teal">
          <Lock size={15} strokeWidth={1.8} />
          Compra 100% segura
        </span>
      </div>
    </header>
  );
}

function Cartao({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-[22px]">
      <h2 className="m-0 mb-4 flex items-center gap-3 font-serif text-[22px] font-normal text-teal-dark">
        <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-teal font-sans text-[14px] font-bold text-white">{numero}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Radio({ ativo }: { ativo: boolean }) {
  return (
    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${ativo ? "border-teal" : "border-[#DDE4E4]"}`}>
      {ativo && <span className="h-2.5 w-2.5 rounded-full bg-teal" />}
    </span>
  );
}

function Tile({ icone, titulo, texto, ativo, onClick }: { icone: React.ReactNode; titulo: string; texto: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex cursor-pointer items-center gap-3 rounded-[18px] border-[1.5px] p-4 text-left transition-colors ${ativo ? "border-teal bg-[#F1F8F7]" : "border-line bg-white hover:border-teal"}`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mist text-teal">{icone}</span>
      <span className="grid min-w-0">
        <span className="text-[14.5px] font-semibold text-text">{titulo}</span>
        <span className="text-[13px] text-muted">{texto}</span>
      </span>
    </button>
  );
}

function Aceite({ marcado, onChange, children }: { marcado: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-text-2">
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-[1.5px] transition-colors ${marcado ? "border-teal bg-teal text-white" : "border-[#DDE4E4] bg-white"}`}>
        {marcado && <Check size={14} strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  );
}

function Campo({
  label,
  value,
  onChange,
  required,
  inputMode,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  inputMode?: "numeric" | "tel";
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[12.5px] font-semibold text-text-2">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        className="w-full min-w-0 rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-[13px] text-[14.5px] text-text outline-none placeholder:text-[#8A9A9B] focus:border-teal"
      />
    </label>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-snow">
      <BarraCheckout />
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-28 text-center">
        <h1 className="m-0 font-serif text-[32px] font-normal text-teal-dark">{titulo}</h1>
        {children}
      </div>
    </div>
  );
}
