import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  KeyRound, Plus, Edit2, Trash2, Power, PowerOff, Loader2, 
  Upload, Download, GripVertical, Star, ChevronDown, PlayCircle, MessageSquare,
  CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { io } from 'socket.io-client';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import api, { SOCKET_URL } from '@/services/api';
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

type KeyStatus = 'active' | 'warning' | 'error' | 'testing' | 'unknown';

const parseProviderError = (errorString: string): { message: string, details?: any } => {
  if (!errorString) return { message: 'Unknown error' };
  
  try {
    const parsed = JSON.parse(errorString);
    
    // Handle Google/Common format: { error: { code, message, ... } }
    if (parsed.error && parsed.error.message) {
      return { 
        message: parsed.error.message, 
        details: parsed 
      };
    }
    
    // Handle Anthropic/Other formats
    if (parsed.error && typeof parsed.error === 'string') {
        return { message: parsed.error, details: parsed };
    }

    // Handle simple message object
    if (parsed.message) {
      return { 
        message: parsed.message,
        details: parsed 
      };
    }
    
    return { message: errorString, details: parsed };
  } catch (e) {
    // If not JSON, return as is
    return { message: errorString };
  }
};

export default function ApiKeys() {
  console.log('ApiKeys component rendered - v2 (Chat Modal Update)');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chatMessage, setChatMessage] = useState('Hello, are you working?');
  const [selectedChatModelId, setSelectedChatModelId] = useState<string>('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [testingKeys, setTestingKeys] = useState<Set<string>>(new Set());
  const [keyStatuses, setKeyStatuses] = useState<Record<string, KeyStatus>>({});
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

  // Realtime subscription for API key updates
  useEffect(() => {
    const socket = io(SOCKET_URL);
    
    socket.on('apikeys:update', () => {
      if (selectedProviderId) {
        fetchApiKeys();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedProviderId]);

  const fetchProviders = async () => {
    try {
      const { data } = await api.get('/providers');
      // Filter active and sort by priority if needed, though backend should handle it
      const activeProviders = (data || []).filter((p: any) => p.is_active);
      setProviders(activeProviders);
      
      if (activeProviders.length > 0) {
        setSelectedProviderId(activeProviders[0].id);
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
      const { data } = await api.get(`/providers/${selectedProviderId}/models`);
      setModels(data || []);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const fetchApiKeys = async () => {
    if (!selectedProviderId) return;

    try {
      const { data } = await api.get('/api-keys', {
        params: { provider_id: selectedProviderId }
      });
      
      setApiKeys(data || []);
      
      // Update key statuses
      const statuses: Record<string, KeyStatus> = {};
      for (const key of data || []) {
        statuses[key.id] = getKeyStatus(key);
      }
      setKeyStatuses(statuses);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const getKeyStatus = (key: ApiKey): KeyStatus => {
    if (!key.is_active) return 'unknown';
    if (key.last_error) {
      if (key.last_error.includes('429') || key.last_error.toLowerCase().includes('quota')) {
        return 'warning';
      }
      return 'error';
    }
    if (key.failed_requests > 5) return 'warning';
    if (key.failed_requests > 10) return 'error';
    return 'active';
  };

  const getStatusIndicator = (keyId: string, key: ApiKey) => {
    if (testingKeys.has(keyId)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary border border-primary/30">
          <Loader2 className="w-3 h-3 animate-spin" />
          Testing...
        </span>
      );
    }

    const status = keyStatuses[keyId] || getKeyStatus(key);
    
    switch (status) {
      case 'active':
        return (
          <Tooltip>
            <TooltipTrigger>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs status-active">
                <span className="w-2 h-2 rounded-full bg-success" />
                Aktif
              </span>
            </TooltipTrigger>
            <TooltipContent>API key berfungsi normal</TooltipContent>
          </Tooltip>
        );
      case 'warning':
        return (
          <Tooltip>
            <TooltipTrigger>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs status-warning">
                <span className="w-2 h-2 rounded-full bg-warning" />
                Hampir Habis
              </span>
            </TooltipTrigger>
            <TooltipContent>{key.last_error || 'Quota hampir habis'}</TooltipContent>
          </Tooltip>
        );
      case 'error':
        return (
          <Tooltip>
            <TooltipTrigger>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs status-error">
                <span className="w-2 h-2 rounded-full bg-destructive pulse-dot" />
                Error
              </span>
            </TooltipTrigger>
            <TooltipContent>{key.last_error || 'API key error'}</TooltipContent>
          </Tooltip>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs status-inactive">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
            Nonaktif
          </span>
        );
    }
  };

  const testApiKey = async (key: ApiKey) => {
    setTestingKeys(prev => new Set(prev).add(key.id));
    
    try {
      const response = await api.post('/api-keys/test', {
        api_key_id: key.id,
        provider_id: key.provider_id,
        model_id: key.provider_models?.model_id || 'gemini-2.5-flash',
      });

      const result = response.data;

      if (result.success) {
        toast.success('✅ API Key Berfungsi', {
          description: `Response time: ${result.response_time_ms}ms`,
        });
        setKeyStatuses(prev => ({ ...prev, [key.id]: 'active' }));
      } else {
        const statusMap: Record<string, KeyStatus> = {
          'invalid': 'error',
          'quota_exceeded': 'warning',
          'provider_error': 'error',
          'network_error': 'error',
        };
        const newStatus = statusMap[result.status] || 'error';
        setKeyStatuses(prev => ({ ...prev, [key.id]: newStatus }));
        
        // Handle failed key logic - usually backend handles this on test failure too, but we can force update
        if (newStatus === 'error' || newStatus === 'warning') {
            await api.put(`/api-keys/${key.id}`, { 
                priority: 0, 
                last_error: result.error || 'Test failed'
            });
        }

        const { message } = parseProviderError(result.error);

        if (result.status === 'quota_exceeded') {
          toast.warning('⚠️ Quota Habis', {
            description: message,
          });
        } else if (result.status === 'invalid') {
          toast.error('❌ API Key Invalid', {
            description: message || 'Key tidak valid atau sudah expired',
          });
        } else {
          toast.error('❌ Test Gagal', {
            description: message,
          });
        }
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      toast.error('Gagal menguji API key');
      setKeyStatuses(prev => ({ ...prev, [key.id]: 'error' }));
    } finally {
      setTestingKeys(prev => {
        const next = new Set(prev);
        next.delete(key.id);
        return next;
      });
      fetchApiKeys();
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

  const openChatModal = (key: ApiKey) => {
    setSelectedKey(key);
    setChatResponse(null);
    setChatMessage('Hello, are you working?');
    if (key.provider_models?.model_id) {
      setSelectedChatModelId(key.provider_models.model_id);
    } else if (models.length > 0) {
      setSelectedChatModelId(models[0].model_id);
    } else {
      setSelectedChatModelId('');
    }
    setIsChatModalOpen(true);
  };

  const handleSendChat = async () => {
    if (!selectedKey || !chatMessage.trim()) return;

    setIsSubmitting(true);
    setChatResponse(null);

    try {
      const response = await api.post('/api-keys/test', {
        api_key_id: selectedKey.id,
        provider_id: selectedKey.provider_id,
        model_id: selectedChatModelId || selectedKey.provider_models?.model_id || undefined,
        message: chatMessage
      });

      if (response.data.success) {
        setChatResponse(response.data.message?.content || 'No response content');
        toast.success('Chat berhasil dikirim');
        // Update key status to active on success
        if (selectedKey) {
            setKeyStatuses(prev => ({ ...prev, [selectedKey.id]: 'active' }));
        }
      } else {
        // Handle error response from backend
        const rawError = response.data.error || 'Unknown error occurred';
        const { message, details } = parseProviderError(rawError);
        
        // If we have details (JSON), pretty print them. Otherwise show the raw string.
        const displayResponse = details ? JSON.stringify(details, null, 2) : rawError;
        
        // Show error in response box, NO TOAST as requested
        setChatResponse(`❌ Error: ${message}\n\nDetails:\n${displayResponse}`);

        // Update key priority to 0 (bottom) on failure
        if (selectedKey) {
             try {
                await api.put(`/api-keys/${selectedKey.id}`, { 
                    priority: 0, 
                    last_error: message
                });
                // Refresh list to show new order
                fetchApiKeys();
             } catch (err) {
                 console.error('Failed to update key priority:', err);
             }
        }
      }
    } catch (error: any) {
        console.error('Chat error:', error);
        setChatResponse(`Error: ${error.message}`);
        // toast.error('Terjadi kesalahan saat mengirim chat');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.api_key.trim()) {
      toast.error('API Key wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const modelId = formData.model_id;
      
      if (selectedKey) {
        await api.put(`/api-keys/${selectedKey.id}`, {
          api_key: formData.api_key,
          name: formData.name || null,
          model_id: modelId || null,
          is_active: formData.is_active,
        });

        toast.success('API Key berhasil diperbarui');
      } else {
        await api.post('/api-keys', {
          provider_id: selectedProviderId,
          api_key: formData.api_key,
          name: formData.name || null,
          model_id: modelId || null,
          is_active: formData.is_active,
          priority: apiKeys.length,
        });

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
      await api.delete(`/api-keys/${selectedKey.id}`);

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
      await api.put(`/api-keys/${key.id}`, {
        is_active: !key.is_active
      });

      toast.success(`API Key ${!key.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchApiKeys();
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast.error('Gagal mengubah status');
    }
  };

  const setPrimaryKey = async (key: ApiKey) => {
    try {
      await api.put(`/api-keys/${key.id}/primary`);
      
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

      await api.post('/api-keys/reorder', { updates });
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
            await api.post('/api-keys', {
                provider_id: selectedProviderId,
                api_key: apiKey,
                priority: apiKeys.length + imported,
            });
            imported++;
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

  const handleBulkDelete = async () => {
    if (selectedKeyIds.size === 0) return;

    setIsSubmitting(true);
    try {
      await api.post('/api-keys/bulk-delete', { ids: Array.from(selectedKeyIds) });
      toast.success(`${selectedKeyIds.size} API Key berhasil dihapus`);
      setIsBulkDeleteDialogOpen(false);
      setSelectedKeyIds(new Set());
      fetchApiKeys();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error('Gagal menghapus API Key terpilih');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectKey = (id: string) => {
    const newSelected = new Set(selectedKeyIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedKeyIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeyIds(new Set(apiKeys.map(k => k.id)));
    } else {
      setSelectedKeyIds(new Set());
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
          <>
            <div className="flex items-center gap-3 mb-4 px-4 py-2 glass rounded-lg">
              <Checkbox 
                checked={apiKeys.length > 0 && selectedKeyIds.size === apiKeys.length}
                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                aria-label="Select all"
              />
              <span className="text-sm font-medium text-muted-foreground">
                {selectedKeyIds.size > 0 ? `${selectedKeyIds.size} dipilih` : 'Pilih Semua'}
              </span>
              
              {selectedKeyIds.size > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setIsBulkDeleteDialogOpen(true)}
                    className="h-8"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Hapus ({selectedKeyIds.size})
                  </Button>
                </div>
              )}
            </div>

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
                    <div className="flex items-center gap-2">
                       <Checkbox 
                        checked={selectedKeyIds.has(key.id)}
                        onCheckedChange={() => toggleSelectKey(key.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <GripVertical className="w-5 h-5 text-muted-foreground shrink-0" />
                    </div>
                    
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
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-sm">{maskApiKey(key.api_key)}</span>
                        {getStatusIndicator(key.id, key)}
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
                      {/* Test Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openChatModal(key)}
                            disabled={testingKeys.has(key.id)}
                            className="text-muted-foreground hover:text-primary"
                          >
                            {testingKeys.has(key.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MessageSquare className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Uji API Key</TooltipContent>
                      </Tooltip>
                      
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
          </>
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
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
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

      {/* Chat Test Modal */}
      <Dialog open={isChatModalOpen} onOpenChange={setIsChatModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Uji Coba API Key</DialogTitle>
            <DialogDescription>
              Uji coba API Key dengan mengirim pesan simulasi ke AI.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Model AI</Label>
              <Select value={selectedChatModelId} onValueChange={setSelectedChatModelId}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Pilih model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.model_id} value={model.model_id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pesan</Label>
              <div className="flex gap-2">
                <Input 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ketik pesan..."
                    disabled={isSubmitting}
                />
                <Button onClick={handleSendChat} disabled={isSubmitting || !chatMessage.trim()}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim'}
                </Button>
              </div>
            </div>

            {chatResponse && (
                <div className="space-y-2">
                    <Label>Respon AI</Label>
                    <div className="p-3 rounded-md bg-secondary/50 border text-sm font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                        {chatResponse}
                    </div>
                </div>
            )}
          </div>

          <DialogFooter>
             <Button variant="ghost" onClick={() => setIsChatModalOpen(false)}>Tutup</Button>
          </DialogFooter>
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

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedKeyIds.size} API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. {selectedKeyIds.size} API key yang dipilih akan dihapus secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus Semua'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
