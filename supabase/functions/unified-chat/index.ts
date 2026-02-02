import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Provider {
  id: string;
  name: string;
  base_url: string;
  is_active: boolean;
  priority: number;
}

interface ProviderApiKey {
  id: string;
  provider_id: string;
  api_key: string;
  is_active: boolean;
  priority: number;
  failed_requests: number;
}

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const unifiedApiKey = authHeader.replace('Bearer ', '');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify unified API key
    const { data: unifiedKey, error: keyError } = await supabase
      .from('unified_api_keys')
      .select('id, is_active')
      .eq('api_key', unifiedApiKey)
      .single();

    if (keyError || !unifiedKey || !unifiedKey.is_active) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ChatRequest = await req.json();
    const requestedModel = body.model || 'gemini-2.5-flash';

    // Get rotation settings
    const { data: settings } = await supabase
      .from('rotation_settings')
      .select('strategy, fallback_enabled')
      .single();

    const strategy = settings?.strategy || 'per_provider';
    const fallbackEnabled = settings?.fallback_enabled ?? true;

    // Get active providers ordered by priority
    const { data: providers, error: providerError } = await supabase
      .from('providers')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (providerError || !providers || providers.length === 0) {
      await logRequest(supabase, unifiedKey.id, null, null, requestedModel, 'error', 500, 'No active providers available', Date.now() - startTime);
      return new Response(
        JSON.stringify({ error: 'No active providers available' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all active API keys, sorted by priority (highest first), then by failed_requests (lowest first)
    const { data: allApiKeys, error: apiKeysError } = await supabase
      .from('provider_api_keys')
      .select('id, provider_id, api_key, is_active, priority, failed_requests')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (apiKeysError || !allApiKeys || allApiKeys.length === 0) {
      await logRequest(supabase, unifiedKey.id, null, null, requestedModel, 'error', 500, 'No active API keys available', Date.now() - startTime);
      return new Response(
        JSON.stringify({ error: 'No active API keys available' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build rotation queue based on strategy
    // Keys with errors are pushed to the end (lower priority)
    let rotationQueue: { provider: Provider; apiKey: ProviderApiKey }[] = [];

    if (strategy === 'per_provider') {
      // Try all keys within each provider before moving to next provider
      for (const provider of providers) {
        const providerKeys = allApiKeys
          .filter((k: ProviderApiKey) => k.provider_id === provider.id)
          // Sort: healthy keys first (no failed requests), then by priority
          .sort((a, b) => {
            // Keys with failed_requests > 5 go to the end
            const aHasErrors = a.failed_requests > 5;
            const bHasErrors = b.failed_requests > 5;
            if (aHasErrors && !bHasErrors) return 1;
            if (!aHasErrors && bHasErrors) return -1;
            // Then sort by priority (higher first)
            return b.priority - a.priority;
          });
        
        for (const key of providerKeys) {
          rotationQueue.push({ provider, apiKey: key });
        }
      }
    } else {
      // Global strategy: interleave keys from all providers
      // Sort all keys globally
      const sortedKeys = [...allApiKeys].sort((a, b) => {
        const aHasErrors = a.failed_requests > 5;
        const bHasErrors = b.failed_requests > 5;
        if (aHasErrors && !bHasErrors) return 1;
        if (!aHasErrors && bHasErrors) return -1;
        return b.priority - a.priority;
      });
      
      for (const key of sortedKeys) {
        const provider = providers.find(p => p.id === key.provider_id);
        if (provider) {
          rotationQueue.push({ provider, apiKey: key });
        }
      }
    }

    // If fallback is disabled, only use the first provider
    if (!fallbackEnabled) {
      const firstProvider = providers[0];
      rotationQueue = rotationQueue.filter(item => item.provider.id === firstProvider.id);
    }

    // Try each API key in rotation until one succeeds
    let lastError: string = 'No API keys available';
    let lastStatusCode: number = 500;
    let usedProviderName: string | null = null;

    for (const { provider, apiKey } of rotationQueue) {
      try {
        const result = await callProviderApi(provider, apiKey.api_key, body, requestedModel);
        
        if (result.success) {
          // Reset failed_requests on success and update stats
          await supabase
            .from('provider_api_keys')
            .update({ 
              total_requests: apiKey.failed_requests > 0 ? 1 : undefined,
              last_used_at: new Date().toISOString(),
              last_error: null,
              failed_requests: 0, // Reset on success
            })
            .eq('id', apiKey.id);

          // Increment total_requests using raw update
          await supabase.rpc('increment_requests_safe', { key_id: apiKey.id });
          await supabase.rpc('increment_unified_requests_safe', { key_id: unifiedKey.id });

          // Log success
          await logRequest(
            supabase, 
            unifiedKey.id, 
            provider.id, 
            apiKey.id, 
            requestedModel, 
            'success', 
            200, 
            null, 
            Date.now() - startTime,
            result.tokensUsed
          );

          return new Response(
            JSON.stringify(result.data),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          lastError = result.error || 'Unknown error';
          lastStatusCode = result.statusCode || 500;
          usedProviderName = provider.name;
          
          // Determine if this is a quota/rate limit error
          const isQuotaError = lastStatusCode === 429 || 
                              lastError.toLowerCase().includes('quota') ||
                              lastError.toLowerCase().includes('rate limit');
          
          const isAuthError = lastStatusCode === 401 || lastStatusCode === 403;
          
          // Calculate new priority - move failed key to last position
          let newPriority = 0; // Lowest priority
          if (isQuotaError || isAuthError) {
            newPriority = -1; // Even lower for quota/auth errors
          }
          
          // Update failed key: increment failures, move to last priority
          await supabase
            .from('provider_api_keys')
            .update({ 
              failed_requests: apiKey.failed_requests + 1,
              last_error: lastError,
              priority: newPriority, // Demote to last position
            })
            .eq('id', apiKey.id);
          
          // Log the fallback attempt
          await logRequest(
            supabase,
            unifiedKey.id,
            provider.id,
            apiKey.id,
            requestedModel,
            'error',
            lastStatusCode,
            `Fallback: ${lastError}`,
            Date.now() - startTime
          );
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        lastStatusCode = 500;
        
        // Update failed key
        await supabase
          .from('provider_api_keys')
          .update({ 
            failed_requests: apiKey.failed_requests + 1,
            last_error: lastError,
            priority: 0, // Demote
          })
          .eq('id', apiKey.id);
      }
    }

    // All keys failed
    await logRequest(supabase, unifiedKey.id, null, null, requestedModel, 'error', lastStatusCode, lastError, Date.now() - startTime);
    
    return new Response(
      JSON.stringify({ error: lastError }),
      { status: lastStatusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function callProviderApi(
  provider: Provider, 
  apiKey: string, 
  body: ChatRequest,
  model: string
): Promise<{ success: boolean; data?: any; error?: string; statusCode?: number; tokensUsed?: number }> {
  
  const providerName = provider.name.toLowerCase();
  
  try {
    let response: Response;
    let requestBody: any;
    let endpoint: string;
    let headers: Record<string, string>;

    if (providerName.includes('gemini') || providerName.includes('google')) {
      // Google Gemini API
      endpoint = `${provider.base_url}/v1beta/models/${model}:generateContent?key=${apiKey}`;
      headers = {
        'Content-Type': 'application/json',
      };
      requestBody = {
        contents: body.messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.content }]
        })),
        generationConfig: {
          temperature: body.temperature || 0.7,
          maxOutputTokens: body.max_tokens || 2048,
        }
      };
    } else if (providerName.includes('groq')) {
      // Groq API (OpenAI-compatible)
      endpoint = `${provider.base_url}/openai/v1/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      requestBody = {
        model: model,
        messages: body.messages,
        temperature: body.temperature || 0.7,
        max_tokens: body.max_tokens || 2048,
      };
    } else {
      // Default: OpenAI-compatible API
      endpoint = `${provider.base_url}/v1/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      requestBody = {
        model: model,
        messages: body.messages,
        temperature: body.temperature || 0.7,
        max_tokens: body.max_tokens || 2048,
      };
    }

    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        error: `Provider error: ${response.status} - ${errorText}`,
        statusCode: response.status 
      };
    }

    const data = await response.json();

    // Normalize response to OpenAI format
    let normalizedResponse: any;
    let tokensUsed: number | undefined;

    if (providerName.includes('gemini') || providerName.includes('google')) {
      // Convert Gemini response to OpenAI format
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      tokensUsed = data.usageMetadata?.totalTokenCount;
      normalizedResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: content,
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: tokensUsed || 0,
        },
      };
    } else {
      normalizedResponse = data;
      tokensUsed = data.usage?.total_tokens;
    }

    return { success: true, data: normalizedResponse, tokensUsed };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500 
    };
  }
}

async function logRequest(
  supabase: any,
  unifiedKeyId: string,
  providerId: string | null,
  providerKeyId: string | null,
  modelName: string,
  status: string,
  statusCode: number,
  errorMessage: string | null,
  responseTimeMs: number,
  tokensUsed?: number
) {
  try {
    await supabase.from('api_usage_logs').insert({
      unified_key_id: unifiedKeyId,
      provider_id: providerId,
      provider_key_id: providerKeyId,
      model_name: modelName,
      request_path: '/api/unified/chat',
      status,
      status_code: statusCode,
      error_message: errorMessage,
      response_time_ms: responseTimeMs,
      tokens_used: tokensUsed,
    });
  } catch (error) {
    console.error('Error logging request:', error);
  }
}