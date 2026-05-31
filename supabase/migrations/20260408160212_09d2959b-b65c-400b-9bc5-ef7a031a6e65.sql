
-- Create enum for generation status
CREATE TYPE public.generation_status AS ENUM ('pending', 'generating', 'done', 'failed');

-- Create enum for product category
CREATE TYPE public.product_category AS ENUM ('food', 'fashion', 'beauty', 'wellness', 'home', 'electronics');

-- Create enum for plan status
CREATE TYPE public.plan_status AS ENUM ('free', 'pro', 'enterprise');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_status public.plan_status NOT NULL DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create generations table
CREATE TABLE public.generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_category public.product_category NOT NULL DEFAULT 'food',
  product_description TEXT NOT NULL,
  status public.generation_status NOT NULL DEFAULT 'pending',
  ad_plan JSONB,
  reference_image_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generations" ON public.generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own generations" ON public.generations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own generations" ON public.generations FOR UPDATE USING (auth.uid() = user_id);

-- Create generation_frames table
CREATE TABLE public.generation_frames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  frame_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  text_overlay TEXT,
  voiceover_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generation_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view frames of their own generations" ON public.generation_frames FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.generations WHERE generations.id = generation_frames.generation_id AND generations.user_id = auth.uid()));
CREATE POLICY "Users can insert frames for their own generations" ON public.generation_frames FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.generations WHERE generations.id = generation_frames.generation_id AND generations.user_id = auth.uid()));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_generations_updated_at BEFORE UPDATE ON public.generations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for carousel images
INSERT INTO storage.buckets (id, name, public) VALUES ('carousel-images', 'carousel-images', false);

CREATE POLICY "Users can view their own carousel images" ON storage.objects FOR SELECT
  USING (bucket_id = 'carousel-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload their own carousel images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'carousel-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Service role needs access too (for edge functions uploading)
CREATE POLICY "Service role can manage carousel images" ON storage.objects FOR ALL
  USING (bucket_id = 'carousel-images' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'carousel-images' AND auth.role() = 'service_role');
