import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, Terminal, Code2, Globe, BookOpen,
  ChevronDown, ChevronUp, Cpu, Zap, RefreshCw,
  MessageSquare, List, Eye, Hash, Search, ExternalLink,
  Server, Shield, AlertCircle, Image as ImageIcon, HardDrive
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

interface Props {
  gatewayKey?: string;
  defaultProvider?: string;
  collapsed?: boolean;
}

type LangTab = 'curl' | 'javascript' | 'python' | 'openai_sdk' | 'openclaw';
type Section = 'chat' | 'storage' | 'models' | 'reference' | 'ai_prompt';

interface Model {
  id: string;
  display_name: string;
  provider: string;
  owned_by: string;
  context_window: number;
  supports_vision: boolean;
  active: boolean;
  object: string;
  created: number;
}

interface UserGatewayKey {
  id: string;
  name: string;
  key_preview: string;
  provider: string;
  model_id?: string;
  status: string;
}

const BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL as string || 'http://localhost:3000').replace(/\/api\/?$/, '')
  : (typeof window !== 'undefined' ? window.location.origin : 'https://one.apprentice.cyou');

const PROVIDER_META: Record<string, { color: string; badge: string; emoji: string; category: 'ai' | 'storage' | 'other' }> = {
  gemini: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', badge: 'bg-blue-500/20 text-blue-300', emoji: '🔵', category: 'ai' },
  groq: { color: 'bg-orange-500/10 text-orange-400 border-orange-500/30', badge: 'bg-orange-500/20 text-orange-300', emoji: '🟠', category: 'ai' },
  openai: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300', emoji: '🟢', category: 'ai' },
  deepseek: { color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', badge: 'bg-cyan-500/20 text-cyan-300', emoji: '🔷', category: 'ai' },
  mistral: { color: 'bg-rose-500/10 text-rose-400 border-rose-500/30', badge: 'bg-rose-500/20 text-rose-300', emoji: '🌸', category: 'ai' },
  cohere: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', badge: 'bg-purple-500/20 text-purple-300', emoji: '🟣', category: 'ai' },
  cerebras: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-300', emoji: '🟡', category: 'ai' },
  together: { color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30', badge: 'bg-indigo-500/20 text-indigo-300', emoji: '🔮', category: 'ai' },
  
  // Storage & Media CDN Providers
  cloudinary: { color: 'bg-sky-500/10 text-sky-400 border-sky-500/30', badge: 'bg-sky-500/20 text-sky-300', emoji: '☁️', category: 'storage' },
  imagekit: { color: 'bg-teal-500/10 text-teal-400 border-teal-500/30', badge: 'bg-teal-500/20 text-teal-300', emoji: '🖼️', category: 'storage' },
  uploadcare: { color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30', badge: 'bg-indigo-500/20 text-indigo-300', emoji: '📤', category: 'storage' },
  removebg: { color: 'bg-pink-500/10 text-pink-400 border-pink-500/30', badge: 'bg-pink-500/20 text-pink-300', emoji: '✂️', category: 'storage' },
};

function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text).catch(() => { });
    setCopiedId(id);
    toast.success('Tersalin ke clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  }, []);
  return { copy, copiedId };
}

function CodeBlock({ code, id, lang = 'bash' }: { code: string; id: string; lang?: string }) {
  const { copy, copiedId } = useCopy();
  const langLabels: Record<string, string> = {
    bash: 'cURL / Shell', javascript: 'JavaScript', python: 'Python',
    typescript: 'TypeScript', json: 'JSON Response', text: 'Text', markdown: 'Markdown Prompt'
  };
  return (
    <div className="rounded-xl overflow-hidden border border-border/40 bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs font-mono text-muted-foreground">{langLabels[lang] || lang}</span>
        </div>
        <button
          onClick={() => copy(code, id)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
        >
          {copiedId === id
            ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Tersalin!</span></>
            : <><Copy className="w-3 h-3" /><span>Salin</span></>
          }
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs font-mono leading-6 text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${colors[method] || 'bg-secondary/60 text-muted-foreground border-border/40'}`}>
      {method}
    </span>
  );
}

function SectionTab({ active, onClick, icon: Icon, label, badge }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/60'
        }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{badge}</span>
      )}
    </button>
  );
}

function LangTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
        }`}
    >
      {label}
    </button>
  );
}

const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  mistral: 'mistral-small-latest',
  cohere: 'command-r-plus',
  deepseek: 'deepseek-chat',
  cerebras: 'llama3.1-70b',
  together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
};

export default function GatewayDocs({ gatewayKey = 'YOUR_GATEWAY_KEY', defaultProvider = 'gemini', collapsed = false }: Props) {
  const [isOpen, setIsOpen] = useState(!collapsed);
  const [section, setSection] = useState<Section>('chat');
  const [langTab, setLangTab] = useState<LangTab>('curl');
  const [provider, setProvider] = useState(defaultProvider);

  const [userKeys, setUserKeys] = useState<UserGatewayKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('custom');
  const [activeKeyString, setActiveKeyString] = useState<string>(gatewayKey);

  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsFilter, setModelsFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');

  useEffect(() => {
    fetchUserKeys();
  }, []);

  const fetchUserKeys = async () => {
    try {
      const { data } = await api.get('/api/keys');
      const items: UserGatewayKey[] = data?.items || data || [];
      if (items.length > 0) {
        setUserKeys(items);
        const match = items.find(k => k.key_preview === gatewayKey || k.id === gatewayKey) || items[0];
        setSelectedKeyId(match.id);
        setActiveKeyString(match.key_preview);

        if (match.provider) {
          handleProviderChange(match.provider);
        }
      }
    } catch {
      // Guest mode
    }
  };

  const handleKeySelect = (keyId: string) => {
    setSelectedKeyId(keyId);
    if (keyId === 'custom') {
      setActiveKeyString(gatewayKey);
      return;
    }

    const matchedKey = userKeys.find(k => k.id === keyId);
    if (matchedKey) {
      setActiveKeyString(matchedKey.key_preview);
      if (matchedKey.provider) {
        handleProviderChange(matchedKey.provider);
      }
    }
  };

  const handleProviderChange = (prov: string) => {
    setProvider(prov);
    const meta = PROVIDER_META[prov.toLowerCase()];
    if (meta?.category === 'storage') {
      setSection('storage');
    } else if (meta?.category === 'ai') {
      setSection('chat');
    }
  };

  const displayKey = activeKeyString.startsWith('YOUR') ? 'YOUR_GATEWAY_KEY' : activeKeyString;
  const defaultModel = PROVIDER_DEFAULT_MODEL[provider] || 'gemini-2.5-flash';
  const currentProviderMeta = PROVIDER_META[provider.toLowerCase()];

  const isStorageCategory = currentProviderMeta?.category === 'storage';
  const isAiCategory = currentProviderMeta?.category === 'ai';

  let aiSystemPrompt = '';

  if (isStorageCategory) {
    aiSystemPrompt = [
      `# 📸 STORAGE CDN GATEWAY SPECIFICATION (${provider.toUpperCase()})`,
      ``,
      `## 📌 ATURAN WAJIB SEBELUM MENULIS KODE KE PROJECT UTAMA`,
      `Anda adalah AI Developer Assistant. **SEBELUM** meletakkan atau mengubah kode di project utama, Anda **WAJIB MEMBUAT FILE UJI COBA TERPISAH** (\`test-storage-cdn.js\`) untuk menguji konektivitas Gateway API Key dan endpoint Storage CDN Gateway (\`/v1/storage/upload\`).`,
      `Jalankan skrip uji coba tersebut via terminal. Setelah dipastikan berhasil (\`201 Created\`), barulah Anda mengimplementasikan kode ke dalam komponen project utama.`,
      ``,
      `---`,
      ``,
      `## 🔑 Setelan Kredensial & Server Gateway`,
      `- **Base URL API**: \`${BASE_URL}/v1\``,
      `- **Gateway API Key**: \`${displayKey}\``,
      `- **Target Provider Storage**: \`${provider.toUpperCase()}\``,
      `- **Fitur Otomatis**: Multi-CDN Failover (ImageKit ➔ Cloudinary ➔ Uploadcare) & Auto EXIF Orientation Fix`,
      ``,
      `---`,
      ``,
      `## 📸 ENDPOINT STORAGE GATEWAY SERVICE`,
      ``,
      `### 1. Upload File (Base64 String atau Remote URL)`,
      `- **URL**: \`${BASE_URL}/v1/storage/upload\``,
      `- **Method**: \`POST\``,
      `- **Header**:`,
      `  - \`Content-Type: application/json\``,
      `  - \`Authorization: Bearer ${displayKey}\``,
      `- **Body JSON**:`,
      `  \`\`\`json`,
      `  {`,
      `    "file": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",`,
      `    "file_name": "foto_produk.png",`,
      `    "auto_rotate": true,`,
      `    "provider": "${provider}"`,
      `  }`,
      `  \`\`\``,
      `- **Response Success (\`201 Created\`)**:`,
      `  \`\`\`json`,
      `  {`,
      `    "success": true,`,
      `    "file": {`,
      `      "id": "e4b2d5a1-7c89-4d10-a299-123456789abc",`,
      `      "provider": "${provider}",`,
      `      "url": "https://res.cloudinary.com/cloud/image/upload/v123/foto_produk.png",`,
      `      "file_id": "foto_produk",`,
      `      "file_name": "foto_produk.png",`,
      `      "file_size": 15420,`,
      `      "mime_type": "image/png",`,
      `      "width": 1024,`,
      `      "height": 1024,`,
      `      "auto_rotated": true,`,
      `      "created_at": "2026-07-21T13:40:00.000Z"`,
      `    }`,
      `  }`,
      `  \`\`\``,
      ``,
      `### 2. List Berkas CDN Terunggah Milik API Key Ini`,
      `- **URL**: \`${BASE_URL}/v1/storage/list?page=1&limit=20&provider=${provider}&search=\``,
      `- **Method**: \`GET\``,
      `- **Header**: \`Authorization: Bearer ${displayKey}\``,
      `- **Query Params Optional**: \`page\` (default 1), \`limit\` (default 20), \`provider\` (cloudinary/imagekit/uploadcare), \`search\` (nama file)`,
      ``,
      `### 3. Detail Berkas CDN Berdasarkan ID`,
      `- **URL**: \`${BASE_URL}/v1/storage/files/:id\``,
      `- **Method**: \`GET\``,
      `- **Header**: \`Authorization: Bearer ${displayKey}\``,
      ``,
      `### 4. Hapus Berkas CDN dari Database`,
      `- **URL**: \`${BASE_URL}/v1/storage/files/:id\``,
      `- **Method**: \`DELETE\``,
      `- **Header**: \`Authorization: Bearer ${displayKey}\``,
      ``,
      `---`,
      ``,
      `## 🧪 SKRIP TEST UJI COBA WAJIB (\`test-storage-cdn.js\`)`,
      `AI wajib membuat dan menjalankan file ini terlebih dahulu sebelum mengubah project utama:`,
      ``,
      `\`\`\`javascript`,
      `const GATEWAY_KEY = '${displayKey}';`,
      `const BASE_URL = '${BASE_URL}/v1';`,
      ``,
      `async function testStorageUpload() {`,
      `  console.log('🚀 Testing Storage CDN Upload (${provider.toUpperCase()})...');`,
      `  const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';`,
      ``,
      `  const uploadRes = await fetch(\`\${BASE_URL}/storage/upload\`, {`,
      `    method: 'POST',`,
      `    headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${GATEWAY_KEY}\` },`,
      `    body: JSON.stringify({ file: dummyBase64, file_name: 'test_cdn.png', auto_rotate: true, provider: '${provider}' })`,
      `  });`,
      ``,
      `  const data = await uploadRes.json();`,
      `  if (uploadRes.ok && data.success) {`,
      `    console.log('✅ Storage CDN Upload Berhasil!');`,
      `    console.log('   Record ID        :', data.file.id);`,
      `    console.log('   Provider Terpakai:', data.file.provider);`,
      `    console.log('   Direct CDN URL   :', data.file.url);`,
      `  } else {`,
      `    console.error('❌ Upload Gagal:', data);`,
      `  }`,
      `}`,
      ``,
      `testStorageUpload();`,
      `\`\`\``
    ].join('\n');
  } else if (isAiCategory) {
    aiSystemPrompt = [
      `# 🤖 AI CHAT & COMPLETIONS SPECIFICATION (${provider.toUpperCase()})`,
      ``,
      `## 📌 ATURAN WAJIB SEBELUM MENULIS KODE KE PROJECT UTAMA`,
      `Anda adalah AI Developer Assistant. **SEBELUM** meletakkan atau mengubah kode di project utama, Anda **WAJIB MEMBUAT FILE UJI COBA TERPISAH** (\`test-ai-chat.js\`) untuk menguji konektivitas Gateway API Key dan endpoint AI Chat (\`/v1/chat/completions\`).`,
      `Jalankan skrip uji coba tersebut via terminal. Setelah dipastikan berhasil (\`200 OK\`), barulah Anda mengimplementasikan kode ke dalam komponen project utama.`,
      ``,
      `---`,
      ``,
      `## 🔑 Setelan Kredensial & Server Gateway`,
      `- **Base URL API**: \`${BASE_URL}/v1\``,
      `- **Gateway API Key**: \`${displayKey}\``,
      `- **Target Provider AI**: \`${provider.toUpperCase()}\``,
      `- **Default Model**: \`${defaultModel}\``,
      ``,
      `---`,
      ``,
      `## 🛰️ ENDPOINT AI CHAT COMPLETIONS (OpenAI Standard Format)`,
      `- **URL**: \`${BASE_URL}/v1/chat/completions\``,
      `- **Method**: \`POST\``,
      `- **Header**:`,
      `  - \`Content-Type: application/json\``,
      `  - \`Authorization: Bearer ${displayKey}\``,
      `- **Body JSON**:`,
      `  \`\`\`json`,
      `  {`,
      `    "model": "${defaultModel}",`,
      `    "messages": [`,
      `      { "role": "system", "content": "Kamu adalah asisten AI yang cerdas." },`,
      `      { "role": "user", "content": "Halo!" }`,
      `    ],`,
      `    "temperature": 0.7`,
      `  }`,
      `  \`\`\``,
      ``,
      `---`,
      ``,
      `## 🧪 SKRIP TEST UJI COBA WAJIB (\`test-ai-chat.js\`)`,
      `AI wajib membuat dan menjalankan file ini terlebih dahulu sebelum mengubah project utama:`,
      ``,
      `\`\`\`javascript`,
      `const GATEWAY_KEY = '${displayKey}';`,
      `const BASE_URL = '${BASE_URL}/v1';`,
      ``,
      `async function testAiChat() {`,
      `  console.log('🚀 Testing AI Chat Completion (${provider.toUpperCase()})...');`,
      ``,
      `  const chatRes = await fetch(\`\${BASE_URL}/chat/completions\`, {`,
      `    method: 'POST',`,
      `    headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${GATEWAY_KEY}\` },`,
      `    body: JSON.stringify({ model: '${defaultModel}', messages: [{ role: 'user', content: 'Tes koneksi' }] })`,
      `  });`,
      ``,
      `  const data = await chatRes.json();`,
      `  if (chatRes.ok) {`,
      `    console.log('✅ AI Chat Berhasil!');`,
      `    console.log('   Balasan AI:', data.choices?.[0]?.message?.content?.trim());`,
      `  } else {`,
      `    console.error('❌ AI Chat Gagal:', data);`,
      `  }`,
      `}`,
      ``,
      `testAiChat();`,
      `\`\`\``
    ].join('\n');
  } else {
    aiSystemPrompt = [
      `# 🤖 MASTER UNIVERSAL GATEWAY SPECIFICATION (AI + STORAGE CDN)`,
      ``,
      `## 📌 ATURAN WAJIB SEBELUM MENULIS KODE KE PROJECT UTAMA`,
      `Anda adalah AI Developer Assistant. **SEBELUM** meletakkan atau mengubah kode di project utama, Anda **WAJIB MEMBUAT FILE UJI COBA TERPISAH** (\`test-one-key-hub.js\`) untuk menguji konektivitas Gateway API Key, endpoint AI Chat (\`/v1/chat/completions\`), dan endpoint Storage CDN (\`/v1/storage/upload\`).`,
      `Jalankan skrip uji coba tersebut via terminal. Setelah dipastikan berhasil (\`200 OK\` / \`201 Created\`), barulah Anda mengimplementasikan kode ke dalam komponen project utama.`,
      ``,
      `---`,
      ``,
      `## 🔑 Setelan Kredensial & Server Gateway`,
      `- **Base URL API**: \`${BASE_URL}/v1\``,
      `- **Gateway API Key**: \`${displayKey}\``,
      `- **Target Provider Utama**: \`Semua Provider (Universal Key - AI & Storage CDN)\``,
      ``,
      `---`,
      ``,
      `## 🛰️ 1. ENDPOINT AI CHAT COMPLETIONS (OpenAI Standard Format)`,
      `- **URL**: \`${BASE_URL}/v1/chat/completions\``,
      `- **Header**: \`Authorization: Bearer ${displayKey}\`, \`Content-Type: application/json\``,
      `- **Body JSON**:`,
      `  \`\`\`json`,
      `  {`,
      `    "model": "gemini-2.5-flash",`,
      `    "messages": [{ "role": "user", "content": "Halo!" }]`,
      `  }`,
      `  \`\`\``,
      ``,
      `---`,
      ``,
      `## 📸 2. ENDPOINT STORAGE GATEWAY (Cloudinary/ImageKit Upload)`,
      `- **URL**: \`${BASE_URL}/v1/storage/upload\``,
      `- **Header**: \`Authorization: Bearer ${displayKey}\`, \`Content-Type: application/json\``,
      `- **Body JSON**:`,
      `  \`\`\`json`,
      `  {`,
      `    "file": "data:image/png;base64,iVBORw0KGgo...",`,
      `    "file_name": "photo.png",`,
      `    "auto_rotate": true`,
      `  }`,
      `  \`\`\``,
      ``,
      `---`,
      ``,
      `## 🧪 3. SKRIP TEST UJI COBA WAJIB (\`test-one-key-hub.js\`)`,
      `\`\`\`javascript`,
      `const GATEWAY_KEY = '${displayKey}';`,
      `const BASE_URL = '${BASE_URL}/v1';`,
      ``,
      `async function runTest() {`,
      `  console.log('🚀 Testing Universal Gateway...');`,
      `  const chatRes = await fetch(\`\${BASE_URL}/chat/completions\`, {`,
      `    method: 'POST',`,
      `    headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${GATEWAY_KEY}\` },`,
      `    body: JSON.stringify({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'Tes' }] })`,
      `  });`,
      `  console.log('1. AI Chat Status:', chatRes.status, await chatRes.json());`,
      `}`,
      ``,
      `runTest();`,
      `\`\`\``
    ].join('\n');
  }

  useEffect(() => {
    if (section === 'models' && isOpen) {
      fetchAllModels();
    }
  }, [section, isOpen]);

  const fetchAllModels = async () => {
    setModelsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (displayKey && displayKey !== 'YOUR_GATEWAY_KEY') {
        headers['Authorization'] = `Bearer ${displayKey}`;
      }
      const res = await fetch(`${BASE_URL}/v1/models`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: Model[] = json?.data || [];
      setModels(data);
    } catch {
      toast.error('Gagal memuat daftar model dari server');
    } finally {
      setModelsLoading(false);
    }
  };

  const chatExamples: Record<LangTab, string> = {
    curl:
      `# ─── Chat Completion (OpenAI-compatible) ────────────────────────────
curl ${BASE_URL}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${displayKey}" \\
  -d '{
    "model": "${defaultModel}",
    "messages": [
      {"role": "system",  "content": "Kamu adalah asisten AI yang cerdas."},
      {"role": "user",    "content": "Jelaskan konsep machine learning dalam 3 kalimat."}
    ],
    "max_tokens": 1024,
    "temperature": 0.7
  }'
`,
    javascript:
      `// ─── JavaScript / Node.js (Fetch API) ────────────────────────────────
const GATEWAY_KEY = '${displayKey}';
const MODEL       = '${defaultModel}';

async function chat(messages, model = MODEL) {
  const res = await fetch('${BASE_URL}/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${GATEWAY_KEY}\`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) throw new Error(\`Gateway error: \${res.status}\`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? data.text ?? data;
}

console.log(await chat([{ role: 'user', content: 'Halo!' }]));
`,
    python:
      `# ─── Python (requests) ──────────────────────────────────────────────
import requests

GATEWAY_KEY   = '${displayKey}'
BASE          = '${BASE_URL}/v1'
DEFAULT_MODEL = '${defaultModel}'

def chat(messages: list, model: str = DEFAULT_MODEL) -> str:
    res = requests.post(
        f'{BASE}/chat/completions',
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {GATEWAY_KEY}'},
        json={'model': model, 'messages': messages},
        timeout=60,
    )
    res.raise_for_status()
    return res.json()['choices'][0]['message']['content']

print(chat([{'role': 'user', 'content': 'Halo!'}]))
`,
    openai_sdk:
      `# ─── OpenAI Python SDK ──────────────────────────────────────────────
from openai import OpenAI

client = OpenAI(
    base_url='${BASE_URL}/v1',
    api_key='${displayKey}',
)

response = client.chat.completions.create(
    model='${defaultModel}',
    messages=[{'role': 'user', 'content': 'Ceritakan tentang AI.'}],
)
print(response.choices[0].message.content)
`,
    openclaw:
      `# ─── Konfigurasi OpenClaw (.env / settings UI) ──────────────────────
baseUrl: "${BASE_URL}/v1"
apiKey: "${displayKey}"
api: "openai-completions"
model: "${defaultModel}"
`,
  };

  const storageExamples: Record<LangTab, string> = {
    curl:
      `# ─── 1. Upload File ke Storage CDN (Base64 atau Remote URL) ─────────────
curl ${BASE_URL}/v1/storage/upload \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${displayKey}" \\
  -d '{
    "file": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...",
    "file_name": "foto_produk.png",
    "auto_rotate": true${provider !== 'all' ? `,\n    "provider": "${provider}"` : ''}
  }'

# ─── 2. List Berkas CDN milik API Key ini (dengan filter & search) ─────
curl "${BASE_URL}/v1/storage/list?page=1&limit=20&provider=${provider === 'all' ? 'cloudinary' : provider}&search=" \\
  -H "Authorization: Bearer ${displayKey}"

# ─── 3. Detail Berkas CDN Berdasarkan ID ──────────────────────────────
curl ${BASE_URL}/v1/storage/files/YOUR_FILE_ID \\
  -H "Authorization: Bearer ${displayKey}"

# ─── 4. Hapus Berkas CDN dari Database ─────────────────────────────────
curl -X DELETE ${BASE_URL}/v1/storage/files/YOUR_FILE_ID \\
  -H "Authorization: Bearer ${displayKey}"
`,
    javascript:
      `// ─── Storage Gateway CDN Client (JavaScript / Node.js) ──────────────
const GATEWAY_KEY = '${displayKey}';
const BASE_URL    = '${BASE_URL}/v1';

// 1. Upload Gambar (Base64 atau Remote URL)
async function uploadToCDN(fileBase64OrUrl, fileName) {
  const res = await fetch(\`\${BASE_URL}/storage/upload\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${GATEWAY_KEY}\`,
    },
    body: JSON.stringify({
      file: fileBase64OrUrl,
      file_name: fileName,
      auto_rotate: true,
      provider: '${provider === 'all' ? 'cloudinary' : provider}'
    }),
  });

  const data = await res.json();
  if (data.success) {
    console.log('✅ Record ID  :', data.file.id);
    console.log('✅ Direct URL :', data.file.url);
    console.log('✅ Provider   :', data.file.provider);
    return data.file;
  }
  throw new Error(data.error?.message || 'Upload gagal');
}

// 2. List Daftar File yang Terunggah
async function listMyCDNFiles(page = 1, limit = 20) {
  const res = await fetch(\`\${BASE_URL}/storage/list?page=\${page}&limit=\${limit}&provider=${provider === 'all' ? 'cloudinary' : provider}\`, {
    headers: { 'Authorization': \`Bearer \${GATEWAY_KEY}\` }
  });
  const data = await res.json();
  console.log('Files:', data.items, 'Total:', data.pagination?.total);
}

// 3. Detail File CDN
async function getCDNFileDetail(fileId) {
  const res = await fetch(\`\${BASE_URL}/storage/files/\${fileId}\`, {
    headers: { 'Authorization': \`Bearer \${GATEWAY_KEY}\` }
  });
  return await res.json();
}

// 4. Hapus File CDN
async function deleteCDNFile(fileId) {
  const res = await fetch(\`\${BASE_URL}/storage/files/\${fileId}\`, {
    method: 'DELETE',
    headers: { 'Authorization': \`Bearer \${GATEWAY_KEY}\` }
  });
  return await res.json();
}
`,
    python:
      `# ─── Storage Gateway CDN Client (Python requests) ────────────────────
import requests

GATEWAY_KEY = '${displayKey}'
BASE_URL    = '${BASE_URL}/v1'

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {GATEWAY_KEY}'
}

# 1. Upload Gambar (Base64 atau Remote URL)
def upload_image_to_cdn(base64_or_url, file_name):
    payload = {
        'file': base64_or_url,
        'file_name': file_name,
        'auto_rotate': True,
        'provider': '${provider === 'all' ? 'cloudinary' : provider}'
    }
    res = requests.post(f'{BASE_URL}/storage/upload', json=payload, headers=headers)
    data = res.json()
    if res.status_code == 201 and data.get('success'):
        print('✅ Direct CDN URL:', data['file']['url'])
        print('   Record ID    :', data['file']['id'])
        return data['file']
    else:
        print('❌ Upload Error:', data)

# 2. List Berkas CDN Terunggah
def list_cdn_files(page=1, limit=20):
    res = requests.get(f'{BASE_URL}/storage/list?page={page}&limit={limit}', headers=headers)
    print('Total Files:', res.json())

# 3. Detail File CDN
def get_cdn_file_detail(file_id):
    res = requests.get(f'{BASE_URL}/storage/files/{file_id}', headers=headers)
    return res.json()

# 4. Hapus File CDN
def delete_cdn_file(file_id):
    res = requests.delete(f'{BASE_URL}/storage/files/{file_id}', headers=headers)
    return res.json()
`,
    openai_sdk:
      `# ─── Integrasi Storage Gateway dalam Python ────────────────────────
import requests

GATEWAY_KEY = '${displayKey}'

response = requests.post(
    '${BASE_URL}/v1/storage/upload',
    headers={'Authorization': f'Bearer {GATEWAY_KEY}'},
    json={
        'file': 'https://example.com/source-image.jpg',
        'file_name': 'processed.jpg',
        'auto_rotate': True
    }
)
print('CDN URL:', response.json()['file']['url'])
`,
    openclaw:
      `# ─── OpenClaw CDN Upload Configuration ──────────────────────────────
uploadUrl: "${BASE_URL}/v1/storage/upload"
apiKey: "${displayKey}"
autoRotate: true
`,
  };

  const endpointRef = [
    { method: 'POST', path: '/v1/chat/completions', desc: 'Chat completion (OpenAI-compatible)', auth: 'Bearer / X-API-Key' },
    { method: 'POST', path: '/v1/storage/upload', desc: 'Upload file ke CDN (Cloudinary/ImageKit/Uploadcare) + Auto Rotate', auth: 'Bearer / X-API-Key' },
    { method: 'GET', path: '/v1/storage/list', desc: 'List berkas CDN milik API Key ini', auth: 'Bearer / X-API-Key' },
    { method: 'DELETE', path: '/v1/storage/files/:id', desc: 'Hapus file CDN dari database', auth: 'Bearer / X-API-Key' },
    { method: 'GET', path: '/v1/models', desc: 'List semua model AI (61+ model)', auth: 'Tidak wajib' },
  ];

  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden bg-card/50 backdrop-blur-sm">
      {/* ── Collapsible Header ──────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center">
            <BookOpen className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">Dokumentasi API Gateway & Storage CDN</p>
            <p className="text-xs text-muted-foreground">cURL · JavaScript · Python · AI Models · Cloudinary / ImageKit Storage</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30">

              {/* ── Key Selector & Key Banner ─────────────────────────────────── */}
              <div className="mx-5 mt-5 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-blue-500/5 border border-primary/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-xs font-bold text-foreground">Gateway API Key Dokumentasi</p>
                  </div>

                  {userKeys.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Pilih Key:</span>
                      <select
                        value={selectedKeyId}
                        onChange={(e) => handleKeySelect(e.target.value)}
                        className="bg-secondary/80 border border-border/50 text-xs rounded-lg px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="custom">Preview / Custom Key</option>
                        {userKeys.map(k => (
                          <option key={k.id} value={k.id}>
                            🔑 {k.name || 'Unnamed Key'} ({k.provider ? k.provider.toUpperCase() : 'UNIVERSAL'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="font-mono text-[11px] bg-background/80 border border-border/40 rounded-lg px-3 py-2 break-all text-primary font-semibold select-all">
                  {displayKey}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Semua contoh kode di bawah secara otomatis memperbarui API Key dan format request sesuai dengan provider key yang Anda pilih di atas.
                </p>
              </div>

              {/* ── Section Tabs ─────────────────────────────────────── */}
              <div className="flex border-b border-border/30 mt-4 px-5 gap-1 overflow-x-auto scrollbar-none">
                <SectionTab active={section === 'chat'} onClick={() => setSection('chat')} icon={MessageSquare} label="AI Chat Completions" />
                <SectionTab active={section === 'storage'} onClick={() => setSection('storage')} icon={ImageIcon} label="Storage CDN (Cloudinary/ImageKit)" badge="Failover" />
                <SectionTab active={section === 'models'} onClick={() => setSection('models')} icon={List} label="Models" badge="61+" />
                <SectionTab active={section === 'reference'} onClick={() => setSection('reference')} icon={Hash} label="API Reference" />
                <SectionTab active={section === 'ai_prompt'} onClick={() => setSection('ai_prompt')} icon={Code2} label="Prompt Untuk AI" />
              </div>

              <div className="p-5 space-y-5">

                {/* ══════════════ CHAT SECTION ══════════════════════════ */}
                <AnimatePresence mode="wait">
                  {section === 'chat' && (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-5"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <MethodBadge method="POST" />
                        <code className="text-xs font-mono bg-secondary/60 px-2 py-1 rounded text-foreground/80">{BASE_URL}/v1/chat/completions</code>
                        <span className="text-xs text-muted-foreground">· OpenAI-compatible</span>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Filter Provider di contoh kode:</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {Object.keys(PROVIDER_META).map(p => (
                            <button
                              key={p}
                              onClick={() => handleProviderChange(p)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${provider === p
                                  ? PROVIDER_META[p].color
                                  : 'border-border/30 text-muted-foreground hover:border-border/60 hover:text-foreground'
                                }`}
                            >
                              {PROVIDER_META[p].emoji} {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        <LangTab active={langTab === 'curl'} onClick={() => setLangTab('curl')} label="🖥 cURL" />
                        <LangTab active={langTab === 'javascript'} onClick={() => setLangTab('javascript')} label="⚡ JavaScript" />
                        <LangTab active={langTab === 'python'} onClick={() => setLangTab('python')} label="🐍 Python" />
                        <LangTab active={langTab === 'openai_sdk'} onClick={() => setLangTab('openai_sdk')} label="🤖 OpenAI SDK" />
                        <LangTab active={langTab === 'openclaw'} onClick={() => setLangTab('openclaw')} label="🦞 OpenClaw" />
                      </div>

                      <CodeBlock
                        code={chatExamples[langTab]}
                        id={`chat-${langTab}`}
                        lang={langTab === 'curl' ? 'bash' : langTab === 'openai_sdk' ? 'python' : langTab === 'openclaw' ? 'yaml' : langTab}
                      />
                    </motion.div>
                  )}

                  {/* ══════════════ STORAGE CDN SECTION ═══════════════════ */}
                  {section === 'storage' && (
                    <motion.div
                      key="storage"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-5"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <MethodBadge method="POST" />
                        <code className="text-xs font-mono bg-secondary/60 px-2 py-1 rounded text-foreground/80">{BASE_URL}/v1/storage/upload</code>
                        <span className="text-xs text-muted-foreground">· Auto Failover & EXIF Rotation</span>
                      </div>

                      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-teal-500/10 border border-blue-500/20 space-y-2 text-xs text-blue-300">
                        <div className="font-bold text-sm flex items-center gap-2 text-blue-400">
                          <ImageIcon className="w-4 h-4" /> Multi-CDN Storage Gateway Service ({provider.toUpperCase()})
                        </div>
                        <p>
                          Endpoint ini digunakan untuk mengunggah gambar/media dari website Anda. Sistem otomatis melakukan **EXIF Auto-Rotation** (agar posisi foto tidak miring) dan **Auto-Failover** antar provider storage (ImageKit ➔ Cloudinary ➔ Uploadcare).
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Pilih Target Storage CDN di Contoh Kode:</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {['cloudinary', 'imagekit', 'uploadcare', 'removebg'].map(p => (
                            <button
                              key={p}
                              onClick={() => handleProviderChange(p)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${provider === p
                                  ? PROVIDER_META[p].color
                                  : 'border-border/30 text-muted-foreground hover:border-border/60 hover:text-foreground'
                                }`}
                            >
                              {PROVIDER_META[p].emoji} {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        <LangTab active={langTab === 'curl'} onClick={() => setLangTab('curl')} label="🖥 cURL" />
                        <LangTab active={langTab === 'javascript'} onClick={() => setLangTab('javascript')} label="⚡ JavaScript" />
                        <LangTab active={langTab === 'python'} onClick={() => setLangTab('python')} label="🐍 Python" />
                      </div>

                      <CodeBlock
                        code={storageExamples[langTab]}
                        id={`storage-${langTab}`}
                        lang={langTab === 'curl' ? 'bash' : langTab}
                      />
                    </motion.div>
                  )}

                  {/* ══════════════ MODELS SECTION ═══════════════════════ */}
                  {section === 'models' && (
                    <motion.div
                      key="models"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-5"
                    >
                      <div className="flex flex-wrap gap-2">
                        {[
                          { m: 'GET', p: '/v1/models' },
                          { m: 'GET', p: '/gateway/:provider/models' },
                        ].map(e => (
                          <div key={e.p} className="flex items-center gap-1.5">
                            <MethodBadge method={e.m} />
                            <code className="text-xs font-mono bg-secondary/60 px-2 py-1 rounded text-foreground/80">{BASE_URL}{e.p}</code>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-primary" />
                            Browser Model Live
                            {models.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{models.length} model</span>
                            )}
                          </p>
                          <button
                            onClick={fetchAllModels}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/40 text-muted-foreground hover:text-foreground transition-all"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${modelsLoading ? 'animate-spin' : ''}`} />
                            {modelsLoading ? 'Memuat...' : 'Refresh'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ══════════════ REFERENCE SECTION ════════════════════ */}
                  {section === 'reference' && (
                    <motion.div
                      key="reference"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-5"
                    >
                      <div>
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Server className="w-4 h-4 text-primary" />
                          Semua Endpoint Gateway & Storage
                        </p>
                        <div className="rounded-xl border border-border/30 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-secondary/60 border-b border-border/30">
                                <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Method</th>
                                <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Path</th>
                                <th className="px-3 py-3 text-left font-semibold text-muted-foreground hidden sm:table-cell">Deskripsi</th>
                                <th className="px-3 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Auth</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpointRef.map((e, i) => (
                                <tr key={e.path} className={`border-b border-border/20 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                                  <td className="px-3 py-2.5"><MethodBadge method={e.method} /></td>
                                  <td className="px-3 py-2.5 font-mono text-[11px] text-foreground/80">{e.path}</td>
                                  <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{e.desc}</td>
                                  <td className="px-3 py-2.5 hidden md:table-cell">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 border border-border/30 text-muted-foreground">{e.auth}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ══════════════ AI PROMPT SECTION ════════════════════ */}
                  {section === 'ai_prompt' && (
                    <motion.div
                      key="ai_prompt"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary">
                        <Zap className="w-4 h-4 mt-0.5 shrink-0 animate-pulse" />
                        <div>
                          <strong>Tips Cepat:</strong> Salin prompt di bawah ini dan tempelkan ke ChatGPT, Claude, Cursor, v0, atau AI lainnya agar AI tersebut langsung paham cara memanggil API rotasi & Storage CDN ini di kode Anda.
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-muted-foreground">Prompt Instruksi Sistem untuk AI</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(aiSystemPrompt);
                              toast.success('Prompt AI berhasil disalin!');
                            }}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all font-medium"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Salin Prompt
                          </button>
                        </div>
                        <CodeBlock
                          code={aiSystemPrompt}
                          id="ai-prompt-block"
                          lang="markdown"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
