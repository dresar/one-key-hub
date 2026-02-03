import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, Plus, Copy, Check, Loader2, Activity, Server, KeyRound, PlayCircle, AlertCircle, MessageSquare, Clock, Trash2 } from 'lucide-react';
import { io } from 'socket.io-client';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api, { API_URL, SOCKET_URL } from '@/services/api';
import axios from 'axios';
import { toast } from 'sonner';

interface UnifiedKey {
  id: string;
  api_key: string;
  name: string | null;
  is_active: boolean;
  total_requests: number;
  failed_requests: number;
  last_used_at: string | null;
  created_at: string;
}

interface UsageStats {
  totalProviders: number;
  totalActiveKeys: number;
  totalRequests: number;
}

interface Provider {
  id: string;
  name: string;
}

interface ProviderModel {
  id: string;
  name: string;
  model_id: string;
}

export default function UnifiedApi() {
  const [unifiedKeys, setUnifiedKeys] = useState<UnifiedKey[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    totalProviders: 0,
    totalActiveKeys: 0,
    totalRequests: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyName, setKeyName] = useState('');

  // Test Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testKey, setTestKey] = useState<UnifiedKey | null>(null);
  const [testProviders, setTestProviders] = useState<Provider[]>([]);
  const [testModels, setTestModels] = useState<ProviderModel[]>([]);
  const [selectedTestProviderId, setSelectedTestProviderId] = useState<string>('');
  const [selectedTestModelId, setSelectedTestModelId] = useState<string>('');
  const [testPrompt, setTestPrompt] = useState('Hello, tell me a joke.');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    const socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
      console.log('Connected to socket server for unified keys');
    });

    socket.on('unified-keys:update', () => fetchData());
    
    // Also listen for provider updates to update stats
    socket.on('providers:update', () => fetchData());

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch unified keys
      const keysResponse = await api.get('/unified/keys');
      setUnifiedKeys(keysResponse.data || []);

      // Fetch usage stats
      const statsResponse = await api.get('/unified/stats');
      setUsageStats(statsResponse.data);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await api.post('/unified/keys', {
        name: keyName || null,
      });

      toast.success('Unified API Key berhasil dibuat');
      setIsModalOpen(false);
      setKeyName('');
      fetchData(); // Refresh list
      
      // Open Test Modal immediately
      openTestModal(response.data);

    } catch (error) {
      console.error('Error generating key:', error);
      toast.error('Gagal membuat API Key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTestModal = async (key: UnifiedKey) => {
    setTestKey(key);
    setTestResponse(null);
    setTestError(null);
    setIsTestModalOpen(true);
    
    // Fetch Providers for testing selection
    try {
        const { data } = await api.get('/providers');
        const activeProviders = (data || []).filter((p: any) => p.is_active);
        setTestProviders(activeProviders);
        
        // Auto select first provider if available
        if (activeProviders.length > 0) {
            setSelectedTestProviderId(activeProviders[0].id);
        }
    } catch (e) {
        console.error("Failed to fetch providers for test", e);
    }
  };

  // Fetch models when provider changes
  useEffect(() => {
    if (selectedTestProviderId && isTestModalOpen) {
        const fetchModels = async () => {
            try {
                const { data } = await api.get(`/providers/${selectedTestProviderId}/models`);
                setTestModels(data || []);
                if (data && data.length > 0) {
                    setSelectedTestModelId(data[0].model_id);
                } else {
                    setSelectedTestModelId('');
                }
            } catch (e) {
                console.error("Failed to fetch models", e);
            }
        };
        fetchModels();
    }
  }, [selectedTestProviderId, isTestModalOpen]);

  const handleRunTest = async () => {
    if (!testKey || !selectedTestModelId || !testPrompt.trim()) return;

    setIsTesting(true);
    setTestResponse(null);
    setTestError(null);

    try {
        // Use direct axios call to avoid auth interceptor (we use the unified key)
        const response = await axios.post(`${API_URL}/v1/chat/completions`, {
            model: selectedTestModelId,
            messages: [{ role: 'user', content: testPrompt }]
        }, {
            headers: {
                'Authorization': `Bearer ${testKey.api_key}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30s timeout
        });

        // Format response
        const content = response.data.choices?.[0]?.message?.content || JSON.stringify(response.data, null, 2);
        setTestResponse(content);
        toast.success('Test berhasil!');

    } catch (error: any) {
        console.error('Test failed:', error);
        let errorMessage = "Terjadi kesalahan saat pengujian.";
        
        if (error.response) {
            // Server responded with error
            const status = error.response.status;
            const data = error.response.data;
            
            if (status === 401 || status === 403) errorMessage = data?.error || "Token tidak valid.";
            else if (status === 429) errorMessage = "Rate limit terlampaui. Coba lagi nanti.";
            else if (status === 503) errorMessage = data?.error || "Layanan atau Model tidak tersedia.";
            else if (status === 502) {
                // Gateway Error (All providers failed)
                errorMessage = data?.error || "Terjadi kesalahan pada semua provider.";
            }
            else if (data && data.error) errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        } else if (error.request) {
            // No response received
            errorMessage = "Tidak ada respon dari server. Periksa koneksi atau provider.";
        } else {
            errorMessage = error.message;
        }

        setTestError(errorMessage);
        toast.error('Test Gagal');
    } finally {
        setIsTesting(false);
    }
  };

  const copyToClipboard = async (key: string, id: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(key);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = key;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(id);
      toast.success('API Key disalin ke clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Gagal menyalin API Key');
    }
  };

  const getEndpointUrl = () => {
    return `${API_URL}/v1/chat/completions`;
  };

  const formatDate = (dateString: string | null) => {
      if (!dateString) return '-';
      const date = new Date(dateString);
      // Simple relative time format
      const diff = Date.now() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      
      if (minutes < 1) return 'Baru saja';
      if (minutes < 60) return `${minutes} menit yang lalu`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} jam yang lalu`;
      
      return date.toLocaleDateString();
  };

  const handleDeleteKey = async (key: UnifiedKey) => {
    if (!window.confirm('Yakin ingin menghapus Unified API Key ini?')) return;
    try {
      await api.delete(`/unified/keys/${key.id}`);
      toast.success('Unified API Key berhasil dihapus');
      fetchData();
    } catch (error) {
      console.error('Error deleting unified key:', error);
      toast.error('Gagal menghapus Unified API Key');
    }
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm">{key.api_key}</code>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
                        key.is_active ? 'status-active' : 'status-inactive'
                      }`}>
                        {key.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {key.name && <span className="font-medium text-foreground">{key.name}</span>}
                      
                      <span className="flex items-center gap-1.5" title="Total Request">
                        <Activity className="w-3.5 h-3.5" />
                        {key.total_requests}
                      </span>

                      <span className="flex items-center gap-1.5 text-destructive" title="Gagal">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {key.failed_requests || 0}
                      </span>

                      <span className="flex items-center gap-1.5" title="Terakhir Digunakan">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(key.last_used_at)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openTestModal(key)}
                        title="Test Key"
                    >
                        <MessageSquare className="w-4 h-4 text-primary" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(key.api_key, key.id)}
                        title="Salin Key"
                    >
                        {copiedId === key.id ? (
                        <Check className="w-4 h-4 text-success" />
                        ) : (
                        <Copy className="w-4 h-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKey(key)}
                        title="Hapus Key"
                    >
                        <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
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

      {/* Test Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Unified API Key</DialogTitle>
            <DialogDescription>
              Uji coba API Key langsung dengan memilih provider dan model.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={selectedTestProviderId} onValueChange={setSelectedTestProviderId}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Pilih Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {testProviders.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={selectedTestModelId} onValueChange={setSelectedTestModelId} disabled={!selectedTestProviderId}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder={testModels.length === 0 ? "Tidak ada model" : "Pilih Model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {testModels.map(m => (
                      <SelectItem key={m.model_id} value={m.model_id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
                <Label>Prompt Test</Label>
                <Textarea 
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Masukkan pesan untuk ditest..."
                    className="min-h-[100px] bg-secondary/50 font-mono text-sm"
                />
            </div>

            {testError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{testError}</span>
                </div>
            )}

            {testResponse && (
                <div className="space-y-2">
                    <Label>Response</Label>
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border max-h-[200px] overflow-y-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap">{testResponse}</pre>
                    </div>
                </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsTestModalOpen(false)}>
              Tutup
            </Button>
            <Button 
                onClick={handleRunTest} 
                disabled={isTesting || !selectedTestModelId || !testPrompt.trim()} 
                className="bg-primary hover:bg-primary/90"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Test API Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
