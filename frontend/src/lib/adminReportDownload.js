/**
 * Download a blob response from the admin API and trigger a browser save.
 */
export async function downloadBlobResponse(res, fallbackFilename = "download") {
  const disposition = res.headers?.["content-disposition"] || "";
  const match = /filename="?([^";\n]+)"?/i.exec(disposition);
  const filename = match?.[1]?.trim() || fallbackFilename;

  const blob = new Blob([res.data], {
    type: res.headers?.["content-type"] || "application/octet-stream",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function parseBlobErrorMessage(data, fallback = "Download failed") {
  if (!data) return fallback;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || fallback;
}
