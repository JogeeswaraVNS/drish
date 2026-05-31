ALTER TABLE public.profiles ADD COLUMN remaining_generations INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.check_and_decrement_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_limit INT;
BEGIN
  SELECT remaining_generations INTO current_limit FROM public.profiles WHERE user_id = NEW.user_id;
  IF current_limit <= 0 THEN
    RAISE EXCEPTION 'No generations remaining - please contact admin.';
  END IF;
  UPDATE public.profiles SET remaining_generations = remaining_generations - 1 WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_generation_limit
BEFORE INSERT ON public.generations
FOR EACH ROW EXECUTE FUNCTION public.check_and_decrement_limit();

CREATE OR REPLACE FUNCTION public.admin_add_generations(target_user_id UUID, amount INT)
RETURNS VOID AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.profiles SET remaining_generations = remaining_generations + amount WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.get_admin_profiles() CASCADE;

CREATE OR REPLACE FUNCTION public.get_admin_profiles()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  is_approved BOOLEAN,
  plan_status public.plan_status,
  created_at TIMESTAMPTZ,
  remaining_generations INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    u.email::VARCHAR,
    p.is_approved,
    p.plan_status,
    p.created_at,
    p.remaining_generations
  FROM public.profiles p
  JOIN auth.users u ON p.user_id = u.id
  ORDER BY p.created_at DESC;
END;
$$;
