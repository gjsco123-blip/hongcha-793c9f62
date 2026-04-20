INSERT INTO public.feature_flags (key, description, enabled_for_admin, enabled_for_all)
VALUES (
  'subject_underline',
  '주어(S) 핵심 명사구에 동사와 동일한 밑줄 표시 (베타)',
  false,
  false
)
ON CONFLICT (key) DO NOTHING;