import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
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

    const socket = io('http://localhost:3000');

    // Listen for new logs (errors)
    socket.on('logs:insert', (log: any) => {
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
    });

    // Listen for API key updates
    socket.on('apikeys:update', (data: any) => {
      // We expect data to be the updated key object
      // Or maybe { old: ..., new: ... } if backend supports it.
      // For now, let's assume we receive the UPDATED key.
      const newKey = data;
      // We don't have old key state easily here without tracking it.
      // So we might only show "current status" notifications.
      
      if (newKey.last_error && !newKey.is_active) {
         // Maybe it was just disabled due to error?
         toast.warning('⚠️ API Key Error/Disabled', {
            description: `Key ${newKey.name || '...'} error: ${newKey.last_error}`,
         });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled, onApiKeyFailed, onProviderFallback]);
}

export default useRealtimeNotifications;
