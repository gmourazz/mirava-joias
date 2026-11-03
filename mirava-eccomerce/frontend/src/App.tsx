import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import AnnouncementBar from "./components/AnnouncementBar";
import Header from "./components/Header";
import Footer from "./components/Footer";
import BotaoContato from "./components/BotaoContato";
import { PopupBoasVindas } from "./components/Novidades";
import RedefinirSenha from "./pages/RedefinirSenha";
import CartDrawer from "./components/CartDrawer";
import Home from "./pages/Home";
import Category from "./pages/Category";
import Produto from "./pages/Produto";
import Conta from "./pages/Conta";
import Busca from "./pages/Busca";
import Checkout from "./pages/Checkout";
import Pedido from "./pages/Pedido";
import PerguntasFrequentes from "./pages/PerguntasFrequentes";
import Politicas from "./pages/Politicas";
import AdminApp from "./admin/AdminApp";
import Rastreio from "./pages/Rastreio";

// Telas com topo próprio no v5 (checkout, conta e painel): sem faixa de avisos, menu, rodapé
// nem botão flutuante — nada que tire a cliente do caminho do pagamento.
const SEM_MOLDURA = ["/checkout", "/conta", "/admin", "/redefinir-senha"];

function Loja() {
  const { pathname } = useLocation();
  const moldura = !SEM_MOLDURA.some((p) => pathname.startsWith(p));

  return (
    <div className="bg-paper font-sans text-ink">
      {moldura && <AnnouncementBar />}
      {moldura && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/categoria/:menuKey/:filter" element={<Category />} />
        <Route path="/produto/:slug" element={<Produto />} />
        <Route path="/conta" element={<Conta />} />
        <Route path="/busca" element={<Busca />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/pedido/:id" element={<Pedido />} />
        <Route path="/rastreio" element={<Rastreio />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/gestao" element={<Navigate to="/admin/pedidos" replace />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/perguntas-frequentes" element={<PerguntasFrequentes />} />
        <Route path="/politicas" element={<Politicas />} />
        <Route path="/politicas/:aba" element={<Politicas />} />
      </Routes>
      {moldura && <Footer />}
      {moldura && <BotaoContato />}
      {moldura && <PopupBoasVindas />}
      <CartDrawer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <FavoritesProvider>
            <Loja />
          </FavoritesProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
