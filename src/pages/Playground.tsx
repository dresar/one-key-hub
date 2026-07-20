import { useState, useEffect, useRef, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Loader2, Send, Image as ImageIcon, MessageSquare, Download, Copy,
  Check, Paperclip, X, Eye, Code, Bot, Sparkles, Zap, ChevronDown,
  Video, RefreshCw, Settings2, Terminal, Workflow
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';
import { API_URL } from '@/services/api';

interface ProviderCredential {
  id: number;
  provider_name: string;
  label: string;
  status: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string;
  video?: string;
  timestamp?: Date;
  tokens?: number;
  responseTime?: number;
}

interface ProviderModel {
  id: string | number;
  display_name: string;
  model_id: string;
  provider: string;
  is_default?: boolean;
  supports_vision?: boolean;
}

const PROVIDER_META: Record<string, { label: string; color: string; icon: string }> = {
  gemini:      { label: 'Google Gemini',       color: 'from-blue-500 to-cyan-500',   icon: '✦' },
  groq:        { label: 'Groq',                color: 'from-orange-500 to-red-500',  icon: '⚡' },
  openai:      { label: 'OpenAI',              color: 'from-emerald-500 to-teal-500',icon: '◈' },
  anthropic:   { label: 'Anthropic (Claude)',  color: 'from-amber-500 to-orange-500',icon: '◎' },
  mistral:     { label: 'Mistral AI',          color: 'from-violet-500 to-purple-500',icon: '◉' },
  cohere:      { label: 'Cohere',              color: 'from-pink-500 to-rose-500',   icon: '◑' },
  together:    { label: 'Together AI',         color: 'from-sky-500 to-indigo-500',  icon: '◐' },
  perplexity:  { label: 'Perplexity',          color: 'from-teal-500 to-green-500',  icon: '◒' },
  huggingface: { label: 'HuggingFace',         color: 'from-yellow-500 to-amber-500',icon: '◓' },
  deepseek:    { label: 'DeepSeek',            color: 'from-indigo-500 to-blue-500', icon: '◈' },
};

function ProviderBadge({ provider }: { provider: string }) {
  const meta = PROVIDER_META[provider] || { label: provider, color: 'from-gray-500 to-gray-600', icon: '◆' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${meta.color} text-white`}>
      <span>{meta.icon}</span> {meta.label}
    </span>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyContent = async () => {
    await navigator.clipboard.writeText(msg.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
      }`}>
        {isUser ? 'U' : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[78%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Media preview */}
        {msg.image && (
          msg.image.startsWith('data:video') ? (
            <video controls src={msg.image} className="max-w-full rounded-xl border border-border shadow-md" style={{ maxHeight: 220 }} />
          ) : (
            <img src={msg.image} alt="Uploaded" className="max-w-full rounded-xl border border-border shadow-md" style={{ maxHeight: 220 }} />
          )
        )}
        {msg.video && (
          <video controls src={msg.video} className="max-w-full rounded-xl border border-border shadow-md" style={{ maxHeight: 220 }} />
        )}

        {/* Text */}
        <div className={`relative px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-card border border-border/60 text-card-foreground rounded-tl-sm shadow-sm'
        }`}>
          <p className="whitespace-pre-wrap">{msg.content}</p>

          {/* Copy button */}
          {!isUser && (
            <button
              onClick={copyContent}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-secondary"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
          )}
        </div>

        {/* Meta */}
        <div className={`flex items-center gap-2 px-1 text-xs text-muted-foreground ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span>{msg.timestamp?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          {msg.tokens && <span>· {msg.tokens.toLocaleString()} tokens</span>}
          {msg.responseTime && <span>· {msg.responseTime}ms</span>}
        </div>
      </div>
    </div>
  );
}

export default function Playground() {
  const [credentials, setCredentials] = useState<ProviderCredential[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [imageModels, setImageModels] = useState<ProviderModel[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image Gen State
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageModel, setImageModel] = useState('dall-e-3');
  const [imageSize, setImageSize] = useState('1024x1024');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imgCopied, setImgCopied] = useState(false);

  useEffect(() => {
    fetchCredentials();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      fetchModels(selectedProvider);
      // Auto-select first matching credential
      const cred = credentials.find(c => c.provider_name === selectedProvider);
      if (cred) setSelectedCredentialId(String(cred.id));
    }
  }, [selectedProvider, credentials]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchCredentials = async () => {
    try {
      const { data } = await api.get('/api/playground/providers-with-credentials');
      const creds: ProviderCredential[] = data?.credentials || [];
      setCredentials(creds);
      if (creds.length > 0) {
        const firstProvider = creds[0].provider_name;
        setSelectedProvider(firstProvider);
        setSelectedCredentialId(String(creds[0].id));
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast.error('Gagal memuat daftar provider. Pastikan sudah tambah credential di halaman Providers.');
    }
  };

  const fetchModels = async (providerValue: string) => {
    try {
      const { data } = await api.get(`/api/playground/models?provider=${providerValue}`);
      const modelList: ProviderModel[] = data?.models || [];
      setModels(modelList);

      if (modelList.length === 0) {
        // No models in DB for this provider
        setChatModel('');
        toast.error(`Belum ada model untuk provider "${providerValue}". Tambahkan di halaman Models.`, { duration: 5000 });
      } else {
        const def = modelList.find(m => m.is_default);
        setChatModel(def?.model_id || modelList[0]?.model_id || '');
      }

      // Image gen models (only providers that support it)
      if (providerValue === 'openai') {
        const imgModels = modelList.filter(m => m.model_id.includes('dall-e'));
        setImageModels(imgModels);
        setImageModel(imgModels[0]?.model_id || 'dall-e-3');
      } else {
        setImageModels([]);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      setModels([]);
      setChatModel('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      if (file.type.startsWith('video/')) {
        setUploadedVideo(dataUrl);
        setUploadedImage(null);
      } else {
        setUploadedImage(dataUrl);
        setUploadedVideo(null);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const clearUpload = () => {
    setUploadedImage(null);
    setUploadedVideo(null);
    setUploadedFileName('');
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !uploadedImage && !uploadedVideo) || !selectedProvider) return;

    const userMsg: Message = {
      role: 'user',
      content: inputMessage,
      image: uploadedImage || undefined,
      video: uploadedVideo || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    clearUpload();
    setIsLoading(true);

    try {
      const body: any = {
        provider: selectedProvider,
        model_id: chatModel,
        prompt: userMsg.content || (userMsg.image ? 'Analyze this image.' : userMsg.video ? 'Analyze this video.' : ''),
        credential_id: selectedCredentialId || undefined,
      };

      if (systemPrompt.trim()) body.system_prompt = systemPrompt;
      if (userMsg.image) body.image_base64 = userMsg.image;
      if (userMsg.video) body.video_base64 = userMsg.video;

      const { data } = await api.post('/api/playground/chat', body);

      // Check if server returned upstream error as 200 with error field
      if (data.error) {
        toast.error(data.error, { duration: 8000 });
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ ${data.error}`,
          timestamp: new Date(),
        }]);
        return;
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.text || 'No response',
        timestamp: new Date(),
        tokens: data.tokens_used,
        responseTime: data.response_time_ms,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || error.message || 'Request gagal';
      toast.error(errMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${errMsg}`, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || !selectedProvider) return;

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const { data } = await api.post('/api/playground/image', {
        provider: 'openai',
        model_id: imageModel,
        prompt: imagePrompt,
        size: imageSize,
        credential_id: selectedCredentialId || undefined,
      });

      if (data.data && data.data.length > 0) {
        setGeneratedImage(data.data[0].url);
        toast.success('Gambar berhasil dibuat!');
      } else {
        throw new Error('No image returned');
      }
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || error.message;
      toast.error(`Image gen error: ${errMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copySnippet = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setSnippetCopied(id);
    toast.success('Disalin!');
    setTimeout(() => setSnippetCopied(null), 2000);
  };

  const curlSnippet = `curl -X POST ${API_URL}/api/playground/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <JWT_TOKEN>" \\
  -d '{
    "provider": "${selectedProvider || 'gemini'}",
    "model_id": "${chatModel || 'gemini-2.5-flash'}",
    "prompt": "Halo! Apa kabar?",
    "system_prompt": "You are a helpful assistant."
  }'`;

  const n8nNodeJson = JSON.stringify([{
    "id": "playground-chat",
    "name": "One Key Hub Playground Chat",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.1,
    "position": [460, 340],
    "parameters": {
      "method": "POST",
      "url": `${API_URL}/api/playground/chat`,
      "sendHeaders": true,
      "headerParameters": { "parameters": [{ "name": "Authorization", "value": "Bearer <JWT_TOKEN>" }] },
      "sendBody": true,
      "contentType": "json",
      "bodyParameters": { "parameters": [
        { "name": "provider", "value": selectedProvider || "gemini" },
        { "name": "model_id", "value": chatModel || "gemini-2.5-flash" },
        { "name": "prompt", "value": "={{ $json.message }}" }
      ]},
    }
  }], null, 2);

  const opencrawSnippet = `// OpenClaw Agent — One Key Hub Integration
// Simpan di .env: ONE_KEY_HUB_URL=${API_URL}

const response = await fetch(process.env.ONE_KEY_HUB_URL + '/api/playground/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${process.env.JWT_TOKEN}\`
  },
  body: JSON.stringify({
    provider: '${selectedProvider || 'gemini'}',
    model_id: '${chatModel || 'gemini-2.5-flash'}',
    prompt: userMessage,
    system_prompt: 'You are a helpful AI assistant.'
  })
});
const { text } = await response.json();
return text; // Kirim ke WhatsApp/Telegram/Slack`;

  // Unique providers from credentials
  const availableProviders = Array.from(new Set(credentials.map(c => c.provider_name)));
  const credentialsForProvider = credentials.filter(c => c.provider_name === selectedProvider);
  const currentModel = models.find(m => m.model_id === chatModel);

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title="AI Playground" subtitle="Uji coba langsung — Chat, Vision, & Image Generation" />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

        {/* ── Config Bar ── */}
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">

              {/* Provider selector */}
              <div className="space-y-1.5 min-w-[180px]">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="bg-background/50 h-9">
                    <SelectValue placeholder="Pilih Provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        Tambah credential di halaman Providers
                      </SelectItem>
                    ) : availableProviders.map(p => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span>{PROVIDER_META[p]?.icon || '◆'}</span>
                          <span>{PROVIDER_META[p]?.label || p}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Credential selector */}
              {credentialsForProvider.length > 1 && (
                <div className="space-y-1.5 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">API Credential</Label>
                  <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId}>
                    <SelectTrigger className="bg-background/50 h-9">
                      <SelectValue placeholder="Pilih credential..." />
                    </SelectTrigger>
                    <SelectContent>
                      {credentialsForProvider.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Model selector */}
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Model</Label>
                <Select value={chatModel} onValueChange={setChatModel} disabled={!selectedProvider || models.length === 0}>
                  <SelectTrigger className="bg-background/50 h-9">
                    <SelectValue placeholder="Pilih Model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        ⚠️ Tambah model dulu di halaman Models
                      </SelectItem>
                    ) : models.map(m => (
                      <SelectItem key={m.model_id} value={m.model_id}>
                        <span className="flex items-center gap-2">
                          {m.supports_vision && <Eye className="w-3 h-3 text-primary" />}
                          {m.display_name || m.model_id}
                          {m.is_default && <span className="text-xs text-muted-foreground">(default)</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 ml-auto shrink-0 pt-5">
                {selectedProvider && <ProviderBadge provider={selectedProvider} />}
                {currentModel?.supports_vision && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Eye className="w-3 h-3" /> Vision
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(!showSettings)} title="System Prompt">
                  <Settings2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSnippets(!showSnippets)} title="Code Snippets">
                  <Code className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchCredentials} title="Refresh">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* System Prompt (collapsible) */}
            {showSettings && (
              <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Settings2 className="w-3 h-3" /> System Prompt (opsional)
                </Label>
                <Textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  placeholder="You are a helpful AI assistant..."
                  className="h-20 resize-none bg-background/50 text-sm"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Code Snippets Panel ── */}
        {showSnippets && (
          <Card className="glass border-border/50">
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Code className="w-4 h-4 text-primary" /> Code Snippets
              </h3>
              <Tabs defaultValue="curl">
                <TabsList className="grid grid-cols-3 w-full max-w-xs h-8">
                  <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
                  <TabsTrigger value="n8n" className="text-xs flex gap-1"><Workflow className="w-3 h-3" /> n8n</TabsTrigger>
                  <TabsTrigger value="openclaw" className="text-xs flex gap-1"><Bot className="w-3 h-3" /> OpenClaw</TabsTrigger>
                </TabsList>
                {[
                  { key: 'curl', code: curlSnippet, lang: 'bash' },
                  { key: 'n8n', code: n8nNodeJson, lang: 'json' },
                  { key: 'openclaw', code: opencrawSnippet, lang: 'javascript' },
                ].map(({ key, code, lang }) => (
                  <TabsContent key={key} value={key}>
                    <div className="relative rounded-lg overflow-hidden border border-border bg-slate-950">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
                        <span className="text-xs text-slate-400 font-mono">{lang}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-slate-400 hover:text-white gap-1"
                          onClick={() => copySnippet(code, key)}
                        >
                          {snippetCopied === key ? <><Check className="w-3 h-3" /> Disalin!</> : <><Copy className="w-3 h-3" /> Salin</>}
                        </Button>
                      </div>
                      <pre className="p-4 text-xs font-mono text-slate-100 overflow-auto max-h-48 leading-relaxed">{code}</pre>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* ── Main Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Chat & Vision
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Image Generation
            </TabsTrigger>
          </TabsList>

          {/* ────────── CHAT TAB ────────── */}
          <TabsContent value="chat">
            <Card className="flex flex-col border-border/50 shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 420px)', minHeight: 480 }}>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 bg-secondary/5" ref={chatContainerRef}>
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground select-none">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Bot className="w-8 h-8 text-primary" />
                    </div>
                    <p className="font-semibold">Mulai percakapan</p>
                    <p className="text-sm mt-1 text-center max-w-xs">
                      Kirim pesan, atau upload gambar/video untuk dianalisis AI
                    </p>
                    {!selectedProvider && (
                      <p className="text-xs mt-3 text-destructive">
                        ⚠️ Belum ada provider dipilih. Pastikan sudah tambah credential di halaman Providers.
                      </p>
                    )}
                  </div>
                ) : (
                  messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
                )}

                {isLoading && (
                  <div className="flex gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload preview strip */}
              {(uploadedImage || uploadedVideo) && (
                <div className="px-4 py-2 bg-background/80 border-t border-border/50 flex items-center gap-3">
                  <div className="relative">
                    {uploadedVideo ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border/50">
                        <Video className="w-4 h-4 text-primary" />
                        <span className="text-xs text-muted-foreground max-w-[120px] truncate">{uploadedFileName}</span>
                      </div>
                    ) : (
                      <img src={uploadedImage!} alt="Preview" className="h-14 w-14 object-cover rounded-lg border border-border" />
                    )}
                    <button
                      onClick={clearUpload}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-medium">{uploadedVideo ? 'Video siap dikirim' : 'Gambar siap dikirim'}</p>
                    <p className="text-xs text-muted-foreground">{uploadedFileName}</p>
                  </div>
                </div>
              )}

              {/* Input area */}
              <div className="p-4 bg-background border-t border-border/50">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="flex gap-2 items-end"
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
                    className="shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    title="Upload gambar atau video"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Textarea
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    placeholder={selectedProvider ? `Ketik pesan untuk ${PROVIDER_META[selectedProvider]?.label || selectedProvider}...` : 'Pilih provider terlebih dahulu...'}
                    className="flex-1 resize-none min-h-[44px] max-h-32 bg-background/50"
                    rows={1}
                    disabled={isLoading || !selectedProvider}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={isLoading || !selectedProvider || (!inputMessage.trim() && !uploadedImage && !uploadedVideo)}
                    className="shrink-0"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  Enter untuk kirim · Shift+Enter untuk baris baru · 📎 untuk upload gambar/video
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* ────────── IMAGE GEN TAB ────────── */}
          <TabsContent value="image">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="space-y-5">
                <Card className="glass border-border/50">
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-primary" /> Image Generation
                    </h3>
                    <p className="text-xs text-muted-foreground">Menggunakan credential OpenAI dari halaman Providers.</p>

                    <div className="space-y-2">
                      <Label className="text-xs">Model</Label>
                      <Select value={imageModel} onValueChange={setImageModel}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                          <SelectItem value="dall-e-2">DALL-E 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Ukuran</Label>
                      <Select value={imageSize} onValueChange={setImageSize}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1024x1024">1024 × 1024 (Square)</SelectItem>
                          <SelectItem value="1792x1024">1792 × 1024 (Landscape)</SelectItem>
                          <SelectItem value="1024x1792">1024 × 1792 (Portrait)</SelectItem>
                          <SelectItem value="512x512">512 × 512 (DALL-E 2)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Prompt</Label>
                      <Textarea
                        value={imagePrompt}
                        onChange={e => setImagePrompt(e.target.value)}
                        placeholder="Describe the image you want to generate..."
                        className="h-28 resize-none text-sm"
                      />
                    </div>

                    <Button
                      onClick={handleGenerateImage}
                      disabled={isLoading || !imagePrompt.trim()}
                      className="w-full"
                    >
                      {isLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Generate Image</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Preview */}
              <div className="md:col-span-2">
                <Card className="border-border/50 shadow-lg overflow-hidden" style={{ minHeight: 480 }}>
                  {generatedImage ? (
                    <div className="relative group h-full">
                      <img
                        src={generatedImage}
                        alt="Generated"
                        className="w-full h-full object-contain bg-secondary/10"
                        style={{ minHeight: 480 }}
                      />
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="shadow-lg"
                          onClick={async () => {
                            await navigator.clipboard.writeText(generatedImage!).catch(() => {});
                            setImgCopied(true);
                            toast.success('URL disalin!');
                            setTimeout(() => setImgCopied(false), 2000);
                          }}
                        >
                          {imgCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="shadow-lg"
                          onClick={() => window.open(generatedImage!, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground opacity-50 select-none" style={{ minHeight: 480 }}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-14 h-14 animate-spin mb-4 text-primary opacity-80" />
                          <p className="font-medium">Membuat gambar...</p>
                          <p className="text-sm mt-1">DALL-E membutuhkan ~10-30 detik</p>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-16 h-16 mb-4" />
                          <p className="font-medium">Hasil gambar muncul di sini</p>
                          <p className="text-sm mt-1">Tulis prompt dan klik Generate</p>
                        </>
                      )}
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
