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
import Specials from "@/pages/Specials";
import IndustriesIndex from "@/pages/IndustriesIndex";
import IndustryDetail from "@/pages/IndustryDetail";
import ShopByType from "@/pages/ShopByType";
import AdminLeaversTemplates from "@/pages/AdminLeaversTemplates";
import Sports from "@/pages/Sports";
import SportsTeamDetail from "@/pages/SportsTeamDetail";
import TeamKits from "@/pages/TeamKits";
import TeamKitBuilder from "@/pages/TeamKitBuilder";
import FightNightTee from "@/pages/FightNightTee";
import LeaversHoodies from "@/pages/LeaversHoodies";
import LeaversStart from "@/pages/LeaversFlow";
import Portfolio from "@/pages/Portfolio";
import FullSquadConfigurator from "@/pages/FullSquadConfigurator";
import SportsOutfitConfigurator from "@/pages/SportsOutfitConfigurator";
import AdminPortfolio from "@/pages/AdminPortfolio";
import AdminBundleVariants from "@/pages/AdminBundleVariants";
import AdminCollectionSeo from "@/pages/AdminCollectionSeo";
import AdminProductsImport from "@/pages/AdminProductsImport";
import AdminPageCopy from "@/pages/AdminPageCopy";
import AdminConfiguratorSettings from "@/pages/AdminConfiguratorSettings";
import AdminNavigation from "@/pages/AdminNavigation";
import AdminIntegrations from "@/pages/AdminIntegrations";
import WhatsAppFAB from "@/components/bold/WhatsAppFAB";
import ScrollToTop from "@/components/bold/ScrollToTop";
import CartDrawer from "@/components/CartDrawer";
import { CartProvider } from "@/context/CartContext";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <CartProvider>
        <ScrollToTop />
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/themes" element={<ThemeShowcase />} />
          <Route path="/workwear" element={<Workwear />} />
          <Route path="/workforce" element={<KitYourWorkforce />} />
          <Route path="/kit-your-workforce" element={<KitYourWorkforce />} />
          <Route path="/specials" element={<Specials />} />
          <Route path="/your-own-print-specials" element={<Specials />} />
          <Route path="/industries" element={<IndustriesIndex />} />
          <Route path="/industries/:slug" element={<IndustryDetail />} />
          <Route path="/shop/:slug" element={<ShopByType />} />
          <Route path="/teams-schools" element={<TeamsSchools />} />
          <Route path="/sports" element={<Sports />} />
          <Route path="/sports-teams/:slug" element={<SportsTeamDetail />} />
          <Route path="/team-kits" element={<TeamKits />} />
          <Route path="/team-kit-builder" element={<TeamKitBuilder />} />
          <Route path="/fight-night-tee" element={<FightNightTee />} />
          <Route path="/leavers-hoodies" element={<LeaversHoodies />} />
          <Route path="/leavers-hoodies/start" element={<LeaversStart />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/full-squad-configurator" element={<FullSquadConfigurator />} />
          <Route path="/sports-outfit-configurator" element={<SportsOutfitConfigurator />} />
          <Route path="/admin/portfolio" element={<RequireAdmin><AdminPortfolio /></RequireAdmin>} />
          <Route path="/admin/bundle-variants" element={<RequireAdmin><AdminBundleVariants /></RequireAdmin>} />
          <Route path="/admin/collection-seo" element={<RequireAdmin><AdminCollectionSeo /></RequireAdmin>} />
          <Route path="/admin/products-import" element={<RequireAdmin><AdminProductsImport /></RequireAdmin>} />
          <Route path="/admin/page-copy" element={<RequireAdmin><AdminPageCopy /></RequireAdmin>} />
          <Route path="/admin/configurator-settings" element={<RequireAdmin><AdminConfiguratorSettings /></RequireAdmin>} />
          <Route path="/admin/navigation" element={<RequireAdmin><AdminNavigation /></RequireAdmin>} />
          <Route path="/admin/integrations" element={<RequireAdmin><AdminIntegrations /></RequireAdmin>} />
          <Route path="/admin/leavers-templates" element={<RequireAdmin><AdminLeaversTemplates /></RequireAdmin>} />
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
        <CartDrawer />
        </CartProvider>
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
