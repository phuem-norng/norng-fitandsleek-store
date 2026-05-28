import api from "./api";

/** CLIP model cold start + vectorize can take 60–120s; keep above backend IMAGE_SEARCH_TIMEOUT. */
export const IMAGE_SEARCH_TIMEOUT_MS = 180000;

/**
 * @param {{ file?: File | Blob, url?: string, limit?: number }} params
 */
export async function postImageSearch({ file, url, limit = 12 }) {
  if (file) {
    const form = new FormData();
    const name = file instanceof File ? file.name : "image-search.jpg";
    form.append("image", file, name);
    if (limit) {
      form.append("limit", String(limit));
    }
    return api.post("/image-search", form, { timeout: IMAGE_SEARCH_TIMEOUT_MS });
  }

  if (url && String(url).trim()) {
    return api.post(
      "/image-search",
      { url: String(url).trim(), limit },
      { timeout: IMAGE_SEARCH_TIMEOUT_MS },
    );
  }

  throw new Error("Provide an image file or URL");
}

export function formatImageSearchError(err) {
  const data = err?.response?.data;
  if (data?.error) {
    return data.error;
  }
  if (data?.message) {
    return data.message;
  }
  if (err?.code === "ECONNABORTED") {
    return "Search timed out — the AI model may still be loading. Wait a moment and try again.";
  }
  return err?.message || "Image search failed";
}

export async function fetchImageSearchStatus() {
  const res = await api.get("/image-search/status", { timeout: 15000 });
  return res.data;
}
