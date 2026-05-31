-- ============================================================
-- COMPLETE SCHEMA — D2C Ad Carousel SaaS
-- Run this on a fresh Supabase project (SQL Editor)
-- ============================================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.generation_status AS ENUM ('pending', 'generating', 'done', 'failed');
CREATE TYPE public.plan_status AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE public.product_category AS ENUM ('food', 'fashion', 'beauty', 'wellness', 'home', 'electronics');

-- 2. TABLES

-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  plan_status public.plan_status NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- generations
CREATE TABLE public.generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_description TEXT NOT NULL,
  product_category public.product_category NOT NULL DEFAULT 'food',
  status public.generation_status NOT NULL DEFAULT 'pending',
  ad_plan JSONB,
  reference_image_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- generation_frames
CREATE TABLE public.generation_frames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  frame_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  text_overlay TEXT,
  voiceover_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.generation_frames ENABLE ROW LEVEL SECURITY;

-- 3. FUNCTIONS

-- Security definer: check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer: check approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_approved FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

-- Timestamp updater
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Auto-assign role on signup (admin for specific email, user for others)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'jogeeswarapuvvala@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    UPDATE public.profiles SET is_approved = true WHERE user_id = NEW.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

-- 4. TRIGGERS

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_generations_updated_at
  BEFORE UPDATE ON public.generations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. SEED ADMIN USER
-- Insert a profile + admin role for the admin email.
-- This ensures admin RLS policies work immediately.
-- NOTE: You must first sign up with jogeeswarapuvvala@gmail.com via the Auth UI
-- or create the user via Supabase Dashboard > Authentication > Users.
-- Once the user exists, the triggers above handle it automatically.
-- The lines below are a fallback if the user already exists in auth.users:
DO $$
DECLARE
  _uid UUID;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'jogeeswarapuvvala@gmail.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, is_approved)
    VALUES (_uid, true)
    ON CONFLICT (user_id) DO UPDATE SET is_approved = true;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

-- 6. RLS POLICIES

-- == profiles ==
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- == user_roles ==
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- == generations ==
CREATE POLICY "Users can view their own generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own generations"
  ON public.generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generations"
  ON public.generations FOR UPDATE
  USING (auth.uid() = user_id);

-- == generation_frames ==
CREATE POLICY "Users can view frames of their own generations"
  ON public.generation_frames FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.generations
    WHERE generations.id = generation_frames.generation_id
      AND generations.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert frames for their own generations"
  ON public.generation_frames FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.generations
    WHERE generations.id = generation_frames.generation_id
      AND generations.user_id = auth.uid()
  ));

-- 7. STORAGE BUCKET

INSERT INTO storage.buckets (id, name, public)
VALUES ('carousel-images', 'carousel-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload carousel images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'carousel-images');

CREATE POLICY "Users can view their own carousel images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'carousel-images');

CREATE POLICY "Service role full access to carousel images"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'carousel-images');

-- 8. REALTIME (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.generations;

-- ============================================================
-- DONE. Sign up with jogeeswarapuvvala@gmail.com to auto-become admin.
-- ============================================================
