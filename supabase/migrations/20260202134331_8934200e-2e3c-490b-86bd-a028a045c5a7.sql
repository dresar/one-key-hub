-- Create safe increment functions for API key usage tracking

-- Increment total_requests for provider_api_keys
CREATE OR REPLACE FUNCTION public.increment_requests_safe(key_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE provider_api_keys
  SET total_requests = total_requests + 1,
      last_used_at = now()
  WHERE id = key_id;
END;
$$;

-- Increment total_requests for unified_api_keys
CREATE OR REPLACE FUNCTION public.increment_unified_requests_safe(key_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE unified_api_keys
  SET total_requests = total_requests + 1
  WHERE id = key_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_requests_safe(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_unified_requests_safe(UUID) TO anon, authenticated, service_role;