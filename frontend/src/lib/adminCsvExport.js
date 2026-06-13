/**
 * Client-side CSV download for admin tables (no server round-trip).
 */

export function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * @param {string[]} headers
 * @param {(string|number)[][]} rows
 * @param {string} filename
 */
export function downloadCsv({ headers, rows, filename }) {
  const header = Array.isArray(headers) ? headers : [];
  const data = Array.isArray(rows) ? rows : [];
  const lines = [
    header.map(escapeCsvCell).join(","),
    ...data.map((row) => (Array.isArray(row) ? row : []).map(escapeCsvCell).join(",")),
  ];
  const blob = new Blob(["\uFEFF", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
