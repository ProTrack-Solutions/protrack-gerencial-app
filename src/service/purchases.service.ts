import type {
  BillCategory,
  CatalogSearchResponse,
  ListPurchaseOrdersParams,
  ListPurchaseOrdersResponse,
  PurchaseEmailKind,
  PurchaseOrderDetail,
  ReceivePurchaseParams,
  SavePurchaseOrderParams,
  Vendor,
} from "@/interfaces/purchases.interface";

import { apiClient } from "./api.service";

export const ListPurchaseOrders = async (params: ListPurchaseOrdersParams, signal?: AbortSignal) => {
  const response = await apiClient.get<ListPurchaseOrdersResponse>("/purchases/orders", { params, signal });
  return response.data;
};

export const GetPurchaseOrder = async (id: string, signal?: AbortSignal) => {
  const response = await apiClient.get<PurchaseOrderDetail>(`/purchases/orders/${id}`, { signal });
  return response.data;
};

export const CreatePurchaseOrder = async (params: SavePurchaseOrderParams) => {
  const response = await apiClient.post<PurchaseOrderDetail>("/purchases/orders", params);
  return response.data;
};

export const UpdatePurchaseOrder = async (id: string, params: SavePurchaseOrderParams) => {
  const response = await apiClient.put<PurchaseOrderDetail>(`/purchases/orders/${id}`, params);
  return response.data;
};

export const SendPurchaseOrder = async (id: string) => {
  const response = await apiClient.post<PurchaseOrderDetail>(`/purchases/orders/${id}/send`);
  return response.data;
};

export const ClosePurchaseOrder = async (id: string, reason: string) => {
  const response = await apiClient.post<PurchaseOrderDetail>(`/purchases/orders/${id}/close`, { reason });
  return response.data;
};

export const CancelPurchaseOrder = async (id: string, reason: string) => {
  const response = await apiClient.post<PurchaseOrderDetail>(`/purchases/orders/${id}/cancel`, { reason });
  return response.data;
};

export const ReceivePurchaseOrder = async (id: string, params: ReceivePurchaseParams) => {
  const response = await apiClient.post<PurchaseOrderDetail>(`/purchases/orders/${id}/receipts`, params);
  return response.data;
};

export const ReversePurchaseReceipt = async (receiptId: string, reason: string) => {
  const response = await apiClient.post<PurchaseOrderDetail>(`/purchases/receipts/${receiptId}/reverse`, { reason });
  return response.data;
};

/** Envia o pedido ao fornecedor por e-mail (PDF anexo); a entrega é assíncrona. */
export const EmailPurchaseOrder = async (id: string, kind: PurchaseEmailKind) => {
  const response = await apiClient.post<PurchaseOrderDetail>(`/purchases/orders/${id}/email`, { kind });
  return response.data;
};

/** Busca por nome ou código de barras exato. */
export const SearchCatalogProducts = async (search: string, signal?: AbortSignal) => {
  const response = await apiClient.get<CatalogSearchResponse>("/purchases/catalog/products", {
    params: { search, page: 1, per_page: 20 },
    signal,
  });
  return response.data.products ?? [];
};

export const ListActiveVendors = async (signal?: AbortSignal) => {
  const response = await apiClient.get<Vendor[] | null>("/vendors/list/is-active", { signal });
  return response.data ?? [];
};

export const ListBillCategories = async (signal?: AbortSignal) => {
  const response = await apiClient.get<BillCategory[] | null>("/bill-categories", { signal });
  return (response.data ?? []).filter((c) => c.is_active);
};
