CREATE TABLE public.ai_generated_contexts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  context_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generated_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contexts of their workspaces"
  ON public.ai_generated_contexts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = ai_generated_contexts.workspace_id
      AND workspaces.user_id = auth.uid()
  ));
