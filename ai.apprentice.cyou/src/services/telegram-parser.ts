import { q } from "../db.js";

// Pola regex umum untuk API Key berbagai provider
const KEY_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{32,64}/g, // OpenAI / Anthropic
  /AIza[0-9A-Za-z_-]{35}/g, // Google / Gemini
  /gsk_[a-zA-Z0-9]{32,64}/g, // Groq
  /xoxb-[0-9a-zA-Z]{10,}/g, // Slack etc
  /[a-zA-Z0-9_-]{40}/g, // Generic 40-char hex/b64 keys
];

interface ParsedCommand {
  action: "BULK_INSERT" | "DELETE" | "ROTATE" | "DISABLE" | "STATUS" | "UNKNOWN";
  provider?: string;
  keys?: string[];
  targetId?: string;
  count?: number;
}

export async function parseCommandWithAI(text: string): Promise<ParsedCommand> {
  // 1. Masking
  let maskedText = text;
  const memoryMap: Record<string, string> = {};
  let tokenCounter = 1;

  for (const pattern of KEY_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const token = `{{TOKEN_${tokenCounter}}}`;
        memoryMap[token] = match;
        maskedText = maskedText.replace(match, token);
        tokenCounter++;
      }
    }
  }

  // Jika tidak ada operasi yang butuh AI (contoh: sekadar 'status'), kita bisa shortcut
  if (maskedText.toLowerCase().trim() === "status" || maskedText.toLowerCase().includes("cek status")) {
    return { action: "STATUS" };
  }

  // 2. Fetch Gemini Key from DB
  const creds = await q("SELECT credentials FROM provider_credentials WHERE provider_name = 'gemini' AND status = 'active' LIMIT 1");
  let apiKey = "";
  if (creds.length > 0 && typeof creds[0].credentials === 'object' && creds[0].credentials !== null) {
      const c = creds[0].credentials as any;
      apiKey = c.apiKey || "";
  }

  if (!apiKey) {
    // Fallback simple parsing jika tidak ada AI key
    if (maskedText.toLowerCase().includes("masukkan")) {
       const tokens = Object.keys(memoryMap);
       if (tokens.length > 0) return { action: "BULK_INSERT", provider: detectProvider(text), keys: tokens.map(t => memoryMap[t]) };
    }
    return { action: "UNKNOWN" };
  }

  // 3. Call AI
  const prompt = `Kamu adalah sistem parser perintah bot Telegram. Tugasmu mengekstrak maksud pengguna ke dalam JSON.
Teks input: "${maskedText}"

Tentukan JSON dengan format:
{
  "action": "BULK_INSERT" | "DELETE" | "ROTATE" | "DISABLE" | "STATUS" | "UNKNOWN",
  "provider": "GOOGLE" | "OPENAI" | "GROQ" | "ANTHROPIC" | "MISTRAL" | null,
  "keys": ["{{TOKEN_1}}", ...] // daftar token jika ada, atau kosong []
}
Hanya outputkan valid JSON tanpa markdown backticks.`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    });
    
    if (!res.ok) throw new Error("AI Request failed");
    const data = await res.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    const cleanJson = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson) as ParsedCommand;

    // 4. Unmasking
    if (parsed.keys && Array.isArray(parsed.keys)) {
      parsed.keys = parsed.keys.map(token => memoryMap[token] || token);
    }

    // Normalisasi provider
    if (parsed.provider) {
        if (parsed.provider.toUpperCase().includes("GOOGLE") || parsed.provider.toUpperCase().includes("GEMINI")) parsed.provider = "gemini";
        else if (parsed.provider.toUpperCase().includes("OPENAI")) parsed.provider = "openai";
        else if (parsed.provider.toUpperCase().includes("GROQ")) parsed.provider = "groq";
        else if (parsed.provider.toUpperCase().includes("ANTHROPIC")) parsed.provider = "anthropic";
        else parsed.provider = parsed.provider.toLowerCase();
    }

    return parsed;

  } catch (err) {
    console.error("AI Parser Error:", err);
    return { action: "UNKNOWN" };
  }
}

function detectProvider(text: string) {
    const t = text.toLowerCase();
    if (t.includes("google") || t.includes("gemini")) return "gemini";
    if (t.includes("openai")) return "openai";
    if (t.includes("groq")) return "groq";
    if (t.includes("anthropic")) return "anthropic";
    return "unknown";
}
