import React, { useEffect, useMemo, useState } from "react";
import Hero from "../components/home/Hero.jsx";
import BrandRow from "../components/home/BrandRow.jsx";
import CollectionTiles from "../components/home/CollectionTiles.jsx";
import PromoBannerSlider from "../components/home/PromoBannerSlider.jsx";
import Section from "../components/shop/Section.jsx";
import { useHomepageSettings } from "../state/homepageSettings.jsx";
import api from "../lib/api";
import { useLanguage } from "../lib/i18n.jsx";

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickCategories(categories, names) {
  if (!Array.isArray(categories)) return [];
  const tokens = (names || []).map(normalizeToken).filter(Boolean);
  if (!tokens.length) return [];

  const exactMatches = categories.filter((category) => {
    const name = normalizeToken(category?.name);
    const slug = normalizeToken(category?.slug);
    const type = normalizeToken(category?.type);
    return tokens.some((token) => token === name || token === slug || token === type);
  });

  if (exactMatches.length > 0) return exactMatches;

  return categories.filter((category) => {
    const name = normalizeToken(category?.name);
    const slug = normalizeToken(category?.slug);
    const type = normalizeToken(category?.type);
    return tokens.some(
      (token) =>
        name.includes(token) ||
        slug.includes(token) ||
        type.includes(token)
    );
  });
}

function getSectionSearchTokens(section) {
  const key = normalizeToken(section?.key);
  const title = normalizeToken(section?.title);
  const tokens = [key, title].filter(Boolean);

  if (key.includes("belt") || title.includes("belt")) {
    tokens.push("belts", "belt");
  }

  if (key.includes("vanna") || title.includes("vanna") || title.includes("វ៉ាន់ណា")) {
    tokens.push("vanna", "វ៉ាន់ណា");
  }

  return Array.from(new Set(tokens));
}

function interleaveProductGroups(groups) {
  const lists = (groups || []).map((items) => (Array.isArray(items) ? [...items] : []));
  const output = [];

  let hasRemaining = true;
  while (hasRemaining) {
    hasRemaining = false;
    for (const list of lists) {
      if (list.length > 0) {
        output.push(list.shift());
        hasRemaining = true;
      }
    }
  }

  return output;
}

const PARENT_SECTION_KEYS = new Set(["women", "men", "boys", "girls"]);
const TAB_SECTION_MAP = { newIn: "new" };
const PARENT_LINK_MAP = { women: "Women", men: "Men", boys: "Boys", girls: "Girls" };

export default function Home() {
  const [categories, setCategories] = useState([]);
  const { settings: homepageSettings } = useHomepageSettings();
  const [sections, setSections] = useState({});
  const { t } = useLanguage();

  // Load categories
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");
        const list = Array.isArray(data) ? data : data?.data;
        setCategories(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("[Home] /categories failed:", err?.response?.status, err?.message);
        setCategories([]);
      }
    })();
  }, []);

  // Get enabled sections from settings, sorted by order
  const enabledSections = useMemo(() => {
    if (!homepageSettings?.sections) {
      // Fallback to default sections
      return [
        { key: 'discounts', title: t('discounts'), enabled: true, order: 1 },
        { key: 'clothes', title: t('clothes'), enabled: true, order: 2 },
        { key: 'shoes', title: t('shoes'), enabled: true, order: 3 },
        { key: 'belts', title: t('belts'), enabled: true, order: 4 },
      ].filter(s => s.enabled).sort((a, b) => a.order - b.order);
    }

    return Object.entries(homepageSettings.sections)
      .filter(([_, section]) => section.enabled)
      .map(([key, section]) => ({
        key,
        title: section.title,
        enabled: section.enabled,
        order: section.order,
      }))
      .sort((a, b) => a.order - b.order);
  }, [homepageSettings]);

  const sectionCategories = useMemo(() => {
    const mapped = {};
    enabledSections.forEach((section) => {
      if (section.key === "discounts") {
        return;
      }

      const searchTokens = getSectionSearchTokens(section);

      mapped[section.key] = pickCategories(categories, searchTokens);
    });
    return mapped;
  }, [enabledSections, categories]);

  // Load section products
  useEffect(() => {
    const loadSection = async (key, categoriesForSection) => {
      const matchedCategories = Array.isArray(categoriesForSection)
        ? categoriesForSection.filter((category) => category?.slug || category?.id)
        : [];

      if (matchedCategories.length === 0) {
        setSections((s) => ({ ...s, [key]: { loading: false, items: [] } }));
        return;
      }

      setSections((s) => ({ ...s, [key]: { ...(s[key] || {}), loading: true } }));
      try {
        const responses = await Promise.all(
          matchedCategories.map((category) => {
            const params = category?.slug
              ? { category: category.slug, per_page: 24 }
              : { category_id: category.id, per_page: 24 };
            return api.get("/products", { params });
          })
        );

        const grouped = responses.map((response) => response?.data?.data || []);
        const merged = interleaveProductGroups(grouped);
        const uniqueItems = Array.from(
          new Map(merged.map((product) => [product.id, product])).values()
        );
        const items = uniqueItems.slice(0, 8);
        setSections((s) => ({ ...s, [key]: { loading: false, items } }));
      } catch (error) {
        console.error(`Error loading section ${key}:`, error);
        setSections((s) => ({ ...s, [key]: { loading: false, items: [] } }));
      }
    };

    const loadDiscounts = async () => {
      setSections((s) => ({ ...s, discounts: { ...(s.discounts || {}), loading: true } }));
      try {
        const { data } = await api.get("/products/discounts");
        const items = (data?.data || []).slice(0, 8);
        setSections((s) => ({ ...s, discounts: { loading: false, items } }));
      } catch (error) {
        console.error("Error loading discounts:", error);
        setSections((s) => ({ ...s, discounts: { loading: false, items: [] } }));
      }
    };

    const loadTabSection = async (key, tab) => {
      setSections((s) => ({ ...s, [key]: { ...(s[key] || {}), loading: true } }));
      try {
        const { data } = await api.get("/products", { params: { tab, per_page: 8 } });
        const items = (data?.data || []).slice(0, 8);
        setSections((s) => ({ ...s, [key]: { loading: false, items } }));
      } catch (error) {
        console.error(`Error loading section ${key}:`, error);
        setSections((s) => ({ ...s, [key]: { loading: false, items: [] } }));
      }
    };

    const loadParentSection = async (key) => {
      const parent = PARENT_LINK_MAP[key] || key;
      setSections((s) => ({ ...s, [key]: { ...(s[key] || {}), loading: true } }));
      try {
        const { data } = await api.get("/products", {
          params: { parent_category: parent, per_page: 8 },
        });
        const items = (data?.data || []).slice(0, 8);
        setSections((s) => ({ ...s, [key]: { loading: false, items } }));
      } catch (error) {
        console.error(`Error loading section ${key}:`, error);
        setSections((s) => ({ ...s, [key]: { loading: false, items: [] } }));
      }
    };

    enabledSections.forEach((section) => {
      if (section.key === "discounts") {
        loadDiscounts();
      } else if (TAB_SECTION_MAP[section.key]) {
        loadTabSection(section.key, TAB_SECTION_MAP[section.key]);
      } else if (PARENT_SECTION_KEYS.has(section.key)) {
        loadParentSection(section.key);
      } else {
        loadSection(section.key, sectionCategories[section.key]);
      }
    });
  }, [enabledSections, sectionCategories]);

  const getSectionLink = (section) => {
    const key = section?.key;
    const matchedCategories = sectionCategories[key] || [];
    const firstCategory = matchedCategories[0];

    if (key === "discounts") return "/discounts";
    if (key === "newIn") return "/search?tab=new";
    if (PARENT_SECTION_KEYS.has(key)) {
      const parent = PARENT_LINK_MAP[key] || key;
      return `/search?parent_category=${encodeURIComponent(parent)}`;
    }
    if (firstCategory?.slug) return `/category/${firstCategory.slug}`;
    return `/search?search=${encodeURIComponent(section?.title || key || "")}`;
  };

  return (
    <div className="pb-14 max-w-[1600px] mx-auto">
      <Hero />
      <div className="animate-fade-in">
        <BrandRow />
      </div>
      <div className="animate-fade-in-up delay-100">
        <CollectionTiles />
      </div>

      {/* Dynamically render sections based on homepage settings */}
      {enabledSections.map((section, index) => (
        <div key={section.key} className={`animate-fade-in-up delay-${(index + 2) * 100}`}>
          <Section
            title={section.title}
            to={getSectionLink(section)}
            items={sections[section.key]?.items || []}
            loading={sections[section.key]?.loading ?? true}
            showDiscount={section.key === 'discounts'}
          />
          {section.key === 'discounts' && <PromoBannerSlider />}
        </div>
      ))}
    </div>
  );
}
