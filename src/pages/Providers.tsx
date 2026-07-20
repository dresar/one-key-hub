import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Plus, Edit2, Trash2, Loader2,
  RefreshCw, Shield, CheckCircle, XCircle, Clock, PlayCircle, Key, Activity,
  Eye, EyeOff, Copy, Check, MoreVertical
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

const STATUS_COLORS: Record<string, string> = {
  active: 'status-active',
  cooldown: 'status-warning',
  inactive: 'status-inactive',
};

const isRateLimitError = (errorText: string) => {
  if (!errorText) return false;
  const txt = errorText.toLowerCase();
  return txt.includes('429') || txt.includes('quota') || txt.includes('rate limit') || txt.includes('limit exceeded');
};

const sanitizeErrorText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/AIzaSy[A-Za-z0-9_-]+/g, '[API_KEY]')
    .replace(/gsk_[A-Za-z0-9_-]+/g, '[API_KEY]')
    .replace(/key:\s*[A-Za-z0-9_-]+/g, 'key: [API_KEY]');
};

interface Credential {
  id: string;
  provider_name: string;
  label: string;
  status: 'active' | 'cooldown' | 'inactive';
  total_requests: number;
  failed_requests: number;
  cooldown_until?: string | null;
  created_at: string;
}

export default function Providers() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providerOptions, setProviderOptions] = useState<{ value: string; label: string; placeholder: string; group: string; docUrl?: string; howToGet?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCred, setSelectedCred] = useState<Credential | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterProvider, setFilterProvider] = useState('all');
  const [isTestResultOpen, setIsTestResultOpen] = useState(false);
  const [testResultData, setTestResultData] = useState<{
    success: boolean;
    provider: string;
    label: string;
    text?: string;
    error?: string;
  } | null>(null);
  const [isTestingId, setIsTestingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [copiedCredId, setCopiedCredId] = useState<string | null>(null);
  const [formCustomId, setFormCustomId] = useState<string>('');

  const [formData, setFormData] = useState({
    provider_name: 'gemini',
    label: '',
    api_key: '',
    cloud_name: '',
    api_secret: '',
    public_key: '',
    private_key: '',
    url_endpoint: '',
    rapidapi_host: '',
    secret_key: '',
  });

  useEffect(() => {
    fetchCredentials();
    fetchProviderOptions();

    // Poll credentials list every 3 seconds to keep UI synced without websockets
    const intervalId = setInterval(() => {
      fetchCredentials();
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const fetchProviderOptions = async () => {
    try {
      const { data } = await api.get('/api/providers');
      const items = data?.items || data || [];
      setProviderOptions(items);
      // Pre-select first provider
      if (items.length > 0) {
        setFormData(prev => ({ ...prev, provider_name: items[0].value }));
      }
    } catch (error) {
      console.error('Error fetching provider options:', error);
      toast.error('Gagal memuat list provider');
    }
  };

  const fetchCredentials = async () => {
    try {
      const { data } = await api.get('/api/credentials');
      const newItems = data?.items || data || [];

      // Detect auto-deleted keys by comparing incoming items with previous state
      setCredentials((prev) => {
        if (prev.length > 0 && newItems.length < prev.length) {
          const prevIds = prev.map(c => c.id);
          const nextIds = newItems.map(c => c.id);
          const deletedIds = prevIds.filter(id => !nextIds.includes(id));
          
          deletedIds.forEach(id => {
            const deletedKey = prev.find(c => c.id === id);
            if (deletedKey) {
              toast.error(
                `🚨 Key ID #${id} (${deletedKey.label || deletedKey.provider_name}) telah OTOMATIS DIHAPUS karena mendeteksi error fatal berulang!`,
                { duration: 6000 }
              );
            }
          });
        }
        return newItems;
      });
    } catch (error) {
      console.error('Error fetching credentials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestCredential = async (cred: Credential) => {
    setIsTestingId(cred.id);
    try {
      const { data } = await api.post(`/api/credentials/${cred.id}/test`);
      setTestResultData({
        success: true,
        provider: cred.provider_name,
        label: cred.label || cred.provider_name,
        text: data.text,
      });
      toast.success(`Key ${cred.label || cred.provider_name} berfungsi!`);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Gagal tes key';
      setTestResultData({
        success: false,
        provider: cred.provider_name,
        label: cred.label || cred.provider_name,
        error: errMsg,
      });
      toast.error(`Key ${cred.label || cred.provider_name} error: ${errMsg}`);
    } finally {
      setIsTestingId(null);
      setIsTestResultOpen(true);
    }
  };

  const openCreateModal = async () => {
    setSelectedCred(null);
    setFormCustomId('');
    setFormData({
      provider_name: filterProvider !== 'all' ? filterProvider : 'gemini',
      label: '',
      api_key: '',
      cloud_name: '',
      api_secret: '',
      public_key: '',
      private_key: '',
      url_endpoint: '',
      rapidapi_host: '',
      secret_key: '',
    });
    setIsModalOpen(true);

    try {
      const { data } = await api.get('/api/credentials/next-id');
      if (data?.next_id) {
        setFormCustomId(String(data.next_id));
      }
    } catch (err) {
      console.error('Failed to fetch next ID:', err);
    }
  };

  const openEditModal = async (cred: Credential) => {
    setSelectedCred(cred);
    setFormCustomId(String(cred.id));
    setShowApiKey(false);
    setIsLoadingModal(true);
    setIsModalOpen(true);

    setFormData({
      provider_name: cred.provider_name,
      label: cred.label || '',
      api_key: '',
      cloud_name: '',
      api_secret: '',
      public_key: '',
      private_key: '',
      url_endpoint: '',
      rapidapi_host: '',
      secret_key: '',
    });

    try {
      const { data } = await api.get(`/api/credentials/${cred.id}/reveal`);
      const c = data?.credentials || {};
      setFormData({
        provider_name: cred.provider_name,
        label: cred.label || '',
        api_key: c.api_key || '',
        cloud_name: c.cloud_name || '',
        api_secret: c.api_secret || '',
        public_key: c.public_key || '',
        private_key: c.private_key || '',
        url_endpoint: c.url_endpoint || '',
        rapidapi_host: c.rapidapi_host || '',
        secret_key: c.secret_key || '',
      });
    } catch (error) {
      console.error('Error revealing credential:', error);
      toast.error('Gagal memuat isi API key dari database');
    } finally {
      setIsLoadingModal(false);
    }
  };

  const handleCopyCredentialKey = async (cred: Credential) => {
    try {
      const { data } = await api.get(`/api/credentials/${cred.id}/reveal`);
      const c = data?.credentials || {};
      const keyToCopy = c.api_key || c.secret_key || c.private_key || '';
      if (!keyToCopy) {
        toast.error('Kredensial tidak berisi string API Key');
        return;
      }
      await navigator.clipboard.writeText(keyToCopy).catch(() => {});
      setCopiedCredId(cred.id);
      toast.success(`API Key (${cred.label || cred.provider_name}) disalin ke clipboard!`);
      setTimeout(() => setCopiedCredId(null), 2000);
    } catch {
      toast.error('Gagal menyalin API key');
    }
  };

  const buildCredentialsPayload = () => {
    const prov = formData.provider_name;
    if (prov === 'cloudinary') {
      return {
        cloud_name: formData.cloud_name.trim(),
        api_key: formData.api_key.trim(),
        api_secret: formData.api_secret.trim(),
      };
    }
    if (prov === 'imagekit') {
      return {
        public_key: formData.public_key.trim(),
        private_key: formData.private_key.trim(),
        url_endpoint: formData.url_endpoint.trim(),
      };
    }
    if (prov === 'uploadcare') {
      return {
        public_key: formData.public_key.trim(),
        secret_key: formData.secret_key.trim(),
      };
    }
    if (prov === 'rapidapi') {
      return {
        api_key: formData.api_key.trim(),
        rapidapi_host: formData.rapidapi_host.trim(),
      };
    }
    if (prov === 'apify') {
      return { api_token: formData.api_key };
    }
    return { api_key: formData.api_key };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prov = formData.provider_name;

    // Validation for new key creation
    if (!selectedCred) {
      if (prov === 'cloudinary') {
        if (!formData.cloud_name.trim() || !formData.api_key.trim() || !formData.api_secret.trim()) {
          toast.error('Semua field Cloudinary (Cloud Name, API Key, API Secret) wajib diisi');
          return;
        }
      } else if (prov === 'imagekit') {
        if (!formData.public_key.trim() || !formData.private_key.trim() || !formData.url_endpoint.trim()) {
          toast.error('Semua field ImageKit (Public Key, Private Key, URL Endpoint) wajib diisi');
          return;
        }
      } else if (prov === 'uploadcare') {
        if (!formData.public_key.trim() || !formData.secret_key.trim()) {
          toast.error('Semua field Uploadcare (Public Key, Secret Key) wajib diisi');
          return;
        }
      } else if (prov === 'rapidapi') {
        if (!formData.api_key.trim() || !formData.rapidapi_host.trim()) {
          toast.error('Semua field RapidAPI (API Key, Host) wajib diisi');
          return;
        }
      } else {
        if (!formData.api_key.trim()) {
          toast.error('API Key wajib diisi');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        provider_name: formData.provider_name,
        label: formData.label || formData.provider_name,
      };

      // Determine if credentials need to be updated
      let shouldSendCreds = false;
      if (!selectedCred) {
        shouldSendCreds = true;
      } else {
        if (prov === 'cloudinary') {
          shouldSendCreds = !!(formData.cloud_name.trim() || formData.api_key.trim() || formData.api_secret.trim());
        } else if (prov === 'imagekit') {
          shouldSendCreds = !!(formData.public_key.trim() || formData.private_key.trim() || formData.url_endpoint.trim());
        } else if (prov === 'uploadcare') {
          shouldSendCreds = !!(formData.public_key.trim() || formData.secret_key.trim());
        } else if (prov === 'rapidapi') {
          shouldSendCreds = !!(formData.api_key.trim() || formData.rapidapi_host.trim());
        } else {
          shouldSendCreds = !!formData.api_key.trim();
        }
      }

      if (shouldSendCreds) {
        payload.credentials = buildCredentialsPayload();
      }

      if (formCustomId.trim()) {
        payload.custom_id = Number(formCustomId);
      }

      if (selectedCred) {
        const { data } = await api.patch(`/api/credentials/${selectedCred.id}`, payload);
        toast.success(data.message || 'Credential berhasil diperbarui');
      } else {
        const { data } = await api.post('/api/credentials', payload);
        toast.success(`Credential #${data.id} (${data.label || data.provider_name}) berhasil disimpan!`);
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

  const handleReindexIds = async () => {
    if (!confirm('Reset dan urutkan ulang seluruh ID API Key mulai dari 1, 2, 3...?')) return;
    setIsSyncing(true);
    try {
      const { data } = await api.post('/api/credentials/reindex-ids');
      toast.success(data.message || 'ID berhasil diurutkan ulang dari 1!');
      fetchCredentials();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal mengurutkan ulang ID');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncCache = async () => {
    setIsSyncing(true);
    try {
      await api.post('/api/credentials/sync');
      toast.success('Sinkronisasi Sukses', {
        description: 'Semua API key dari database berhasil di-sync ke JSON local cache.',
      });
      fetchCredentials();
    } catch (error: any) {
      console.error('Error syncing credentials cache:', error);
      toast.toast?.error ? toast.toast.error('Sinkronisasi Gagal') : toast.error('Sinkronisasi Gagal', {
        description: error.response?.data?.error || 'Gagal menyinkronkan database dengan local cache.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (visibleCreds: Credential[]) => {
    const visibleIds = visibleCreds.map(c => c.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`HAPUS MASSAL: Apakah Anda yakin ingin menghapus ${selectedIds.length} credential yang dipilih?`)) return;

    setIsBulkDeleting(true);
    try {
      const { data } = await api.post('/api/credentials/bulk-delete', { ids: selectedIds });
      toast.success(data.message || `${selectedIds.length} credential berhasil dihapus`);
      setSelectedIds([]);
      fetchCredentials();
    } catch (error: any) {
      console.error('Error bulk deleting credentials:', error);
      toast.error(error.response?.data?.error || 'Gagal melakukan hapus massal');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkDeleteByProvider = async (providerName: string) => {
    const targetCount = credentials.filter(c => c.provider_name === providerName).length;
    if (targetCount === 0) {
      toast.error(`Tidak ada credential untuk provider ${providerName}`);
      return;
    }

    if (!confirm(`⚠️ PERHATIAN: Hapus SEMUA ${targetCount} key untuk provider "${providerName.toUpperCase()}"? Action ini tidak bisa dibatalkan.`)) return;

    setIsBulkDeleting(true);
    try {
      const { data } = await api.post('/api/credentials/bulk-delete', { provider_name: providerName });
      toast.success(data.message || `Semua key ${providerName} (${targetCount}) berhasil dihapus`);
      setSelectedIds([]);
      fetchCredentials();
    } catch (error: any) {
      console.error('Error deleting provider credentials:', error);
      toast.error(error.response?.data?.error || 'Gagal menghapus key provider');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const selectedProviderConfig = providerOptions.find(p => p.value === formData.provider_name);

  const filteredCreds = filterProvider === 'all'
    ? credentials
    : credentials.filter(c => c.provider_name === filterProvider);

  // Stats calculation
  const getProviderStats = (providerValue: string) => {
    const provCreds = credentials.filter(c => c.provider_name === providerValue);
    const active = provCreds.filter(c => c.status === 'active').length;
    const cooldown = provCreds.filter(c => c.status === 'cooldown').length;
    const inactive = provCreds.filter(c => c.status === 'inactive').length;
    const totalRequests = provCreds.reduce((sum, c) => sum + (c.total_requests || 0), 0);
    const failedRequests = provCreds.reduce((sum, c) => sum + (c.failed_requests || 0), 0);
    
    return {
      count: provCreds.length,
      active,
      cooldown,
      inactive,
      totalRequests,
      failedRequests,
    };
  };

  const totalKeysCount = credentials.length;
  const activeKeysCount = credentials.filter(c => c.status === 'active').length;
  const cooldownKeysCount = credentials.filter(c => c.status === 'cooldown').length;

  return (
    <div className="min-h-screen">
      <AppHeader title="Provider API Keys" subtitle="Manajemen kredensial dan monitoring rotasi API key" />

      <div className="p-4 md:p-6 space-y-6">
        
        {/* Global Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {[
            { label: 'Total API Keys', value: totalKeysCount, icon: Key, color: 'text-primary' },
            { label: 'Keys Aktif', value: activeKeysCount, icon: CheckCircle, color: 'text-green-500' },
            { label: 'Keys Cooldown', value: cooldownKeysCount, icon: Clock, color: 'text-warning' },
            { 
              label: 'Total Requests', 
              value: credentials.reduce((sum, c) => sum + c.total_requests, 0), 
              icon: Activity, 
              color: 'text-accent' 
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</p>
                <p className="text-base sm:text-xl font-bold truncate">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Credentials Table / List section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Key className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                {filterProvider === 'all' 
                  ? 'Semua API Keys / Credentials' 
                  : `API Keys untuk ${providerOptions.find(p => p.value === filterProvider)?.label || filterProvider}`}
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Menampilkan {filteredCreds.length} dari total {credentials.length} kredensial
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Select value={filterProvider} onValueChange={setFilterProvider}>
                <SelectTrigger className="flex-1 sm:flex-initial min-w-[130px] sm:w-[180px] h-8 text-xs bg-secondary/50 border-border/40">
                  <SelectValue placeholder="Filter Provider" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Semua Provider</SelectItem>
                  {providerOptions.map(p => {
                    const count = credentials.filter(c => c.provider_name === p.value).length;
                    return (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label} {count > 0 ? `(${count})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Button 
                onClick={handleReindexIds} 
                disabled={isSyncing} 
                variant="outline" 
                size="sm"
                title="Reset & urutkan ulang semua ID mulai dari 1, 2, 3..."
                className="bg-secondary/40 border-border/40 hover:bg-secondary/80 text-xs gap-1.5 flex-1 sm:flex-none"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Urutkan ID (1,2,3..)</span>
                <span className="sm:hidden">Reset ID</span>
              </Button>

              <Button 
                onClick={handleSyncCache} 
                disabled={isSyncing} 
                variant="outline" 
                size="sm"
                className="bg-secondary/40 border-border/40 hover:bg-secondary/80 text-xs gap-2 flex-1 sm:flex-none"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync Cache</span>
              </Button>

              <Button
                onClick={openCreateModal}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-sm flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Tambah Credential</span>
                <span className="sm:hidden">Tambah</span>
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredCreds.length === 0 ? (
            <div className="glass rounded-xl">
              <EmptyState
                icon={Server}
                title="Kunci tidak ditemukan"
                description={
                  filterProvider === 'all'
                    ? "Belum ada credential yang ditambahkan. Silakan tambahkan API key provider Anda."
                    : `Kunci untuk provider ${filterProvider} belum ditambahkan.`
                }
                action={
                  <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Credential Baru
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-3">
              {/* ─── Bulk Action Bar ─── */}
              <div className="glass rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 border border-border/50 bg-secondary/30">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="select-all-creds"
                    checked={filteredCreds.length > 0 && filteredCreds.every(c => selectedIds.includes(c.id))}
                    onChange={() => toggleSelectAll(filteredCreds)}
                    className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                  />
                  <label htmlFor="select-all-creds" className="text-xs font-semibold cursor-pointer select-none">
                    Pilih Semua ({filteredCreds.length})
                  </label>
                  {selectedIds.length > 0 && (
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {selectedIds.length} dipilih
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedIds.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDeleteSelected}
                      disabled={isBulkDeleting}
                      className="text-xs gap-1.5 h-8 bg-destructive hover:bg-destructive/90"
                    >
                      {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Hapus ({selectedIds.length})
                    </Button>
                  )}

                  {filterProvider !== 'all' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkDeleteByProvider(filterProvider)}
                      disabled={isBulkDeleting}
                      className="text-xs gap-1.5 h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus {filterProvider.toUpperCase()} ({credentials.filter(c => c.provider_name === filterProvider).length})
                    </Button>
                  )}

                  {credentials.some(c => c.status === 'inactive') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const inactiveCount = credentials.filter(c => c.status === 'inactive').length;
                        if (!confirm(`Hapus ${inactiveCount} key dengan status INACTIVE/Terblokir?`)) return;
                        setIsBulkDeleting(true);
                        try {
                          const inactiveIds = credentials.filter(c => c.status === 'inactive').map(c => c.id);
                          const { data } = await api.post('/api/credentials/bulk-delete', { ids: inactiveIds });
                          toast.success(data.message || `${inactiveCount} key inaktif berhasil dihapus`);
                          setSelectedIds([]);
                          fetchCredentials();
                        } catch (err: any) {
                          toast.error(err.response?.data?.error || 'Gagal hapus key inaktif');
                        } finally {
                          setIsBulkDeleting(false);
                        }
                      }}
                      disabled={isBulkDeleting}
                      className="text-xs gap-1.5 h-8 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus Inaktif ({credentials.filter(c => c.status === 'inactive').length})
                    </Button>
                  )}
                </div>
              </div>

              <AnimatePresence mode="popLayout">
                {filteredCreds.map((cred, index) => (
                  <motion.div
                    key={cred.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ delay: index * 0.03 }}
                    className={`glass rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border transition-all duration-200 ${
                      selectedIds.includes(cred.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border/40 hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(cred.id)}
                        onChange={() => toggleSelectId(cred.id)}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer shrink-0"
                      />
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        cred.status === 'active' ? 'bg-primary/10' : 'bg-secondary'
                      }`}>
                        <Shield className={`w-5 h-5 ${cred.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 border border-primary/20 font-mono font-semibold text-primary">
                            ID: {cred.id}
                          </span>
                          <span className="font-semibold truncate">{cred.label || cred.provider_name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-secondary/80 border border-border/50 font-mono">
                            {cred.provider_name}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[cred.status] || 'status-inactive'}`}>
                            {cred.status === 'active' && <CheckCircle className="w-3 h-3" />}
                            {cred.status === 'cooldown' && <Clock className="w-3 h-3" />}
                            {cred.status === 'inactive' && <XCircle className="w-3 h-3" />}
                            {cred.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                          <span>Requests: <strong>{cred.total_requests || 0}</strong></span>
                          <span>Gagal: <strong className="text-destructive">{cred.failed_requests || 0}</strong></span>
                          {cred.cooldown_until && (
                            <span className="text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                              Cooldown s/d: {new Date(cred.cooldown_until).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        {cred.last_error && !isRateLimitError(cred.last_error) && (
                          <div className="mt-2 space-y-1.5">
                            <div className="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 px-2.5 py-1.5 rounded-lg font-mono max-w-xl break-words">
                              Error: {sanitizeErrorText(cred.last_error)}
                            </div>
                            <div className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg max-w-xl">
                              ⚠️ <strong>Rekomendasi:</strong> Key ini mendeteksi error fatal (bukan limit kuota). Direkomendasikan untuk segera menghapus key ini.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestCredential(cred)}
                        disabled={isTestingId !== null}
                        className="text-xs text-primary hover:text-primary/95 hover:bg-primary/10 h-8 px-2.5"
                      >
                        {isTestingId === cred.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <PlayCircle className="w-3.5 h-3.5 mr-1" />
                        )}
                        Test Key
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 bg-card border-border">
                          <DropdownMenuItem onClick={() => handleCopyCredentialKey(cred)} className="text-xs gap-2 cursor-pointer">
                            {copiedCredId === cred.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            Salin API Key
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(cred)} className="text-xs gap-2 cursor-pointer">
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit Credential
                          </DropdownMenuItem>
                          {cred.status === 'cooldown' && (
                            <DropdownMenuItem onClick={() => handleReactivate(cred)} className="text-xs gap-2 text-warning cursor-pointer">
                              <RefreshCw className="w-3.5 h-3.5" />
                              Reaktivasi Key
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => { setSelectedCred(cred); setIsDeleteDialogOpen(true); }}
                            className="text-xs gap-2 text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus Key
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedCred ? 'Edit Credential' : 'Tambah Credential Baru'}</DialogTitle>
            <DialogDescription>
              {selectedCred ? 'Perbarui API key provider Anda' : 'Tambahkan API key baru untuk provider pilihan Anda'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={formData.provider_name || ''}
                onValueChange={(v) => setFormData({ ...formData, provider_name: v })}
                disabled={!!selectedCred}
              >
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="form_custom_id" className="text-xs font-semibold">ID / Prioritas Key</Label>
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded font-mono">
                  {selectedCred ? 'Bisa Diubah' : 'Otomatis Terisi ID Terkecil (#1)'}
                </span>
              </div>
              <Input
                id="form_custom_id"
                type="number"
                min={1}
                value={formCustomId}
                onChange={(e) => setFormCustomId(e.target.value)}
                placeholder="contoh: 1, 2, 100"
                className="bg-secondary/50 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Label (opsional)</Label>
              <Input
                placeholder="contoh: Gemini Key Utama"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="bg-secondary/50"
              />
            </div>

            {isLoadingModal ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Memuat API key dari database...</span>
              </div>
            ) : (
              <>
                {formData.provider_name === 'cloudinary' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Cloud Name</Label>
                      <Input
                        placeholder="Masukkan Cloud Name..."
                        value={formData.cloud_name}
                        onChange={(e) => setFormData({ ...formData, cloud_name: e.target.value })}
                        className="bg-secondary/50 text-sm"
                        required={!selectedCred}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <div className="relative flex items-center">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="Masukkan API Key..."
                          value={formData.api_key}
                          onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                          className="bg-secondary/50 font-mono text-sm pr-20"
                          required={!selectedCred}
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowApiKey(!showApiKey)}
                            title={showApiKey ? 'Sembunyikan' : 'Tampilkan API Key'}
                          >
                            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                          {formData.api_key && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={async () => {
                                await navigator.clipboard.writeText(formData.api_key).catch(() => {});
                                toast.success('API Key disalin ke clipboard!');
                              }}
                              title="Salin API Key"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>API Secret</Label>
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="Masukkan API Secret..."
                        value={formData.api_secret}
                        onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                        className="bg-secondary/50 font-mono text-sm"
                        required={!selectedCred}
                      />
                    </div>
                  </>
                ) : formData.provider_name === 'imagekit' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Public Key</Label>
                      <Input
                        placeholder="contoh: public_..."
                        value={formData.public_key}
                        onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                        className="bg-secondary/50 font-mono text-sm"
                        required={!selectedCred}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Private Key</Label>
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="contoh: private_..."
                        value={formData.private_key}
                        onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                        className="bg-secondary/50 font-mono text-sm"
                        required={!selectedCred}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL Endpoint</Label>
                      <Input
                        placeholder="contoh: https://ik.imagekit.io/..."
                        value={formData.url_endpoint}
                        onChange={(e) => setFormData({ ...formData, url_endpoint: e.target.value })}
                        className="bg-secondary/50 text-sm"
                        required={!selectedCred}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="relative flex items-center">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder={selectedProviderConfig?.placeholder || 'Masukkan API key...'}
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        className="bg-secondary/50 font-mono text-sm pr-20"
                        required={!selectedCred}
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowApiKey(!showApiKey)}
                          title={showApiKey ? 'Sembunyikan' : 'Tampilkan API Key'}
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                        {formData.api_key && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={async () => {
                              await navigator.clipboard.writeText(formData.api_key).catch(() => {});
                              toast.success('API Key disalin!');
                            }}
                            title="Salin API Key"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {selectedCred && (
              <p className="text-xs text-muted-foreground mt-1">
                Kosongkan field-field di atas jika tidak ingin mengubah kunci / rahasia.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</> : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Credential</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus credential "{selectedCred?.label || selectedCred?.provider_name}"? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Result Modal */}
      <Dialog open={isTestResultOpen} onOpenChange={setIsTestResultOpen}>
        {testResultData && (
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className={`w-3.5 h-3.5 rounded-full ${testResultData.success ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                Status Key: {testResultData.success ? 'Berfungsi (Hijau)' : 'Error (Merah)'}
              </DialogTitle>
              <DialogDescription>
                Hasil pengujian key untuk <strong>{testResultData.label}</strong> ({testResultData.provider}) dengan prompt default: <em>"di mana letak indonesia"</em>
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 p-4 rounded-xl border bg-secondary/30 text-sm max-h-60 overflow-y-auto">
              {testResultData.success ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-green-400">Respon Jawaban AI:</p>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap font-sans">{testResultData.text}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-red-400">Detail Error:</p>
                  <p className="text-destructive font-mono text-xs whitespace-pre-wrap">{testResultData.error}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setIsTestResultOpen(false)} className={testResultData.success ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-primary'}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
