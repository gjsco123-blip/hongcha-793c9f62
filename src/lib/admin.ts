import type { User } from "@supabase/supabase-js";

export const ADMIN_EMAIL = "co500123@naver.com";

export function isAdmin(user: User | null | undefined): boolean {
  if (!user?.email) return false;
  return user.email.toLowerCase() === ADMIN_EMAIL;
}