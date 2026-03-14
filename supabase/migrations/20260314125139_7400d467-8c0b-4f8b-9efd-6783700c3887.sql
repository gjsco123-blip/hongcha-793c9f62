
CREATE TABLE public.syntax_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL,
  example_sentence text,
  pinned_content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.syntax_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own syntax_patterns"
  ON public.syntax_patterns
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
