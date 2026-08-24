import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import StorefrontLayout from "./components/StorefrontLayout";
import AdminLayout from "./components/AdminLayout";
import Home from "./pages/Home";
import Category from "./pages/Category";
import MaisVendidasPage from "./pages/MaisVendidas";
import Produto from "./pages/Produto";
import Conta from "./pages/Conta";
import Favoritos from "./pages/Favoritos";
import Busca from "./pages/Busca";
import Checkout from "./pages/Checkout";
import Pedido from "./pages/Pedido";
import Sobre from "./pages/Sobre";
import ComoComprar from "./pages/ComoComprar";
import PrazosEntrega from "./pages/PrazosEntrega";
import FaleConosco from "./pages/FaleConosco";
import GuiaDeTamanhos from "./pages/GuiaDeTamanhos";
import Cuidados from "./pages/Cuidados";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminPedidos from "./pages/admin/Pedidos";
import AdminPedidoDetalhe from "./pages/admin/PedidoDetalhe";
import AdminProdutos from "./pages/admin/Produtos";
import AdminAdministradores from "./pages/admin/Administradores";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <Routes>
              {/* Painel administrativo: layout próprio (sidebar), sem a
                  casca da loja — ver components/AdminLayout.tsx. */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="pedidos" element={<AdminPedidos />} />
                <Route path="pedidos/:id" element={<AdminPedidoDetalhe />} />
                <Route path="produtos" element={<AdminProdutos />} />
                <Route path="administradores" element={<AdminAdministradores />} />
              </Route>

              {/* Loja pública */}
              <Route element={<StorefrontLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/categoria/:menuKey/:filter" element={<Category />} />
                <Route path="/mais-vendidas" element={<MaisVendidasPage />} />
                <Route path="/produto/:slug" element={<Produto />} />
                <Route path="/conta" element={<Conta />} />
                <Route path="/favoritos" element={<Favoritos />} />
                <Route path="/busca" element={<Busca />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/pedido/:id" element={<Pedido />} />
                <Route path="/sobre" element={<Sobre />} />
                <Route path="/como-comprar" element={<ComoComprar />} />
                <Route path="/prazos-de-entrega" element={<PrazosEntrega />} />
                <Route path="/fale-conosco" element={<FaleConosco />} />
                <Route path="/guia-de-tamanhos" element={<GuiaDeTamanhos />} />
                <Route path="/cuidados" element={<Cuidados />} />
              </Route>
            </Routes>
          </CartProvider>
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
