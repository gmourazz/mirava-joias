import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Sacola de verdade: item, quantidade e total.
//
// Guardada em localStorage porque o checkout manda a cliente para o site do
// Mercado Pago — a página inteira é trocada. Se o carrinho vivesse só em
// memória, quem desistisse do pagamento e voltasse encontraria a sacola vazia
// e teria que escolher tudo de novo.
//
// O que fica salvo é só a intenção de compra (peça, tamanho, quantidade) e o
// preço para exibir. Quem decide quanto custa continua sendo o servidor: no
// checkout o front manda `product_id`, tamanho e quantidade, e o preço é lido
// do banco. Um localStorage adulterado não vira desconto.

const STORAGE_KEY = "mirava.carrinho";

function loadItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Descarta o que não tiver o formato esperado: uma versão antiga do
    // carrinho salva no navegador não pode quebrar a loja de hoje.
    return parsed.filter(
      (i): i is CartItem =>
        typeof i === "object" && i !== null &&
        typeof (i as CartItem).key === "string" &&
        typeof (i as CartItem).productId === "string" &&
        typeof (i as CartItem).priceCents === "number" &&
        typeof (i as CartItem).quantity === "number",
    );
  } catch {
    return [];
  }
}

export interface CartItem {
  /** productId + tamanho — a mesma peça em tamanhos diferentes são linhas
   *  separadas na sacola. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  priceCents: number;
  size: string | null;
  quantity: number;
}

interface CartContextValue {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  items: CartItem[];
  addItem: (item: Omit<CartItem, "key" | "quantity">) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  subtotalCents: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>(loadItems);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Navegador em aba anônima ou armazenamento cheio: perder a persistência
      // é chato, quebrar a loja é pior.
    }
  }, [items]);

  // Adicionar a mesma peça/tamanho de novo soma quantidade, não duplica linha.
  const addItem = (item: Omit<CartItem, "key" | "quantity">) => {
    const key = `${item.productId}:${item.size ?? ""}`;
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { ...item, key, quantity: 1 }];
    });
    setCartOpen(true); // feedback imediato: a cliente vê que entrou
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const updateQuantity = (key: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(key);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, quantity } : i)),
    );
  };

  const clearCart = () => setItems([]);

  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartOpen,
        openCart: () => setCartOpen(true),
        closeCart: () => setCartOpen(false),
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotalCents,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
