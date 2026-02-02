import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, Plus, Copy, Check, Loader2, Activity, Server, KeyRound } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UnifiedKey {
  id: string;
  api_key: string;
  name: string | null;
  is_active: boolean;
  total_requests: number;
  created_at: string;
}

interface UsageStats {
  totalProviders: number;
  totalActiveKeys: number;
  totalRequests: number;
}

export default function UnifiedApi() {
  const [unifiedKeys, setUnifiedKeys] = useState<UnifiedKey[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    totalProviders: 0,
    totalActiveKeys: 0,
    totalRequests: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('unified-keys-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unified_api_keys' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch unified keys
      const { data: keys, error: keysError } = await supabase
        .from('unified_api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (keysError) throw keysError;
      setUnifiedKeys(keys || []);

      // Fetch usage stats
      const { count: providersCount } = await supabase
        .from('providers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: activeKeysCount } = await supabase
        .from('provider_api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const totalRequests = (keys || []).reduce((sum, key) => sum + key.total_requests, 0);

      setUsageStats({
        totalProviders: providersCount || 0,
        totalActiveKeys: activeKeysCount || 0,
        totalRequests,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'ok_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const newKey = generateKey();
      const { error } = await supabase
        .from('unified_api_keys')
        .insert({
          api_key: newKey,
          name: keyName || null,
        });

      if (error) throw error;
      toast.success('Unified API Key berhasil dibuat');
      setIsModalOpen(false);
      setKeyName('');
    } catch (error) {
      console.error('Error generating key:', error);
      toast.error('Gagal membuat API Key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (key: string, id: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(id);
      toast.success('API Key disalin ke clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Gagal menyalin API Key');
    }
  };

  const getEndpointUrl = () => {
    return `${window.location.origin}/api/unified/chat`;
  };

  return (
    <div className="min-h-screen">
      <AppHeader title="Unified API" subtitle="Gateway API tunggal untuk semua provider" />
      
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Provider Aktif</p>
                <p className="text-2xl font-bold">{usageStats.totalProviders}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">API Key Tersedia</p>
                <p className="text-2xl font-bold">{usageStats.totalActiveKeys}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Request</p>
                <p className="text-2xl font-bold">{usageStats.totalRequests}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Endpoint Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-6"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Endpoint API
          </h3>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-sm">Chat Completions (OpenAI-style)</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-secondary/50 px-4 py-2 rounded-lg font-mono text-sm">
                  POST {getEndpointUrl()}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(getEndpointUrl(), 'endpoint')}
                >
                  {copiedId === 'endpoint' ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-secondary/30 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Contoh Request:</p>
              <pre className="text-xs font-mono overflow-x-auto">
{`curl -X POST ${getEndpointUrl()} \\
  -H "Authorization: Bearer YOUR_UNIFIED_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}
              </pre>
            </div>
          </div>
        </motion.div>

        {/* Unified Keys */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Unified API Keys
            </h2>
            <Button onClick={() => setIsModalOpen(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Generate Key
            </Button>
          </div>

          {isLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : unifiedKeys.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="Belum ada Unified API Key"
              description="Generate API key untuk mulai menggunakan unified gateway. Satu key untuk semua provider!"
              action={
                <Button onClick={() => setIsModalOpen(true)} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Key Pertama
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {unifiedKeys.map((key, index) => (
                <motion.div
                  key={key.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-6 py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm">{key.api_key}</code>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
                        key.is_active ? 'status-active' : 'status-inactive'
                      }`}>
                        {key.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {key.name && <span>{key.name}</span>}
                      <span>{key.total_requests} request</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(key.api_key, key.id)}
                  >
                    {copiedId === key.id ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Generate Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Generate Unified API Key</DialogTitle>
            <DialogDescription>
              Buat API key baru untuk mengakses semua provider melalui satu endpoint.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleGenerateKey} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama (opsional)</Label>
              <Input
                id="name"
                placeholder="contoh: Production, Testing"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="bg-secondary/50"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Key'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
