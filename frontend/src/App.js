import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import ThemeShowcase from "@/pages/ThemeShowcase";
import Workwear from "@/pages/Workwear";
import TeamsSchools from "@/pages/TeamsSchools";
import DesignYourOwn from "@/pages/DesignYourOwn";
import Contact from "@/pages/Contact";
import CheckoutSuccess from "@/pages/CheckoutSuccess";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Toaster theme="dark" position="top-center" richColors />
        <Routes>
          <Route path="/" element={<ThemeShowcase />} />
          <Route path="/workwear" element={<Workwear />} />
          <Route path="/teams-schools" element={<TeamsSchools />} />
          <Route path="/design" element={<DesignYourOwn />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
