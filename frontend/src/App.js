import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
import AdminTeamKits from "@/pages/AdminTeamKits";
import AdminDesignerProducts from "@/pages/AdminDesignerProducts";
import AdminProductSettings from "@/pages/AdminProductSettings";
import AdminLogin from "@/pages/AdminLogin";
import AdminQA from "@/pages/AdminQA";
import RequireAdmin from "@/pages/RequireAdmin";
import KitYourWorkforce from "@/pages/KitYourWorkforce";
import Sports from "@/pages/Sports";
import TeamKits from "@/pages/TeamKits";
import TeamKitBuilder from "@/pages/TeamKitBuilder";
import FightNightTee from "@/pages/FightNightTee";
import LeaversHoodies from "@/pages/LeaversHoodies";
import { LeaversStart, LeaversJoin, LeaversManage } from "@/pages/LeaversFlow";
import WhatsAppFAB from "@/components/bold/WhatsAppFAB";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/themes" element={<ThemeShowcase />} />
          <Route path="/workwear" element={<Workwear />} />
          <Route path="/workforce" element={<KitYourWorkforce />} />
          <Route path="/kit-your-workforce" element={<KitYourWorkforce />} />
          <Route path="/teams-schools" element={<TeamsSchools />} />
          <Route path="/sports" element={<Sports />} />
          <Route path="/team-kits" element={<TeamKits />} />
          <Route path="/team-kit-builder" element={<TeamKitBuilder />} />
          <Route path="/fight-night-tee" element={<FightNightTee />} />
          <Route path="/leavers-hoodies" element={<LeaversHoodies />} />
          <Route path="/leavers-hoodies/start" element={<LeaversStart />} />
          <Route path="/leavers/:token" element={<LeaversJoin />} />
          <Route path="/leavers/:token/manage" element={<LeaversManage />} />
          <Route path="/design" element={<DesignYourOwn />} />
          <Route path="/design-your-own" element={<DesignYourOwn />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/import-reviews" element={<RequireAdmin><AdminImport /></RequireAdmin>} />
          <Route path="/admin/team-kits" element={<RequireAdmin><AdminTeamKits /></RequireAdmin>} />
          <Route path="/admin/designer-products" element={<RequireAdmin><AdminDesignerProducts /></RequireAdmin>} />
          <Route path="/admin/product-settings" element={<RequireAdmin><AdminProductSettings /></RequireAdmin>} />
          <Route path="/admin/qa" element={<RequireAdmin><AdminQA /></RequireAdmin>} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
        </Routes>
        {/* Site-wide WhatsApp FAB. Pages that already render their own FAB will overlap harmlessly,
            but to avoid duplicates each page-level FAB is identical position/size — only rendered once
            visually because pages don't include their own anymore. */}
        <SiteFAB />
      </BrowserRouter>
    </div>
  );
}

// Hide global FAB on routes where pages render their own variant (with bespoke preset text).
function SiteFAB() {
  const { pathname } = useLocation();
  const ownFabRoutes = ["/sports", "/team-kit-builder", "/team-kits", "/fight-night-tee", "/admin"];
  if (ownFabRoutes.some(r => pathname.startsWith(r))) return null;
  if (pathname.startsWith("/product/")) return null;
  return <WhatsAppFAB />;
}

export default App;
