import api from "./api";
import { downloadBlobResponse, parseBlobErrorMessage } from "./adminReportDownload";

/**
 * Export a table to PDF or Excel via the admin API.
 *
 * @param {{ format: 'pdf' | 'excel', filename: string, title: string, subtitle?: string, headers: string[], rows: (string|number|null)[][] }} payload
 */
export async function exportAdminTable(payload) {
  const res = await api.post("/admin/exports/table", payload, {
    responseType: "blob",
  });
  const ext = payload.format === "pdf" ? ".pdf" : ".xls";
  const fallback = payload.filename?.includes(".") ? payload.filename : `${payload.filename || "export"}${ext}`;
  await downloadBlobResponse(res, fallback);
}

export async function exportAdminTableWithErrors(payload, { onError } = {}) {
  try {
    await exportAdminTable(payload);
    return true;
  } catch (e) {
    const message = await parseBlobErrorMessage(
      e?.response?.data,
      e?.response?.data?.message || "Export failed",
    );
    if (onError) onError(message);
    throw e;
  }
}
