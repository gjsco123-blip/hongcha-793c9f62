-- Restore pre-existing admin patterns to global scope and relax admin write ownership.
UPDATE public.syntax_patterns AS sp
SET is_global = true
FROM auth.users AS u
WHERE sp.user_id = u.id
  AND lower(coalesce(u.email, '')) IN ('co500123@naver.com', 'gjsco123@gmail.com');

DROP POLICY IF EXISTS "Admin can update global syntax_patterns" ON public.syntax_patterns;
DROP POLICY IF EXISTS "Admin can delete global syntax_patterns" ON public.syntax_patterns;

CREATE POLICY "Admin can update global syntax_patterns"
  ON public.syntax_patterns
  FOR UPDATE
  TO authenticated
  USING (
    is_global = true
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'co500123@naver.com'
  )
  WITH CHECK (
    is_global = true
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'co500123@naver.com'
  );

CREATE POLICY "Admin can delete global syntax_patterns"
  ON public.syntax_patterns
  FOR DELETE
  TO authenticated
  USING (
    is_global = true
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'co500123@naver.com'
  );
