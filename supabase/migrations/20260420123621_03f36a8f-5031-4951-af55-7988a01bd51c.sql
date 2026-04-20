INSERT INTO public.feature_flags (key, enabled_for_admin, enabled_for_all, description)
VALUES ('sv_labels', true, false, '동사/주어 밑줄 아래에 s, v, s'', v'', v₁, v₂ 등 절·병렬 라벨 표시')
ON CONFLICT (key) DO NOTHING;