import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  KeyRound, Plus, Edit2, Trash2, Power, PowerOff, Loader2, 
  Upload, Download, GripVertical, Star, ChevronDown 
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Provider {
  id: string;
  name: string;
}

interface ProviderModel {
  id: string;
  name: string;
  model_id: string;
}

interface ApiKey {
  id: string;
  provider_id: string;
  model_id: string | null;
  api_key: string;
  name: string | null;
  is_active: boolean;
  priority: number;
  total_requests: number;
  failed_requests: number;
  last_error: string | null;
  created_at: string;
  provider_models?: ProviderModel;
}

const DEFAULT_MODELS = [
  { name: 'Gemini 2.5 Flash', model_id: 'gemini-2.5-flash' },
  { name: 'Gemini 2.5 Pro', model_id: 'gemini-2.5-pro' },
  { name: 'Gemini 2.0 Flash', model_id: 'gemini-2.0-flash' },
  { name: 'Llama 3.3 70B', model_id: 'llama-3.3-70b-versatile' },
  { name: 'GPT-4o', model_id: 'gpt-4o' },
  { name: 'GPT-4o Mini', model_id: 'gpt-4o-mini' },
];

export default function ApiKeys() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    api_key: '',
    name: '',
    model_id: '',
    is_active: true,
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (selectedProviderId) {
      fetchApiKeys();
      fetchModels();
    }
  }, [selectedProviderId]);

  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('id, name')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) throw error;
      setProviders(data || []);
      if (data && data.length > 0) {
        setSelectedProviderId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModels = async () => {
    if (!selectedProviderId) return;
    
    try {
      const { data, error } = await supabase
        .from('provider_models')
        .select('*')
        .eq('provider_id', selectedProviderId);

      if (error) throw error;
      setModels(data || []);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const fetchApiKeys = async () => {
    if (!selectedProviderId) return;

    try {
      const { data, error } = await supabase
        .from('provider_api_keys')
        .select(`
          *,
          provider_models (id, name, model_id)
        `)
        .eq('provider_id', selectedProviderId)
        .order('priority', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const openCreateModal = () => {
    setSelectedKey(null);
    setFormData({ api_key: '', name: '', model_id: '', is_active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (key: ApiKey) => {
    setSelectedKey(key);
    setFormData({
      api_key: key.api_key,
      name: key.name || '',
      model_id: key.model_id || '',
      is_active: key.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.api_key.trim()) {
      toast.error('API Key wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensure model exists
      let modelId = formData.model_id;
      if (modelId && !models.find(m => m.id === modelId)) {
        // Create the model if it doesn't exist
        const selectedModel = DEFAULT_MODELS.find(m => m.model_id === modelId);
        if (selectedModel) {
          const { data: newModel, error: modelError } = await supabase
            .from('provider_models')
            .insert({
              provider_id: selectedProviderId,
              name: selectedModel.name,
              model_id: selectedModel.model_id,
            })
            .select()
            .single();

          if (modelError) throw modelError;
          modelId = newModel.id;
        }
      }

      if (selectedKey) {
        const { error } = await supabase
          .from('provider_api_keys')
          .update({
            api_key: formData.api_key,
            name: formData.name || null,
            model_id: modelId || null,
            is_active: formData.is_active,
          })
          .eq('id', selectedKey.id);

        if (error) throw error;
        toast.success('API Key berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('provider_api_keys')
          .insert({
            provider_id: selectedProviderId,
            api_key: formData.api_key,
            name: formData.name || null,
            model_id: modelId || null,
            is_active: formData.is_active,
            priority: apiKeys.length,
          });

        if (error) throw error;
        toast.success('API Key berhasil ditambahkan');
      }

      setIsModalOpen(false);
      fetchApiKeys();
      fetchModels();
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error('Gagal menyimpan API Key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedKey) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('provider_api_keys')
        .delete()
        .eq('id', selectedKey.id);

      if (error) throw error;
      toast.success('API Key berhasil dihapus');
      setIsDeleteDialogOpen(false);
      fetchApiKeys();
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Gagal menghapus API Key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleKeyStatus = async (key: ApiKey) => {
    try {
      const { error } = await supabase
        .from('provider_api_keys')
        .update({ is_active: !key.is_active })
        .eq('id', key.id);

      if (error) throw error;
      toast.success(`API Key ${!key.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchApiKeys();
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast.error('Gagal mengubah status');
    }
  };

  const setPrimaryKey = async (key: ApiKey) => {
    try {
      // Set all other keys to lower priority
      await supabase
        .from('provider_api_keys')
        .update({ priority: 0 })
        .eq('provider_id', selectedProviderId)
        .neq('id', key.id);

      // Set this key to highest priority
      const { error } = await supabase
        .from('provider_api_keys')
        .update({ priority: 100 })
        .eq('id', key.id);

      if (error) throw error;
      toast.success('API Key dijadikan utama');
      fetchApiKeys();
    } catch (error) {
      console.error('Error setting primary key:', error);
      toast.error('Gagal mengubah prioritas');
    }
  };

  const handleReorder = async (newOrder: ApiKey[]) => {
    setApiKeys(newOrder);
    
    // Update priorities based on new order
    try {
      const updates = newOrder.map((key, index) => ({
        id: key.id,
        priority: newOrder.length - index,
      }));

      for (const update of updates) {
        await supabase
          .from('provider_api_keys')
          .update({ priority: update.priority })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error reordering:', error);
      fetchApiKeys(); // Revert on error
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let keys: string[] = [];

      if (file.name.endsWith('.json')) {
        const json = JSON.parse(text);
        keys = Array.isArray(json) ? json : [json];
      } else if (file.name.endsWith('.csv')) {
        keys = text.split('\n').filter(Boolean);
      } else {
        keys = text.split('\n').filter(Boolean);
      }

      let imported = 0;
      for (const key of keys) {
        const keyItem = key as string | { api_key?: string; key?: string };
        const apiKey = typeof keyItem === 'string' ? keyItem.trim() : (keyItem.api_key || keyItem.key);
        if (apiKey) {
          const { error } = await supabase
            .from('provider_api_keys')
            .insert({
              provider_id: selectedProviderId,
              api_key: apiKey,
              priority: apiKeys.length + imported,
            });
          if (!error) imported++;
        }
      }

      toast.success(`${imported} API Key berhasil diimport`);
      fetchApiKeys();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Gagal mengimport file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = (format: 'txt' | 'json' | 'csv') => {
    let content = '';
    const keys = apiKeys.map(k => k.api_key);

    if (format === 'json') {
      content = JSON.stringify(keys, null, 2);
    } else if (format === 'csv') {
      content = 'api_key\n' + keys.join('\n');
    } else {
      content = keys.join('\n');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-keys.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  return (
    <div className="min-h-screen">
      <AppHeader title="API Key Provider" subtitle="Kelola API key untuk setiap provider" />
      
      <div className="p-6">
        {/* Provider Selector */}
        <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
              <SelectTrigger className="w-[200px] bg-secondary/50">
                <SelectValue placeholder="Pilih Provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <p className="text-muted-foreground">
              Total: <span className="text-foreground font-medium">{apiKeys.length}</span> API key
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json,.csv"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedProviderId}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={apiKeys.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('txt')}>
                  Export sebagai TXT
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')}>
                  Export sebagai JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  Export sebagai CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              onClick={openCreateModal} 
              disabled={!selectedProviderId}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah API Key
            </Button>
          </div>
        </div>

        {/* API Keys List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !selectedProviderId ? (
          <div className="glass rounded-xl">
            <EmptyState
              icon={KeyRound}
              title="Pilih Provider"
              description="Pilih provider terlebih dahulu untuk melihat dan mengelola API key."
            />
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="glass rounded-xl">
            <EmptyState
              icon={KeyRound}
              title="Belum ada API Key"
              description={`Tambahkan API key untuk provider ${selectedProvider?.name} untuk mulai menggunakan unified API.`}
              action={
                <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah API Key Pertama
                </Button>
              }
            />
          </div>
        ) : (
          <Reorder.Group values={apiKeys} onReorder={handleReorder} className="space-y-3">
            <AnimatePresence>
              {apiKeys.map((key, index) => (
                <Reorder.Item
                  key={key.id}
                  value={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.03 }}
                  className="glass rounded-xl p-4 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="w-5 h-5 text-muted-foreground shrink-0" />
                    
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      key.priority >= 100 ? 'bg-primary/20' : 'bg-secondary'
                    }`}>
                      {key.priority >= 100 ? (
                        <Star className="w-5 h-5 text-primary fill-primary" />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm">{maskApiKey(key.api_key)}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
                          key.is_active ? 'status-active' : 'status-inactive'
                        }`}>
                          {key.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                        {key.failed_requests > 0 && (
                          <span className="status-warning px-2 py-0.5 rounded-full text-xs border">
                            {key.failed_requests} gagal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {key.name && <span>{key.name}</span>}
                        {key.provider_models && (
                          <span className="font-mono">{key.provider_models.name}</span>
                        )}
                        <span>{key.total_requests} request</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPrimaryKey(key)}
                        className={key.priority >= 100 ? 'text-primary' : 'text-muted-foreground hover:text-primary'}
                        title="Jadikan Utama"
                      >
                        <Star className={`w-4 h-4 ${key.priority >= 100 ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleKeyStatus(key)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {key.is_active ? (
                          <PowerOff className="w-4 h-4" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(key)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedKey(key);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {selectedKey ? 'Edit API Key' : 'Tambah API Key Baru'}
            </DialogTitle>
            <DialogDescription>
              {selectedKey
                ? 'Perbarui informasi API key'
                : `Tambahkan API key baru untuk ${selectedProvider?.name}`}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                placeholder="Masukkan API key"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                className="bg-secondary/50 font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama (opsional)</Label>
              <Input
                id="name"
                placeholder="contoh: Key Utama, Key Backup"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="model">Model AI</Label>
              <Select value={formData.model_id} onValueChange={(v) => setFormData({ ...formData, model_id: v })}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Pilih model (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_MODELS.map((model) => (
                    <SelectItem key={model.model_id} value={model.model_id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Status Aktif</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
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
                    Menyimpan...
                  </>
                ) : (
                  'Simpan'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus API key ini? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
