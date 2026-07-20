import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, Terminal, Code2, Globe, BookOpen,
  ChevronDown, ChevronUp, Cpu, Zap, RefreshCw,
  MessageSquare, List, Eye, Hash, Search, ExternalLink,
  Server, Shield, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  gatewayKey?: string;
  defaultProvider?: string;
  collapsed?: boolean;
}

type LangTab = 'curl' | 'javascript' | 'python' | 'openai_sdk';
type Section = 'chat' | 'models' | 'reference' | 'ai_prompt';

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

const BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL as string || 'http://localhost:3000').replace(/\/api\/?$/, '')
  : 'https://one.apprentice.cyou/api';

const PROVIDER_META: Record<string, { color: string; badge: string; emoji: string }> = {
  gemini: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', badge: 'bg-blue-500/20 text-blue-300', emoji: '🔵' },
  groq: { color: 'bg-orange-500/10 text-orange-400 border-orange-500/30', badge: 'bg-orange-500/20 text-orange-300', emoji: '🟠' },
  openai: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300', emoji: '🟢' },
  mistral: { color: 'bg-rose-500/10 text-rose-400 border-rose-500/30', badge: 'bg-rose-500/20 text-rose-300', emoji: '🌸' },
  cohere: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', badge: 'bg-purple-500/20 text-purple-300', emoji: '🟣' },
  deepseek: { color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', badge: 'bg-cyan-500/20 text-cyan-300', emoji: '🔷' },
  cerebras: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-300', emoji: '🟡' },
  together: { color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30', badge: 'bg-indigo-500/20 text-indigo-300', emoji: '🔮' },
  xai: { color: 'bg-slate-500/10 text-slate-400 border-slate-500/30', badge: 'bg-slate-500/20 text-slate-300', emoji: '⚫' },
};

// ── Copy hook ─────────────────────────────────────────────────────────────────
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

// ── Syntax-highlighted code block ─────────────────────────────────────────────
function CodeBlock({ code, id, lang = 'bash' }: { code: string; id: string; lang?: string }) {
  const { copy, copiedId } = useCopy();
  const langLabels: Record<string, string> = {
    bash: 'cURL / Shell', javascript: 'JavaScript', python: 'Python',
    typescript: 'TypeScript', json: 'JSON Response', text: 'Text',
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

// ── Method badge ──────────────────────────────────────────────────────────────
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

// ── Section Tab ────────────────────────────────────────────────────────────────
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

// ── Language Tab ───────────────────────────────────────────────────────────────
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

// ── Provider → default model map ───────────────────────────────────────────────
const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  mistral: 'mistral-small-latest',
  cohere: 'command-r-plus',
  deepseek: 'deepseek-chat',
  cerebras: 'llama3.1-70b',
  together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  xai: 'grok-beta',
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function GatewayDocs({ gatewayKey = 'YOUR_GATEWAY_KEY', defaultProvider = 'gemini', collapsed = false }: Props) {
  const [isOpen, setIsOpen] = useState(!collapsed);
  const [section, setSection] = useState<Section>('chat');
  const [langTab, setLangTab] = useState<LangTab>('curl');
  const [provider, setProvider] = useState(defaultProvider);
  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsFilter, setModelsFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [allProviders, setAllProviders] = useState<string[]>([]);

  const displayKey = gatewayKey.startsWith('YOUR') ? 'YOUR_GATEWAY_KEY' : gatewayKey;
  // Default model changes with provider — this is what makes examples update
  const defaultModel = PROVIDER_DEFAULT_MODEL[provider] || 'gemini-2.0-flash';

  const aiSystemPrompt = `Kamu adalah asisten AI pemrograman. Saya menggunakan Unified AI Gateway (rotasi API key otomatis) dengan spesifikasi berikut:

- Base URL API: \`${BASE_URL}/v1\`
- Gateway API Key: \`${displayKey}\`

Semua request chat completions (seperti GPT, Gemini, Llama, Mistral, Cohere, DeepSeek) harus dikirim ke:
- Endpoint: \`${BASE_URL}/v1/chat/completions\`
- Header Autentikasi: \`Authorization: Bearer ${displayKey}\`
- Format Request: Mengikuti standar format OpenAI Chat Completions (misal: JSON body dengan \`model\`, \`messages\`, \`temperature\`, \`max_tokens\`).

Daftar model yang tersedia dapat diambil via:
- Endpoint: \`${BASE_URL}/v1/models\`

Ketika menulis kode pemrograman untuk saya (JavaScript/Node.js, Python, cURL, PHP, Go, dll.), selalu gunakan Base URL dan API Key di atas. Jika menggunakan SDK resmi OpenAI (python-openai, openai-node), arahkan parameter \`base_url\` / \`baseURL\` ke \`${BASE_URL}/v1\` dan \`api_key\` / \`apiKey\` ke \`${displayKey}\`.`;

  // Load models when section switches to models
  useEffect(() => {
    if (section === 'models' && isOpen) {
      fetchAllModels();
    }
  }, [section, isOpen]);

  const fetchAllModels = async () => {
    setModelsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (gatewayKey && gatewayKey !== 'YOUR_GATEWAY_KEY') {
        headers['Authorization'] = `Bearer ${gatewayKey}`;
      }
      const res = await fetch(`${BASE_URL}/v1/models`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: Model[] = json?.data || [];
      setModels(data);
      const provs = [...new Set(data.map(m => m.provider))].sort();
      setAllProviders(provs);
    } catch {
      toast.error('Gagal memuat daftar model dari server');
    } finally {
      setModelsLoading(false);
    }
  };

  const filteredModels = models.filter(m => {
    const matchFilter = !modelsFilter ||
      m.id.toLowerCase().includes(modelsFilter.toLowerCase()) ||
      m.display_name.toLowerCase().includes(modelsFilter.toLowerCase());
    const matchProvider = providerFilter === 'all' || m.provider === providerFilter;
    return matchFilter && matchProvider;
  });

  // ── Code examples per language / section ──────────────────────────────────
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

# ─── Chat via provider tertentu ──────────────────────────────────────
curl ${BASE_URL}/gateway/${provider}/chat \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${displayKey}" \\
  -d '{
    "model": "${defaultModel}",
    "messages": [{"role": "user", "content": "Halo dunia!"}]
  }'

# ─── Cek semua endpoint aktif ─────────────────────────────────────────
curl ${BASE_URL}/
`,
    javascript:
      `// ─── JavaScript / Node.js (Fetch API) ────────────────────────────────
const GATEWAY_KEY = '${displayKey}';
const MODEL       = '${defaultModel}'; // provider: ${provider}

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

  // Supports both OpenAI format & direct text response
  return data.choices?.[0]?.message?.content ?? data.text ?? data;
}

// Contoh penggunaan
const answer = await chat([
  { role: 'system', content: 'Kamu adalah asisten AI.' },
  { role: 'user',   content: 'Apa itu neural network?' },
]);
console.log(answer);

// ─── Multi-turn conversation ──────────────────────────────────────────
const history = [];

async function sendMessage(userMsg) {
  history.push({ role: 'user', content: userMsg });
  const reply = await chat(history);
  history.push({ role: 'assistant', content: reply });
  return reply;
}

console.log(await sendMessage('Halo!'));
console.log(await sendMessage('Apa tindak lanjut dari jawaban sebelumnya?'));
`,
    python:
      `# ─── Python (requests) ──────────────────────────────────────────────
import requests

GATEWAY_KEY   = '${displayKey}'
BASE          = '${BASE_URL}'
DEFAULT_MODEL = '${defaultModel}'  # provider: ${provider}
HEADERS       = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {GATEWAY_KEY}',
}

def chat(messages: list, model: str = DEFAULT_MODEL) -> str:
    """Kirim pesan ke AI dan dapatkan balasan."""
    res = requests.post(
        f'{BASE}/v1/chat/completions',
        headers=HEADERS,
        json={'model': model, 'messages': messages},
        timeout=60,
    )
    res.raise_for_status()
    data = res.json()
    return data['choices'][0]['message']['content']

# Contoh sederhana
reply = chat([{'role': 'user', 'content': 'Apa itu deep learning?'}])
print(reply)

# Contoh multi-provider dengan rotasi otomatis
models_to_try = [
    '${defaultModel}',          # ${provider}
    'gemini-2.0-flash',         # gemini
    'llama-3.3-70b-versatile',  # groq
    'mistral-small-latest',     # mistral
]

for model_id in models_to_try:
    try:
        answer = chat([{'role': 'user', 'content': 'Hello!'}], model=model_id)
        print(f"✅ {model_id}: {answer[:80]}...")
        break
    except Exception as e:
        print(f"❌ {model_id}: {e}")
`,
    openai_sdk:
      `# ─── OpenAI Python SDK ──────────────────────────────────────────────
from openai import OpenAI

# Cukup ganti base_url & api_key — semua method OpenAI bekerja!
client = OpenAI(
    base_url='${BASE_URL}/v1',
    api_key='${displayKey}',
)

# Chat completion — model: ${provider}
response = client.chat.completions.create(
    model='${defaultModel}',
    messages=[
        {'role': 'system', 'content': 'Kamu adalah pakar teknologi AI.'},
        {'role': 'user',   'content': 'Jelaskan kemampuan model ${provider} ini.'},
    ],
    max_tokens=512,
    temperature=0.8,
)
print(response.choices[0].message.content)

# List semua model
for m in client.models.list():
    print(m.id)

# ─── OpenAI JavaScript / TypeScript SDK ──────────────────────────────
/*
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${BASE_URL}/v1',
  apiKey:  '${displayKey}',
  dangerouslyAllowBrowser: true,
});

const res = await client.chat.completions.create({
  model: '${defaultModel}',
  messages: [{ role: 'user', content: 'Ceritakan tentang ${provider}.' }],
});
console.log(res.choices[0].message.content);
*/
`,
  };

  const modelsExamples: Record<LangTab, string> = {
    curl:
      `# ─── List Semua Model (61+ model dari semua provider) ────────────────
curl ${BASE_URL}/v1/models \\
  -H "Authorization: Bearer ${displayKey}"

# ─── List Model per Provider ──────────────────────────────────────────
curl ${BASE_URL}/gateway/gemini/models \\
  -H "X-API-Key: ${displayKey}"

curl ${BASE_URL}/gateway/groq/models
curl ${BASE_URL}/gateway/mistral/models
curl ${BASE_URL}/gateway/cohere/models
curl ${BASE_URL}/gateway/deepseek/models

# ─── Contoh filter model dengan jq ──────────────────────────────────
curl ${BASE_URL}/v1/models | jq '.data[] | select(.provider == "gemini") | .id'
`,
    javascript:
      `// ─── List semua model ─────────────────────────────────────────────────
const res = await fetch('${BASE_URL}/v1/models', {
  headers: { 'Authorization': 'Bearer ${displayKey}' },
});
const { data: models } = await res.json();
console.log(\`Total: \${models.length} model\`);

// Filter per provider
const geminiModels = models.filter(m => m.provider === 'gemini');
const groqModels   = models.filter(m => m.provider === 'groq');

// Tampilkan dalam tabel
console.table(geminiModels.map(m => ({
  id:       m.id,
  context:  m.context_window,
  vision:   m.supports_vision,
})));

// ─── List model provider tertentu ────────────────────────────────────
const provRes = await fetch('${BASE_URL}/gateway/gemini/models');
const { data: geminiOnly } = await provRes.json();
`,
    python:
      `# ─── List semua model via requests ──────────────────────────────────
import requests

res = requests.get(
    '${BASE_URL}/v1/models',
    headers={'Authorization': 'Bearer ${displayKey}'},
)
models = res.json().get('data', [])

print(f"Total: {len(models)} model tersedia\\n")

# Group per provider
from collections import defaultdict
by_provider = defaultdict(list)
for m in models:
    by_provider[m['provider']].append(m['id'])

for prov, ids in sorted(by_provider.items()):
    print(f"🔹 {prov.upper()} ({len(ids)} model):")
    for mid in ids:
        print(f"   - {mid}")
`,
    openai_sdk:
      `# ─── OpenAI Python SDK — List Model ──────────────────────────────────
from openai import OpenAI

client = OpenAI(
    base_url='${BASE_URL}/v1',
    api_key='${displayKey}',
)

# List semua model (sama persis seperti memanggil OpenAI resmi)
models = client.models.list()
for m in models:
    print(f"{m.id:40s}  owned_by={m.owned_by}")

# ─── OpenAI JS SDK ────────────────────────────────────────────────────
/*
const models = await client.models.list();
for (const m of models.data) {
  console.log(m.id, '—', m.owned_by);
}
*/
`,
  };

  const chatResponse = `{
  "id": "chatcmpl-a1b2c3d4e5",
  "object": "chat.completion",
  "created": 1736472501,
  "model": "gemini-2.0-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Machine learning adalah cabang kecerdasan buatan yang memungkinkan sistem belajar dari data."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 24,
    "completion_tokens": 42,
    "total_tokens": 66
  }
}`;

  const modelsResponse = `{
  "object": "list",
  "data": [
    {
      "id": "gemini-2.5-flash",
      "object": "model",
      "created": 1736472501,
      "owned_by": "Google Gemini",
      "active": true,
      "context_window": 1048576,
      "supports_vision": true,
      "display_name": "Gemini 2.5 Flash",
      "provider": "gemini"
    },
    {
      "id": "gemini-2.0-flash",
      "object": "model",
      "created": 1736472501,
      "owned_by": "Google Gemini",
      "active": true,
      "context_window": 1048576,
      "supports_vision": false,
      "display_name": "Gemini 2.0 Flash",
      "provider": "gemini"
    },
    {
      "id": "llama-3.3-70b-versatile",
      "object": "model",
      "created": 1736472501,
      "owned_by": "Groq",
      "active": true,
      "context_window": 131072,
      "supports_vision": false,
      "display_name": "Llama 3.3 70B Versatile",
      "provider": "groq"
    }
  ]
}`;

  const endpointRef = [
    { method: 'POST', path: '/v1/chat/completions', desc: 'Chat completion (OpenAI-compatible)', auth: 'Bearer / X-API-Key' },
    { method: 'POST', path: '/gateway/:provider/chat', desc: 'Chat via provider tertentu', auth: 'X-API-Key' },
    { method: 'GET', path: '/v1/models', desc: 'List semua model (61+ model)', auth: 'Tidak wajib' },
    { method: 'GET', path: '/gateway/models', desc: 'List semua model (alias)', auth: 'Tidak wajib' },
    { method: 'GET', path: '/gateway/:provider/models', desc: 'List model per provider', auth: 'Tidak wajib' },
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
            <p className="font-semibold text-sm">Dokumentasi API Gateway</p>
            <p className="text-xs text-muted-foreground">cURL · JavaScript · Python · OpenAI SDK · 61+ Model</p>
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

              {/* ── Key Banner ───────────────────────────────────────── */}
              <div className="mx-5 mt-5 flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-blue-500/5 border border-primary/20">
                <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-foreground">Gateway Key Anda</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Rotasi Otomatis</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">61+ Model</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">Multi-Provider</span>
                  </div>
                  <div className="mt-2 font-mono text-[11px] bg-background/60 border border-border/30 rounded-lg px-3 py-2 break-all text-muted-foreground select-all">
                    {displayKey}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Gunakan key ini sebagai pengganti API Key langsung. Satu key untuk semua provider — gateway rotasi otomatis jika satu key gagal.
                  </p>
                </div>
              </div>

              {/* ── Section Tabs ─────────────────────────────────────── */}
              <div className="flex border-b border-border/30 mt-4 px-5 gap-1 overflow-x-auto scrollbar-none">
                <SectionTab active={section === 'chat'} onClick={() => setSection('chat')} icon={MessageSquare} label="Chat Completions" />
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
                      {/* Endpoint pill */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <MethodBadge method="POST" />
                        <code className="text-xs font-mono bg-secondary/60 px-2 py-1 rounded text-foreground/80">{BASE_URL}/v1/chat/completions</code>
                        <span className="text-xs text-muted-foreground">· OpenAI-compatible</span>
                      </div>

                      {/* Provider selector */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Provider di contoh kode:</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {Object.keys(PROVIDER_META).map(p => (
                            <button
                              key={p}
                              onClick={() => setProvider(p)}
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

                      {/* Lang tabs */}
                      <div className="flex gap-1.5 flex-wrap">
                        <LangTab active={langTab === 'curl'} onClick={() => setLangTab('curl')} label="🖥 cURL" />
                        <LangTab active={langTab === 'javascript'} onClick={() => setLangTab('javascript')} label="⚡ JavaScript" />
                        <LangTab active={langTab === 'python'} onClick={() => setLangTab('python')} label="🐍 Python" />
                        <LangTab active={langTab === 'openai_sdk'} onClick={() => setLangTab('openai_sdk')} label="🤖 OpenAI SDK" />
                      </div>

                      <CodeBlock
                        code={chatExamples[langTab]}
                        id={`chat-${langTab}`}
                        lang={langTab === 'curl' ? 'bash' : langTab === 'openai_sdk' ? 'python' : langTab}
                      />

                      {/* Response example */}
                      <div className="space-y-2">
                        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          Contoh Respons Berhasil (200 OK)
                        </p>
                        <CodeBlock code={chatResponse} id="chat-response" lang="json" />
                      </div>

                      {/* Error note */}
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-muted-foreground">
                          Jika satu API key gagal (429/503), gateway <strong className="text-foreground">otomatis rotasi</strong> ke key berikutnya tanpa perlu ubah kode Anda.
                        </div>
                      </div>
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
                      {/* Endpoint pills */}
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

                      {/* Lang tabs */}
                      <div className="flex gap-1.5 flex-wrap">
                        <LangTab active={langTab === 'curl'} onClick={() => setLangTab('curl')} label="🖥 cURL" />
                        <LangTab active={langTab === 'javascript'} onClick={() => setLangTab('javascript')} label="⚡ JavaScript" />
                        <LangTab active={langTab === 'python'} onClick={() => setLangTab('python')} label="🐍 Python" />
                        <LangTab active={langTab === 'openai_sdk'} onClick={() => setLangTab('openai_sdk')} label="🤖 OpenAI SDK" />
                      </div>

                      <CodeBlock
                        code={modelsExamples[langTab]}
                        id={`models-${langTab}`}
                        lang={langTab === 'curl' ? 'bash' : langTab === 'openai_sdk' ? 'python' : langTab}
                      />

                      {/* Response */}
                      <div className="space-y-2">
                        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <span className="w-2 h-2 rounded-full bg-green-400" />
                          Contoh Respons (GET /v1/models)
                        </p>
                        <CodeBlock code={modelsResponse} id="models-response" lang="json" />
                      </div>

                      {/* ── Live Model Browser ────────────────────────────── */}
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

                        {/* Filters */}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder="Cari model..."
                              value={modelsFilter}
                              onChange={e => setModelsFilter(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-secondary/60 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </div>
                          <select
                            value={providerFilter}
                            onChange={e => setProviderFilter(e.target.value)}
                            className="px-3 py-2 text-xs rounded-lg bg-secondary/60 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground"
                          >
                            <option value="all">Semua Provider</option>
                            {allProviders.map(p => (
                              <option key={p} value={p} className="capitalize">{p}</option>
                            ))}
                          </select>
                        </div>

                        {modelsLoading ? (
                          <div className="py-10 text-center">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Memuat daftar model dari server...</p>
                          </div>
                        ) : models.length === 0 ? (
                          <div className="py-10 text-center border-2 border-dashed border-border/30 rounded-xl">
                            <Server className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm font-medium">Model belum dimuat</p>
                            <p className="text-xs text-muted-foreground mt-1">Klik "Refresh" untuk memuat 61+ model</p>
                            <button
                              onClick={fetchAllModels}
                              className="mt-3 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                              Muat Sekarang
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-xl border border-border/30 overflow-hidden">
                              <div className="overflow-y-auto" style={{ maxHeight: '380px' }}>
                                <table className="w-full text-xs">
                                  <thead className="sticky top-0 z-10">
                                    <tr className="bg-card border-b border-border/40">
                                      <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Model ID</th>
                                      <th className="px-3 py-3 text-left font-semibold text-muted-foreground hidden sm:table-cell">Provider</th>
                                      <th className="px-3 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Context</th>
                                      <th className="px-3 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">Vision</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredModels.map((m, i) => {
                                      const meta = PROVIDER_META[m.provider];
                                      return (
                                        <tr
                                          key={m.id}
                                          className={`border-b border-border/20 hover:bg-secondary/30 transition-colors cursor-pointer group ${i % 2 === 0 ? '' : 'bg-secondary/5'}`}
                                        >
                                          <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                              <div>
                                                <div className="font-mono font-medium text-foreground group-hover:text-primary transition-colors">{m.id}</div>
                                                <div className="text-muted-foreground text-[10px] mt-0.5">{m.display_name}</div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2.5 hidden sm:table-cell">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-medium ${meta?.color || 'bg-secondary/80 border-border/30 text-muted-foreground'}`}>
                                              {meta?.emoji} {m.provider}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground font-mono">
                                            {m.context_window >= 1_000_000
                                              ? <span className="text-emerald-400">{(m.context_window / 1_000_000).toFixed(1)}M</span>
                                              : `${Math.round(m.context_window / 1000)}K`}
                                          </td>
                                          <td className="px-3 py-2.5 hidden lg:table-cell">
                                            {m.supports_vision
                                              ? <span className="flex items-center gap-1 text-emerald-400 text-[10px]"><Eye className="w-3 h-3" /> Ya</span>
                                              : <span className="text-muted-foreground text-[10px]">—</span>
                                            }
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground text-right">
                              Menampilkan <strong className="text-foreground">{filteredModels.length}</strong> dari {models.length} model
                            </p>
                          </>
                        )}
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
                      {/* Endpoint table */}
                      <div>
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Server className="w-4 h-4 text-primary" />
                          Semua Endpoint
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

                      {/* Authentication */}
                      <div>
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-primary" />
                          Autentikasi
                        </p>
                        <div className="space-y-2">
                          {[
                            { header: 'Authorization: Bearer <GATEWAY_KEY>', desc: 'Header standar OpenAI — digunakan di /v1/chat/completions & /v1/models' },
                            { header: 'X-API-Key: <GATEWAY_KEY>', desc: 'Header alternatif — digunakan di /gateway/:provider/chat' },
                          ].map(a => (
                            <div key={a.header} className="p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                              <code className="text-[11px] font-mono text-primary">{a.header}</code>
                              <p className="text-[11px] text-muted-foreground">{a.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Base URLs */}
                      <div>
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Globe className="w-4 h-4 text-primary" />
                          Base URL
                        </p>
                        <CodeBlock
                          code={`# Lokal (Development)
${BASE_URL}

# Production (ganti sesuai domain server Anda)
https://airotation.my.id

# OpenAI SDK base_url
${BASE_URL}/v1`}
                          id="base-urls"
                          lang="bash"
                        />
                      </div>

                      {/* Quick start */}
                      <div>
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary" />
                          Quick Start — Test dalam 30 Detik
                        </p>
                        <CodeBlock
                          code={`# 1. Test koneksi ke gateway
curl ${BASE_URL}/

# 2. Lihat semua model tersedia
curl ${BASE_URL}/v1/models | python -m json.tool

# 3. Kirim chat pertama Anda
curl ${BASE_URL}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${displayKey}" \\
  -d '{"model":"gemini-2.0-flash","messages":[{"role":"user","content":"Halo!"}]}'`}
                          id="quickstart"
                          lang="bash"
                        />
                      </div>

                      {/* Error codes */}
                      <div>
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                          Kode Error
                        </p>
                        <div className="space-y-1.5">
                          {[
                            { code: '401', color: 'text-red-400', desc: 'Gateway Key tidak valid atau tidak ditemukan' },
                            { code: '403', color: 'text-red-400', desc: 'Key tidak aktif atau semua API key provider gagal' },
                            { code: '429', color: 'text-amber-400', desc: 'Rate limit — gateway akan auto-retry ke key berikutnya' },
                            { code: '503', color: 'text-orange-400', desc: 'Semua API key sedang cooldown — coba beberapa saat lagi' },
                            { code: '200', color: 'text-green-400', desc: 'Sukses — respons berhasil dikembalikan' },
                          ].map(e => (
                            <div key={e.code} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/20">
                              <span className={`text-xs font-bold font-mono w-8 ${e.color}`}>{e.code}</span>
                              <span className="text-xs text-muted-foreground">{e.desc}</span>
                            </div>
                          ))}
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
                          <strong>Tips Cepat:</strong> Salin prompt di bawah ini dan tempelkan ke ChatGPT, Claude, Cursor, v0, atau AI lainnya agar AI tersebut langsung paham cara memanggil API rotasi ini di kode Anda.
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
