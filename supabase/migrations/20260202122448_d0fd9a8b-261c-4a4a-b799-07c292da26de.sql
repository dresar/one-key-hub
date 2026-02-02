-- Create admin users table for authentication
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create providers table
CREATE TABLE public.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    priority INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create provider models table
CREATE TABLE public.provider_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    model_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create provider API keys table
CREATE TABLE public.provider_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE NOT NULL,
    model_id UUID REFERENCES public.provider_models(id) ON DELETE SET NULL,
    api_key TEXT NOT NULL,
    name TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    priority INTEGER DEFAULT 0 NOT NULL,
    total_requests INTEGER DEFAULT 0 NOT NULL,
    failed_requests INTEGER DEFAULT 0 NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create unified API keys table
CREATE TABLE public.unified_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key TEXT UNIQUE NOT NULL,
    name TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    total_requests INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create API usage logs table
CREATE TABLE public.api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unified_key_id UUID REFERENCES public.unified_api_keys(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
    provider_key_id UUID REFERENCES public.provider_api_keys(id) ON DELETE SET NULL,
    model_name TEXT,
    request_path TEXT,
    status TEXT NOT NULL,
    status_code INTEGER,
    error_message TEXT,
    response_time_ms INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create rotation settings table
CREATE TABLE public.rotation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy TEXT DEFAULT 'per_provider' NOT NULL CHECK (strategy IN ('per_provider', 'global')),
    fallback_enabled BOOLEAN DEFAULT true NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotation_settings ENABLE ROW LEVEL SECURITY;

-- Create policies - since this is personal/private, we'll use service role for backend operations
-- For frontend, we'll authenticate via custom session and allow access to authenticated users

-- Users table - allow read for login verification
CREATE POLICY "Allow read users for auth" ON public.users FOR SELECT USING (true);

-- Providers - full access (personal use)
CREATE POLICY "Allow all providers" ON public.providers FOR ALL USING (true) WITH CHECK (true);

-- Provider models - full access
CREATE POLICY "Allow all provider_models" ON public.provider_models FOR ALL USING (true) WITH CHECK (true);

-- Provider API keys - full access
CREATE POLICY "Allow all provider_api_keys" ON public.provider_api_keys FOR ALL USING (true) WITH CHECK (true);

-- Unified API keys - full access
CREATE POLICY "Allow all unified_api_keys" ON public.unified_api_keys FOR ALL USING (true) WITH CHECK (true);

-- API usage logs - full access
CREATE POLICY "Allow all api_usage_logs" ON public.api_usage_logs FOR ALL USING (true) WITH CHECK (true);

-- Rotation settings - full access
CREATE POLICY "Allow all rotation_settings" ON public.rotation_settings FOR ALL USING (true) WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for auto-updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_provider_api_keys_updated_at BEFORE UPDATE ON public.provider_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_unified_api_keys_updated_at BEFORE UPDATE ON public.unified_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rotation_settings_updated_at BEFORE UPDATE ON public.rotation_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_usage_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.providers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_api_keys;
ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_api_keys;

-- Insert default admin user (password: admin, hashed with bcrypt)
-- Note: We'll use a simple hash for demo, in production use proper bcrypt
INSERT INTO public.users (username, password_hash) VALUES ('admin', '$2a$10$rQEY9CTH.lQZYEQFLX9U2eZ7FqfO6xK5J5c5NRvTvGjMhT9W5gCYS');

-- Insert default rotation settings
INSERT INTO public.rotation_settings (strategy, fallback_enabled) VALUES ('per_provider', true);