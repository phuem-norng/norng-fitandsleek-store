import React, { useMemo, useState, useRef, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../state/auth.jsx";
import { useCart } from "../../state/cart.jsx";
import { useWishlist } from "../../state/wishlist.jsx";
import { useLanguage } from "../../lib/i18n.jsx";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";
import api from "../../lib/api.js";
import { resolveImageUrl } from "../../lib/images.js";
import { Camera, X, Bell, Menu, Search, User, Heart, ShoppingBag, Moon, Sun } from "lucide-react";
import { useTheme } from "../../state/theme.jsx";
import Logo from "../Logo.jsx";
import LoginDialog from "../dialogs/LoginDialog.jsx";
import RegisterDialog from "../dialogs/RegisterDialog.jsx";
import SmartSearchModal from "../search/SmartSearchModal.jsx";
import MegaMenuEmptyState from "./MegaMenuEmptyState.jsx";
import MegaMenuScrollArea from "./MegaMenuScrollArea.jsx";
import { storefrontSearchUrl as navSearch } from "../../lib/storefrontNavLinks.js";
import { mergeTopNavDropdowns } from "../../lib/defaultTopNavDropdowns.js";
import { resolveHeaderChromeStyle } from "../../lib/storefrontChrome.js";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

/** Match nav item only when path + query params align (avoids every /search?… link active at once). */
function isNavItemActive(location, to) {
  const toStr = String(to || "");
  const qIndex = toStr.indexOf("?");
  const toPath = qIndex >= 0 ? toStr.slice(0, qIndex) : toStr;
  const toSearch = qIndex >= 0 ? toStr.slice(qIndex + 1) : "";
  const { pathname, search } = location;

  if (!toSearch) {
    if (toPath === "/discounts") {
      return pathname === "/discounts" || pathname.startsWith("/discounts/");
    }
    return pathname === toPath && !search;
  }

  if (pathname !== toPath) return false;

  const toParams = new URLSearchParams(toSearch);
  const locParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [key, value] of toParams.entries()) {
    if (locParams.get(key) !== value) return false;
  }
  return true;
}

function getInitials(label) {
  const text = String(label || "").trim();
  if (!text) return "";
  return text.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Badge({ value, accent = false }) {
  if (!value) return null;
  return (
    <span
      key={value}
      className={cn("fs-header-badge", accent && "fs-header-badge-accent")}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

function Icon({ name }) {
  const cls = "w-[18px] h-[18px]";
  if (name === "search") return <Search className={cls} strokeWidth={2} />;
  if (name === "user") return <User className={cls} strokeWidth={2} />;
  if (name === "heart") return <Heart className={cls} strokeWidth={2} />;
  if (name === "bag") return <ShoppingBag className={cls} strokeWidth={2} />;
  return null;
}

function ProfileMenu({ user, onLogout, t, className = "" }) {
  const [open, setOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const ref = useRef(null);
  const avatarSrc = user?.profile_image_url || user?.profile_image_path
    ? resolveImageUrl(user.profile_image_url || user.profile_image_path)
    : null;
  const initials = getInitials(user?.name || user?.email || "");

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarSrc]);

  if (!user) return null;

  return (
    <div className={cn("relative shrink-0 overflow-visible", className)} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fs-avatar-ring"
        aria-label={t("account")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="fs-avatar-ring__frame">
          <span className="fs-avatar-ring__inner">
            {avatarSrc && !avatarBroken ? (
              <img
                src={avatarSrc}
                alt={user?.name || "Profile"}
                className="w-full h-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <span>{initials || "U"}</span>
            )}
          </span>
          <span className="fs-avatar-ring__status" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
          <div className="px-4 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-900/10 text-zinc-900 flex items-center justify-center overflow-hidden">
              {avatarSrc && !avatarBroken ? (
                <img
                  src={avatarSrc}
                  alt={user?.name || "Profile"}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <span className="text-sm font-bold">{initials || "U"}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 truncate">{user?.name || t("account")}</p>
              <p className="text-sm text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="py-2">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm">{t("account")}</span>
            </Link>
            <Link
              to="/profile?tab=orders"
              onClick={() => setOpen(false)}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-sm">{t("orders")}</span>
            </Link>
          </div>
          <div className="py-2 border-t border-slate-100">
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm font-medium">{t("logout")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function NavDropdownPanel({ items }) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) return null;

  const hasSections = safeItems.some((item) => item?.type === "section");

  return (
    <div className="bg-white shadow-xl border-t border-zinc-100">
      {hasSections ? (
        <div className="container-safe mx-auto py-6 px-8">
          <div className="grid grid-cols-4 gap-10">
            {safeItems.filter((item) => item?.type === "section").map((section, idx) => (
              <div key={idx} className={section.className || ""}>
                {section.to ? (
                  <Link to={section.to} className="block group mb-3">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-1 group-hover:text-emerald-600 transition-colors">
                      {section.label}
                    </h4>
                    {section.description && (
                      <p className="text-xs text-zinc-500 leading-relaxed">{section.description}</p>
                    )}
                  </Link>
                ) : (
                  <div className="block mb-3">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-1">
                      {section.label}
                    </h4>
                    {section.description && (
                      <p className="text-xs text-zinc-500 leading-relaxed">{section.description}</p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  {section.items?.map((item, itemIdx) => (
                    <Link key={itemIdx} to={item.to} className="fs-menu-item">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="container-safe mx-auto py-6 px-8">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {safeItems.map((item, idx) => (
              <Link
                key={idx}
                to={item.to}
                className={cn(
                  "px-6 py-3 text-sm font-medium transition-all duration-200 rounded-lg",
                  item.highlight
                    ? "text-zinc-900 font-semibold bg-zinc-100 hover:bg-zinc-200"
                    : "text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Animated Nav Link — one underline at a time (hover wins, else single active route)
function AnimatedNavLink({ to, label, hasDropdown, onHover, index, hoveredIndex, isDropdownOpen }) {
  const location = useLocation();
  const isActive = isNavItemActive(location, to);
  const showUnderline =
    hoveredIndex === index ||
    (hoveredIndex === null && (isActive || isDropdownOpen));

  return (
    <NavLink
      to={to}
      className={cn("fs-nav-link", showUnderline && "fs-nav-link-active")}
      onMouseEnter={onHover}
    >
      <span className="relative z-10">{label}</span>
      <span className={cn("fs-nav-underline", showUnderline && "is-on")} />
    </NavLink>
  );
}

function NavBar({ navItems }) {
  const { t } = useLanguage();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showMore, setShowMore] = useState(false);

  const visibleItemsCount = navItems.length > 8 ? 5 : navItems.length > 6 ? 5 : Math.min(6, navItems.length);
  const visibleItems = navItems.slice(0, visibleItemsCount);
  const moreItems = navItems.slice(visibleItemsCount);
  const hasMore = moreItems.length > 0;
  const hoveredItem = hoveredIndex != null ? visibleItems[hoveredIndex] : null;
  const panelOpen = Boolean(hoveredItem?.items?.length);

  return (
    <div
      className="relative"
      onMouseLeave={() => {
        setHoveredIndex(null);
        setShowMore(false);
      }}
    >
      <nav className="fs-header-bar flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:gap-x-5 lg:gap-x-6 xl:gap-x-8 relative z-10 py-2">
        {visibleItems.map((item, index) => {
          const itemKey = item.to || item.label || `nav-${index}`;
          const hasDropdown = Boolean(item.items?.length);
          return (
            <div
              key={itemKey}
              className="relative"
              onMouseEnter={() => {
                if (hasDropdown) setHoveredIndex(index);
              }}
            >
              <AnimatedNavLink
                to={item.to}
                label={item.label}
                hasDropdown={hasDropdown}
                index={index}
                hoveredIndex={hoveredIndex}
                isDropdownOpen={hoveredIndex === index}
                onHover={() => setHoveredIndex(hasDropdown ? index : null)}
              />
            </div>
          );
        })}

        {hasMore && (
          <div className="relative">
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              onMouseEnter={() => setShowMore(true)}
              onMouseLeave={() => setShowMore(false)}
            >
              {t("more") || "More"}
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-lg border border-zinc-200 overflow-hidden z-50">
                {moreItems.map((item, idx) => (
                  <Link
                    key={idx}
                    to={item.to}
                    className="block px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                    onClick={() => setShowMore(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {panelOpen && (
        <div className="absolute left-0 right-0 top-full z-50 pt-1">
          <NavDropdownPanel items={hoveredItem.items} />
        </div>
      )}
    </div>
  );
}

export default function Header({ onOpenCart, onOpenNotifications, notificationsUnread = 0 }) {
  const nav = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { count } = useCart();
  const wishlist = useWishlist();
  const { t, language, toggleLanguage } = useLanguage();
  const { settings } = useHomepageSettings();
  const { storefrontMode, toggleStorefrontMode } = useTheme();
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showLeftMenu, setShowLeftMenu] = useState(false);
  const [activeLeftSection, setActiveLeftSection] = useState(0);
  const [autoLeftMenu, setAutoLeftMenu] = useState({
    newProduct: [],
    trending: [],
    discounts: [],
    brands: [],
  });

  useEffect(() => {
    const openLogin = () => {
      if (user) return;
      setShowRegisterDialog(false);
      setShowLoginDialog(true);
    };
    const openRegister = () => {
      if (user) return;
      setShowLoginDialog(false);
      setShowRegisterDialog(true);
    };
    window.addEventListener("fs:open-login", openLogin);
    window.addEventListener("fs:open-register", openRegister);
    return () => {
      window.removeEventListener("fs:open-login", openLogin);
      window.removeEventListener("fs:open-register", openRegister);
    };
  }, [user]);


  // Get header settings with fallback defaults
  const footerSettings = settings?.footer || {};
  const headerSettings = settings?.header || {
    logo_text: "FIT&SLEEK",
    logo_url: "/logo.png",
    background_color: "#6e8b7e",
    background_image: "",
    text_color: "#ffffff",
    search_placeholder: "Search everything",
    search_enabled: false,
    cart_enabled: true,
    wishlist_enabled: true,
    language_enabled: true,
    free_delivery_icon: "🚚",
    free_delivery_text: "Free delivery on orders above $40",
    nav_visibility: {
      newIn: true,
      discounts: true,
      women: true,
      men: true,
      sale: true,
    },
    custom_nav: [],
    left_menu: [],
    nav_labels: {},
  };

  const chromeStyle = useMemo(
    () => resolveHeaderChromeStyle(headerSettings, footerSettings),
    [headerSettings, footerSettings],
  );

  const headerLabels = headerSettings.nav_labels || {};
  const localizedNavLabels = (headerLabels && (headerLabels.en || headerLabels.km))
    ? (headerLabels[language] || headerLabels.en || {})
    : (language === "km" ? {} : headerLabels);
  const label = (key, fallback) => localizedNavLabels[key] || fallback;
  const searchPlaceholder = language === "km"
    ? t('searchProducts')
    : (headerSettings.search_placeholder || "Search everything");
  const navVisibility = headerSettings.nav_visibility || {};
  const isVisible = (key) => navVisibility[key] !== false;
  const customNavItems = Array.isArray(headerSettings.custom_nav) ? headerSettings.custom_nav : [];
  const defaultLeftMenu = [
    {
      title: t('newProduct'),
      items: [
        { label: t('newArrivals'), to: '/search?tab=new', image: '/placeholder.svg' },
        { label: t('trendingNow'), to: '/search?tab=trending', image: '/placeholder.svg' },
        { label: t('thisWeek'), to: '/search?tab=this-week', image: '/placeholder.svg' },
        { label: t('bestSellers'), to: '/search?q=Best%20Seller', image: '/placeholder.svg' },
        { label: t('editorPicks'), to: '/search?q=Editors%20Pick', image: '/placeholder.svg' },
        { label: t('limitedDrop'), to: '/search?q=Limited%20Drop', image: '/placeholder.svg' },
        { label: t('freshStyles'), to: '/search?q=Fresh%20Style', image: '/placeholder.svg' },
        { label: t('justAdded'), to: '/search?q=Just%20Added', image: '/placeholder.svg' },
      ],
    },
    {
      title: t('productTrending'),
      items: [
        { label: t('trendingNow'), to: '/search?tab=trending', image: '/placeholder.svg' },
        { label: t('topRated'), to: '/search?sort=rating', image: '/placeholder.svg' },
        { label: t('bestSellers'), to: '/search?sort=popular', image: '/placeholder.svg' },
        { label: t('mostViewed'), to: '/search?q=Most%20Viewed', image: '/placeholder.svg' },
        { label: t('popularNow'), to: '/search?q=Popular%20Now', image: '/placeholder.svg' },
        { label: t('streetStyle'), to: '/search?q=Street%20Style', image: '/placeholder.svg' },
        { label: t('viralPicks'), to: '/search?q=Viral', image: '/placeholder.svg' },
        { label: t('trendingThisWeek'), to: '/search?q=Trending%20This%20Week', image: '/placeholder.svg' },
      ],
    },
    {
      title: t('productDiscounts'),
      items: [
        { label: t('allDiscounts'), to: '/discounts', image: '/placeholder.svg' },
        { label: t('clothes'), to: '/discounts/clothes', image: '/placeholder.svg' },
        { label: t('shoes'), to: '/discounts/shoes', image: '/placeholder.svg' },
        { label: t('under20'), to: '/discounts?max_price=20', image: '/placeholder.svg' },
        { label: t('topDeals'), to: '/discounts?sort=discount', image: '/placeholder.svg' },
        { label: t('accessories'), to: '/discounts?q=Accessories', image: '/placeholder.svg' },
        { label: t('bags'), to: '/discounts?q=Bags', image: '/placeholder.svg' },
        { label: t('flashSale'), to: '/discounts?q=Flash', image: '/placeholder.svg' },
      ],
    },
    {
      title: t('brandsCategories'),
      items: [
        { label: 'Nike', to: '/search?q=Nike', image: '/placeholder.svg' },
        { label: 'Adidas', to: '/search?q=Adidas', image: '/placeholder.svg' },
        { label: 'Puma', to: '/search?q=Puma', image: '/placeholder.svg' },
        { label: 'Zara', to: '/search?q=Zara', image: '/placeholder.svg' },
      ],
    },
  ];
  const leftMenuSource =
    Array.isArray(headerSettings.left_menu) && headerSettings.left_menu.length > 0
      ? headerSettings.left_menu
      : defaultLeftMenu;
  const leftMenu = (leftMenuSource || []).filter(
    (s) => String(s?.title || "").toLowerCase() !== "menu visibility",
  );

  useEffect(() => {
    let mounted = true;
    const loadAutoMenu = async () => {
      try {
        const [productsRes, discountsRes, brandsRes] = await Promise.all([
          api.get("/products"),
          api.get("/products/discounts"),
          api.get("/brands"),
        ]);

        const products = productsRes?.data?.data || [];
        const discounts = discountsRes?.data?.data || [];
        const brands = brandsRes?.data?.data || [];

        const newProductItems = products.slice(0, 6).map((p) => ({
          label: p.name,
          to: p.slug ? `/p/${p.slug}` : "/search",
          image: resolveImageUrl(p.image_url),
        }));

        const trendingItems = products.slice(6, 12).map((p) => ({
          label: p.name,
          to: p.slug ? `/p/${p.slug}` : "/search",
          image: resolveImageUrl(p.image_url),
        }));

        const discountItems = discounts.slice(0, 6).map((p) => ({
          label: p.name,
          to: p.slug ? `/p/${p.slug}` : "/search",
          image: resolveImageUrl(p.image_url),
        }));

        const brandItems = brands.map((b) => ({
          label: b.name,
          to: b.slug ? `/brands/${b.slug}` : `/search?q=${encodeURIComponent(b.name)}`,
          image: b.logo_url || null,
        }));

        if (mounted) {
          setAutoLeftMenu({
            newProduct: newProductItems,
            trending: trendingItems.length ? trendingItems : newProductItems,
            discounts: discountItems,
            brands: brandItems,
          });
        }
      } catch {
        if (mounted) {
          setAutoLeftMenu({
            newProduct: [],
            trending: [],
            discounts: [],
            brands: [],
          });
        }
      }
    };

    loadAutoMenu();
    return () => {
      mounted = false;
    };
  }, []);

  const mergeUniqueItems = (baseItems = [], extraItems = []) => {
    const seen = new Set();
    const toKey = (item) => `${item.label || ""}::${item.to || ""}`;
    const merged = [];
    [...baseItems, ...extraItems].forEach((item) => {
      const key = toKey(item || {});
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });
    return merged;
  };

  const isBrandsSectionTitle = (title) => {
    const key = String(title || "").toLowerCase();
    return key === "brands" || key === "brands & categories" || key === "brands and categories";
  };

  const leftMenuWithAuto = useMemo(() => {
    const normalized = (leftMenu || []).map((section) => {
      const title = String(section?.title || "").toLowerCase();
      if (title === "new product") {
        return { ...section, items: autoLeftMenu.newProduct };
      }
      if (title === "product trending") {
        return { ...section, items: autoLeftMenu.trending };
      }
      if (title === "product discounts") {
        return { ...section, items: autoLeftMenu.discounts };
      }
      if (isBrandsSectionTitle(title)) {
        return { ...section, title: t("brandsCategories"), items: autoLeftMenu.brands };
      }
      return section;
    });

    const findByTitle = (title) =>
      normalized.find((s) => String(s?.title || "").toLowerCase() === title);

    const findBrandsSection = () => normalized.find((s) => isBrandsSectionTitle(s?.title));

    const ensureSection = (title, fallbackItems, autoItems) => {
      const existing = findByTitle(title);
      if (existing) {
        return {
          ...existing,
          items: autoItems || fallbackItems,
        };
      }
      return {
        title: title.replace(/\b\w/g, (c) => c.toUpperCase()),
        items: autoItems || fallbackItems,
      };
    };

    const ensureBrandsSection = (fallbackItems, autoItems) => {
      const existing = findBrandsSection();
      if (existing) {
        return {
          ...existing,
          title: t("brandsCategories"),
          items: autoItems || fallbackItems,
        };
      }
      return {
        title: t("brandsCategories"),
        items: autoItems || fallbackItems,
      };
    };

    const defaultByTitle = (title) =>
      (defaultLeftMenu || []).find((s) => String(s?.title || "").toLowerCase() === title)?.items || [];

    const defaultBrandsItems =
      (defaultLeftMenu || []).find((s) => isBrandsSectionTitle(s?.title))?.items || [];

    const ensured = [
      ensureSection("new product", defaultByTitle("new product"), autoLeftMenu.newProduct),
      ensureSection("product trending", defaultByTitle("product trending"), autoLeftMenu.trending),
      ensureSection("product discounts", defaultByTitle("product discounts"), autoLeftMenu.discounts),
      ensureBrandsSection(defaultBrandsItems, autoLeftMenu.brands),
    ];

    const ensuredTitles = new Set(ensured.map((s) => String(s?.title || "").toLowerCase()));
    const remaining = normalized.filter(
      (s) =>
        !ensuredTitles.has(String(s?.title || "").toLowerCase()) &&
        !isBrandsSectionTitle(s?.title)
    );

    return [...remaining, ...ensured];
  }, [leftMenu, autoLeftMenu, t]);

  const getLeftMenuTitle = (title) => {
    const key = String(title || '').toLowerCase();
    const map = {
      'new product': 'newProduct',
      'product trending': 'productTrending',
      'product discounts': 'productDiscounts',
      'brands': 'brandsCategories',
      'brands & categories': 'brandsCategories',
      'brands and categories': 'brandsCategories',
    };
    const tKey = map[key];
    return tKey ? t(tKey) : title;
  };

  const closeMegaMenu = () => setShowLeftMenu(false);

  useEffect(() => {
    setShowLeftMenu(false);
  }, [location.pathname, location.search]);

  const isBrandsSection = (section) => isBrandsSectionTitle(section?.title);

  const renderMegaMenuItems = (activeItems, { compact = false } = {}) => {
    const emptyLabel = t("megaMenuNothingYet") || "មិនទាន់មាន";
    if (activeItems.length === 0) {
      return <MegaMenuEmptyState message={emptyLabel} />;
    }

    if (compact) {
      return (
        <MegaMenuScrollArea className="max-h-[min(360px,60vh)]">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {activeItems.map((item, i) => (
              <Link
                key={`${item.to}-${item.label}-${i}`}
                to={item.to || "/search"}
                onClick={closeMegaMenu}
                className="group flex flex-col items-center gap-1 rounded-lg border border-transparent p-1.5 text-center hover:border-zinc-200 hover:bg-zinc-50/80"
              >
                <div className="flex h-12 w-full items-center justify-center rounded-md bg-zinc-50 ring-1 ring-zinc-100">
                  {item.image ? (
                    <img
                      src={resolveImageUrl(item.image)}
                      alt=""
                      className="max-h-8 max-w-[4.25rem] object-contain transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                  ) : (
                    <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
                      {getInitials(item.label)}
                    </span>
                  )}
                </div>
                <span className="line-clamp-1 w-full text-[11px] font-medium leading-tight text-zinc-700 group-hover:text-zinc-900">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </MegaMenuScrollArea>
      );
    }

    return (
      <MegaMenuScrollArea className="max-h-[min(360px,60vh)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {activeItems.map((item, i) => {
            const isBrandLink = String(item.to || "").startsWith("/brands/");
            return (
              <Link
                key={`${item.to}-${item.label}-${i}`}
                to={item.to || "/search"}
                onClick={closeMegaMenu}
                className="group flex flex-col gap-2 rounded-xl border border-transparent p-2 text-left hover:border-zinc-200 hover:bg-zinc-50/70"
              >
                <div
                  className="relative w-full overflow-hidden rounded-lg bg-zinc-100"
                  style={{ aspectRatio: "4 / 5" }}
                >
                  {item.image ? (
                    <img
                      src={resolveImageUrl(item.image)}
                      alt={item.label}
                      className={cn(
                        "h-full w-full transition-transform duration-300 group-hover:scale-105",
                        isBrandLink ? "object-contain p-4" : "object-cover"
                      )}
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center px-2 text-center text-sm font-bold text-zinc-500">
                      {getInitials(item.label)}
                    </span>
                  )}
                </div>
                <span className="line-clamp-2 text-sm font-semibold text-zinc-800 group-hover:text-zinc-900 group-hover:underline">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </MegaMenuScrollArea>
    );
  };

  const navDropdowns = useMemo(
    () => mergeTopNavDropdowns(headerSettings.nav_dropdowns),
    [headerSettings.nav_dropdowns]
  );

  const navItems = useMemo(
    () => [
      {
        key: 'newIn',
        label: label('newIn', 'NEW IN'),
        to: navSearch({ tab: 'new' }),
        items: navDropdowns.newIn,
      },
      {
        key: 'discounts',
        label: label('discounts', t('discounts')).replace(/^🎉\s*/, ''),
        to: "/discounts",
        items: navDropdowns.discounts,
      },
      {
        key: 'women',
        label: label('women', 'WOMEN'),
        to: "/search?parent_category=Women",
        items: navDropdowns.women,
      },
      {
        key: 'men',
        label: label('men', 'MEN'),
        to: "/search?parent_category=Men",
        items: navDropdowns.men,
      },
      {
        key: 'sale',
        label: label('sale', t('sale')),
        to: navSearch({ tab: 'sale' }),
        items: navDropdowns.sale,
      },
    ]
      .filter((item) => (item.key ? isVisible(item.key) : true))
      .concat(
        customNavItems
          .filter((item) => item && item.label && item.to)
          .map((item) => ({ label: item.label, to: item.to, items: item.items || [] }))
      ),
    [t, label, navDropdowns, headerSettings.nav_labels, headerSettings.nav_visibility, headerSettings.custom_nav]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (headerSettings.search_enabled) setShowSearchDialog(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [headerSettings.search_enabled]);

  return (
    <div className="fs-site-chrome sticky top-0 z-30 backdrop-blur-md shadow-sm" style={chromeStyle}>
      {/* Mobile: logo + search + theme only (desktop bar hidden below lg) */}
      <div className="fs-header-bar fs-header-bar--mobile lg:hidden">
        <Link to="/" className="shrink-0">
          <Logo
            className="fs-header-bar__logo-mobile"
            src={headerSettings.logo_url || "/logo.png"}
          />
        </Link>

        {headerSettings.search_enabled && (
          <button
            type="button"
            onClick={() => setShowSearchDialog(true)}
            className="flex-1 min-w-0"
          >
            <div className="relative">
              <div className="w-full h-9 sm:h-10 rounded-full border border-white/60 bg-white/95 pl-9 sm:pl-10 pr-9 sm:pr-10 text-xs text-zinc-800 shadow-sm flex items-center">
                <span className="truncate text-zinc-500">{searchPlaceholder}</span>
              </div>
              <span className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-zinc-600">
                <Icon name="search" />
              </span>
              <span className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-zinc-600">
                <Camera className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        )}

        {/* Mobile dark mode toggle */}
        <button
          type="button"
          onClick={toggleStorefrontMode}
          className="shrink-0 fs-iconbtn-header group"
          aria-label={storefrontMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={storefrontMode === "dark" ? "Light mode" : "Dark mode"}
        >
          {storefrontMode === "dark"
            ? <Sun className="w-[18px] h-[18px]" strokeWidth={2} />
            : <Moon className="w-[18px] h-[18px]" strokeWidth={2} />
          }
        </button>
      </div>

      {/* Desktop header + nav + mega menu share one hover zone */}
      <div
        className="hidden lg:block relative"
        onMouseLeave={() => setShowLeftMenu(false)}
      >
        <div className="fs-header-bar fs-header-bar--desktop min-h-[5rem] py-1.5 lg:grid">
          <div className="flex min-w-0 items-center justify-start gap-1 lg:gap-1.5">
            {headerSettings.search_enabled && (
              <>
                <button
                  type="button"
                  className="fs-btn fs-btn-sm bg-transparent hover:bg-transparent hidden lg:flex shrink-0 border-0"
                  onMouseEnter={() => setShowLeftMenu(true)}
                >
                  <Menu className="w-4 h-4" />
                  <span className="hidden xl:inline">{t('menu')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSearchDialog(true)}
                  className="fs-header-bar__search min-w-0 shrink"
                >
                  <div className="relative">
                    <div className="fs-header-search w-full h-9 rounded-full border pl-10 pr-10 text-xs outline-none flex items-center">
                      <span className="truncate font-medium">{searchPlaceholder}</span>
                    </div>
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Icon name="search" />
                    </span>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Camera className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              </>
            )}
          </div>

          <Link to="/" className="flex shrink-0 justify-self-center px-1">
            <Logo className="fs-header-bar__logo" src={headerSettings.logo_url || "/logo.png"} />
          </Link>

          <div className="fs-header-actions flex min-w-0 items-center justify-end gap-1 lg:gap-1.5 overflow-visible">
            {headerSettings.language_enabled && (
              <div className="relative group flex">
                <button
                  onClick={toggleLanguage}
                  className="fs-lang-pill"
                  title={t('language')}
                  aria-label={t('language')}
                >
                  <img
                    src={language === "km" ? "https://flagcdn.com/kh.svg" : "https://flagcdn.com/gb.svg"}
                    alt=""
                    className="fs-lang-pill__flag"
                    aria-hidden="true"
                  />
                  <span>{language === "km" ? "KM" : "EN"}</span>
                </button>
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none">
                  {language === "km" ? t('english') : t('khmer')}
                </div>
              </div>
            )}

            {/* Desktop dark mode toggle */}
            <button
              onClick={toggleStorefrontMode}
              className="fs-iconbtn-header group"
              aria-label={storefrontMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={storefrontMode === "dark" ? "Light mode" : "Dark mode"}
            >
              {storefrontMode === "dark"
                ? <Sun className="w-[18px] h-[18px]" strokeWidth={2} />
                : <Moon className="w-[18px] h-[18px]" strokeWidth={2} />
              }
            </button>

            <span className="fs-header-divider" aria-hidden="true" />

            <button
              onClick={onOpenNotifications}
              className="fs-iconbtn-header group"
              aria-label={t('notifications')}
            >
              <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
              <Badge value={notificationsUnread} accent />
            </button>

            {headerSettings.wishlist_enabled && (
              <Link
                className="fs-iconbtn-header group"
                to="/search?tab=wishlist"
                aria-label={t('wishlist')}
              >
                <Icon name="heart" />
                <Badge value={wishlist.count} accent />
              </Link>
            )}

            {headerSettings.cart_enabled && (
              <button
                className="fs-iconbtn-header group"
                onClick={onOpenCart}
                aria-label={t('cart')}
              >
                <Icon name="bag" />
                <Badge value={count} />
              </button>
            )}

            <span className="fs-header-divider" aria-hidden="true" />

            <ProfileMenu user={user} onLogout={logout} t={t} />

            {user ? null : (
              <div className="hidden xl:flex items-center gap-2 ml-1 shrink-0">
                <button
                  onClick={() => setShowLoginDialog(true)}
                  className="fs-btn fs-btn-secondary fs-btn-sm"
                >
                  {t('login')}
                </button>
                <button
                  onClick={() => setShowRegisterDialog(true)}
                  className="fs-btn fs-btn-primary fs-btn-sm"
                >
                  {t('register')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Navigation Row */}
        <div className="border-b fs-chrome-border relative">
          <NavBar navItems={navItems} />
        </div>

        {/* Desktop Left Mega Menu Panel — height fits content */}
        {showLeftMenu && (
          <div className="absolute left-0 right-0 top-full z-40 pt-px">
            <div className="bg-white shadow-xl border-t border-zinc-200/60">
              <div className="container-safe py-4">
                {leftMenuWithAuto.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5 items-start">
                    <div className="max-h-[min(440px,70vh)] overflow-y-auto pr-3 scrollbar-hide border-r border-zinc-100 space-y-1">
                      {leftMenuWithAuto.map((section, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseEnter={() => setActiveLeftSection(idx)}
                          className={cn(
                            "relative w-full text-left px-4 py-3 rounded-lg fs-nav-link-typo",
                            activeLeftSection === idx
                              ? "bg-zinc-50 text-zinc-900"
                              : "text-zinc-700 hover:bg-zinc-100/70 hover:text-zinc-900"
                          )}
                        >
                          {activeLeftSection === idx && (
                            <span className="absolute left-0 top-0 h-full w-1 bg-zinc-900 rounded-r" />
                          )}
                          <span className="block whitespace-normal leading-tight">
                            {getLeftMenuTitle(section.title)}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="min-w-0">
                      <div className="mb-3 fs-nav-link-typo text-zinc-500">
                        {getLeftMenuTitle(leftMenuWithAuto[activeLeftSection]?.title)}
                      </div>
                      {renderMegaMenuItems(leftMenuWithAuto[activeLeftSection]?.items || [], {
                        compact: isBrandsSection(leftMenuWithAuto[activeLeftSection]),
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      <SmartSearchModal
        open={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
        placeholder={searchPlaceholder}
        accentColor={headerSettings.background_color || "#10a37f"}
      />

      {/* Login Dialog */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onSwitchToRegister={() => {
          setShowLoginDialog(false);
          setShowRegisterDialog(true);
        }}
      />

      {/* Register Dialog */}
      <RegisterDialog
        isOpen={showRegisterDialog}
        onClose={() => setShowRegisterDialog(false)}
        onSwitchToLogin={() => {
          setShowRegisterDialog(false);
          setShowLoginDialog(true);
        }}
      />

    </div>
  );
}

