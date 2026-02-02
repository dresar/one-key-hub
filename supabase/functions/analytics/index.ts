import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'weekly';
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    if (period === 'monthly') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    }
    
    startDate.setHours(0, 0, 0, 0);

    // Get logs within date range
    const { data: logs, error } = await supabase
      .from('api_usage_logs')
      .select('created_at, status, tokens_used')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const dailyStats: Record<string, { date: string; total: number; success: number; error: number; tokens: number }> = {};
    
    // Initialize all dates in range
    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyStats[dateKey] = {
        date: dateKey,
        total: 0,
        success: 0,
        error: 0,
        tokens: 0,
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate logs
    for (const log of logs || []) {
      const dateKey = new Date(log.created_at).toISOString().split('T')[0];
      if (dailyStats[dateKey]) {
        dailyStats[dateKey].total++;
        if (log.status === 'success') {
          dailyStats[dateKey].success++;
        } else {
          dailyStats[dateKey].error++;
        }
        dailyStats[dateKey].tokens += log.tokens_used || 0;
      }
    }

    // Convert to array and sort by date
    const data = Object.values(dailyStats).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate totals
    const summary = {
      total_requests: data.reduce((sum, d) => sum + d.total, 0),
      success_requests: data.reduce((sum, d) => sum + d.success, 0),
      error_requests: data.reduce((sum, d) => sum + d.error, 0),
      total_tokens: data.reduce((sum, d) => sum + d.tokens, 0),
      success_rate: 0,
    };
    
    if (summary.total_requests > 0) {
      summary.success_rate = Math.round((summary.success_requests / summary.total_requests) * 100);
    }

    return new Response(
      JSON.stringify({ 
        period,
        data,
        summary,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
