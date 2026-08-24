import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { CartDrawer } from "./components/CartDrawer";
import { Footer } from "./components/Footer";
import { MobileCartBar } from "./components/MobileCartBar";
import { Navbar } from "./components/Navbar";
import { WhatsAppButton } from "./components/WhatsAppButton";
import { AboutPage } from "./pages/AboutPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ContactPage } from "./pages/ContactPage";
import { HomePage } from "./pages/HomePage";
import { StorePage } from "./pages/StorePage";

export default function App() {
  const [busqueda, setBusqueda] = useState("");
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  return (
    <>
      <Navbar
        busqueda={busqueda}
        onBuscar={setBusqueda}
        onAbrirCarrito={() => setCarritoAbierto(true)}
      />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/tienda"
          element={<StorePage busqueda={busqueda} onBuscar={setBusqueda} />}
        />
        <Route path="/tienda/pedido" element={<CheckoutPage />} />
        <Route path="/nosotros" element={<AboutPage />} />
        <Route path="/contacto" element={<ContactPage />} />
      </Routes>

      <Footer />
      <BottomNav />
      <WhatsAppButton />
      <MobileCartBar onAbrir={() => setCarritoAbierto(true)} />

      {carritoAbierto && <CartDrawer onCerrar={() => setCarritoAbierto(false)} />}
    </>
  );
}
