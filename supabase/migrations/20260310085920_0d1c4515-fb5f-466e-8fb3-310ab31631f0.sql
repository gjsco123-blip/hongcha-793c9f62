
CREATE TABLE public.learning_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('hongt', 'syntax')),
  preset text,
  sentence text NOT NULL,
  ai_draft text NOT NULL,
  final_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own learning_examples"
  ON public.learning_examples
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_learning_examples_user_type ON public.learning_examples (user_id, type, created_at DESC);
