import { useEffect, useRef } from 'react';
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
    // Disabled to prevent Socket.io errors on cPanel
    return () => {};
  }, [enabled, onApiKeyFailed, onProviderFallback]);
}

export default useRealtimeNotifications;
