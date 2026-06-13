/** Build storefront search URLs for header / mega-menu navigation. */

export function storefrontSearchUrl({
  tab = "",
  gender = "",
  category = "",
  parentCategory = "",
  saleGender = "",
} = {}) {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (parentCategory) {
    params.set("parent_category", parentCategory);
  } else if (gender) {
    params.set("gender", gender);
  }
  if (category) params.set("category", category);
  if (tab === "sale" && saleGender) params.set("gender", saleGender);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}
