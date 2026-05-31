
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Allow service_role to delete generations (needed by cleanup function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'generations' 
    AND policyname = 'Service role can delete generations'
  ) THEN
    CREATE POLICY "Service role can delete generations"
    ON public.generations
    FOR DELETE
    TO service_role
    USING (true);
  END IF;
END $$;

-- Allow service_role to delete generation_frames
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'generation_frames' 
    AND policyname = 'Service role can delete generation_frames'
  ) THEN
    CREATE POLICY "Service role can delete generation_frames"
    ON public.generation_frames
    FOR DELETE
    TO service_role
    USING (true);
  END IF;
END $$;
