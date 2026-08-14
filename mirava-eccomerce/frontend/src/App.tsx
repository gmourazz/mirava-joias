import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import AnnouncementBar from "./components/AnnouncementBar";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Newsletter from "./components/Newsletter";
import WhatsAppButton from "./components/WhatsAppButton";
import CartDrawer from "./components/CartDrawer";
import Home from "./pages/Home";
import Category from "./pages/Category";
import Produto from "./pages/Produto";

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <div className="bg-paper font-sans text-ink">
          <AnnouncementBar />
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/categoria/:menuKey/:filter" element={<Category />} />
            <Route path="/produto/:slug" element={<Produto />} />
          </Routes>
          <Newsletter />
          <Footer />
          <WhatsAppButton />
          <CartDrawer />
        </div>
      </CartProvider>
    </BrowserRouter>
  );
}
