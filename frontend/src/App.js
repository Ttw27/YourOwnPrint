import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import ThemeShowcase from "@/pages/ThemeShowcase";
import Workwear from "@/pages/Workwear";
import TeamsSchools from "@/pages/TeamsSchools";
import DesignYourOwn from "@/pages/DesignYourOwn";
import Contact from "@/pages/Contact";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import ProductDetail from "@/pages/ProductDetail";
import ReviewsPage from "@/pages/Reviews";
import AdminImport from "@/pages/AdminImport";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/themes" element={<ThemeShowcase />} />
          <Route path="/workwear" element={<Workwear />} />
          <Route path="/teams-schools" element={<TeamsSchools />} />
          <Route path="/design" element={<DesignYourOwn />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/admin/import-reviews" element={<AdminImport />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
