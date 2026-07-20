import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, RotateCcw, TestTube, Bell, BarChart3, Key, Zap, ArrowRight,
  Workflow, Copy, Check, FileJson, AlertTriangle, ShieldCheck, Terminal,
  Bot, MessageSquare, Eye, Video, Image as ImageIcon, ChevronDown, ChevronRight,
  Smartphone, Globe, Hash, Layers, Code2
} from 'lucide-react';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { API_URL } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─── Sidebar navigation items ────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id: 'about',        label: 'Tentang One Key',        icon: BookOpen },
  { id: 'rotation',     label: 'Auto Rotasi API Key',     icon: RotateCcw },
  { id: 'multimodal',   label: 'Gambar & Video (Vision)', icon: Eye },
  { id: 'n8n',          label: 'Integrasi n8n',           icon: Workflow },
  { id: 'openclaw',     label: 'OpenClaw Integration',    icon: Bot },
  { id: 'test',         label: 'Test API Key',            icon: TestTube },
  { id: 'proxy',        label: 'Proxy Gateway',           icon: Zap },
  { id: 'status',       label: 'Indikator Status',        icon: Key },
  { id: 'errors',       label: 'Error Codes',             icon: AlertTriangle },
];

// ─── Code Block component ────────────────────────────────────────────────────
function CodeBlock({ code, lang = 'json', id, copiedId, onCopy }: {
  code: string; lang?: string; id: string; copiedId: string | null; onCopy: (text: string, id: string) => void
}) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-border shadow-sm max-w-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
        <span className="text-xs text-slate-400 font-mono">{lang}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-slate-400 hover:text-white gap-1 px-2 shrink-0"
          onClick={() => onCopy(code, id)}
        >
          {copiedId === id ? <><Check className="w-3 h-3 text-green-400" /> Disalin!</> : <><Copy className="w-3 h-3" /> Salin</>}
        </Button>
      </div>
      <pre className="p-3 sm:p-4 text-xs font-mono text-slate-100 overflow-x-auto max-h-96 leading-relaxed bg-slate-950 whitespace-pre max-w-full">{code}</pre>
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ id, icon: Icon, iconBg, title, children }: {
  id: string; icon: any; iconBg: string; title: string; children: React.ReactNode
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl sm:rounded-2xl p-3.5 sm:p-6 scroll-mt-20 overflow-hidden max-w-full"
    >
      <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <h2 className="text-base sm:text-xl font-bold truncate">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

// ─── Provider support matrix ─────────────────────────────────────────────────
const VISION_MATRIX = [
  { provider: 'Gemini', image: true, video: true, text: true, notes: 'Image + Video (inline base64). Terbaik untuk video.' },
  { provider: 'OpenAI (GPT-4o)', image: true, video: false, text: true, notes: 'Image via content array. GPT-4o & 4o-mini.' },
  { provider: 'Anthropic (Claude)', image: true, video: false, text: true, notes: 'Image via native Anthropic vision format.' },
  { provider: 'Groq', image: true, video: false, text: true, notes: 'Vision model: llama-3.2-11b-vision-preview.' },
  { provider: 'Mistral', image: false, video: false, text: true, notes: 'Text only.' },
  { provider: 'Cohere', image: false, video: false, text: true, notes: 'Text only.' },
  { provider: 'Together AI', image: false, video: false, text: true, notes: 'Text only.' },
  { provider: 'Perplexity', image: false, video: false, text: true, notes: 'Text only.' },
];

export default function Documentation() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('about');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Disalin ke clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Code snippets ──────────────────────────────────────────────────────────

  const curlChatSnippet = `# Chat biasa
curl -X POST ${API_URL}/gateway/gemini/chat \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk-okh-YOUR_GATEWAY_KEY" \\
  -d '{
    "prompt": "Jelaskan n8n dalam satu kalimat.",
    "model_id": "gemini-2.5-flash"
  }'`;

  const curlVisionSnippet = `# Kirim gambar ke AI untuk dianalisis
# (konversi gambar ke base64 dulu)
IMAGE_B64=$(base64 -i foto.jpg | tr -d '\\n')

curl -X POST ${API_URL}/gateway/gemini/chat \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk-okh-YOUR_GATEWAY_KEY" \\
  -d "{
    \\"prompt\\": \\"Apa yang ada di gambar ini?\\",
    \\"model_id\\": \\"gemini-2.5-flash\\",
    \\"image_base64\\": \\"data:image/jpeg;base64,\${IMAGE_B64}\\"
  }"`;

  const curlVideoSnippet = `# Kirim video ke Gemini untuk dianalisis
VIDEO_B64=$(base64 -i video.mp4 | tr -d '\\n')

curl -X POST ${API_URL}/gateway/gemini/chat \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk-okh-YOUR_GATEWAY_KEY" \\
  -d "{
    \\"prompt\\": \\"Apa yang terjadi di video ini?\\",
    \\"model_id\\": \\"gemini-2.0-flash-exp\\",
    \\"video_base64\\": \\"data:video/mp4;base64,\${VIDEO_B64}\\"
  }"`;

  const n8nChatJson = JSON.stringify([{
    "id": "okh-chat",
    "name": "One Key Hub — Chat",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.1,
    "position": [460, 340],
    "parameters": {
      "method": "POST",
      "url": `${API_URL}/gateway/gemini/chat`,
      "sendHeaders": true,
      "headerParameters": { "parameters": [{ "name": "X-API-Key", "value": "sk-okh-YOUR_GATEWAY_KEY" }] },
      "sendBody": true,
      "contentType": "json",
      "bodyParameters": { "parameters": [
        { "name": "prompt", "value": "={{ $json.message }}" },
        { "name": "model_id", "value": "gemini-2.5-flash" },
      ]},
    }
  }], null, 2);

  const n8nVisionJson = JSON.stringify([
    {
      "id": "read-file",
      "name": "Read Binary File",
      "type": "n8n-nodes-base.readBinaryFile",
      "typeVersion": 1,
      "parameters": { "filePath": "/data/photo.jpg" }
    },
    {
      "id": "to-base64",
      "name": "Convert to Base64",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "parameters": {
        "functionCode": "const b64 = $input.first().binary.data.data.toString('base64');\nreturn [{ json: { image_base64: 'data:image/jpeg;base64,' + b64 } }];"
      }
    },
    {
      "id": "send-to-ai",
      "name": "One Key Hub — Vision",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "parameters": {
        "method": "POST",
        "url": `${API_URL}/gateway/gemini/chat`,
        "sendHeaders": true,
        "headerParameters": { "parameters": [{ "name": "X-API-Key", "value": "sk-okh-YOUR_GATEWAY_KEY" }] },
        "sendBody": true,
        "contentType": "json",
        "bodyParameters": { "parameters": [
          { "name": "prompt", "value": "Apa yang ada di gambar ini? Jelaskan secara detail." },
          { "name": "model_id", "value": "gemini-2.5-flash" },
          { "name": "image_base64", "value": "={{ $json.image_base64 }}" }
        ]},
      }
    }
  ], null, 2);

  const opencrawInstallSnippet = `# Instalasi OpenClaw (self-hosted AI agent)
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install

# Konfigurasi .env OpenClaw
echo "ONE_KEY_HUB_URL=${API_URL}" >> .env
echo "ONE_KEY_HUB_KEY=sk-okh-YOUR_GATEWAY_KEY" >> .env
echo "DEFAULT_PROVIDER=gemini" >> .env`;

  const opencrawConfigSnippet = `// openclaw.config.js — integrasi One Key Hub
module.exports = {
  ai: {
    provider: 'custom',  // Pakai One Key Hub sebagai AI provider

    // Endpoint untuk chat biasa
    chatUrl: '${API_URL}/gateway/gemini/chat',
    headers: {
      'X-API-Key': process.env.ONE_KEY_HUB_KEY,
      'Content-Type': 'application/json'
    },

    // Format request ke One Key Hub
    formatRequest: (message) => ({
      prompt: message.text,
      model_id: 'gemini-2.5-flash',
      // Jika ada gambar (WhatsApp/Telegram kirim foto):
      image_base64: message.image_base64 || undefined,
    }),

    // Parse response dari One Key Hub
    parseResponse: (data) => data.text,
  },

  // Platform yang didukung
  platforms: ['whatsapp', 'telegram', 'slack', 'discord'],
};`;

  const opencrawHandlerSnippet = `// Handler untuk pesan masuk dengan gambar (WhatsApp/Telegram)
// File: handlers/messageHandler.js

async function handleIncomingMessage(message) {
  const body = {
    prompt: message.text || 'Analyze this image.',
    model_id: 'gemini-2.5-flash',  // Atau model lain yang support vision
  };

  // Jika ada media (foto/video)
  if (message.imageBase64) {
    body.image_base64 = message.imageBase64; // data:image/jpeg;base64,...
  }
  if (message.videoBase64) {
    body.video_base64 = message.videoBase64; // data:video/mp4;base64,...
  }

  const res = await fetch('${API_URL}/gateway/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.ONE_KEY_HUB_KEY,
    },
    body: JSON.stringify(body),
  });

  const { text } = await res.json();

  // Kirim balasan ke user (WhatsApp/Telegram/Slack/Discord)
  await sendReply(message.from, text);
}`;

  const errorHandlingSnippet = `// JavaScript — Error handling untuk One Key Hub
try {
  const response = await fetch('${API_URL}/gateway/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'sk-okh-YOUR_GATEWAY_KEY',
    },
    body: JSON.stringify({ prompt: 'Hello', model_id: 'gemini-2.5-flash' }),
  });

  if (!response.ok) {
    const err = await response.json();
    if (response.status === 401) throw new Error('API Key invalid/expired');
    if (response.status === 429) throw new Error('Rate limit / quota habis');
    if (response.status === 503) throw new Error('Semua credential habis — tambah credential baru di Providers');
    throw new Error(err.error || 'Unknown error');
  }

  const { text, model, tokens_used } = await response.json();
  console.log('Response:', text);
  console.log('Model:', model, '| Tokens used:', tokens_used);

} catch (error) {
  console.error('Error:', error.message);
}`;

  const proxyExampleSnippet = `# Proxy ke GIPHY (cari GIF)
curl -X POST ${API_URL}/gateway/giphy/proxy \\
  -H "X-API-Key: sk-okh-YOUR_GATEWAY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "method": "GET",
    "path": "/v1/gifs/search",
    "queryParams": { "q": "cat", "limit": "10" }
  }'

# Proxy ke Remove.bg (hapus background foto)
curl -X POST ${API_URL}/gateway/removebg/proxy \\
  -H "X-API-Key: sk-okh-YOUR_GATEWAY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "method": "POST",
    "path": "/v1.0/removebg",
    "body": {
      "image_file_b64": "data:image/png;base64,iVBOR...",
      "size": "auto"
    }
  }'`;

  return (
    <div className="min-h-screen">
      <AppHeader title="Dokumentasi" subtitle="Panduan lengkap penggunaan One Key Hub" />

      <div className="flex gap-0 max-w-7xl mx-auto">

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-0 self-start h-screen pt-6 pb-8 pl-4 pr-2 space-y-1 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-2">Navigasi</p>
          {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                activeSection === id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </a>
          ))}
        </aside>

        {/* ── Main Content ─────────────────────────────────────── */}
        <main className="flex-1 min-w-0 p-3 sm:p-6 space-y-6 sm:space-y-8 pb-20 max-w-full overflow-hidden">

          {/* Mobile Navigation Quick Jump Dropdown */}
          <div className="lg:hidden mb-2">
            <Select
              value={activeSection}
              onValueChange={(val) => {
                setActiveSection(val);
                document.getElementById(val)?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <SelectTrigger className="w-full bg-secondary/50 border-border/60 h-9 text-xs">
                <SelectValue placeholder="Lompat ke bagian dokumentasi..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {NAV_SECTIONS.map(({ id, label }) => (
                  <SelectItem key={id} value={id} className="text-xs">
                    📌 {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* About */}
          <Section id="about" icon={BookOpen} iconBg="bg-primary/20 text-primary" title="Tentang One Key Hub">
            <div className="text-muted-foreground space-y-3 leading-relaxed text-xs sm:text-sm">
              <p>
                <strong className="text-foreground">One Key Hub</strong> adalah sistem manajemen API key untuk AI yang memungkinkan Anda menyatukan
                banyak API key dari berbagai provider (Gemini, Groq, OpenAI, Anthropic, dll) ke dalam <strong className="text-foreground">satu endpoint Gateway</strong>.
                Sistem ini secara otomatis melakukan rotasi API key ketika terjadi error atau quota habis.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-4">
                {[
                  { icon: Key, color: 'bg-primary/10 text-primary', title: 'Multi-Provider', desc: 'Satu key untuk semua AI provider' },
                  { icon: RotateCcw, color: 'bg-green-500/10 text-green-500', title: 'Auto Rotasi', desc: 'Otomatis ganti key jika gagal' },
                  { icon: Eye, color: 'bg-violet-500/10 text-violet-500', title: 'Vision Support', desc: 'Analisis gambar & video dengan AI' },
                ].map(({ icon: Icon, color, title, desc }) => (
                  <div key={title} className={`p-3 sm:p-4 rounded-xl border border-border/50 ${color.split(' ')[0]}/5`}>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${color} flex items-center justify-center mb-2`}>
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <p className="font-semibold text-xs sm:text-sm text-foreground">{title}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Auto Rotation */}
          <Section id="rotation" icon={RotateCcw} iconBg="bg-accent/20 text-accent" title="Cara Kerja Auto-Rotasi API Key">
            <div className="space-y-3 text-muted-foreground">
              <p>Sistem rotasi bekerja dengan prinsip <strong className="text-foreground">fail-fast dan auto-fallback</strong>:</p>
              <div className="space-y-2">
                {[
                  { n: 1, color: 'bg-primary', title: 'Request Masuk', desc: 'Sistem memilih API key dengan prioritas tertinggi yang aktif dan sehat.' },
                  { n: 2, color: 'bg-green-500', title: 'Jika Berhasil', desc: 'Counter sukses bertambah, error counter di-reset, key tetap di prioritas tinggi.' },
                  { n: 3, color: 'bg-warning', title: 'Jika Gagal (429/401/5xx)', desc: 'Key langsung diturunkan ke prioritas paling rendah, sistem otomatis mencoba key berikutnya.' },
                  { n: 4, color: 'bg-accent', title: 'Fallback Provider', desc: 'Jika semua key satu provider habis, sistem beralih ke provider berikutnya.' },
                ].map(({ n, color, title, desc }) => (
                  <div key={n} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${color} text-white text-xs font-bold shrink-0`}>{n}</span>
                    <div>
                      <strong className="text-foreground text-sm">{title}</strong>
                      <p className="text-sm mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ── MULTIMODAL (VISION) ─────────────────────────────── */}
          <Section id="multimodal" icon={Eye} iconBg="bg-violet-500/20 text-violet-500" title="Analisis Gambar & Video (Vision AI)">
            <div className="space-y-6 text-muted-foreground">
              <p>
                One Key Hub mendukung <strong className="text-foreground">multimodal AI</strong> — kirim gambar atau video bersama teks untuk dianalisis.
                Gunakan endpoint chat biasa dan tambahkan field <code className="bg-secondary px-1 py-0.5 rounded text-foreground">image_base64</code> atau <code className="bg-secondary px-1 py-0.5 rounded text-foreground">video_base64</code>.
              </p>

              {/* Provider matrix */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Layers className="w-4 h-4" /> Support Matrix Provider
                </h3>
                <div className="border rounded-xl overflow-x-auto max-w-full text-xs">
                  <Table className="min-w-[480px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead className="text-center">📷 Gambar</TableHead>
                        <TableHead className="text-center">🎬 Video</TableHead>
                        <TableHead className="text-center">💬 Teks</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {VISION_MATRIX.map(row => (
                        <TableRow key={row.provider}>
                          <TableCell className="font-medium">{row.provider}</TableCell>
                          <TableCell className="text-center">{row.image ? '✅' : '❌'}</TableCell>
                          <TableCell className="text-center">{row.video ? '✅' : '❌'}</TableCell>
                          <TableCell className="text-center">{row.text ? '✅' : '❌'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.notes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Code examples */}
              <Tabs defaultValue="image">
                <TabsList className="grid grid-cols-3 w-full max-w-sm mb-4">
                  <TabsTrigger value="image" className="gap-1 text-xs"><ImageIcon className="w-3 h-3" /> Gambar</TabsTrigger>
                  <TabsTrigger value="video" className="gap-1 text-xs"><Video className="w-3 h-3" /> Video</TabsTrigger>
                  <TabsTrigger value="text" className="gap-1 text-xs"><MessageSquare className="w-3 h-3" /> Teks</TabsTrigger>
                </TabsList>
                <TabsContent value="image">
                  <CodeBlock code={curlVisionSnippet} lang="bash" id="vision-curl" copiedId={copiedId} onCopy={copyToClipboard} />
                  <div className="mt-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs">
                    <strong className="text-violet-400">Tips:</strong> Gambar harus dikonversi ke format <code className="break-all font-mono">data:image/jpeg;base64,...</code> atau <code className="break-all font-mono">data:image/png;base64,...</code> sebelum dikirim.
                  </div>
                </TabsContent>
                <TabsContent value="video">
                  <CodeBlock code={curlVideoSnippet} lang="bash" id="video-curl" copiedId={copiedId} onCopy={copyToClipboard} />
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                    <strong className="text-amber-400">Catatan:</strong> Video analisis hanya didukung oleh <strong>Gemini</strong> (model gemini-2.0-flash-exp atau lebih baru). Ukuran video disarankan &lt;10MB untuk hasil terbaik.
                  </div>
                </TabsContent>
                <TabsContent value="text">
                  <CodeBlock code={curlChatSnippet} lang="bash" id="text-curl" copiedId={copiedId} onCopy={copyToClipboard} />
                </TabsContent>
              </Tabs>

              {/* Request body fields */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <FileJson className="w-4 h-4" /> Field Request Body
                </h3>
                <div className="border rounded-xl overflow-x-auto max-w-full text-xs">
                  <Table className="min-w-[480px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-xs">Field</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { field: 'prompt', type: 'string', desc: 'Pertanyaan / instruksi teks untuk AI' },
                        { field: 'model_id', type: 'string', desc: 'ID model (misal: gemini-2.5-flash, gpt-4o)' },
                        { field: 'image_base64', type: 'string', desc: 'Gambar dalam format data URI (data:image/jpeg;base64,...)' },
                        { field: 'video_base64', type: 'string', desc: 'Video dalam format data URI (data:video/mp4;base64,...) — hanya Gemini' },
                        { field: 'system_prompt', type: 'string', desc: 'Instruksi sistem untuk mengatur perilaku AI' },
                      ].map(row => (
                        <TableRow key={row.field}>
                          <TableCell className="font-mono text-xs font-semibold">{row.field}</TableCell>
                          <TableCell className="text-xs">{row.type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.desc}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </Section>

          {/* ── N8N INTEGRATION ─────────────────────────────────── */}
          <Section id="n8n" icon={Workflow} iconBg="bg-pink-500/20 text-pink-500" title="Integrasi n8n & Automation">
            <div className="space-y-6 text-muted-foreground">
              <p>
                Gunakan One Key Hub langsung di workflow n8n. Copy-paste node JSON siap pakai ke bawah, atau konfigurasi manual.
              </p>

              <Tabs defaultValue="chat">
                <TabsList className="grid grid-cols-3 w-full max-w-md mb-4">
                  <TabsTrigger value="chat" className="text-xs">Chat Biasa</TabsTrigger>
                  <TabsTrigger value="vision" className="text-xs gap-1"><Eye className="w-3 h-3" /> Vision</TabsTrigger>
                  <TabsTrigger value="errors" className="text-xs">Error Handling</TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="space-y-4">
                  <p className="text-sm">Node JSON siap pakai — paste langsung ke canvas n8n (Ctrl+V):</p>
                  <CodeBlock code={n8nChatJson} lang="json" id="n8n-chat" copiedId={copiedId} onCopy={copyToClipboard} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-2">
                    <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 space-y-2 text-sm overflow-hidden">
                      <h4 className="font-semibold text-foreground flex items-center gap-2 text-xs sm:text-sm">
                        <Zap className="w-4 h-4 text-yellow-500 shrink-0" /> Konfigurasi Dasar
                      </h4>
                      <div className="space-y-2">
                        {[
                          ['Method', 'POST'],
                          ['URL', `${API_URL}/gateway/:provider/chat`],
                          ['Auth Header', 'X-API-Key'],
                          ['Key Format', 'sk-okh-...'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                            <span className="text-muted-foreground font-medium shrink-0">{k}</span>
                            <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground font-mono text-[11px] break-all max-w-full">{v}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 space-y-2 text-sm overflow-hidden">
                      <h4 className="font-semibold text-foreground flex items-center gap-2 text-xs sm:text-sm">
                        <ArrowRight className="w-4 h-4 text-primary shrink-0" /> Dynamic Expression
                      </h4>
                      <p className="text-xs text-muted-foreground">Ambil teks dari node sebelumnya:</p>
                      <code className="block bg-slate-900 text-slate-100 p-2 rounded text-[11px] font-mono break-all max-w-full">{'{{ $json.message }}'}</code>
                      <code className="block bg-slate-900 text-slate-100 p-2 rounded text-[11px] font-mono break-all max-w-full">{'{{ $node["Webhook"].json.body.text }}'}</code>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="vision" className="space-y-4">
                  <p className="text-sm">Workflow 3 node untuk kirim gambar ke AI (Read File → Convert Base64 → Send to AI):</p>
                  <CodeBlock code={n8nVisionJson} lang="json" id="n8n-vision" copiedId={copiedId} onCopy={copyToClipboard} />
                  <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs">
                    <strong className="text-violet-400">Cara pakai:</strong> Salin seluruh JSON → buka n8n → tekan Ctrl+V di canvas. Tiga node akan otomatis terbentuk. Ganti path file dan API Key Anda.
                  </div>
                </TabsContent>

                <TabsContent value="errors" className="space-y-4">
                  <CodeBlock code={errorHandlingSnippet} lang="javascript" id="n8n-error" copiedId={copiedId} onCopy={copyToClipboard} />
                  <div className="border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Kode</TableHead>
                          <TableHead>Penyebab</TableHead>
                          <TableHead>Solusi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          ['401', 'Unauthorized', 'Cek X-API-Key. Pastikan format dan nilai benar.'],
                          ['403', 'Forbidden', 'Key tidak diizinkan untuk provider ini. Cek allowed_providers di API Keys.'],
                          ['429', 'Rate Limit', 'Semua key habis kuota. Tambah credential baru di Providers.'],
                          ['503', 'No Credential', 'Tidak ada credential aktif. Cek halaman Providers.'],
                          ['500', 'Server Error', 'Error internal One Key Hub. Cek Logs server.'],
                          ['502', 'Bad Gateway', 'Provider AI down atau timeout. Coba lagi atau ganti provider.'],
                        ].map(([code, cause, sol]) => (
                          <TableRow key={code}>
                            <TableCell className="font-mono text-xs font-bold text-destructive">{code}</TableCell>
                            <TableCell className="text-xs">{cause}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{sol}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Section>

          {/* ── OPENCLAW ───────────────────────────────────────── */}
          <Section id="openclaw" icon={Bot} iconBg="bg-sky-500/20 text-sky-500" title="OpenClaw Integration">
            <div className="space-y-6 text-muted-foreground">
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-2">
                <h3 className="font-semibold text-sky-400 text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4" /> Apa itu OpenClaw?
                </h3>
                <p className="text-sm leading-relaxed">
                  <strong className="text-foreground">OpenClaw</strong> adalah agen Kecerdasan Buatan (AI) otonom bersifat <strong className="text-foreground">open-source</strong> yang berjalan di server Anda sendiri.
                  OpenClaw memungkinkan Anda mengontrol AI melalui platform chat populer seperti{' '}
                  <strong className="text-foreground">WhatsApp, Telegram, Slack, dan Discord</strong>.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {['WhatsApp', 'Telegram', 'Slack', 'Discord'].map(p => (
                    <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                  ))}
                </div>
              </div>

              <p>
                Dengan integrasi One Key Hub + OpenClaw, Anda mendapatkan bot AI yang bisa menganalisis <strong className="text-foreground">gambar dan video</strong> yang
                dikirim user via WhatsApp/Telegram, dengan auto-rotasi API key secara transparan.
              </p>

              <Tabs defaultValue="install">
                <TabsList className="grid grid-cols-3 w-full max-w-md mb-4">
                  <TabsTrigger value="install" className="text-xs">Instalasi</TabsTrigger>
                  <TabsTrigger value="config" className="text-xs">Konfigurasi</TabsTrigger>
                  <TabsTrigger value="vision" className="text-xs gap-1"><Eye className="w-3 h-3" /> Vision Handler</TabsTrigger>
                </TabsList>

                <TabsContent value="install" className="space-y-3">
                  <p className="text-sm">Install OpenClaw dan hubungkan ke One Key Hub:</p>
                  <CodeBlock code={opencrawInstallSnippet} lang="bash" id="oc-install" copiedId={copiedId} onCopy={copyToClipboard} />
                </TabsContent>

                <TabsContent value="config" className="space-y-3">
                  <p className="text-sm">Konfigurasi OpenClaw untuk menggunakan One Key Hub sebagai AI provider:</p>
                  <CodeBlock code={opencrawConfigSnippet} lang="javascript" id="oc-config" copiedId={copiedId} onCopy={copyToClipboard} />
                </TabsContent>

                <TabsContent value="vision" className="space-y-3">
                  <p className="text-sm">Handler untuk pesan dengan gambar/video (WhatsApp/Telegram foto):</p>
                  <CodeBlock code={opencrawHandlerSnippet} lang="javascript" id="oc-vision" copiedId={copiedId} onCopy={copyToClipboard} />
                </TabsContent>
              </Tabs>

              {/* Use cases */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-sky-500" /> Contoh Use Case
                </h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  {[
                    { icon: '📸', title: 'Analisis Foto WhatsApp', desc: 'User kirim foto → OpenClaw kirim ke Gemini via One Key Hub → AI jelaskan isi foto' },
                    { icon: '🎬', title: 'Analisis Video Telegram', desc: 'User kirim video pendek → Gemini analisis konten video → Balasan otomatis' },
                    { icon: '💬', title: 'Bot Customer Service', desc: 'Jawab pertanyaan pelanggan via Slack/Discord menggunakan AI dengan rotasi key otomatis' },
                    { icon: '🔒', title: 'API Key Aman', desc: 'API key tidak pernah exposed ke user. Semua dikelola di One Key Hub server.' },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                      <p className="font-semibold text-foreground flex items-center gap-2"><span>{icon}</span>{title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Test API Key */}
          <Section id="test" icon={TestTube} iconBg="bg-green-500/20 text-green-500" title="Mekanisme Test API Key">
            <div className="space-y-4 text-muted-foreground">
              <p>Fitur test memungkinkan Anda memverifikasi apakah API key masih berfungsi tanpa harus menunggu request sebenarnya gagal:</p>
              <ul className="space-y-2">
                {[
                  'Klik tombol Play (▶) pada credential di halaman Providers',
                  'Sistem mengirim request test singkat ke provider dengan model default',
                  'Hasil ditampilkan: ✅ Berhasil, ⚠️ Quota Habis, atau ❌ Invalid',
                  'Status credential diperbarui secara realtime di database dan UI',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* Proxy Gateway */}
          <Section id="proxy" icon={Zap} iconBg="bg-indigo-500/20 text-indigo-500" title="Unified Service Gateway & Proxy API">
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Selain AI Chat & Vision, One Key Hub juga menyediakan <strong className="text-foreground">Proxy Universal</strong> untuk layanan media, stok gambar, dan utilitas lainnya.
                API Key tetap aman di backend.
              </p>
              <div className="bg-secondary/40 border border-border/40 p-4 rounded-xl font-mono text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600/20 text-blue-400 text-xs px-2 py-0.5 rounded font-bold">POST</span>
                  <span className="text-foreground text-xs">{API_URL}/gateway/:provider/proxy</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Provider: <code>giphy</code>, <code>pexels</code>, <code>pixabay</code>, <code>removebg</code>,
                  <code>cloudinary</code>, <code>imagekit</code>, <code>uploadcare</code>, <code>openweather</code>, <code>newsapi</code>, <code>alphavantage</code>, <code>apify</code>
                </p>
              </div>
              <CodeBlock code={proxyExampleSnippet} lang="bash" id="proxy-curl" copiedId={copiedId} onCopy={copyToClipboard} />
            </div>
          </Section>

          {/* Status Indicators */}
          <Section id="status" icon={Key} iconBg="bg-secondary text-foreground" title="Indikator Status API Key">
            <div className="space-y-3 text-muted-foreground">
              <p>Setiap credential menampilkan status visual:</p>
              <div className="space-y-2">
                {[
                  { color: 'bg-green-500', border: 'border-green-500/30 bg-green-500/10', label: '🟢 Aktif', desc: 'API key berfungsi normal, tidak ada error' },
                  { color: 'bg-yellow-500', border: 'border-yellow-500/30 bg-yellow-500/10', label: '🟡 Cooldown', desc: 'Quota mendekati limit atau ada beberapa error (rate limit)' },
                  { color: 'bg-red-500', border: 'border-red-500/30 bg-red-500/10', label: '🔴 Error / Inactive', desc: 'API key invalid, expired, atau quota habis total' },
                ].map(({ color, border, label, desc }) => (
                  <div key={label} className={`flex items-center gap-3 p-3 rounded-xl border ${border}`}>
                    <span className={`w-3 h-3 rounded-full ${color} shrink-0`} />
                    <div>
                      <strong className="text-foreground text-sm">{label}</strong>
                      <p className="text-xs">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Error codes */}
          <Section id="errors" icon={AlertTriangle} iconBg="bg-destructive/20 text-destructive" title="Error Codes & Solusi">
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Kode</TableHead>
                    <TableHead>Penyebab</TableHead>
                    <TableHead>Solusi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ['401', 'Unauthorized', 'Cek X-API-Key header. Pastikan formatnya benar (bukan Bearer).'],
                    ['403', 'Forbidden', 'Provider tidak diizinkan. Cek allowed_providers di pengaturan Gateway Key.'],
                    ['429', 'Rate Limit', 'Semua key habis kuota. Tambah credential baru di halaman Providers.'],
                    ['503', 'No Credential', 'Tidak ada credential aktif untuk provider ini.'],
                    ['500', 'Server Error', 'Error internal. Periksa Logs server One Key Hub.'],
                    ['502', 'Bad Gateway', 'Koneksi ke Provider AI gagal (timeout/down). Coba provider lain.'],
                  ].map(([code, cause, sol]) => (
                    <TableRow key={code}>
                      <TableCell className="font-mono text-sm font-bold text-destructive">{code}</TableCell>
                      <TableCell className="text-sm">{cause}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sol}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Section>

        </main>
      </div>
    </div>
  );
}