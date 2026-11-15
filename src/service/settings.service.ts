import type {
  CompanyUser,
  CreateUserParams,
  DepartmentRecord,
  ModuleRecord,
  ProductCategoryRecord,
  RecordStatus,
  SaveDepartmentParams,
  SaveVendorParams,
  UpdateUserParams,
  VendorRecord,
} from "@/interfaces/settings.interface";

import { apiClient } from "./api.service";

const list = <T,>(data: T[] | null | undefined) => data ?? [];

// ─── Fornecedores (módulo inventory) ────────────────────────────────────────
export const ListVendors = async (signal?: AbortSignal) =>
  list((await apiClient.get<VendorRecord[] | null>("/vendors/list", { signal })).data);
export const CreateVendor = (params: SaveVendorParams) => apiClient.post("/vendors", params);
export const UpdateVendor = (id: string, params: SaveVendorParams) => apiClient.put(`/vendors/${id}`, params);
export const ToggleVendor = (id: string, isActive: boolean) => apiClient.put(`/vendors/toggle/${id}`, { is_active: isActive });

// ─── Departamentos (escrita só ADMIN) ───────────────────────────────────────
export const ListDepartments = async (signal?: AbortSignal) =>
  list((await apiClient.get<DepartmentRecord[] | null>("/departments/list", { signal })).data);
export const ListModules = async (signal?: AbortSignal) =>
  list((await apiClient.get<ModuleRecord[] | null>("/modules/list", { signal })).data);
export const CreateDepartment = (params: SaveDepartmentParams) => apiClient.post("/departments", params);
export const UpdateDepartment = (id: string, params: SaveDepartmentParams) => apiClient.put(`/departments/${id}`, params);
export const SetDepartmentStatus = (id: string, status: RecordStatus) => apiClient.put(`/departments/status/${id}`, { Status: status });
export const DeleteDepartment = (id: string) => apiClient.delete(`/departments/${id}`);

// ─── Categorias de produto (módulo inventory) ───────────────────────────────
export const ListProductCategories = async (signal?: AbortSignal) =>
  list((await apiClient.get<ProductCategoryRecord[] | null>("/products-categories/list/company", { signal })).data);
export const CreateProductCategory = (params: { name: string; color: string }) => apiClient.post("/products-categories", params);
export const UpdateProductCategory = (id: string, params: { name: string; color: string }) =>
  apiClient.put(`/products-categories/${id}`, { id, ...params });
export const SetProductCategoryStatus = (id: string, status: RecordStatus) => apiClient.put("/products-categories/status/", { id, status });
export const DeleteProductCategory = (id: string) => apiClient.delete(`/products-categories/${id}`);

// ─── Usuários (ADMIN) ───────────────────────────────────────────────────────
export const ListCompanyUsers = async (signal?: AbortSignal) =>
  list((await apiClient.get<CompanyUser[] | null>("/user/list-company", { signal })).data);
export const CreateCompanyUser = (params: CreateUserParams) => apiClient.post("/user", params);
export const UpdateCompanyUser = (id: string, params: UpdateUserParams) => apiClient.put(`/user/${id}`, params);
export const SetUserStatus = (id: string, status: RecordStatus) => apiClient.put(`/user/status/${id}`, { status });
