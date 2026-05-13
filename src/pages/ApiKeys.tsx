import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound, Plus, Edit2, Trash2, Loader2, Copy, Check,
  RefreshCw, Shield, Activity, ChevronDown, RotateCcw,
  Zap, Star, Clock
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/services/api';
import { toast } from 'sonner';

const AI_PROVIDERS = [
  'gemini', 'openclaw', 'groq', 'openai', 'anthropic',
  'mistral', 'cohere', 'together', 'perplexity',
  'huggingface', 'cloudinary', 'imagekit', 'apify',
  'newsapi', 'openweather', 'alphavantage',
];

interface GatewayKey {
  id: string;
  name?: string;
  tenant_id: string;
  status: 'active' | 'inactive' | 'suspended';
  quota_per_minute?: number;
  allowed_providers?: string[];
  client_username?: string;
  created_at: string;
  health?: {
    last_latency_ms?: number;
    last_status?: number;
    checked_at?: string;
  } | null;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<GatewayKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<GatewayKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    quota_per_minute: 60,
    allowed_providers: [] as string[],
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const { data } = await api.get('/api/keys');
      setKeys(data?.items || data || []);
    } catch (error) {
      console.error('Error fetching gateway keys:', error);
      toast.error('Gagal memuat Gateway API Keys');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedKey(null);
    setFormData({ name: '', quota_per_minute: 60, allowed_providers: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (key: GatewayKey) => {
    setSelectedKey(key);
    setFormData({
      name: key.name || '',
      quota_per_minute: key.quota_per_minute || 60,
      allowed_providers: key.allowed_providers || [],
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name || undefined,
        quota_per_minute: formData.quota_per_minute || undefined,
        allowed_providers: formData.allowed_providers.length > 0 ? formData.allowed_providers : undefined,
      };

      if (selectedKey) {
        await api.patch(`/api/keys/${selectedKey.id}`, payload);
        toast.success('Gateway Key berhasil diperbarui');
      } else {
        const { data } = await api.post('/api/keys', payload);
        // Show new key value only once
        const newKey = data.plaintext_key || data.key;
        if (newKey) {
          await navigator.clipboard.writeText(newKey).catch(() => {});
          toast.success(`Key berhasil dibuat! Disalin: ${newKey.slice(0, 20)}...`, { duration: 8000 });
        } else {
          toast.success('Gateway Key berhasil dibuat');
        }
      }
      setIsModalOpen(false);
      fetchKeys();
    } catch (error: any) {
      console.error('Error saving key:', error);
      toast.error(error.response?.data?.error || 'Gagal menyimpan key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRotate = async (key: GatewayKey) => {
    if (!confirm(`Rotate key "${key.name || key.id}"? Key lama akan tidak aktif.`)) return;
    try {
      const { data } = await api.post(`/api/keys/${key.id}/rotate`);
      const newPlaintext = data.plaintext_key || data.key;
      if (newPlaintext) {
        await navigator.clipboard.writeText(newPlaintext).catch(() => {});
        toast.success(`Key dirotasi! Key baru disalin: ${newPlaintext.slice(0, 20)}...`, { duration: 8000 });
      } else {
        toast.success('Key berhasil dirotasi');
      }
      fetchKeys();
    } catch {
      toast.error('Gagal merotasi key');
    }
  };

  const handleDelete = async () => {
    if (!selectedKey) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/keys/${selectedKey.id}`);
      toast.success('Gateway Key berhasil dihapus');
      setIsDeleteDialogOpen(false);
      fetchKeys();
    } catch {
      toast.error('Gagal menghapus key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyKey = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    toast.success('Key disalin');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleProvider = (prov: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_providers: prev.allowed_providers.includes(prov)
        ? prev.allowed_providers.filter(p => p !== prov)
        : [...prev.allowed_providers, prov],
    }));
  };

  const getStatusColor = (status: string) => {
    if (status === 'active') return 'status-active';
    if (status === 'suspended') return 'status-error';
    return 'status-inactive';
  };

  return (
    <div className="min-h-screen">
      <AppHeader
        title="Gateway API Keys"
        subtitle="Kelola key untuk akses gateway multi-provider"
      />

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">{keys.length}</span> gateway key
          </p>
          <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Generate Key Baru
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : keys.length === 0 ? (
          <div className="glass rounded-xl">
            <EmptyState
              icon={KeyRound}
              title="Belum ada Gateway Key"
              description="Generate key untuk akses gateway. Satu key bisa digunakan untuk semua provider AI."
              action={
                <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Key Pertama
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence>
              {keys.map((key, index) => (
                <motion.div
                  key={key.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      key.status === 'active' ? 'bg-primary/10' : 'bg-secondary'
                    }`}>
                      <KeyRound className={`w-5 h-5 ${key.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{key.name || 'Unnamed Key'}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${getStatusColor(key.status)}`}>
                          {key.status}
                        </span>
                        {key.quota_per_minute && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {key.quota_per_minute}/min
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">
                          ID: {key.id.slice(0, 8)}...
                        </span>
                        {key.health && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {key.health.last_latency_ms}ms
                          </span>
                        )}
                        {key.allowed_providers && key.allowed_providers.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {key.allowed_providers.slice(0, 4).map(p => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-xs bg-secondary/80 border border-border/30">
                                {p}
                              </span>
                            ))}
                            {key.allowed_providers.length > 4 && (
                              <span className="text-xs text-muted-foreground">+{key.allowed_providers.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 w-full sm:w-auto justify-end">
                    <Button variant="ghost" size="icon" onClick={() => copyKey(key.id, key.id)} title="Salin ID">
                      {copiedId === key.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleRotate(key)} title="Rotate key">
                      <RotateCcw className="w-4 h-4 text-warning" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(key)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => { setSelectedKey(key); setIsDeleteDialogOpen(true); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedKey ? 'Edit Gateway Key' : 'Generate Gateway Key Baru'}</DialogTitle>
            <DialogDescription>
              {selectedKey
                ? 'Perbarui konfigurasi gateway key'
                : 'Buat key baru untuk akses gateway AI. Key akan ditampilkan SEKALI saja.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Key (opsional)</Label>
              <Input
                placeholder="contoh: Production, Testing, OpenClaw"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Quota per Menit</Label>
              <Input
                type="number"
                min={1}
                max={10000}
                value={formData.quota_per_minute}
                onChange={(e) => setFormData({ ...formData, quota_per_minute: Number(e.target.value) })}
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Provider yang Diizinkan</Label>
              <p className="text-xs text-muted-foreground">
                Kosongkan = izinkan semua provider. Pilih untuk membatasi.
              </p>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                {AI_PROVIDERS.map(prov => (
                  <div
                    key={prov}
                    className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/60 transition-colors"
                    onClick={() => toggleProvider(prov)}
                  >
                    <Checkbox
                      checked={formData.allowed_providers.includes(prov)}
                      onCheckedChange={() => toggleProvider(prov)}
                    />
                    <span className="text-xs font-mono">{prov}</span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</>
                  : selectedKey ? 'Simpan' : 'Generate Key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Gateway Key</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin hapus key "{selectedKey?.name || selectedKey?.id}"? Semua akses menggunakan key ini akan berhenti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
