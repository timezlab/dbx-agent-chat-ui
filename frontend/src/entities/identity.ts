import { z } from "zod";

/**
 * Cách người dùng được xác thực với backend (host cung cấp qua `me` API).
 * `DB_SAML_SSO` — đăng nhập SSO của Databricks; `PAT` — personal access token.
 */
export const AuthTypeSchema = z.enum(["DB_SAML_SSO", "PAT"]);
export type AuthType = z.infer<typeof AuthTypeSchema>;

/**
 * Danh tính người dùng hiện tại, fetch từ `NEXT_PUBLIC_ME_API_URL` (host cung cấp).
 * CHỈ để hiển thị — không gửi vào ChatRequest, không phải secret trong bundle (Principle II).
 *
 * `email` + `username` BẮT BUỘC (khóa nhận diện tối thiểu); các field còn lại optional —
 * host nào không cung cấp thì UI đơn giản không hiển thị dòng đó. Giữ snake_case cho JSON
 * contract để khớp convention backend Databricks (vd `session_id`).
 */
export const IdentitySchema = z.object({
  email: z.string(), // bắt buộc — dòng chính hiển thị trên chip
  username: z.string(),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  auth_type: AuthTypeSchema.optional(),
  org_id: z.string().optional(),
});
export type Identity = z.infer<typeof IdentitySchema>;
