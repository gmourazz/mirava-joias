import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import AnnouncementBar from "./components/AnnouncementBar";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Newsletter from "./components/Newsletter";
import BotaoContato from "./components/BotaoContato";
import CartDrawer from "./components/CartDrawer";
import Home from "./pages/Home";
import Category from "./pages/Category";
import MaisVendidasPage from "./pages/MaisVendidas";
import Produto from "./pages/Produto";
import Conta from "./pages/Conta";
import Busca from "./pages/Busca";
import Checkout from "./pages/Checkout";
import Pedido from "./pages/Pedido";
import Gestao from "./pages/Gestao";
import Sobre from "./pages/Sobre";
import ComoComprar from "./pages/ComoComprar";
import PrazosEntrega from "./pages/PrazosEntrega";
import FaleConosco from "./pages/FaleConosco";
import GuiaDeTamanhos from "./pages/GuiaDeTamanhos";
import Cuidados from "./pages/Cuidados";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="bg-paper font-sans text-ink">
            <AnnouncementBar />
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/categoria/:menuKey/:filter" element={<Category />} />
              <Route path="/mais-vendidas" element={<MaisVendidasPage />} />
              <Route path="/produto/:slug" element={<Produto />} />
              <Route path="/conta" element={<Conta />} />
              <Route path="/busca" element={<Busca />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/pedido/:id" element={<Pedido />} />
              <Route path="/gestao" element={<Gestao />} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/como-comprar" element={<ComoComprar />} />
              <Route path="/prazos-de-entrega" element={<PrazosEntrega />} />
              <Route path="/fale-conosco" element={<FaleConosco />} />
              <Route path="/guia-de-tamanhos" element={<GuiaDeTamanhos />} />
              <Route path="/cuidados" element={<Cuidados />} />
            </Routes>
            <Newsletter />
            <Footer />
            <BotaoContato />
            <CartDrawer />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
