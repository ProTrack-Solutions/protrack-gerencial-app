import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

/** Escapa texto vindo da API antes de entrar no HTML do PDF. */
export function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PdfTable = {
  columns: { label: string; align?: "left" | "right" | "center" }[];
  rows: (string | number)[][];
};

export type PdfDocument = {
  title: string;
  subtitle?: string;
  /** Pares rótulo/valor em destaque no topo, ex: totais. */
  highlights?: { label: string; value: string }[];
  sections?: { title: string; table?: PdfTable; lines?: { label: string; value: string }[] }[];
};

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111; margin: 32px; font-size: 12px; }
  header { border-bottom: 3px solid #4896EA; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { font-size: 22px; margin: 0; }
  .sub { color: #566176; margin-top: 4px; }
  .brand { color: #4896EA; font-weight: 700; font-size: 11px; letter-spacing: 1px; }
  .hl { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .hl div { flex: 1; min-width: 120px; background: #EBF3FD; border-radius: 10px; padding: 10px 12px; }
  .hl span { display: block; color: #566176; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
  .hl b { font-size: 16px; }
  h2 { font-size: 14px; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #F1F5F9; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #DEE5ED; }
  .lines div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #DEE5ED; }
  footer { margin-top: 28px; color: #8A94A6; font-size: 10px; text-align: center; }
`;

export function buildPdfHtml(doc: PdfDocument) {
  const highlights = doc.highlights?.length
    ? `<div class="hl">${doc.highlights
        .map((h) => `<div><span>${escapeHtml(h.label)}</span><b>${escapeHtml(h.value)}</b></div>`)
        .join("")}</div>`
    : "";

  const sections = (doc.sections ?? [])
    .map((section) => {
      const table = section.table
        ? `<table><thead><tr>${section.table.columns
            .map((c) => `<th style="text-align:${c.align ?? "left"}">${escapeHtml(c.label)}</th>`)
            .join("")}</tr></thead><tbody>${section.table.rows
            .map(
              (row) =>
                `<tr>${row
                  .map(
                    (cell, i) =>
                      `<td style="text-align:${section.table?.columns[i]?.align ?? "left"}">${escapeHtml(cell)}</td>`,
                  )
                  .join("")}</tr>`,
            )
            .join("")}</tbody></table>`
        : "";
      const lines = section.lines
        ? `<div class="lines">${section.lines
            .map((l) => `<div><span>${escapeHtml(l.label)}</span><b>${escapeHtml(l.value)}</b></div>`)
            .join("")}</div>`
        : "";
      return `<h2>${escapeHtml(section.title)}</h2>${table}${lines}`;
    })
    .join("");

  const now = new Date();
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
    <header><div class="brand">PROTRACK GERENCIAL</div><h1>${escapeHtml(doc.title)}</h1>${
      doc.subtitle ? `<div class="sub">${escapeHtml(doc.subtitle)}</div>` : ""
    }</header>
    ${highlights}${sections}
    <footer>Gerado pelo app ProTrack em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}</footer>
  </body></html>`;
}

/** Gera o PDF e abre a folha de compartilhamento do sistema (WhatsApp, e-mail, Drive...). */
export async function sharePdf(doc: PdfDocument) {
  try {
    const html = buildPdfHtml(doc);
    if (Platform.OS === "web") {
      await Print.printAsync({ html });
      return;
    }
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: doc.title,
      });
    } else {
      await Print.printAsync({ uri });
    }
  } catch {
    Alert.alert("Não foi possível gerar o PDF", "Tente novamente em instantes.");
  }
}
