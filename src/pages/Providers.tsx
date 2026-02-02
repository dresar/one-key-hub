import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Plus, Edit2, Trash2, Power, PowerOff, Loader2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Provider {
  id: string;
  name: string;
  base_url: string;
  is_active: boolean;
  priority: number;
  created_at: string;
}

export default function Providers() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    base_url: '',
    is_active: true,
  });

  useEffect(() => {
    fetchProviders();

    const channel = supabase
      .channel('providers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'providers' },
        () => fetchProviders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error('Gagal memuat data provider');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedProvider(null);
    setFormData({ name: '', base_url: '', is_active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (provider: Provider) => {
    setSelectedProvider(provider);
    setFormData({
      name: provider.name,
      base_url: provider.base_url,
      is_active: provider.is_active,
    });
    setIsModalOpen(true);
  };

  const openDeleteDialog = (provider: Provider) => {
    setSelectedProvider(provider);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.base_url.trim()) {
      toast.error('Nama dan Base URL wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedProvider) {
        // Update
        const { error } = await supabase
          .from('providers')
          .update({
            name: formData.name,
            base_url: formData.base_url,
            is_active: formData.is_active,
          })
          .eq('id', selectedProvider.id);

        if (error) throw error;
        toast.success('Provider berhasil diperbarui');
      } else {
        // Create
        const { error } = await supabase
          .from('providers')
          .insert({
            name: formData.name,
            base_url: formData.base_url,
            is_active: formData.is_active,
            priority: providers.length,
          });

        if (error) throw error;
        toast.success('Provider berhasil ditambahkan');
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving provider:', error);
      toast.error('Gagal menyimpan provider');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProvider) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('providers')
        .delete()
        .eq('id', selectedProvider.id);

      if (error) throw error;
      toast.success('Provider berhasil dihapus');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast.error('Gagal menghapus provider');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProviderStatus = async (provider: Provider) => {
    try {
      const { error } = await supabase
        .from('providers')
        .update({ is_active: !provider.is_active })
        .eq('id', provider.id);

      if (error) throw error;
      toast.success(`Provider ${!provider.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
    } catch (error) {
      console.error('Error toggling provider:', error);
      toast.error('Gagal mengubah status provider');
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader title="Provider AI" subtitle="Kelola provider dan endpoint API" />
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <p className="text-muted-foreground">
            Total: <span className="text-foreground font-medium">{providers.length}</span> provider
          </p>
          <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Provider
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : providers.length === 0 ? (
          <div className="glass rounded-xl">
            <EmptyState
              icon={Server}
              title="Belum ada provider"
              description="Tambahkan provider AI seperti Gemini, Groq, atau OpenAI-compatible untuk mulai menggunakan unified API."
              action={
                <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Provider Pertama
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {providers.map((provider, index) => (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass rounded-xl p-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      provider.is_active ? 'bg-primary/10' : 'bg-secondary'
                    }`}>
                      <Server className={`w-6 h-6 ${
                        provider.is_active ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {provider.name}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
                          provider.is_active ? 'status-active' : 'status-inactive'
                        }`}>
                          {provider.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </h3>
                      <p className="text-sm text-muted-foreground font-mono">{provider.base_url}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleProviderStatus(provider)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {provider.is_active ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(provider)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(provider)}
                      className="text-muted-foreground hover:text-destructive"
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
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {selectedProvider ? 'Edit Provider' : 'Tambah Provider Baru'}
            </DialogTitle>
            <DialogDescription>
              {selectedProvider
                ? 'Perbarui informasi provider AI'
                : 'Tambahkan provider AI baru seperti Gemini, Groq, atau OpenAI-compatible'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Provider</Label>
              <Input
                id="name"
                placeholder="contoh: Gemini, Groq, OpenAI"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="base_url">Base URL API</Label>
              <Input
                id="base_url"
                placeholder="contoh: https://generativelanguage.googleapis.com"
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                className="bg-secondary/50 font-mono text-sm"
              />
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
            <AlertDialogTitle>Hapus Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus provider "{selectedProvider?.name}"? 
              Semua API key yang terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.
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
