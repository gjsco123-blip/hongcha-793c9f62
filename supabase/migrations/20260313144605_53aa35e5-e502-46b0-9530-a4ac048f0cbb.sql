ALTER TABLE public.passages ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Initialize sort_order based on created_at order, per school
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY school_id ORDER BY created_at) AS rn
  FROM public.passages
)
UPDATE public.passages p SET sort_order = r.rn FROM ranked r WHERE p.id = r.id;