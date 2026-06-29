import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Plus, Edit2, Trash2, Power, PowerOff, Loader2,
  RefreshCw, Shield, CheckCircle, XCircle, Clock
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/services/api';
import { toast } from 'sonner';

// Provider config — list AI providers yang didukung backend
const PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Google Gemini', apiKeyField: 'api_key', placeholder: 'AIzaSy...' },
  { value: 'openclaw', label: 'OpenClaw AI', apiKeyField: 'api_key', placeholder: 'sk-openclaw-...' },
  { value: 'groq', label: 'Groq', apiKeyField: 'api_key', placeholder: 'gsk_...' },
  { value: 'openai', label: 'OpenAI', apiKeyField: 'api_key', placeholder: 'sk-proj-...' },
  { value: 'anthropic', label: 'Anthropic (Claude)', apiKeyField: 'api_key', placeholder: 'sk-ant-...' },
  { value: 'mistral', label: 'Mistral AI', apiKeyField: 'api_key', placeholder: 'your-mistral-key' },
  { value: 'cohere', label: 'Cohere', apiKeyField: 'api_key', placeholder: 'your-cohere-key' },
  { value: 'together', label: 'Together AI', apiKeyField: 'api_key', placeholder: 'your-together-key' },
  { value: 'perplexity', label: 'Perplexity AI', apiKeyField: 'api_key', placeholder: 'pplx-...' },
  { value: 'huggingface', label: 'HuggingFace', apiKeyField: 'api_key', placeholder: 'hf_...' },
  { value: 'cloudinary', label: 'Cloudinary', apiKeyField: 'api_key', placeholder: 'cloud_name|api_key|api_secret' },
  { value: 'imagekit', label: 'ImageKit', apiKeyField: 'api_key', placeholder: 'public_key|private_key|url_endpoint' },
  { value: 'apify', label: 'Apify', apiKeyField: 'api_token', placeholder: 'apify_api_...' },
  { value: 'newsapi', label: 'NewsAPI', apiKeyField: 'api_key', placeholder: 'your-newsapi-key' },
  { value: 'openweather', label: 'OpenWeather', apiKeyField: 'api_key', placeholder: 'your-appid' },
  { value: 'rapidapi', label: 'RapidAPI', apiKeyField: 'api_key', placeholder: 'api_key|rapidapi_host' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'status-active',
  cooldown: 'status-warning',
  inactive: 'status-inactive',
  disabled: 'status-inactive',
};

interface Credential {
  id: string;
  provider_name: string;
  provider_type?: string;
  label: string;
  status: 'active' | 'cooldown' | 'inactive';
  total_requests: number;
  failed_requests: number;
  cooldown_until?: string | null;
  created_at: string;
}

export default function Providers() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCred, setSelectedCred] = useState<Credential | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterProvider, setFilterProvider] = useState('all');

  const [formData, setFormData] = useState({
    provider_name: 'gemini',
    label: '',
    api_key: '',
    extra_field: '',   // For multi-field providers like cloudinary
  });

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const { data } = await api.get('/api/credentials');
      setCredentials(data?.items || data || []);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast.error('Gagal memuat data credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedCred(null);
    setFormData({ provider_name: 'gemini', label: '', api_key: '', extra_field: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (cred: Credential) => {
    setSelectedCred(cred);
    setFormData({
      provider_name: cred.provider_name,
      label: cred.label || '',
      api_key: '',
      extra_field: '',
    });
    setIsModalOpen(true);
  };

  const buildCredentialsPayload = () => {
    const prov = formData.provider_name;
    // Special multi-field providers
    if (prov === 'cloudinary') {
      const parts = formData.api_key.split('|');
      return {
        cloud_name: parts[0]?.trim() || '',
        api_key: parts[1]?.trim() || '',
        api_secret: parts[2]?.trim() || '',
      };
    }
    if (prov === 'imagekit') {
      const parts = formData.api_key.split('|');
      return {
        public_key: parts[0]?.trim() || '',
        private_key: parts[1]?.trim() || '',
        url_endpoint: parts[2]?.trim() || '',
      };
    }
    if (prov === 'rapidapi') {
      const parts = formData.api_key.split('|');
      return {
        api_key: parts[0]?.trim() || '',
        rapidapi_host: parts[1]?.trim() || '',
      };
    }
    if (prov === 'apify') {
      return { api_token: formData.api_key };
    }
    return { api_key: formData.api_key };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.api_key.trim() && !selectedCred) {
      toast.error('API Key wajib diisi');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        provider_name: formData.provider_name,
        label: formData.label || formData.provider_name,
        credentials: buildCredentialsPayload(),
      };

      if (selectedCred) {
        await api.patch(`/api/credentials/${selectedCred.id}`, payload);
        toast.success('Credential berhasil diperbarui');
      } else {
        await api.post('/api/credentials', payload);
        toast.success('Credential berhasil ditambahkan');
      }
      setIsModalOpen(false);
      fetchCredentials();
    } catch (error: any) {
      console.error('Error saving credential:', error);
      toast.error(error.response?.data?.error || 'Gagal menyimpan credential');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCred) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/credentials/${selectedCred.id}`);
      toast.success('Credential berhasil dihapus');
      setIsDeleteDialogOpen(false);
      fetchCredentials();
    } catch (error) {
      toast.error('Gagal menghapus credential');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivate = async (cred: Credential) => {
    try {
      await api.post(`/api/credentials/${cred.id}/reactivate`);
      toast.success('Credential diaktifkan kembali');
      fetchCredentials();
    } catch {
      toast.error('Gagal mengaktifkan credential');
    }
  };

  const selectedProviderConfig = PROVIDER_OPTIONS.find(p => p.value === formData.provider_name);

  const filteredCreds = filterProvider === 'all'
    ? credentials
    : credentials.filter(c => c.provider_name === filterProvider);

  const uniqueProviders = [...new Set(credentials.map(c => c.provider_name))];

  return (
    <div className="min-h-screen">
      <AppHeader title="Provider Credentials" subtitle="Kelola API key untuk setiap provider AI" />

      <div className="p-6">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger className="w-[180px] bg-secondary/50">
                <SelectValue placeholder="Filter Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Provider</SelectItem>
                {uniqueProviders.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{filteredCreds.length}</span> credential
            </p>
          </div>
          <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Credential
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredCreds.length === 0 ? (
          <div className="glass rounded-xl">
            <EmptyState
              icon={Server}
              title="Belum ada credential"
              description="Tambahkan API key provider AI (Gemini, OpenClaw, Groq, OpenAI, dll.) untuk mulai menggunakan gateway."
              action={
                <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Credential Pertama
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence>
              {filteredCreds.map((cred, index) => (
                <motion.div
                  key={cred.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.04 }}
                  className="glass rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      cred.status === 'active' ? 'bg-primary/10' : 'bg-secondary'
                    }`}>
                      <Shield className={`w-5 h-5 ${cred.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{cred.label || cred.provider_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-secondary/80 border border-border/50 font-mono">
                          {cred.provider_name}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[cred.status] || 'status-inactive'}`}>
                          {cred.status === 'active' && <CheckCircle className="w-3 h-3" />}
                          {cred.status === 'cooldown' && <Clock className="w-3 h-3" />}
                          {cred.status === 'inactive' && <XCircle className="w-3 h-3" />}
                          {cred.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>Requests: {cred.total_requests || 0}</span>
                        {(cred.failed_requests || 0) > 0 && (
                          <span className="text-destructive">Gagal: {cred.failed_requests}</span>
                        )}
                        {cred.cooldown_until && (
                          <span className="text-warning">Cooldown: {new Date(cred.cooldown_until).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 w-full sm:w-auto justify-end">
                    {cred.status === 'cooldown' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReactivate(cred)}
                        className="text-xs"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Reaktivasi
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(cred)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => { setSelectedCred(cred); setIsDeleteDialogOpen(true); }}
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
      {isModalOpen && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedCred ? 'Edit Credential' : 'Tambah Credential Baru'}</DialogTitle>
              <DialogDescription>
                {selectedCred ? 'Perbarui API key provider' : 'Tambahkan API key untuk provider AI baru'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={formData.provider_name}
                  onValueChange={(v) => setFormData({ ...formData, provider_name: v })}
                  disabled={!!selectedCred}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Label (opsional)</Label>
                <Input
                  placeholder="contoh: Production Key 1"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {formData.provider_name === 'cloudinary'
                    ? 'Format: cloud_name|api_key|api_secret'
                    : formData.provider_name === 'imagekit'
                    ? 'Format: public_key|private_key|url_endpoint'
                    : formData.provider_name === 'rapidapi'
                    ? 'Format: api_key|rapidapi_host'
                    : 'API Key'}
                </Label>
                <Input
                  type="password"
                  placeholder={selectedProviderConfig?.placeholder || 'Masukkan API key...'}
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="bg-secondary/50 font-mono text-sm"
                  required={!selectedCred}
                />
                {selectedCred && (
                  <p className="text-xs text-muted-foreground">Kosongkan jika tidak ingin mengubah API key</p>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Batal</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
                  {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</> : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Dialog */}
      {isDeleteDialogOpen && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Credential</AlertDialogTitle>
              <AlertDialogDescription>
                Yakin hapus credential "{selectedCred?.label || selectedCred?.provider_name}"? Tindakan ini tidak bisa dibatalkan.
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
      )}
    </div>
  );
}
