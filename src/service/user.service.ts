import { apiClient } from "./api.service";

export interface UpdateOwnProfileRequest {
  name: string;
  email: string;
  username: string;
}

/** PUT /user: o próprio usuário altera nome, e-mail e usuário (sem precisar ser ADMIN). */
export const UpdateOwnProfile = async (params: UpdateOwnProfileRequest) => {
  await apiClient.put("/user", params);
};

export const UpdatePassword = async (params: { current_password: string; password: string }) => {
  await apiClient.put("/user/password", params);
};
