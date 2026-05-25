import { useCallback, useEffect, useMemo, useState } from "react";
import { browseFromSearchParams } from "../lib/storefrontProductFilters.js";

export function useStorefrontBrowseDraft(searchParams, _appliedFilters, priceBounds) {
  const browseFromUrl = useMemo(() => browseFromSearchParams(searchParams), [searchParams]);

  const [draftSort, setDraftSort] = useState(browseFromUrl.sort);
  const [draftMinPrice, setDraftMinPrice] = useState(browseFromUrl.minPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(browseFromUrl.maxPrice);

  useEffect(() => {
    setDraftSort(browseFromUrl.sort);
    setDraftMinPrice(browseFromUrl.minPrice);
    setDraftMaxPrice(browseFromUrl.maxPrice);
  }, [browseFromUrl.sort, browseFromUrl.minPrice, browseFromUrl.maxPrice]);

  const syncBrowseDraftFromUrl = useCallback(() => {
    setDraftSort(browseFromUrl.sort);
    setDraftMinPrice(
      browseFromUrl.minPrice !== ""
        ? browseFromUrl.minPrice
        : priceBounds?.min != null
          ? String(priceBounds.min)
          : "",
    );
    setDraftMaxPrice(
      browseFromUrl.maxPrice !== ""
        ? browseFromUrl.maxPrice
        : priceBounds?.max != null
          ? String(priceBounds.max)
          : "",
    );
  }, [browseFromUrl, priceBounds]);

  const clearBrowseDraft = useCallback(() => {
    setDraftSort("recommend");
    if (priceBounds?.min != null) setDraftMinPrice(String(priceBounds.min));
    if (priceBounds?.max != null) setDraftMaxPrice(String(priceBounds.max));
  }, [priceBounds]);

  const browseDraft = useMemo(
    () => ({
      sort: draftSort,
      minPrice: draftMinPrice,
      maxPrice: draftMaxPrice,
    }),
    [draftSort, draftMinPrice, draftMaxPrice],
  );

  return {
    browseFromUrl,
    browseDraft,
    draftSort,
    setDraftSort,
    draftMinPrice,
    setDraftMinPrice,
    draftMaxPrice,
    setDraftMaxPrice,
    syncBrowseDraftFromUrl,
    clearBrowseDraft,
  };
}
