import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound, Plus, Edit2, Trash2, Loader2, Copy, Check,
  Activity, RotateCcw, Zap, Clock, Download, Upload
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import GatewayDocs from '@/components/GatewayDocs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
  key_preview?: string;
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

  // ── EXPORT & IMPORT MODAL STATES ──
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [isExportCopied, setIsExportCopied] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRawInput, setImportRawInput] = useState('');
  const [importParsedItems, setImportParsedItems] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const openExportModal = () => {
    setIsExportModalOpen(true);
  };

  const generateExportContent = () => {
    if (exportFormat === 'json') {
      return JSON.stringify(keys, null, 2);
    }
    const headers = ['ID', 'Name', 'Tenant_ID', 'Status', 'Quota_Per_Minute', 'Allowed_Providers', 'Created_At'];
    const rows = keys.map(k => [
      `"${k.id}"`,
      `"${(k.name || '').replace(/"/g, '""')}"`,
      `"${k.tenant_id}"`,
      `"${k.status}"`,
      k.quota_per_minute || 0,
      `"${(k.allowed_providers || []).join(';')}"`,
      `"${k.created_at}"`
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
  };

  const handleDownloadExport = () => {
    const content = generateExportContent();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `onekeyhub_gateway_keys_${Date.now()}.${exportFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Gateway API Keys berhasil diunduh!');
  };

  const handleCopyExport = async () => {
    const content = generateExportContent();
    await navigator.clipboard.writeText(content).catch(() => {});
    setIsExportCopied(true);
    toast.success('Hasil export disalin ke clipboard!');
    setTimeout(() => setIsExportCopied(false), 2000);
  };

  const openImportModal = () => {
    setImportRawInput('');
    setImportParsedItems([]);
    setIsImportModalOpen(true);
  };

  const parseImportText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setImportParsedItems([]);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      setImportParsedItems(list);
    } catch {
      const lines = trimmed.split(/\r?\n/).filter(Boolean);
      const items = lines.map((line, idx) => ({
        name: `Imported Key #${idx + 1}`,
        tenant_id: line.trim(),
        quota_per_minute: 60,
      }));
      setImportParsedItems(items);
    }
  };

  const handleExecuteImport = async () => {
    if (importParsedItems.length === 0) {
      toast.error('Tidak ada Gateway Key valid untuk di-import');
      return;
    }
    setIsImporting(true);
    let successCount = 0;
    try {
      for (const item of importParsedItems) {
        try {
          await api.post('/api/keys', {
            name: item.name || 'Imported Gateway Key',
            tenant_id: item.tenant_id || 'default',
            quota_per_minute: item.quota_per_minute || 60,
            allowed_providers: item.allowed_providers || [],
          });
          successCount++;
        } catch (e) {
          console.warn('Single key import failed:', e);
        }
      }
      toast.success(`Berhasil mengimpor ${successCount} Gateway Key!`);
      setIsImportModalOpen(false);
      fetchKeys();
    } catch {
      toast.error('Gagal mengimpor Gateway Key');
    } finally {
      setIsImporting(false);
    }
  };

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <p className="text-muted-foreground text-sm">
            Menampilkan <span className="text-foreground font-medium">{keys.length}</span> gateway key
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={openExportModal}
              variant="outline"
              size="sm"
              className="bg-secondary/40 border-primary/40 text-primary hover:bg-primary/10 text-xs gap-1.5 flex-1 sm:flex-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Keys</span>
            </Button>
            <Button
              onClick={openImportModal}
              variant="outline"
              size="sm"
              className="bg-secondary/40 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 text-xs gap-1.5 flex-1 sm:flex-none"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Keys</span>
            </Button>
            <Button onClick={openCreatePage} className="bg-primary hover:bg-primary/90 text-sm gap-2 flex-1 sm:flex-none">
              <Plus className="w-4 h-4" />
              Generate Key Baru
            </Button>
          </div>
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
                        <span className="text-xs text-muted-foreground font-mono bg-secondary/80 px-2 py-0.5 rounded border border-border/40" title="Key Preview (Format: AR_tenantId_secret)">
                          {key.key_preview || `ID: ${key.id.slice(0, 8)}...`}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRotate(key)}
                      title="Generate key rahasia baru (AR_...)"
                      className="text-xs gap-1.5 text-warning border-warning/30 hover:bg-warning/10"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Rotate & Salin
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => copyKey(key.key_preview || key.id, key.id)} title="Salin Preview Key">
                      {copiedId === key.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
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

        {/* ── API Documentation (always visible, collapsed by default) ── */}
        <GatewayDocs
          gatewayKey={keys.find(k => k.status === 'active')?.key_preview || 'YOUR_GATEWAY_KEY'}
          defaultProvider="gemini"
          collapsed={true}
        />
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

      {/* ── EXPORT GATEWAY KEYS MODAL ── */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Export Gateway API Keys
            </DialogTitle>
            <DialogDescription>
              Export daftar Gateway API Keys ke berkas JSON atau CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div>
              <Label className="text-xs mb-1.5 block">Format Export</Label>
              <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                <SelectTrigger className="h-9 text-xs bg-secondary/50 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="json">JSON (.json)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Pratinjau Export ({keys.length} Key)</Label>
              <textarea
                readOnly
                value={generateExportContent()}
                rows={6}
                className="w-full font-mono text-xs p-2.5 rounded-lg bg-black/40 border border-border/50 text-emerald-400 resize-none focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsExportModalOpen(false)}>Tutup</Button>
            <Button variant="outline" onClick={handleCopyExport} className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
              {isExportCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              Salin Clipboard
            </Button>
            <Button onClick={handleDownloadExport} className="bg-primary hover:bg-primary/90 text-white gap-1.5">
              <Download className="w-4 h-4" />
              Download Berkas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IMPORT GATEWAY KEYS MODAL ── */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-500" />
              Import Gateway API Keys
            </DialogTitle>
            <DialogDescription>
              Tempel daftar Gateway API Key (format JSON array atau list Tenant ID 1 per baris).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <textarea
              value={importRawInput}
              onChange={(e) => {
                setImportRawInput(e.target.value);
                parseImportText(e.target.value);
              }}
              placeholder={`Tempel data di sini (JSON Array):\n[\n  { "name": "App 1", "tenant_id": "tenant_1", "quota_per_minute": 60 }\n]`}
              rows={6}
              className="w-full font-mono text-xs p-2.5 rounded-lg bg-secondary/30 border border-border/50 focus:outline-none focus:border-primary"
            />

            <div className="text-xs text-muted-foreground flex justify-between items-center p-2 rounded bg-secondary/20 border border-border/30">
              <span>Terdeteksi: <strong className="text-foreground">{importParsedItems.length} Key</strong></span>
              {importParsedItems.length > 0 && <span className="text-emerald-400 font-medium">Format Valid</span>}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsImportModalOpen(false)}>Batal</Button>
            <Button
              onClick={handleExecuteImport}
              disabled={isImporting || importParsedItems.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isImporting ? 'Mengimpor...' : `Proses Import (${importParsedItems.length} Key)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
