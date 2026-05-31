-- Create an RPC to fetch profiles with emails for admins
CREATE OR REPLACE FUNCTION public.get_admin_profiles()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  is_approved BOOLEAN,
  plan_status public.plan_status,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict role check to protect auth.users access
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    u.email::VARCHAR,
    p.is_approved,
    p.plan_status,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON p.user_id = u.id
  ORDER BY p.created_at DESC;
END;
$$;
