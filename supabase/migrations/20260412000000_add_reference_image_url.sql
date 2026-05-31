-- Add reference_image_url to generations table if it doesn't already exist
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS reference_image_url TEXT;
