import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  KeyRound, ArrowLeft, Loader2, 
  Copy, Shield, Settings, CheckCircle, HelpCircle, HardDrive, Cpu
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import GatewayDocs from '@/components/GatewayDocs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/services/api';
import { toast } from 'sonner';

interface ProviderItem {
  value: string;
  label: string;
  group: string;
}

export default function ApiKeyForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providerOptions, setProviderOptions] = useState<ProviderItem[]>([]);
  const [models, setModels] = useState<{ model_id: string; display_name: string; provider: string }[]>([]);
  const [createdPlaintext, setCreatedPlaintext] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    quota_per_minute: 60,
    status: 'active',
    provider: '_all', // Default: All providers (Universal key)
    model_type: 'text',
    model_id: '',
  });

  useEffect(() => {
    fetchProviders();
    fetchModels();
    if (isEditMode) {
      fetchKeyDetails();
    }
  }, [id]);

  const fetchProviders = async () => {
    try {
      const { data } = await api.get('/api/providers');
      const items: ProviderItem[] = data?.items || data || [];
      setProviderOptions(items);
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error('Gagal memuat list provider');
    }
  };

  const fetchModels = async () => {
    try {
      const { data } = await api.get('/api/models');
      setModels(data?.items || data || []);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const fetchKeyDetails = async () => {
    try {
      const { data } = await api.get('/api/keys');
      const allKeys = data?.items || data || [];
      const targetKey = allKeys.find((k: any) => k.id === id);
      
      if (!targetKey) {
        toast.error('Key tidak ditemukan');
        navigate('/api-keys');
        return;
      }

      setFormData({
        name: targetKey.name || '',
        quota_per_minute: targetKey.quota_per_minute || 60,
        status: targetKey.status || 'active',
        provider: targetKey.provider || '_all',
        model_type: targetKey.model_type || 'text',
        model_id: targetKey.model_id || '',
      });
    } catch (error) {
      console.error('Error fetching key details:', error);
      toast.error('Gagal memuat detail key');
    } finally {
      setIsLoading(false);
    }
  };

  const copyPlaintextKey = async () => {
    if (!createdPlaintext) return;
    await navigator.clipboard.writeText(createdPlaintext).catch(() => {});
    toast.success('Key berhasil disalin ke clipboard!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const isUniversal = !formData.provider || formData.provider === '_all';
      const payload = {
        name: formData.name || undefined,
        quota_per_minute: formData.quota_per_minute,
        status: formData.status,
        provider: isUniversal ? '' : formData.provider,
        model_type: formData.model_type,
        model_id: isUniversal ? '' : (formData.model_id || ''),
        allowed_providers: isUniversal ? null : [formData.provider],
      };

      if (isEditMode) {
        await api.patch(`/api/keys/${id}`, payload);
        toast.success('Gateway Key berhasil diperbarui');
        navigate('/api-keys');
      } else {
        const { data } = await api.post('/api/keys', payload);
        const plaintext = data.plaintext_key || data.key;
        if (plaintext) {
          setCreatedPlaintext(plaintext);
          await navigator.clipboard.writeText(plaintext).catch(() => {});
          toast.success('Key baru berhasil dibuat dan disalin!');
        } else {
          toast.success('Gateway Key berhasil dibuat');
          navigate('/api-keys');
        }
      }
    } catch (error: any) {
      console.error('Error saving key:', error);
      toast.error(error.response?.data?.error || 'Gagal menyimpan key');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group providers by group name
  const groupedProviders = providerOptions.reduce((acc: Record<string, ProviderItem[]>, item) => {
    const groupName = item.group || 'Lainnya';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(item);
    return acc;
  }, {});

  // Group title mappings
  const groupTitles: Record<string, string> = {
    'AI': '🤖 AI & LLM Models',
    'Media': '📸 Media CDN & Cloud Storage (Cloudinary, ImageKit, Uploadcare, RemoveBG)',
    'Storage': '💾 Cloud Storage & Database (Supabase, Firebase, Appwrite, Neon)',
    'Image': '🖼️ Stock Media & GIFs (Pexels, Pixabay, Unsplash, Giphy)',
    'Search': '🔍 Search Engines & Scrapers (Serper, SerpAPI, Brave, Tavily, Exa)',
    'Weather': '🌤️ Weather Services',
    'Location': '🗺️ Maps & Geocoding',
    'Finance': '💱 Currency & Finance',
    'News': '📰 News API',
    'Tools': '🛠️ Utilities & Tools',
  };

  // Filter models depending on selected provider
  const isUniversal = !formData.provider || formData.provider === '_all';
  const filteredModels = !isUniversal
    ? models.filter(m => m.provider.toLowerCase() === formData.provider.toLowerCase())
    : [];

  return (
    <div className="min-h-screen">
      <AppHeader
        title={isEditMode ? "Edit Gateway API Key" : "Generate Gateway API Key Baru"}
        subtitle={isEditMode ? "Perbarui setelan khusus gateway key Anda" : "Buat gateway key baru untuk akses provider AI, Storage CDN (Cloudinary/ImageKit), atau Universal Key"}
      />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        
        {/* Back Link */}
        <div className="flex items-center">
          <Link to="/api-keys" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Gateway Keys
          </Link>
        </div>

        {/* If Plaintext Key was generated successfully */}
        {createdPlaintext && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            {/* Key reveal card */}
            <div className="glass border-green-500/20 bg-green-500/5 p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <h3 className="font-bold text-green-500 text-lg">Gateway Key Berhasil Dibuat!</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Harap salin dan simpan key ini di tempat yang aman. Untuk alasan keamanan, key ini{' '}
                <strong>hanya akan ditampilkan SEKALI ini saja</strong>.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 font-mono text-sm bg-secondary/80 border border-border/50 px-4 py-3 rounded-xl break-all select-all">
                  {createdPlaintext}
                </div>
                <Button onClick={copyPlaintextKey} className="bg-green-600 hover:bg-green-700 text-white gap-2 h-auto py-3">
                  <Copy className="w-4 h-4" />
                  Salin Key
                </Button>
              </div>

              <div className="pt-1">
                <Button onClick={() => navigate('/api-keys')} variant="outline" className="text-sm">
                  Selesai & Kembali ke Daftar Key
                </Button>
              </div>
            </div>

            {/* Full docs — key pre-filled, expanded by default */}
            <GatewayDocs
              gatewayKey={createdPlaintext}
              defaultProvider={formData.provider === '_all' ? 'gemini' : (formData.provider || 'gemini')}
              collapsed={false}
            />
          </motion.div>
        )}

        {!createdPlaintext && (
          isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-6 border border-border/40 space-y-6"
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Step 1: Select Provider & Model */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Pilih Target Provider & Model
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Primary Provider Selector */}
                    <div className="space-y-2">
                      <Label htmlFor="provider-select">1. Target Provider API</Label>
                      <Select 
                        value={formData.provider || '_all'} 
                        onValueChange={(val) => setFormData({ ...formData, provider: val, model_id: '' })}
                      >
                        <SelectTrigger id="provider-select" className="bg-secondary/50 border-border/40">
                          <SelectValue placeholder="Semua Provider (Full Gateway Access)" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border max-h-[350px]">
                          <SelectItem value="_all" className="font-semibold text-primary">
                            🌐 Semua Provider (Full Gateway Access / AI & Storage CDN)
                          </SelectItem>
                          
                          {Object.keys(groupedProviders).map((grp) => (
                            <SelectGroup key={grp}>
                              <SelectLabel className="text-xs uppercase text-muted-foreground font-bold pt-2">
                                {groupTitles[grp] || grp}
                              </SelectLabel>
                              {groupedProviders[grp].map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Specific Model Selector */}
                    <div className="space-y-2">
                      <Label htmlFor="model-select">2. Model Khusus (Opsional)</Label>
                      <Select 
                        value={formData.model_id || '_none'} 
                        onValueChange={(val) => setFormData({ ...formData, model_id: val === '_none' ? '' : val })}
                        disabled={isUniversal}
                      >
                        <SelectTrigger id="model-select" className="bg-secondary/50 border-border/40">
                          <SelectValue placeholder={isUniversal ? "Semua Model / Storage CDN (Bebas)" : "Semua Model (Bebas)"} />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="_none">Semua Model (Bebas)</SelectItem>
                          {filteredModels.map(m => (
                            <SelectItem key={m.model_id} value={m.model_id}>
                              {m.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <hr className="border-border/30" />

                {/* Step 2: Key Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Setelan Gateway Key
                  </h3>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="key-name">Nama Gateway Key</Label>
                      <Input
                        id="key-name"
                        placeholder="contoh: Key Website Main / CDN Storage Key"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-secondary/50 border-border/40 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="key-quota">Quota Limit per Menit (RPM)</Label>
                      <Input
                        id="key-quota"
                        type="number"
                        min={1}
                        max={100000}
                        value={formData.quota_per_minute}
                        onChange={(e) => setFormData({ ...formData, quota_per_minute: Number(e.target.value) })}
                        className="bg-secondary/50 border-border/40 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="model-type-select">Batasan Tipe Model</Label>
                      <Select 
                        value={formData.model_type || '_all'} 
                        onValueChange={(val) => setFormData({ ...formData, model_type: val === '_all' ? '' : val })}
                      >
                        <SelectTrigger id="model-type-select" className="bg-secondary/50 border-border/40">
                          <SelectValue placeholder="Semua Tipe (Bebas)" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="_all">Semua Tipe (Bebas)</SelectItem>
                          <SelectItem value="text">Text Generation (Chat/Completions)</SelectItem>
                          <SelectItem value="image">Image / Media Generation & Storage</SelectItem>
                          <SelectItem value="audio">Audio Generation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {isEditMode && (
                      <div className="space-y-2">
                        <Label htmlFor="status-select">Status Key</Label>
                        <Select 
                          value={formData.status} 
                          onValueChange={(val) => setFormData({ ...formData, status: val })}
                        >
                          <SelectTrigger id="status-select" className="bg-secondary/50 border-border/40">
                            <SelectValue placeholder="Pilih Status" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="active">Active (Dapat Digunakan)</SelectItem>
                            <SelectItem value="inactive">Inactive (Dinonaktifkan Sementara)</SelectItem>
                            <SelectItem value="suspended">Suspended (Ditangguhkan Total)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 border-t border-border/30 pt-4">
                  <Button type="button" variant="ghost" onClick={() => navigate('/api-keys')}>
                    Batal
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="bg-primary hover:bg-primary/90 min-w-[120px]"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</>
                    ) : (
                      isEditMode ? 'Simpan Perubahan' : 'Generate Key'
                    )}
                  </Button>
                </div>

              </form>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}
