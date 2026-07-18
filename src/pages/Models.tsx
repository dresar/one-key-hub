import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Plus, Edit2, Trash2, Loader2,
  CheckCircle, Shield, Activity, Info, Key, Globe, Eye, ArrowUpRight, Link2
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/api';
import { toast } from 'sonner';

interface ProviderConfig {
  value: string;
  label: string;
  placeholder: string;
  group: string;
  docUrl: string;
  howToGet: string;
  apiKeyField: string;
  description?: string;
}

interface AiModel {
  id: string;
  provider: string;
  model_id: string;
  display_name: string;
  is_default: boolean;
  supports_vision: boolean;
  created_at?: string;
}

interface Credential {
  id: string;
  provider_name: string;
  status: string;
}

export default function Models() {
  const navigate = useNavigate();
  const [models, setModels] = useState<AiModel[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [utilityProviders, setUtilityProviders] = useState<ProviderConfig[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<ProviderConfig | null>(null);
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailProvider, setDetailProvider] = useState<ProviderConfig | null>(null);

  // Model Form states (for adding/updating inside the Edit Provider modal)
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [selectedModelForEdit, setSelectedModelForEdit] = useState<AiModel | null>(null);
  const [formData, setFormData] = useState({
    model_id: '',
    display_name: '',
    is_default: false,
    supports_vision: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Alert state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<AiModel | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [modelsRes, providersRes, credentialsRes] = await Promise.all([
        api.get('/api/models'),
        api.get('/api/providers'),
        api.get('/api/credentials'),
      ]);

      setModels(modelsRes.data?.items || modelsRes.data || []);
      
      // Filter AI and non-AI utility providers
      const allProviders: ProviderConfig[] = providersRes.data?.items || providersRes.data || [];
      const aiProviders = allProviders.filter(p => p.group === 'AI');
      const nonAiProviders = allProviders.filter(p => p.group !== 'AI');
      setProviders(aiProviders);
      setUtilityProviders(nonAiProviders);

      setCredentials(credentialsRes.data?.items || credentialsRes.data || []);
    } catch (error) {
      console.error('Error fetching models page data:', error);
      toast.error('Gagal memuat data halaman model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditModal = (prov: ProviderConfig) => {
    setEditProvider(prov);
    setIsAddingModel(false);
    setSelectedModelForEdit(null);
    setFormData({
      model_id: '',
      display_name: '',
      is_default: false,
      supports_vision: false,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDetailModal = (prov: ProviderConfig) => {
    setDetailProvider(prov);
    setIsDetailModalOpen(true);
  };

  const handleStartEditModel = (model: AiModel) => {
    setSelectedModelForEdit(model);
    setFormData({
      model_id: model.model_id,
      display_name: model.display_name,
      is_default: model.is_default,
      supports_vision: model.supports_vision,
    });
    setIsAddingModel(true);
  };

  const handleStartAddModel = () => {
    setSelectedModelForEdit(null);
    setFormData({
      model_id: '',
      display_name: '',
      is_default: false,
      supports_vision: false,
    });
    setIsAddingModel(true);
  };

  const handleSubmitModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProvider) return;
    if (!formData.model_id.trim() || !formData.display_name.trim()) {
      toast.error('Semua field wajib diisi');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        provider: editProvider.value,
        model_id: formData.model_id.trim(),
        display_name: formData.display_name.trim(),
        is_default: formData.is_default,
        supports_vision: formData.supports_vision,
      };

      if (selectedModelForEdit) {
        await api.patch(`/api/models/${selectedModelForEdit.id}`, payload);
        toast.success('Model AI berhasil diperbarui');
      } else {
        await api.post('/api/models', payload);
        toast.success('Model AI berhasil ditambahkan');
      }
      
      setIsAddingModel(false);
      setSelectedModelForEdit(null);
      
      // Refresh data
      const modelsRes = await api.get('/api/models');
      setModels(modelsRes.data?.items || modelsRes.data || []);
    } catch (error: any) {
      console.error('Error saving model:', error);
      toast.error(error.response?.data?.error || 'Gagal menyimpan model AI');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteAlert = (model: AiModel) => {
    setModelToDelete(model);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteModel = async () => {
    if (!modelToDelete) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/models/${modelToDelete.id}`);
      toast.success('Model AI berhasil dihapus');
      setIsDeleteDialogOpen(false);
      setModelToDelete(null);
      
      // Refresh data
      const modelsRes = await api.get('/api/models');
      setModels(modelsRes.data?.items || modelsRes.data || []);
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error('Gagal menghapus model AI');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get models for a specific provider
  const getProviderModels = (providerValue: string) => {
    return models.filter(m => m.provider === providerValue);
  };

  // Get credentials count for a specific provider
  const getProviderCredentialsCount = (providerValue: string) => {
    return credentials.filter(c => c.provider_name === providerValue).length;
  };

  return (
    <div className="min-h-screen">
      <AppHeader title="Model & Layanan AI Management" subtitle="Kelola model AI serta layanan utility & media (Cloudinary, ImageKit, dll) secara terpadu" />

      <div className="p-4 md:p-6 space-y-6">
        
        {/* Grid 4 Horizontal Dashboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Provider AI', value: providers.length, icon: Cpu, color: 'text-primary' },
            { label: 'Total Model AI', value: models.length, icon: Activity, color: 'text-accent' },
            { label: 'Layanan Non-AI/Utility', value: utilityProviders.length, icon: Globe, color: 'text-green-500' },
            { label: 'Total API Keys', value: credentials.length, icon: Key, color: 'text-warning' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-4 flex items-center gap-3 border border-border/40"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary/60 flex items-center justify-center">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="ai" className="w-full space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-secondary/35 border border-border/40 p-1 rounded-xl">
            <TabsTrigger value="ai" className="flex items-center gap-2 rounded-lg py-2">
              <Cpu className="w-4 h-4" /> Provider AI & Model
            </TabsTrigger>
            <TabsTrigger value="utility" className="flex items-center gap-2 rounded-lg py-2">
              <Globe className="w-4 h-4" /> Utility & Media
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-4">
            <h2 className="text-base font-bold text-foreground">Daftar Provider AI & Model</h2>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : providers.length === 0 ? (
              <div className="glass rounded-xl">
                <EmptyState
                  icon={Cpu}
                  title="Tidak ada provider AI"
                  description="Pastikan provider AI diaktifkan di konfigurasi backend Anda."
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {providers.map((prov, idx) => {
                    const provModels = getProviderModels(prov.value);
                    const keysCount = getProviderCredentialsCount(prov.value);

                    return (
                      <motion.div
                        key={prov.value}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.04 }}
                        className="glass rounded-xl p-5 border border-border/40 flex flex-col justify-between hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-lg">{prov.label}</h3>
                            <span className="text-[10px] bg-secondary/80 px-2 py-0.5 rounded-full border border-border/50 font-semibold uppercase text-primary tracking-wider font-mono">
                              {prov.group}
                            </span>
                          </div>
                          
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                            {prov.description || prov.howToGet || 'Provider AI terintegrasi untuk Gateway.'}
                          </p>

                          <div className="grid grid-cols-2 gap-3 mb-6 bg-secondary/10 p-3 rounded-lg border border-border/20 text-xs">
                            <div>
                              <span className="text-muted-foreground">Kunci API:</span>
                              <p className="font-semibold text-sm mt-0.5">{keysCount} Kunci</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Model AI:</span>
                              <p className="font-semibold text-sm mt-0.5">{provModels.length} Model</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                          <Button 
                            onClick={() => handleOpenDetailModal(prov)} 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1 text-xs hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                          >
                            <Info className="w-3.5 h-3.5 mr-1" />
                            Detail
                          </Button>
                          <Button 
                            onClick={() => handleOpenEditModal(prov)} 
                            size="sm" 
                            className="flex-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            Edit Model
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="utility" className="space-y-4">
            <h2 className="text-base font-bold text-foreground">Daftar Layanan Utility & Media</h2>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : utilityProviders.length === 0 ? (
              <div className="glass rounded-xl">
                <EmptyState
                  icon={Globe}
                  title="Tidak ada layanan non-AI"
                  description="Pastikan layanan non-AI diaktifkan di konfigurasi backend Anda."
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {utilityProviders.map((prov, idx) => {
                    const keysCount = getProviderCredentialsCount(prov.value);

                    return (
                      <motion.div
                        key={prov.value}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.04 }}
                        className="glass rounded-xl p-5 border border-border/40 flex flex-col justify-between hover:border-green-500/40 hover:shadow-lg hover:shadow-green-500/5 transition-all duration-300"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-lg">{prov.label}</h3>
                            <span className="text-[10px] bg-secondary/80 px-2 py-0.5 rounded-full border border-border/50 font-semibold uppercase text-green-500 tracking-wider font-mono">
                              {prov.group}
                            </span>
                          </div>
                          
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                            {prov.description || prov.howToGet || 'Layanan utility terintegrasi untuk proxy universal.'}
                          </p>

                          <div className="grid grid-cols-2 gap-3 mb-6 bg-secondary/10 p-3 rounded-lg border border-border/20 text-xs">
                            <div>
                              <span className="text-muted-foreground">Kunci API Terdaftar:</span>
                              <p className="font-semibold text-sm mt-0.5">{keysCount} Kunci</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Format Placeholder:</span>
                              <p className="font-semibold font-mono text-[10px] mt-0.5 truncate" title={prov.placeholder}>{prov.placeholder}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                          <Button 
                            onClick={() => handleOpenDetailModal(prov)} 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1 text-xs hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                          >
                            <Info className="w-3.5 h-3.5 mr-1" />
                            Detail
                          </Button>
                          <Button 
                            onClick={() => navigate('/providers')} 
                            size="sm" 
                            className="flex-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20"
                          >
                            <Key className="w-3.5 h-3.5 mr-1" />
                            Kelola Kunci
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Models Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        {editProvider && (
          <DialogContent className="bg-card border-border max-w-2xl overflow-y-auto max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="text-xl">Kelola Model AI - {editProvider.label}</DialogTitle>
              <DialogDescription>
                Konfigurasi model AI untuk provider {editProvider.label}. Anda dapat menambah, mengedit, atau menghapus model.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 my-2">
              
              {/* Form Input Model (collapsible/conditional state inline) */}
              {isAddingModel ? (
                <form onSubmit={handleSubmitModel} className="p-4 rounded-xl border border-border/50 bg-secondary/15 space-y-4">
                  <h4 className="font-bold text-sm text-foreground">
                    {selectedModelForEdit ? 'Edit Model' : 'Tambah Model Baru'}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Display Name (Nama Tampilan)</Label>
                      <Input
                        placeholder="contoh: Gemini 2.5 Flash"
                        value={formData.display_name}
                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                        className="bg-secondary/50"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Model ID (API Identifier)</Label>
                      <Input
                        placeholder="contoh: gemini-2.5-flash"
                        value={formData.model_id}
                        onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                        className="bg-secondary/50 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-secondary/5">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Model Default</Label>
                        <p className="text-[10px] text-muted-foreground">Default jika request model kosong</p>
                      </div>
                      <Switch
                        checked={formData.is_default}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-secondary/5">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Mendukung Visi</Label>
                        <p className="text-[10px] text-muted-foreground">Mendukung input gambar / multimodal</p>
                      </div>
                      <Switch
                        checked={formData.supports_vision}
                        onCheckedChange={(checked) => setFormData({ ...formData, supports_vision: checked })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/20">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingModel(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={isSubmitting} size="sm" className="bg-primary hover:bg-primary/90 text-white">
                      {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      Simpan Model
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center bg-secondary/10 p-3 rounded-xl border border-border/25">
                  <span className="text-xs text-muted-foreground">Model terdaftar: <strong>{getProviderModels(editProvider.value).length} model</strong></span>
                  <Button onClick={handleStartAddModel} size="sm" className="bg-primary hover:bg-primary/95 text-xs text-white">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Tambah Model Baru
                  </Button>
                </div>
              )}

              {/* Models List for this provider */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Daftar Model</Label>
                {getProviderModels(editProvider.value).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">Belum ada model AI untuk provider ini. Silakan tambahkan model baru.</p>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {getProviderModels(editProvider.value).map((model) => (
                      <div key={model.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-secondary/5 hover:border-border transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{model.display_name}</span>
                            {model.is_default && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] bg-green-500/10 text-green-500 border border-green-500/20 font-bold uppercase">
                                DEFAULT
                              </span>
                            )}
                            {model.supports_vision && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] bg-accent/10 text-accent border border-accent/20 font-bold uppercase flex items-center gap-0.5">
                                <Eye className="w-2.5 h-2.5" /> VISION
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">ID: {model.model_id}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleStartEditModel(model)} className="w-8 h-8">
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteAlert(model)} className="w-8 h-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-border/20 pt-4 mt-2">
              <Button onClick={() => setIsEditModalOpen(false)} className="bg-primary hover:bg-primary/95 text-white">
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Detail Provider Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        {detailProvider && (
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Detail Provider: {detailProvider.label}
              </DialogTitle>
              <DialogDescription>
                Informasi detail dan dokumentasi resmi pengambilan API key
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-3 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Grup Provider:</span>
                <p className="font-semibold text-primary">{detailProvider.group}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Format Kunci / API Key:</span>
                <p className="font-mono text-xs bg-secondary/50 p-2 rounded border border-border/25">{detailProvider.placeholder}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Cara Mengambil API Key:</span>
                <p className="text-xs text-muted-foreground bg-secondary/15 p-3 rounded-xl leading-relaxed border border-border/20 whitespace-pre-line">
                  {detailProvider.howToGet || 'Silakan daftar di konsol resmi provider untuk mendapatkan API key gratis.'}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Tautan Resmi:</span>
                <a
                  href={detailProvider.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-medium transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Kunjungi Konsol Developer
                  </span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
            </div>

            <DialogFooter className="border-t border-border/20 pt-4 mt-2">
              <Button onClick={() => setIsDetailModalOpen(false)} className="bg-primary hover:bg-primary/95 text-white">
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Model AI</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus model "{modelToDelete?.display_name}"? Model ini tidak akan lagi terdaftar di database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteModel} className="bg-destructive hover:bg-destructive/90 text-white">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
