CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  product_description TEXT,
  product_category public.product_category,
  reference_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workspaces"
  ON public.workspaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workspaces"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workspaces"
  ON public.workspaces FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.generations ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.generations ADD COLUMN week_number INTEGER;
ALTER TABLE public.generations ADD COLUMN generation_type TEXT DEFAULT 'carousel';

-------------------------------------------------------------