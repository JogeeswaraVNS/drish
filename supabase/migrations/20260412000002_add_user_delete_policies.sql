-- Allow users to delete their own generations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'generations' 
    AND policyname = 'Users can delete their own generations'
  ) THEN
    CREATE POLICY "Users can delete their own generations"
    ON public.generations
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allow users to delete their own carousel images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can delete their own carousel images'
  ) THEN
    CREATE POLICY "Users can delete their own carousel images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'carousel-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
