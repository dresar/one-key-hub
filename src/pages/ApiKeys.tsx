import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound, Plus, Edit2, Trash2, Loader2, Copy, Check,
  Activity, RotateCcw, Zap, Clock
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/services/api';
import { toast } from 'sonner';

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
  const navigate = useNavigate();
  const [keys, setKeys] = useState<GatewayKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<GatewayKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const openCreatePage = () => {
    navigate('/api-keys/create');
  };

  const openEditPage = (key: GatewayKey) => {
    navigate(`/api-keys/edit/${key.id}`);
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

      <div className="p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">
            Menampilkan <span className="text-foreground font-medium">{keys.length}</span> gateway key
          </p>
          <Button onClick={openCreatePage} className="bg-primary hover:bg-primary/90 text-sm gap-2">
            <Plus className="w-4 h-4" />
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
              description="Generate key untuk akses gateway. Satu key bisa digunakan untuk memanggil semua provider AI pilihan Anda."
              action={
                <Button onClick={openCreatePage} className="bg-primary hover:bg-primary/90 text-sm gap-2">
                  <Plus className="w-4 h-4" />
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
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ delay: index * 0.03 }}
                  className="glass rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-border/40 hover:border-border/80 transition-all duration-200"
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${getStatusColor(key.status)}`}>
                          {key.status}
                        </span>
                        {key.quota_per_minute && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            {key.quota_per_minute}/min
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono bg-secondary/80 px-2 py-0.5 rounded border border-border/40">
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
                              <span className="text-xs text-muted-foreground font-semibold">+{key.allowed_providers.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                    <Button variant="ghost" size="icon" onClick={() => copyKey(key.id, key.id)} title="Salin ID">
                      {copiedId === key.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleRotate(key)} title="Rotate key" className="text-warning hover:text-warning hover:bg-warning/10">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditPage(key)} title="Edit Key">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => { setSelectedKey(key); setIsDeleteDialogOpen(true); }}
                      title="Hapus Key"
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
