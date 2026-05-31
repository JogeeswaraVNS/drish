-- Add new columns to generations table for multi-step pipeline
ALTER TABLE public.generations 
  ADD COLUMN IF NOT EXISTS aspect_ratio text,
  ADD COLUMN IF NOT EXISTS current_step text NOT NULL DEFAULT 'context_pending';

-- Add service role policy for generations so edge functions can update
CREATE POLICY "Service role can do everything on generations"
  ON public.generations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add service role policy for generation_frames
CREATE POLICY "Service role can do everything on generation_frames"
  ON public.generation_frames
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);