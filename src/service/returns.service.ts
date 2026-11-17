import type {
  CreateReturnParams,
  ListReturnsParams,
  ListReturnsResponse,
  ReturnDetail,
  ReturnableSale,
  SaleSearchResponse,
} from "@/interfaces/returns.interface";

import { apiClient } from "./api.service";

export const ListReturns = async (params: ListReturnsParams, signal?: AbortSignal) => {
  const response = await apiClient.get<ListReturnsResponse>("/returns", { params, signal });
  return response.data;
};

export const GetReturn = async (id: string, signal?: AbortSignal) => {
  const response = await apiClient.get<ReturnDetail>(`/returns/${id}`, { signal });
  return response.data;
};

export const CreateReturn = async (params: CreateReturnParams) => {
  const response = await apiClient.post<ReturnDetail>("/returns", params);
  return response.data;
};

/** Vendas que ainda têm itens para devolver (busca por cliente, produto ou nº). */
export const SearchSalesForReturn = async (
  params: { search?: string; page?: number; per_page?: number },
  signal?: AbortSignal,
) => {
  const response = await apiClient.get<SaleSearchResponse>("/returns/sales", { params, signal });
  return response.data;
};

export const GetReturnableSale = async (saleId: string, signal?: AbortSignal) => {
  const response = await apiClient.get<ReturnableSale>(`/returns/sales/${saleId}`, { signal });
  return response.data;
};
