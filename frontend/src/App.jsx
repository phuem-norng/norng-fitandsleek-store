import React from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import SiteLayout from "./components/layout/SiteLayout.jsx";
import Home from "./pages/Home.jsx";
import Search from "./pages/Search.jsx";
import ImageSearch from "./pages/ImageSearch.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Discounts from "./pages/Discounts.jsx";
import DiscountCategory from "./pages/DiscountCategory.jsx";
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import OAuthCallback from "./pages/auth/OAuthCallback.jsx";
import CartPage from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import PaymentProcess from "./pages/PaymentProcess.jsx";
import Orders from "./pages/Orders.jsx";
import ContactPage from "./pages/Contact.jsx";
import SupportPage from "./pages/Support.jsx";
import PrivacyPage from "./pages/Privacy.jsx";
import FAQPage from "./pages/FAQ.jsx";
import TermsPage from "./pages/Terms.jsx";
import CookiesPage from "./pages/Cookies.jsx";
import NotificationsPage from "./pages/Notifications.jsx";
import BrandDetail from "./pages/BrandDetail.jsx";
import CategoryPage from "./pages/CategoryPage.jsx";
import CustomerProfile from "./pages/CustomerProfile.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import {
  AdminHome,
  Reports,
  AdminProducts,
  AdminCategories,
  AdminBrands,
  AdminSuppliers,
  AdminStockInventoryList,
  AdminInventoryLotsCatalog,
  AdminBarcodeQR,
  AdminPosScan,
  AdminOrders,
  AdminInvoicePage,
  AdminCustomers,
  AdminAdministrators,
  HomePageManager,
  CompleteHomepageManager,
  Contacts,
  Messages,
  ChatbotSettings,
  Notifications,
  Profile,
  Settings,
  AdminDiscounts,
  UserManagement,
  AdminManagement,
  AdminPayments,
  SaleHistory,
  AdminReplacementCases,
  AdminShipments,
  AdminPurchaseOrders,
  AdminStockReceived,
  PaymentSettings,
  LoyaltyTopFans,
  UserProfileDetail,
} from "./pages/admin/adminLazy.js";
import { CatalogAvailabilityProvider } from "./state/catalogAvailability.jsx";
import { HomepageSettingsProvider, useHomepageSettings } from "./state/homepageSettings.jsx";
import { useLanguage } from "./lib/i18n.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import HomepageSettingsTest from "./pages/HomepageSettingsTest.jsx";
import PublicHomepageManager from "./pages/PublicHomepageManager.jsx";
import ExtendedHomepageManager from "./pages/ExtendedHomepageManager.jsx";
import DriverScanPage from "./pages/driver/Scan.jsx";
import { useAuth, TOKEN_KEY } from "./state/auth.jsx";
import { useTheme } from "./state/theme.jsx";
import { AdminContentSkeleton } from "./components/admin/AdminLoading.jsx";

/** Old URLs used `/admin/barcode-qr`; preserve redirects after rename to `/admin/stock-inventory`. */
function LegacyBarcodeQrToStockInventoryEdit() {
  const { id } = useParams();
  return <Navigate to={`/admin/stock-inventory/${id}/edit`} replace />;
}

function AdminUserProfileRedirect() {
  const { userId } = useParams();
  return <Navigate to={`/admin/users/${userId}`} replace />;
}

/** Legacy chat/API links used `/products/:slug`; storefront route is `/p/:slug`. */
function ProductSlugRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/p/${slug}`} replace />;
}

function CustomerPageSkeleton() {
  return (
    <div className="container-safe-inset py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-200/80 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-52 rounded-full bg-slate-200/80 animate-pulse" />
              <div className="h-4 w-72 max-w-full rounded-full bg-slate-200/70 animate-pulse" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="h-10 rounded-xl bg-slate-200/70 animate-pulse" />
              <div className="h-10 rounded-xl bg-slate-200/70 animate-pulse" />
              <div className="h-10 rounded-xl bg-slate-200/70 animate-pulse" />
              <div className="h-10 rounded-xl bg-slate-200/70 animate-pulse" />
            </div>
            <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="h-6 w-56 rounded-full bg-slate-200/80 animate-pulse" />
              <div className="h-28 rounded-2xl bg-slate-200/70 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="h-12 rounded-xl bg-slate-200/70 animate-pulse" />
                <div className="h-12 rounded-xl bg-slate-200/70 animate-pulse" />
                <div className="h-12 rounded-xl bg-slate-200/70 animate-pulse" />
                <div className="h-12 rounded-xl bg-slate-200/70 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackOrderRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("tab", "track");
  return <Navigate to={`/profile?${params.toString()}`} replace />;
}

function RequireAuth({ children }) {
  const { user, booted } = useAuth();
  if (!booted) return <CustomerPageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function isAdminUser(user) {
  if (!user) return false;
  // Check role field (admin|superadmin|customer)
  const role = user?.role;
  if (role && (String(role).toLowerCase() === "admin" || String(role).toLowerCase() === "superadmin")) return true;
  // Also check is_admin boolean field for backward compatibility
  const isAdmin = user?.is_admin;
  if (isAdmin === true || isAdmin === 1 || isAdmin === "1") return true;
  return false;
}

function RequireAdmin({ children }) {
  const { user, booted } = useAuth();
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem(TOKEN_KEY);

  if (!booted && !hasToken) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }
  if (!booted && hasToken) {
    return children;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  if (!isAdminUser(user)) return <Navigate to="/" replace />;
  return children;
}

/** Sets `data-admin-theme` on `<html>` only on `/admin` when dark mode is on. Tailwind `dark:` is scoped to `html.admin-dashboard[data-admin-theme="dark"]` so the storefront never inherits it. */
function AdminHtmlThemeSync() {
  const location = useLocation();
  const { mode, hydrated } = useTheme();

  React.useEffect(() => {
    const root = document.documentElement;
    if (!hydrated) return;
    const onAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
    if (onAdmin && mode === "dark") {
      root.setAttribute("data-admin-theme", "dark");
    } else {
      root.removeAttribute("data-admin-theme");
    }
  }, [location.pathname, mode, hydrated]);

  return null;
}

/** Sets `data-storefront-theme="dark"` on `<html>` when on storefront routes and user has dark mode on.
 *  Removed when navigating to admin so admin styles are never polluted. */
function StorefrontHtmlThemeSync() {
  const location = useLocation();
  const { storefrontMode } = useTheme();

  React.useEffect(() => {
    const root = document.documentElement;
    const onAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
    if (!onAdmin && storefrontMode === "dark") {
      root.setAttribute("data-storefront-theme", "dark");
    } else {
      root.removeAttribute("data-storefront-theme");
    }
  }, [location.pathname, storefrontMode]);

  return null;
}

/** Legacy /shop URLs → /search (bottom nav and bookmarks). */
function ShopToSearchRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/search${search}`} replace />;
}

export default function App() {
  return (
    <CatalogAvailabilityProvider>
      <HomepageSettingsProvider>
        <FontSettingsSync />
        <AdminHtmlThemeSync />
        <StorefrontHtmlThemeSync />
        <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/shop" element={<ShopToSearchRedirect />} />
          <Route path="/image-search" element={<ImageSearch />} />
          <Route path="/brands/:slug" element={<BrandDetail />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/discounts" element={<Discounts />} />
          <Route path="/discounts/:categorySlug" element={<DiscountCategory />} />
          <Route path="/p/:slug" element={<ProductDetail />} />
          <Route path="/products/:slug" element={<ProductSlugRedirect />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route
            path="/track-order"
            element={
              <RequireAuth>
                <TrackOrderRedirect />
              </RequireAuth>
            }
          />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/homepage-settings-test" element={<HomepageSettingsTest />} />
          <Route path="/homepage-manager" element={<PublicHomepageManager />} />
          <Route path="/homepage-manager-extended" element={<ExtendedHomepageManager />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/driver/scan" element={<DriverScanPage />} />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <CustomerProfile />
              </RequireAuth>
            }
          />
          <Route
            path="/checkout"
            element={
              <RequireAuth>
                <Checkout />
              </RequireAuth>
            }
          />
          <Route
            path="/payment/:orderId"
            element={
              <RequireAuth>
                <PaymentProcess />
              </RequireAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <Orders />
              </RequireAuth>
            }
          />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/oauth/callback/:ticket" element={<OAuthCallback />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="purchase-orders" element={<AdminPurchaseOrders />} />
          <Route path="reports" element={<Reports />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="inventory" element={<AdminProducts />} />
          <Route path="discounts" element={<AdminDiscounts />} />
          <Route path="sales" element={<AdminDiscounts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="suppliers" element={<AdminSuppliers />} />
          <Route path="stock-inventory/new" element={<AdminBarcodeQR />} />
          <Route path="stock-inventory/:id/edit" element={<AdminBarcodeQR />} />
          <Route path="stock-inventory" element={<AdminStockInventoryList />} />
          <Route path="inventory-lots" element={<AdminInventoryLotsCatalog />} />
          <Route path="stock-received/new" element={<Navigate to="/admin/purchase-orders" replace />} />
          <Route path="stock-received/:id/edit" element={<Navigate to="/admin/stock-received" replace />} />
          <Route path="stock-received" element={<AdminStockReceived />} />
          <Route path="barcode-qr/new" element={<Navigate to="/admin/stock-inventory/new" replace />} />
          <Route path="barcode-qr/:id/edit" element={<LegacyBarcodeQrToStockInventoryEdit />} />
          <Route path="barcode-qr" element={<Navigate to="/admin/stock-inventory" replace />} />
          <Route path="checkout" element={<AdminPosScan />} />
          <Route path="pos" element={<Navigate to="/admin/checkout" replace />} />
          <Route path="homepage" element={<HomePageManager />} />
          <Route path="homepage-complete" element={<CompleteHomepageManager />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:orderId/invoice" element={<AdminInvoicePage />} />
          <Route path="users/:userId" element={<UserProfileDetail />} />
          <Route path="customers/:userId" element={<AdminUserProfileRedirect />} />
          <Route path="administrators/:userId" element={<AdminUserProfileRedirect />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="administrators" element={<AdminAdministrators />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="messages" element={<Messages />} />
          <Route path="chatbot" element={<ChatbotSettings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="user-management" element={<UserManagement />} />
          <Route path="admin-management" element={<AdminManagement />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="payments/sale-history" element={<SaleHistory />} />
          <Route path="replacement-cases" element={<AdminReplacementCases />} />
          <Route path="shipments" element={<AdminShipments />} />
          <Route path="payment-settings" element={<PaymentSettings />} />
          <Route path="loyalty-top-fans" element={<LoyaltyTopFans />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HomepageSettingsProvider>
    </CatalogAvailabilityProvider>
  );
}

function FontSettingsSync() {
  const { settings } = useHomepageSettings();
  const { language } = useLanguage();

  React.useEffect(() => {
    const root = document.documentElement;
    const fontEn = settings?.fonts?.english || "Inter";
    const fontKm = settings?.fonts?.khmer || "Kantumruy Pro";

    const baseFallback = "\"Kantumruy Pro\", \"Noto Sans Khmer\", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"";
    const kmFallback = "\"Kantumruy Pro\", \"Noto Sans Khmer\", \"Battambang\", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"";

    const normalizeStack = (font, fallback) => {
      if (!font || String(font).toLowerCase() === "system") {
        return fallback;
      }
      if (String(font).includes(",")) {
        return font;
      }
      return `"${font}", ${fallback}`;
    };

    const enStack = normalizeStack(fontEn, baseFallback);
    const kmStack = normalizeStack(fontKm, kmFallback);

    root.style.setProperty("--fs-font-en", enStack);
    root.style.setProperty("--fs-font-km", kmStack);
    root.style.setProperty("--fs-font-base", language === "km" ? kmStack : enStack);
    root.setAttribute("data-lang", language || "en");
  }, [settings, language]);

  return null;
}



