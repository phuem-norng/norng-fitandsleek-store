import React, { lazy, Suspense } from "react";
import { AdminContentSkeleton } from "../components/admin/AdminLoading.jsx";

function PageFallback({ admin = false }) {
  if (admin) {
    return (
      <div className="flex min-h-[40dvh] w-full flex-col p-6">
        <AdminContentSkeleton lines={2} imageHeight={120} className="mx-auto w-full max-w-5xl flex-1" />
      </div>
    );
  }
  return (
    <div className="container-safe py-10">
      <div className="h-8 w-48 rounded-full bg-slate-200/80 animate-pulse" />
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl bg-slate-200/70 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function LazyBoundary({ admin = false, children }) {
  return <Suspense fallback={<PageFallback admin={admin} />}>{children}</Suspense>;
}

// Storefront (heavy)
export const LazyImageSearch = lazy(() => import("../pages/ImageSearch.jsx"));
export const LazyProductDetail = lazy(() => import("../pages/ProductDetail.jsx"));
export const LazyCheckout = lazy(() => import("../pages/Checkout.jsx"));
export const LazyCustomerProfile = lazy(() => import("../pages/CustomerProfile.jsx"));

// Admin shell + pages
export const LazyAdminLayout = lazy(() => import("../pages/admin/AdminLayout.jsx"));
export const LazyAdminProducts = lazy(() => import("../pages/admin/Products.jsx"));
export const LazyAdminCategories = lazy(() => import("../pages/admin/Categories.jsx"));
export const LazyAdminBrands = lazy(() => import("../pages/admin/Brands.jsx"));
export const LazyAdminBarcodeQR = lazy(() => import("../pages/admin/StockInventory.jsx"));
export const LazyInventoryIntegrity = lazy(() => import("../pages/admin/InventoryIntegrity.jsx"));
export const LazyAdminPosScan = lazy(() => import("../pages/admin/Checkout.jsx"));
export const LazyAdminOrders = lazy(() => import("../pages/admin/Orders.jsx"));
export const LazyAdminInvoicePage = lazy(() => import("../pages/admin/Invoice.jsx"));
export const LazyAdminCustomers = lazy(() => import("../pages/admin/Customers.jsx"));
export const LazyAdminAdministrators = lazy(() => import("../pages/admin/Administrators.jsx"));
export const LazyAdminHome = lazy(() => import("../pages/admin/AdminHome.jsx"));
export const LazyHomePageManager = lazy(() => import("../pages/admin/HomePageManager.jsx"));
export const LazyCompleteHomepageManager = lazy(() => import("../pages/admin/CompleteHomepageManager.jsx"));
export const LazyReports = lazy(() => import("../pages/admin/Reports.jsx"));
export const LazySettings = lazy(() => import("../pages/admin/Settings.jsx"));
export const LazyContacts = lazy(() => import("../pages/admin/Contacts.jsx"));
export const LazyMessages = lazy(() => import("../pages/admin/Messages.jsx"));
export const LazyChatbotSettings = lazy(() => import("../pages/admin/ChatbotSettings.jsx"));
export const LazyNotifications = lazy(() => import("../pages/admin/Notifications.jsx"));
export const LazyProfile = lazy(() => import("../pages/admin/Profile.jsx"));
export const LazyAdminDiscounts = lazy(() => import("../pages/admin/Discounts.jsx"));
export const LazyUserManagement = lazy(() => import("../pages/admin/UserManagement.jsx"));
export const LazyAdminManagement = lazy(() => import("../pages/admin/AdminManagement.jsx"));
export const LazyAdminPayments = lazy(() => import("../pages/admin/Payments.jsx"));
export const LazySaleHistory = lazy(() => import("../pages/admin/SaleHistory.jsx"));
export const LazyAdminReplacementCases = lazy(() => import("../pages/admin/ReplacementCases.jsx"));
export const LazyPaymentSettings = lazy(() => import("../pages/admin/PaymentSettings.jsx"));
