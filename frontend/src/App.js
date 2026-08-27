import React, { useEffect } from "react";
import { initWhatsAppNumber } from "@/lib/data";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import SearchResults from "@/pages/SearchResults";
import FestivalTeesAndBrands from "@/pages/FestivalTeesAndBrands";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Returns from "@/pages/Returns";
import Workwear from "@/pages/Workwear";
import ForBusiness from "@/pages/ForBusiness";
import TeamsSchools from "@/pages/TeamsSchools";
import DesignYourOwn from "@/pages/DesignYourOwn";
import Contact from "@/pages/Contact";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import ProductDetail from "@/pages/ProductDetail";
import FindMyKit from "@/pages/FindMyKit";
import DesignShop from "@/pages/DesignShop";
import ReviewsPage from "@/pages/Reviews";
import AdminImport from "@/pages/AdminImport";
import AdminReviews from "@/pages/AdminReviews";
import AdminTeamKits from "@/pages/AdminTeamKits";
import AdminDesignerProducts from "@/pages/AdminDesignerProducts";
import AdminProductSettings from "@/pages/AdminProductSettings";
import AdminLogin from "@/pages/AdminLogin";
import AdminQA from "@/pages/AdminQA";
import RequireAdmin from "@/pages/RequireAdmin";
import AdminLayout from "@/components/bold/AdminLayout";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminReclassify from "@/pages/AdminReclassify";
import AdminImageHealth from "@/pages/AdminImageHealth";
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
import SchoolTrips from "@/pages/SchoolTrips";
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
import AdminOrders from "@/pages/AdminOrders";
import AdminEnquiries from "@/pages/AdminEnquiries";
import WhatsAppFAB from "@/components/bold/WhatsAppFAB";
import ScrollToTop from "@/components/bold/ScrollToTop";
import CartDrawer from "@/components/CartDrawer";
import { CartProvider } from "@/context/CartContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import Account from "@/pages/Account";
import ResetPassword from "@/pages/ResetPassword";

function App() {
  // Pull the admin-set WhatsApp number once on load so every WhatsApp link
  // reflects it (falls back silently if unset/unreachable).
  useEffect(() => { initWhatsAppNumber(); }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <CustomerAuthProvider>
        <CartProvider>
        <ScrollToTop />
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/festival-tees-and-brands" element={<FestivalTeesAndBrands />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/workwear" element={<Workwear />} />
          <Route path="/for-business" element={<ForBusiness />} />
          <Route path="/workforce" element={<KitYourWorkforce />} />
          <Route path="/kit-your-workforce" element={<KitYourWorkforce />} />
          <Route path="/specials" element={<Specials />} />
          <Route path="/your-own-print-specials" element={<Specials />} />
          <Route path="/industries" element={<IndustriesIndex />} />
          <Route path="/industries/:slug" element={<IndustryDetail />} />
          <Route path="/shop/:slug" element={<ShopByType />} />
          <Route path="/find-my-kit" element={<FindMyKit />} />
          <Route path="/design-shop" element={<DesignShop />} />
          <Route path="/design-shop/:slug" element={<DesignShop />} />
          <Route path="/teams-schools" element={<TeamsSchools />} />
          <Route path="/sports" element={<Sports />} />
          <Route path="/sports-teams/:slug" element={<SportsTeamDetail />} />
          <Route path="/team-kits" element={<TeamKits />} />
          <Route path="/team-kit-builder" element={<TeamKitBuilder />} />
          <Route path="/fight-night-tee" element={<FightNightTee />} />
          <Route path="/leavers-hoodies" element={<LeaversHoodies />} />
          <Route path="/school-trips" element={<SchoolTrips />} />
          <Route path="/leavers-hoodies/start" element={<LeaversStart />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/full-squad-configurator" element={<FullSquadConfigurator />} />
          <Route path="/sports-outfit-configurator" element={<SportsOutfitConfigurator />} />
          <Route path="/admin/portfolio" element={<RequireAdmin><AdminLayout><AdminPortfolio /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/bundle-variants" element={<RequireAdmin><AdminLayout><AdminBundleVariants /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/collection-seo" element={<RequireAdmin><AdminLayout><AdminCollectionSeo /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/products-import" element={<RequireAdmin><AdminLayout><AdminProductsImport /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/reclassify" element={<RequireAdmin><AdminLayout><AdminReclassify /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/image-health" element={<RequireAdmin><AdminLayout><AdminImageHealth /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/page-copy" element={<RequireAdmin><AdminLayout><AdminPageCopy /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/configurator-settings" element={<RequireAdmin><AdminLayout><AdminConfiguratorSettings /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/navigation" element={<RequireAdmin><AdminLayout><AdminNavigation /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/integrations" element={<RequireAdmin><AdminLayout><AdminIntegrations /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/orders" element={<RequireAdmin><AdminLayout><AdminOrders /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/enquiries" element={<RequireAdmin><AdminLayout><AdminEnquiries /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/leavers-templates" element={<RequireAdmin><AdminLayout><AdminLeaversTemplates /></AdminLayout></RequireAdmin>} />
          <Route path="/design" element={<DesignYourOwn />} />
          <Route path="/design-your-own" element={<DesignYourOwn />} />
          <Route path="/account" element={<Account />} />
          <Route path="/account/addresses" element={<Account />} />
          <Route path="/account/designs" element={<Account />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/import-reviews" element={<RequireAdmin><AdminLayout><AdminImport /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/reviews" element={<RequireAdmin><AdminLayout><AdminReviews /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/team-kits" element={<RequireAdmin><AdminLayout><AdminTeamKits /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/designer-products" element={<RequireAdmin><AdminLayout><AdminDesignerProducts /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/product-settings" element={<RequireAdmin><AdminLayout><AdminProductSettings /></AdminLayout></RequireAdmin>} />
          <Route path="/admin" element={<RequireAdmin><AdminLayout><AdminDashboard /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/qa" element={<RequireAdmin><AdminLayout><AdminQA /></AdminLayout></RequireAdmin>} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          {/* Catch-all — must stay last. Without it, unknown URLs rendered a blank page. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        {/* Site-wide WhatsApp FAB. Pages that already render their own FAB will overlap harmlessly,
            but to avoid duplicates each page-level FAB is identical position/size — only rendered once
            visually because pages don't include their own anymore. */}
        <SiteFAB />
        <CartDrawer />
        </CartProvider>
        </CustomerAuthProvider>
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
