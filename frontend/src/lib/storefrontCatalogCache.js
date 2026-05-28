/**
 * Dedupe storefront catalog API calls (categories, brands, filter-options).
 * Shared across Header, Home, Search filters.
 */

const TTL_MS = 5 * 60 * 1000;

const cache = {
  categories: { at: 0, data: null, promise: null },
  brands: { at: 0, data: null, promise: null },
  filterOptions: { at: 0, data: null, promise: null },
};

function isFresh(entry) {
  return entry.data != null && Date.now() - entry.at < TTL_MS;
}

async function load(entry, fetcher) {
  if (isFresh(entry)) {
    return entry.data;
  }
  if (!entry.promise) {
    entry.promise = fetcher()
      .then((data) => {
        entry.data = data;
        entry.at = Date.now();
        entry.promise = null;
        return data;
      })
      .catch((err) => {
        entry.promise = null;
        throw err;
      });
  }
  return entry.promise;
}

export function fetchCachedCategories(api) {
  return load(cache.categories, async () => {
    const { data } = await api.get("/categories");
    const list = Array.isArray(data) ? data : data?.data;
    return Array.isArray(list) ? list : [];
  });
}

export function fetchCachedBrands(api) {
  return load(cache.brands, async () => {
    const { data } = await api.get("/brands");
    const list = data?.data ?? data;
    return Array.isArray(list) ? list : [];
  });
}

export function fetchCachedFilterOptions(api) {
  return load(cache.filterOptions, async () => {
    const { data } = await api.get("/products/filter-options");
    return {
      colors: data?.colors || [],
      sizes: data?.sizes || [],
      price_min: data?.price_min ?? null,
      price_max: data?.price_max ?? null,
    };
  });
}

export function invalidateStorefrontCatalogCache() {
  Object.values(cache).forEach((entry) => {
    entry.at = 0;
    entry.data = null;
    entry.promise = null;
  });
}
