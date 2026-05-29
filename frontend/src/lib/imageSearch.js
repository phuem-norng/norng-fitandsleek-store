import api from "./api";

/** CLIP + Qdrant can exceed default axios timeouts (HF cold start). */
export const IMAGE_SEARCH_REQUEST_TIMEOUT_MS = 120_000;

/**
 * POST multipart image to Laravel image-search (uses VITE_API_BASE_URL / split-host routing).
 */
export function postImageSearch(formData, config = {}) {
  return api.post("/image-search", formData, {
    timeout: IMAGE_SEARCH_REQUEST_TIMEOUT_MS,
    ...config,
  });
}
