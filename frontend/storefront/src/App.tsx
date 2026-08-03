import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { CartDrawer } from "./components/CartDrawer";
import { Footer } from "./components/Footer";
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
        <Route path="/tienda" element={<StorePage busqueda={busqueda} />} />
        <Route path="/tienda/pedido" element={<CheckoutPage />} />
        <Route path="/nosotros" element={<AboutPage />} />
        <Route path="/contacto" element={<ContactPage />} />
      </Routes>

      <Footer />
      <WhatsAppButton />

      {carritoAbierto && <CartDrawer onCerrar={() => setCarritoAbierto(false)} />}
    </>
  );
}
