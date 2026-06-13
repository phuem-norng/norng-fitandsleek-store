import { useEffect, useState } from "react";
import api from "../lib/api";

export function useProductListingFacets(params, enabled = true) {
  const [brandFacets, setBrandFacets] = useState([]);
  const [loading, setLoading] = useState(false);

  const paramKey = enabled ? JSON.stringify(params || {}) : "";

  useEffect(() => {
    if (!enabled) {
      setBrandFacets([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/products/facets", { params: params || {} });
        if (!cancelled) {
          setBrandFacets(Array.isArray(data?.brands) ? data.brands : []);
        }
      } catch {
        if (!cancelled) setBrandFacets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paramKey, enabled]);

  return { brandFacets, facetsLoading: loading };
}
