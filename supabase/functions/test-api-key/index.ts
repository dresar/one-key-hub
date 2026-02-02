import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  api_key_id: string;
  provider_id: string;
  model_id?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TestRequest = await req.json();
    const { api_key_id, provider_id, model_id } = body;

    if (!api_key_id || !provider_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing api_key_id or provider_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the API key
    const { data: apiKey, error: keyError } = await supabase
      .from('provider_api_keys')
      .select('api_key')
      .eq('id', api_key_id)
      .single();

    if (keyError || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the provider
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('name, base_url')
      .eq('id', provider_id)
      .single();

    if (providerError || !provider) {
      return new Response(
        JSON.stringify({ success: false, error: 'Provider not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test the API key
    const startTime = Date.now();
    const testModel = model_id || 'gemini-2.5-flash';
    const providerName = provider.name.toLowerCase();
    
    let response: Response;
    let endpoint: string;
    let headers: Record<string, string>;
    let requestBody: any;

    const testMessage = { role: 'user', content: 'Say "Hello, I am working!" in 5 words or less.' };

    if (providerName.includes('gemini') || providerName.includes('google')) {
      endpoint = `${provider.base_url}/v1beta/models/${testModel}:generateContent?key=${apiKey.api_key}`;
      headers = { 'Content-Type': 'application/json' };
      requestBody = {
        contents: [{ role: 'user', parts: [{ text: testMessage.content }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 50 }
      };
    } else if (providerName.includes('groq')) {
      endpoint = `${provider.base_url}/openai/v1/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.api_key}`,
      };
      requestBody = {
        model: testModel,
        messages: [testMessage],
        temperature: 0.1,
        max_tokens: 50,
      };
    } else {
      endpoint = `${provider.base_url}/v1/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.api_key}`,
      };
      requestBody = {
        model: testModel,
        messages: [testMessage],
        temperature: 0.1,
        max_tokens: 50,
      };
    }

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseTime = Date.now() - startTime;
      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.error?.message || 
                            responseData.message || 
                            `HTTP ${response.status}`;
        
        // Determine error type
        let status = 'error';
        if (response.status === 401) status = 'invalid';
        else if (response.status === 429) status = 'quota_exceeded';
        else if (response.status >= 500) status = 'provider_error';

        // Update API key with error
        await supabase
          .from('provider_api_keys')
          .update({ 
            last_error: errorMessage,
          })
          .eq('id', api_key_id);

        // Log the test
        await supabase.from('api_usage_logs').insert({
          provider_id,
          provider_key_id: api_key_id,
          model_name: testModel,
          request_path: '/api/test-key',
          status: 'error',
          status_code: response.status,
          error_message: errorMessage,
          response_time_ms: responseTime,
        });

        return new Response(
          JSON.stringify({ 
            success: false, 
            status,
            error: errorMessage,
            status_code: response.status,
            response_time_ms: responseTime
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Success - clear last error
      await supabase
        .from('provider_api_keys')
        .update({ 
          last_error: null,
          last_used_at: new Date().toISOString()
        })
        .eq('id', api_key_id);

      // Log the successful test
      await supabase.from('api_usage_logs').insert({
        provider_id,
        provider_key_id: api_key_id,
        model_name: testModel,
        request_path: '/api/test-key',
        status: 'success',
        status_code: 200,
        response_time_ms: responseTime,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'active',
          message: 'API key berfungsi dengan baik',
          response_time_ms: responseTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Network error';
      
      // Log the failed test
      await supabase.from('api_usage_logs').insert({
        provider_id,
        provider_key_id: api_key_id,
        model_name: testModel,
        request_path: '/api/test-key',
        status: 'error',
        status_code: 500,
        error_message: errorMessage,
        response_time_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'network_error',
          error: errorMessage 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
