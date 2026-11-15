import { isAxiosError } from "axios";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { GetReportParams, ReportResponse } from "@/interfaces/reports.interface";

import { apiClient } from "./api.service";

export const GetReport = async (params: GetReportParams, signal?: AbortSignal) => {
  const response = await apiClient.get<ReportResponse>("/reports", { params: { ...params, format: "json" }, signal });
  return response.data;
};

/** UTF-8 -> string sem depender de TextDecoder (nem todo motor JS do RN tem). */
function decodeUtf8(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  try {
    return decodeURIComponent(escape(binary));
  } catch {
    return binary;
  }
}

const MIME = {
  pdf: { type: "application/pdf", uti: "com.adobe.pdf" },
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", uti: "org.openxmlformats.spreadsheetml.sheet" },
} as const;

/**
 * Baixa o arquivo pronto (gerado pela API, igual ao do web), salva no cache
 * do aparelho e abre a folha de compartilhamento.
 */
export const ShareReportFile = async (params: GetReportParams, format: "pdf" | "xlsx", fileName: string) => {
  let bytes: ArrayBuffer;
  try {
    const response = await apiClient.get<ArrayBuffer>("/reports", {
      params: { ...params, format },
      responseType: "arraybuffer",
      timeout: 60000,
    });
    bytes = response.data;
  } catch (error) {
    // Com responseType arraybuffer o JSON de erro também chega em bytes.
    if (isAxiosError(error) && error.response?.data instanceof ArrayBuffer) {
      try {
        error.response.data = JSON.parse(decodeUtf8(new Uint8Array(error.response.data)));
      } catch {
        error.response.data = {};
      }
    }
    throw error;
  }

  const safeName = fileName.replace(/[^\w\-. ]+/g, "").trim() || "relatorio";
  const file = new File(Paths.cache, `${safeName}.${format}`);
  if (file.exists) file.delete();
  file.create();
  file.write(new Uint8Array(bytes));
  await Sharing.shareAsync(file.uri, { mimeType: MIME[format].type, UTI: MIME[format].uti, dialogTitle: fileName });
};
