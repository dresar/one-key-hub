import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Link2, Plus, Copy, Check, Loader2, Activity, Server, KeyRound,
  PlayCircle, AlertCircle, MessageSquare, Clock, Trash2,
  RefreshCw, Zap, RotateCcw, ChevronRight, Shield
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api, { API_BASE } from '@/services/api';
import { toast } from 'sonner';

const AI_PROVIDERS = [
  { value: 'gemini', label: 'Gemini', endpoint: '/gateway/gemini/chat' },
  { value: 'openclaw', label: 'OpenClaw', endpoint: '/gateway/openclaw/chat' },
  { value: 'groq', label: 'Groq', endpoint: '/gateway/groq/chat' },
  { value: 'openai', label: 'OpenAI', endpoint: '/gateway/openai/chat' },
  { value: 'anthropic', label: 'Anthropic', endpoint: '/gateway/anthropic/chat' },
  { value: 'mistral', label: 'Mistral', endpoint: '/gateway/mistral/chat' },
  { value: 'cohere', label: 'Cohere', endpoint: '/gateway/cohere/chat' },
  { value: 'together', label: 'Together AI', endpoint: '/gateway/together/chat' },
  { value: 'perplexity', label: 'Perplexity', endpoint: '/gateway/perplexity/chat' },
];

interface GatewayKey {
  id: string;
  name?: string;
  status: string;
  quota_per_minute?: number;
  allowed_providers?: string[];
  created_at: string;
}

interface AiModel {
  id: string;
  provider: string;
  model_id: string;
  display_name: string;
  is_default: boolean;
  supports_vision: boolean;
}

interface BootstrapStats {
  totalCredentials: number;
  activeCredentials: number;
  cooldownCredentials: number;
  totalClients: number;
  totalRequests: number;
  recentErrors: number;
}

export default function UnifiedApi() {
  const [keys, setKeys] = useState<GatewayKey[]>([]);
  const [stats, setStats] = useState<BootstrapStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Test modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testKey, setTestKey] = useState<GatewayKey | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<AiModel[]>([]);
  const [testPrompt, setTestPrompt] = useState('Hai! Apakah kamu bisa menjawab pertanyaan ini?');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedProvider && isTestModalOpen) {
      fetchModels(selectedProvider);
    }
  }, [selectedProvider, isTestModalOpen]);

  const fetchData = async () => {
    try {
      const [keysRes, statsRes] = await Promise.all([
        api.get('/api/keys').catch(() => ({ data: [] })),
        api.get('/api/stats').catch(() => ({ data: null })),
      ]);
      setKeys(keysRes.data?.items || keysRes.data || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModels = async (provider: string) => {
    try {
      const { data } = await api.get(`/api/playground/models?provider=${provider}`);
      const modelList = data?.models || data || [];
      setModels(modelList);
      const def = modelList.find((m: AiModel) => m.is_default);
      setSelectedModel(def?.model_id || modelList[0]?.model_id || '');
    } catch {
      setModels([]);
      setSelectedModel('');
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/api/keys', {
        name: keyName || undefined,
      });

      const plaintext = data.plaintext_key || data.key;
      setIsModalOpen(false);
      setKeyName('');

      if (plaintext) {
        await navigator.clipboard.writeText(plaintext).catch(() => {});
        toast.success(`Key dibuat & disalin! Simpan segera: ${plaintext.slice(0, 24)}...`, { duration: 10000 });
      } else {
        toast.success('Gateway Key berhasil dibuat');
      }
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal membuat key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTestModal = (key: GatewayKey) => {
    setTestKey(key);
    setTestResponse(null);
    setTestError(null);
    setSelectedProvider('gemini');
    setIsTestModalOpen(true);
  };

  const handleRunTest = async () => {
    if (!testKey || !selectedModel || !testPrompt.trim()) return;
    setIsTesting(true);
    setTestResponse(null);
    setTestError(null);

    const providerConfig = AI_PROVIDERS.find(p => p.value === selectedProvider);
    const endpoint = providerConfig?.endpoint || '/gateway/gemini/chat';

    try {
      // Use gateway endpoint directly with the key
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': testKey.id, // Gateway uses key ID or raw key
        },
        body: JSON.stringify({
          prompt: testPrompt,
          model_id: selectedModel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTestError(data.error || `Error ${res.status}: ${res.statusText}`);
        return;
      }

      // Gateway playground returns { text, model }
      const text = data.text || data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
      setTestResponse(text);
      toast.success('Test berhasil!');
    } catch (error: any) {
      setTestError(error.message || 'Koneksi gagal');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteKey = async (key: GatewayKey) => {
    if (!confirm(`Hapus key "${key.name || key.id}"?`)) return;
    try {
      await api.delete(`/api/keys/${key.id}`);
      toast.success('Key berhasil dihapus');
      fetchData();
    } catch {
      toast.error('Gagal menghapus key');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    toast.success('Disalin ke clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getGatewayUrl = (prov: string) => `${API_BASE}/gateway/${prov}/chat`;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const diff = Date.now() - new Date(dateString).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Baru saja';
    if (m < 60) return `${m} menit lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen">
      <AppHeader title="Unified Gateway" subtitle="Satu key untuk semua provider AI" />

      <div className="p-4 md:p-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Credential Aktif', value: stats.activeCredentials, icon: Shield, color: 'text-primary' },
              { label: 'Total Credential', value: stats.totalCredentials, icon: Server, color: 'text-accent' },
              { label: 'Total Request', value: stats.totalRequests, icon: Activity, color: 'text-success' },
              { label: 'Error 24h', value: stats.recentErrors, icon: AlertCircle, color: 'text-destructive' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.value ?? 0}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Rotation Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-5"
        >
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" />
            Unified Rotation AI
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">Cara Kerja Rotasi:</p>
              <ul className="space-y-1 text-xs">
                <li>• Gateway otomatis memilih credential aktif terbaru</li>
                <li>• Jika credential rate-limited → masuk cooldown otomatis</li>
                <li>• Circuit breaker mencegah cascade failure</li>
                <li>• Credential direaktivasi otomatis setelah cooldown</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Endpoint Gateway:</p>
              <div className="space-y-1">
                {AI_PROVIDERS.slice(0, 5).map(p => (
                  <div key={p.value} className="flex items-center gap-2">
                    <code className="text-xs bg-secondary/50 px-2 py-0.5 rounded font-mono flex-1 truncate">
                      POST /gateway/{p.value}/chat
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6"
                      onClick={() => copyToClipboard(getGatewayUrl(p.value), `ep-${p.value}`)}
                    >
                      {copiedId === `ep-${p.value}`
                        ? <Check className="w-3 h-3 text-success" />
                        : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">+{AI_PROVIDERS.length - 5} provider lainnya...</p>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-secondary/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Contoh Request (OpenClaw):</p>
            <pre className="text-xs font-mono overflow-x-auto text-foreground/80">
{`curl -X POST ${API_BASE}/gateway/openclaw/chat \\
  -H "X-API-Key: eka_<tenant>_<secret>" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Halo!", "model_id": "openclaw-1"}'`}
            </pre>
          </div>
        </motion.div>

        {/* Gateway Keys */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Gateway Keys ({keys.length})
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
          ) : keys.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="Belum ada Gateway Key"
              description="Generate key untuk akses semua provider via unified endpoint."
              action={
                <Button onClick={() => setIsModalOpen(true)} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Key Pertama
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {keys.map((key, index) => (
                <motion.div
                  key={key.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-4 md:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-secondary/20 transition-colors"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{key.name || 'Unnamed Key'}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
                        key.status === 'active' ? 'status-active' : 'status-inactive'
                      }`}>
                        {key.status}
                      </span>
                      {key.quota_per_minute && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {key.quota_per_minute}/min
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">ID: {key.id.slice(0, 12)}...</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(key.created_at)}
                      </span>
                      {key.allowed_providers && key.allowed_providers.length > 0 && (
                        <span>{key.allowed_providers.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openTestModal(key)} title="Test Key">
                      <MessageSquare className="w-4 h-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(key.id, key.id)} title="Salin ID">
                      {copiedId === key.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteKey(key)} title="Hapus">
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
            <DialogTitle>Generate Gateway Key Baru</DialogTitle>
            <DialogDescription>
              Key akan ditampilkan SEKALI saja setelah dibuat. Simpan dengan aman!
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerateKey} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Key (opsional)</Label>
              <Input
                placeholder="contoh: Production, OpenClaw Test"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : 'Generate Key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Test Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Gateway — {testKey?.name || 'Key'}</DialogTitle>
            <DialogDescription>Uji coba langsung ke provider AI via gateway</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel} disabled={models.length === 0}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder={models.length === 0 ? 'Tidak ada model — tambahkan di Models' : 'Pilih model'} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(m => (
                      <SelectItem key={m.model_id} value={m.model_id}>
                        {m.display_name || m.model_id}
                        {m.is_default && ' ⭐'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                className="min-h-[100px] bg-secondary/50"
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

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsTestModalOpen(false)}>Tutup</Button>
            <Button
              onClick={handleRunTest}
              disabled={isTesting || !selectedModel || !testPrompt.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {isTesting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</>
                : <><PlayCircle className="w-4 h-4 mr-2" />Test Sekarang</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
