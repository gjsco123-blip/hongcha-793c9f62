import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/admin";

export interface FeatureFlagRow {
  id: string;
  key: string;
  enabled_for_admin: boolean;
  enabled_for_all: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const STALE_MS = 60_000;

async function fetchFlags(): Promise<FeatureFlagRow[]> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .order("key", { ascending: true });
  if (error) {
    console.warn("[useFeatureFlag] fetch failed:", error.message);
    return [];
  }
  return (data ?? []) as FeatureFlagRow[];
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature_flags"],
    queryFn: fetchFlags,
    staleTime: STALE_MS,
    gcTime: 5 * 60_000,
  });
}

export function useFeatureFlag(key: string): boolean {
  const { user } = useAuth();
  const { data } = useFeatureFlags();
  const flag = data?.find((f) => f.key === key);
  if (!flag) {
    if (data && data.length > 0) {
      console.warn(`[useFeatureFlag] unknown flag "${key}" — returning false`);
    }
    return false;
  }
  if (flag.enabled_for_all) return true;
  if (flag.enabled_for_admin && isAdmin(user)) return true;
  return false;
}

export function useInvalidateFeatureFlags() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["feature_flags"] });
}