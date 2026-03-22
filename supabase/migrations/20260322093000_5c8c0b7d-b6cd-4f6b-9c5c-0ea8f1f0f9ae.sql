ALTER TABLE public.syntax_patterns
ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

UPDATE public.syntax_patterns AS sp
SET is_global = true
FROM auth.users AS u
WHERE sp.user_id = u.id
  AND lower(coalesce(u.email, '')) = 'co500123@naver.com';

DROP POLICY IF EXISTS "Users can manage own syntax_patterns" ON public.syntax_patterns;
DROP POLICY IF EXISTS "Authenticated users can read global syntax_patterns" ON public.syntax_patterns;
DROP POLICY IF EXISTS "Admin can insert global syntax_patterns" ON public.syntax_patterns;
DROP POLICY IF EXISTS "Admin can update global syntax_patterns" ON public.syntax_patterns;
DROP POLICY IF EXISTS "Admin can delete global syntax_patterns" ON public.syntax_patterns;

CREATE POLICY "Authenticated users can read global syntax_patterns"
  ON public.syntax_patterns
  FOR SELECT
  TO authenticated
  USING (is_global = true);

CREATE POLICY "Admin can insert global syntax_patterns"
  ON public.syntax_patterns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_global = true
    AND user_id = auth.uid()
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'co500123@naver.com'
  );

CREATE POLICY "Admin can update global syntax_patterns"
  ON public.syntax_patterns
  FOR UPDATE
  TO authenticated
  USING (
    is_global = true
    AND user_id = auth.uid()
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'co500123@naver.com'
  )
  WITH CHECK (
    is_global = true
    AND user_id = auth.uid()
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'co500123@naver.com'
  );

CREATE POLICY "Admin can delete global syntax_patterns"
  ON public.syntax_patterns
  FOR DELETE
  TO authenticated
  USING (
    is_global = true
    AND user_id = auth.uid()
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'co500123@naver.com'
  );
