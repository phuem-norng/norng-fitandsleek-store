import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import {
  STOREFRONT_GENDER_OPTIONS,
  buildSectionOptionsFromHomepage,
  sortSizes,
} from "../lib/storefrontProductFilters.js";
import { useHomepageSettings } from "../state/homepageSettings.jsx";

export function useStorefrontFilterSections() {
  const { settings: homepageSettings } = useHomepageSettings();
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [attributeOptions, setAttributeOptions] = useState({
    colors: [],
    sizes: [],
    price_min: null,
    price_max: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const [catRes, brandRes, optRes] = await Promise.all([
          api.get("/categories"),
          api.get("/brands"),
          api.get("/products/filter-options"),
        ]);
        const catList = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
        const brandList = brandRes.data?.data || brandRes.data || [];
        setCategories(Array.isArray(catList) ? catList : []);
        setBrands(Array.isArray(brandList) ? brandList : []);
        setAttributeOptions({
          colors: optRes.data?.colors || [],
          sizes: sortSizes(optRes.data?.sizes || []),
          price_min: optRes.data?.price_min ?? null,
          price_max: optRes.data?.price_max ?? null,
        });
      } catch {
        setCategories([]);
        setBrands([]);
        setAttributeOptions({ colors: [], sizes: [], price_min: null, price_max: null });
      }
    })();
  }, []);

  const priceBounds = useMemo(() => {
    const min = attributeOptions.price_min;
    const max = attributeOptions.price_max;
    if (min == null || max == null || max <= min) return null;
    return { min: Math.floor(min), max: Math.ceil(max) };
  }, [attributeOptions.price_min, attributeOptions.price_max]);

  const filterSections = useMemo(() => {
    const sectionOpts = buildSectionOptionsFromHomepage(homepageSettings);
    const categoryOpts = categories.map((c) => ({
      value: String(c.id),
      label: c.name || "—",
    }));
    const brandOpts = brands.map((b) => ({
      value: String(b.id),
      label: b.name || "—",
    }));
    const colorOpts = (attributeOptions.colors || []).map((color) => ({
      value: color,
      label: color,
    }));
    const sizeOpts = (attributeOptions.sizes || []).map((size) => ({
      value: size,
      label: size,
    }));

    const sections = [
      { id: "gender", title: "Gender", options: STOREFRONT_GENDER_OPTIONS },
      ...(sectionOpts.length
        ? [{ id: "section", title: "Section / type", options: sectionOpts }]
        : []),
      ...(categoryOpts.length ? [{ id: "category", title: "Categories", options: categoryOpts }] : []),
      ...(brandOpts.length ? [{ id: "brand", title: "Brand", options: brandOpts }] : []),
      ...(colorOpts.length ? [{ id: "color", title: "Color", options: colorOpts }] : []),
      ...(sizeOpts.length ? [{ id: "size", title: "Size", options: sizeOpts }] : []),
    ];

    return sections;
  }, [homepageSettings, categories, brands, attributeOptions]);

  return { categories, brands, filterSections, priceBounds };
}
