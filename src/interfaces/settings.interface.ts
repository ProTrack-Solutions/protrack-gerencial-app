// Cadastros auxiliares (Configurações), no formato do protrack-api.

export type RecordStatus = "ACTIVE" | "INACTIVE";

export interface VendorRecord {
  id: string;
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  postal_code: string;
  address_line_1: string;
  number: string;
  address_line_2: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  is_active: boolean;
}

export type SaveVendorParams = Omit<VendorRecord, "id" | "is_active">;

export interface ModuleRecord {
  code: string;
  name: string;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  description: string;
  status: RecordStatus | string;
  modules: ModuleRecord[] | null;
}

export interface SaveDepartmentParams {
  name: string;
  description: string;
  modules: ModuleRecord[];
}

export interface ProductCategoryRecord {
  id: string;
  name: string;
  color: string;
  status: RecordStatus | string;
}

export interface CompanyUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  status: RecordStatus | string;
  department_id: string;
  department_name: string;
  last_login_at: string | null;
}

export interface CreateUserParams {
  name: string;
  email: string;
  username: string;
  password: string;
  department_id: string;
}

export interface UpdateUserParams {
  name: string;
  email: string;
  username: string;
  role: string;
  department_id: string;
}
