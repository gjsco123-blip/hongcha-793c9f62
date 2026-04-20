import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import {
  useFeatureFlags,
  useInvalidateFeatureFlags,
  type FeatureFlagRow,
} from "@/hooks/useFeatureFlag";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: flags, isLoading } = useFeatureFlags();
  const invalidate = useInvalidateFeatureFlags();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin(user)) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !isAdmin(user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-sm text-muted-foreground">로딩 중...</span>
      </div>
    );
  }

  const updateFlag = async (
    flag: FeatureFlagRow,
    field: "enabled_for_admin" | "enabled_for_all",
    value: boolean,
  ) => {
    setUpdatingId(flag.id + field);
    const { error } = await supabase
      .from("feature_flags")
      .update({ [field]: value })
      .eq("id", flag.id);
    setUpdatingId(null);
    if (error) {
      toast({
        title: "업데이트 실패",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await invalidate();
    toast({
      title: "저장됨",
      description: `${flag.key} → ${field === "enabled_for_all" ? "모두 공개" : "관리자 노출"} ${value ? "ON" : "OFF"}`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </Button>
          <h1 className="text-sm font-semibold tracking-[0.15em] uppercase text-foreground">
            Admin · Feature Flags
          </h1>
        </div>
        <span className="text-xs text-muted-foreground">{user?.email}</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-sm text-muted-foreground mb-6">
          베타 기능을 단계적으로 공개합니다. <strong>관리자 노출</strong>을 켜면 본인 계정에서만 보이고,
          <strong> 모두 공개</strong>를 켜면 전체 사용자에게 적용됩니다. 변경 즉시 반영되며 새로고침이 필요할 수 있습니다.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !flags || flags.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              등록된 기능 플래그가 없습니다. 새 베타 기능이 추가되면 여기에 자동으로 나타납니다.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => (
              <Card key={flag.id} className="p-5">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-semibold text-foreground">
                        {flag.key}
                      </code>
                      {flag.enabled_for_all && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Live
                        </span>
                      )}
                    </div>
                    {flag.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {flag.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 shrink-0">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-xs text-muted-foreground w-24 text-right">
                        관리자 노출
                      </span>
                      <Switch
                        checked={flag.enabled_for_admin}
                        disabled={updatingId === flag.id + "enabled_for_admin"}
                        onCheckedChange={(v) => updateFlag(flag, "enabled_for_admin", v)}
                      />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-xs text-muted-foreground w-24 text-right">
                        모두 공개
                      </span>
                      <Switch
                        checked={flag.enabled_for_all}
                        disabled={updatingId === flag.id + "enabled_for_all"}
                        onCheckedChange={(v) => updateFlag(flag, "enabled_for_all", v)}
                      />
                    </label>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}