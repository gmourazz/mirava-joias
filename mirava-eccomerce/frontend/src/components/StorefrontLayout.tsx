// Casca da loja pública — o que toda página de vitrine compartilha. Separada
// do AdminLayout: o painel administrativo não é uma página de loja e não
// deve carregar banner de cupom, newsletter ou sacola de compras.

import { Outlet } from "react-router-dom";
import AnnouncementBar from "./AnnouncementBar";
import Header from "./Header";
import Footer from "./Footer";
import Newsletter from "./Newsletter";
import BotaoContato from "./BotaoContato";
import CartDrawer from "./CartDrawer";

export default function StorefrontLayout() {
  return (
    <div className="bg-paper font-sans text-ink">
      <AnnouncementBar />
      <Header />
      <Outlet />
      <Newsletter />
      <Footer />
      <BotaoContato />
      <CartDrawer />
    </div>
  );
}
