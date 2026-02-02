import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationConfig {
  enabled?: boolean;
  onApiKeyFailed?: (keyId: string, error: string) => void;
  onProviderFallback?: (fromProvider: string, toProvider: string) => void;
}

export function useRealtimeNotifications(config: NotificationConfig = {}) {
  const { enabled = true, onApiKeyFailed, onProviderFallback } = config;
  const lastLogIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Subscribe to api_usage_logs for error notifications
    const logsChannel = supabase
      .channel('realtime-notifications-logs')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'api_usage_logs'
        },
        (payload) => {
          const log = payload.new as any;
          
          // Skip if we've already processed this
          if (log.id === lastLogIdRef.current) return;
          lastLogIdRef.current = log.id;

          // Show notification for errors
          if (log.status === 'error') {
            const errorMsg = log.error_message || 'Unknown error';
            
            if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota')) {
              toast.warning('⚠️ API Key Quota Habis', {
                description: `Model: ${log.model_name || 'Unknown'} - Beralih ke key berikutnya`,
                duration: 5000,
              });
            } else if (errorMsg.includes('401')) {
              toast.error('🔴 API Key Invalid', {
                description: `Key tidak valid atau sudah expired`,
                duration: 5000,
              });
            } else {
              toast.error('❌ Request Gagal', {
                description: errorMsg.slice(0, 100),
                duration: 4000,
              });
            }
            
            onApiKeyFailed?.(log.provider_key_id, errorMsg);
          }
        }
      )
      .subscribe();

    // Subscribe to provider_api_keys for status changes
    const keysChannel = supabase
      .channel('realtime-notifications-keys')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'provider_api_keys'
        },
        (payload) => {
          const oldData = payload.old as any;
          const newData = payload.new as any;
          
          // Check if key just got an error
          if (!oldData.last_error && newData.last_error) {
            toast.warning('⚠️ API Key Error', {
              description: `Key mengalami error: ${newData.last_error.slice(0, 80)}`,
              duration: 4000,
            });
          }
          
          // Check if key was deactivated
          if (oldData.is_active && !newData.is_active) {
            toast.info('ℹ️ API Key Dinonaktifkan', {
              description: `Sebuah API key telah dinonaktifkan`,
              duration: 3000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(keysChannel);
    };
  }, [enabled, onApiKeyFailed, onProviderFallback]);
}

export default useRealtimeNotifications;
