import { useState, useEffect, useRef } from 'react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Send, Image as ImageIcon, MessageSquare, Download, Copy, Check, Paperclip, X } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

import { API_URL } from '@/services/api';

interface UnifiedKey {
  id: string;
  name: string;
  api_key: string;
  is_active: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string; // Data URL for display
}

interface Provider {
  id: string;
  name: string;
  is_active: boolean;
}

interface ProviderModel {
  id: string;
  name: string;
  model_id: string;
  provider_id: string;
}

export default function Playground() {
  const [unifiedKeys, setUnifiedKeys] = useState<UnifiedKey[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<ProviderModel[]>([]);
  
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatModel, setChatModel] = useState(''); 
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image Gen State
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [selectedImageProviderId, setSelectedImageProviderId] = useState<string>('');
  const [imageModels, setImageModels] = useState<ProviderModel[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState('1024x1024');

  useEffect(() => {
    fetchUnifiedKeys();
    fetchProviders();
  }, []);

  useEffect(() => {
    if (selectedProviderId) {
        fetchModels(selectedProviderId, 'chat');
    }
  }, [selectedProviderId]);

  useEffect(() => {
    if (selectedImageProviderId) {
        fetchModels(selectedImageProviderId, 'image');
    }
  }, [selectedImageProviderId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchUnifiedKeys = async () => {
    try {
      const { data } = await api.get('/unified/keys');
      const activeKeys = data.filter((k: UnifiedKey) => k.is_active);
      setUnifiedKeys(activeKeys);
      if (activeKeys.length > 0) {
        setSelectedKey(activeKeys[0].api_key);
      }
    } catch (error) {
      console.error('Error fetching unified keys:', error);
      toast.error('Gagal memuat Unified API Keys');
    }
  };

  const fetchProviders = async () => {
    try {
        const { data } = await api.get('/providers');
        const activeProviders = data.filter((p: Provider) => p.is_active);
        setProviders(activeProviders);
        // Auto select first provider if available
        // if (activeProviders.length > 0) setSelectedProviderId(activeProviders[0].id);
    } catch (error) {
        console.error('Error fetching providers:', error);
    }
  };

  const fetchModels = async (providerId: string, type: 'chat' | 'image') => {
      try {
          const { data } = await api.get(`/providers/${providerId}/models`);
          if (type === 'chat') {
              setModels(data);
              if (data.length > 0) setChatModel(data[0].model_id);
              else setChatModel('');
          } else {
              setImageModels(data);
              if (data.length > 0) setImageModel(data[0].model_id);
              else setImageModel('');
          }
      } catch (error) {
          console.error('Error fetching models:', error);
          if (type === 'chat') setModels([]);
          else setImageModels([]);
      }
  };

  const handleCopyImage = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('URL gambar disalin');
    } catch (err) {
      toast.error('Gagal menyalin URL');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadedImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !uploadedImage) || !selectedKey) return;

    const newMsg: Message = { 
        role: 'user', 
        content: inputMessage,
        image: uploadedImage || undefined
    };
    
    setMessages(prev => [...prev, newMsg]);
    setInputMessage('');
    setUploadedImage(null);
    setIsLoading(true);

    try {
      // Prepare message content for multimodal
      let content: any = newMsg.content;
      
      if (newMsg.image) {
          const isVideo = newMsg.image.startsWith('data:video');
          content = [
              { type: 'text', text: newMsg.content || (isVideo ? 'Analyze this video' : 'Analyze this image') },
              { type: 'image_url', image_url: { url: newMsg.image } }
          ];
      }

      const response = await fetch(`${API_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${selectedKey}`
        },
        body: JSON.stringify({
          model: chatModel,
          messages: [...messages, { role: newMsg.role, content }].map(m => {
              // Ensure we send correct structure to backend (which handles conversion to provider format)
              if (typeof m.content === 'string') return { role: m.role, content: m.content };
              return { role: m.role, content: m.content };
          })
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to send message');
      }

      const assistantMsg = data.choices[0].message;
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMsg.content }]);

    } catch (error: any) {
      console.error('Chat error:', error);
      toast.error(`Error: ${error.message}`);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || !selectedKey) return;

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const response = await fetch(`${API_URL}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${selectedKey}`
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: imagePrompt,
          size: imageSize,
          n: 1
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to generate image');
      }

      if (data.data && data.data.length > 0) {
        setGeneratedImage(data.data[0].url);
        toast.success('Gambar berhasil dibuat!');
      } else {
        throw new Error('No image data returned');
      }

    } catch (error: any) {
      console.error('Image gen error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-10">
      <AppHeader title="Playground" subtitle="Uji coba Unified API (Chat & Image)" />
      
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        
        {/* Configuration Bar */}
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
            <div className="space-y-2 w-full md:w-1/2">
              <Label>Pilih Unified API Key</Label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Pilih Key..." />
                </SelectTrigger>
                <SelectContent>
                  {unifiedKeys.length === 0 ? (
                    <SelectItem value="none" disabled>Belum ada Unified Key aktif</SelectItem>
                  ) : (
                    unifiedKeys.map(key => (
                      <SelectItem key={key.id} value={key.api_key}>
                        {key.name} ({key.api_key.slice(0, 8)}...)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
               <div className="px-3 py-1 rounded-md bg-secondary text-xs text-muted-foreground border">
                  Environment: Production
               </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Chat Completion
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Image Generation
            </TabsTrigger>
          </TabsList>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                    <Label>Pilih Provider</Label>
                    <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Provider AI" />
                        </SelectTrigger>
                        <SelectContent>
                            {providers.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Pilih Model</Label>
                    <Select value={chatModel} onValueChange={setChatModel} disabled={!selectedProviderId}>
                        <SelectTrigger>
                            <SelectValue placeholder={!selectedProviderId ? "Pilih Provider dahulu" : "Pilih Model"} />
                        </SelectTrigger>
                        <SelectContent>
                            {models.length === 0 ? (
                                <SelectItem value="none" disabled>Tidak ada model tersedia</SelectItem>
                            ) : (
                                models.map(m => (
                                    <SelectItem key={m.id} value={m.model_id}>{m.name}</SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="h-[600px] flex flex-col border-border/50 shadow-lg">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/10" ref={chatContainerRef}>
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                            <MessageSquare className="w-12 h-12 mb-2" />
                            <p>Mulai percakapan...</p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                                msg.role === 'user' 
                                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                                    : 'bg-secondary text-secondary-foreground rounded-tl-none'
                            }`}>
                                {msg.image && (
                                    msg.image.startsWith('data:video') ? (
                                        <video controls src={msg.image} className="max-w-full rounded-lg mb-2" style={{ maxHeight: '300px' }} />
                                    ) : (
                                        <img src={msg.image} alt="Uploaded" className="max-w-full rounded-lg mb-2" style={{ maxHeight: '200px' }} />
                                    )
                                )}
                                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-secondary rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-xs text-muted-foreground">Mengetik...</span>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Upload Preview */}
                {uploadedImage && (
                    <div className="px-4 py-2 bg-background border-t flex items-center gap-2">
                        <div className="relative">
                            {uploadedImage.startsWith('data:video') ? (
                                <video src={uploadedImage} className="h-12 w-12 object-cover rounded-md" />
                            ) : (
                                <img src={uploadedImage} alt="Preview" className="h-12 w-12 object-cover rounded-md" />
                            )}
                            <button 
                                onClick={() => setUploadedImage(null)}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <span className="text-xs text-muted-foreground">Gambar siap dikirim</span>
                    </div>
                )}

                <div className="p-4 bg-background border-t">
                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                        className="flex gap-2"
                    >
                        <input
                            type="file"
                            accept="image/*,video/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                        >
                            <Paperclip className="w-4 h-4" />
                        </Button>
                        <Input 
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Ketik pesan..."
                            className="flex-1"
                            disabled={isLoading || !selectedKey}
                        />
                        <Button type="submit" disabled={isLoading || !selectedKey}>
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </Card>
          </TabsContent>

          {/* IMAGE TAB */}
          <TabsContent value="image" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Controls */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label>Pilih Provider</Label>
                        <Select value={selectedImageProviderId} onValueChange={setSelectedImageProviderId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                {providers.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Model</Label>
                        <Select value={imageModel} onValueChange={setImageModel} disabled={!selectedImageProviderId}>
                            <SelectTrigger>
                                <SelectValue placeholder={!selectedImageProviderId ? "Pilih Provider dahulu" : "Pilih Model"} />
                            </SelectTrigger>
                            <SelectContent>
                                {imageModels.length === 0 ? (
                                    <SelectItem value="none" disabled>Tidak ada model tersedia</SelectItem>
                                ) : (
                                    imageModels.map(m => (
                                        <SelectItem key={m.id} value={m.model_id}>{m.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Ukuran</Label>
                         <Select value={imageSize} onValueChange={setImageSize}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1024x1024">1024 x 1024</SelectItem>
                                <SelectItem value="512x512">512 x 512 (DALL-E 2)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Prompt</Label>
                        <Textarea 
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="Deskripsikan gambar yang ingin dibuat..."
                            className="h-32 resize-none"
                        />
                    </div>

                    <Button 
                        onClick={handleGenerateImage} 
                        disabled={isLoading || !selectedKey || !imagePrompt}
                        className="w-full"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                Generate Image
                            </>
                        )}
                    </Button>
                </div>

                {/* Preview */}
                <div className="md:col-span-2">
                    <Card className="h-[500px] border-border/50 shadow-lg flex items-center justify-center bg-secondary/10 relative overflow-hidden group">
                        {generatedImage ? (
                            <>
                                <img 
                                    src={generatedImage} 
                                    alt="Generated" 
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                                />
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="secondary" onClick={() => handleCopyImage(generatedImage)}>
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                    <Button size="icon" variant="secondary" onClick={() => window.open(generatedImage, '_blank')}>
                                        <Download className="w-4 h-4" />
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-muted-foreground opacity-50">
                                {isLoading ? (
                                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                                ) : (
                                    <ImageIcon className="w-16 h-16 mx-auto mb-4" />
                                )}
                                <p>{isLoading ? 'Sedang membuat gambar...' : 'Hasil gambar akan muncul di sini'}</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
