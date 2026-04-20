-- feature_flags 테이블
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  enabled_for_admin BOOLEAN NOT NULL DEFAULT false,
  enabled_for_all BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자: 읽기
CREATE POLICY "Authenticated users can read feature_flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);

-- 관리자만: 추가
CREATE POLICY "Admin can insert feature_flags"
ON public.feature_flags
FOR INSERT
TO authenticated
WITH CHECK (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'co500123@naver.com'::text);

-- 관리자만: 수정
CREATE POLICY "Admin can update feature_flags"
ON public.feature_flags
FOR UPDATE
TO authenticated
USING (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'co500123@naver.com'::text)
WITH CHECK (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'co500123@naver.com'::text);

-- 관리자만: 삭제
CREATE POLICY "Admin can delete feature_flags"
ON public.feature_flags
FOR DELETE
TO authenticated
USING (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'co500123@naver.com'::text);

-- updated_at 자동 갱신 함수 (없으면 생성)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();