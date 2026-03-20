import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTeacherLabel() {
  const { user } = useAuth();
  const [teacherLabel, setTeacherLabelState] = useState("홍T");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("teacher_label")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setTeacherLabelState(data.teacher_label);
      } else if (!data) {
        // Insert default
        await supabase.from("user_preferences").insert({
          user_id: user.id,
          teacher_label: "홍T",
        });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const setTeacherLabel = useCallback(
    async (label: string) => {
      if (!user?.id || !label.trim()) return;
      const trimmed = label.trim();
      setTeacherLabelState(trimmed);
      await supabase
        .from("user_preferences")
        .update({ teacher_label: trimmed })
        .eq("user_id", user.id);
    },
    [user?.id]
  );

  return { teacherLabel, setTeacherLabel, loading };
}
