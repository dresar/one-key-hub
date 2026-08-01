const readline = require('readline');
const https = require('https');
const http = require('http');

const API_BASE = process.env.ONEKEY_BASE_URL || 'https://one.apprentice.cyou/v1';
const API_KEY = process.env.ONEKEY_API_KEY || 'AR_7651fb06_0f19ac85a3a409b4fe568b2afb7a1512';
const MODEL = process.env.ONEKEY_MODEL || 'gemini-2.5-flash';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.clear();
console.log('\x1b[36m%s\x1b[0m', '════════════════════════════════════════════════════════════');
console.log('\x1b[33m%s\x1b[0m', '   🚀 ONE KEY HUB — TERMINAL AI CODING ASSISTANT CLI');
console.log('\x1b[36m%s\x1b[0m', '════════════════════════════════════════════════════════════');
console.log(`📡 Endpoint : \x1b[32m${API_BASE}\x1b[0m`);
console.log(`🔑 API Key  : \x1b[32m${API_KEY.substring(0, 8)}...\x1b[0m`);
console.log(`🤖 Model    : \x1b[32m${MODEL}\x1b[0m`);
console.log('💡 Ketik \x1b[31mexit\x1b[0m atau \x1b[31mquit\x1b[0m untuk keluar.\n');

const messages = [
  { role: 'system', content: 'You are a helpful expert AI programming assistant. Keep answers clear, accurate, and format code cleanly.' }
];

function askPrompt() {
  rl.question('\x1b[35mAnda > \x1b[0m', async (userPrompt) => {
    const input = userPrompt.trim();
    if (!input) {
      askPrompt();
      return;
    }
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('\x1b[33mTerima kasih! Sampai jumpa.\x1b[0m');
      rl.close();
      return;
    }

    messages.push({ role: 'user', content: input });
    process.stdout.write('\x1b[32mAI   > \x1b[0m');

    try {
      const url = new URL(`${API_BASE}/chat/completions`);
      const body = JSON.stringify({
        model: MODEL,
        messages: messages
      });

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            if (parsed.error) {
              console.log(`\x1b[31m[Error]: ${parsed.error.message || JSON.stringify(parsed.error)}\x1b[0m\n`);
            } else {
              const reply = parsed.choices?.[0]?.message?.content || parsed.text || JSON.stringify(parsed);
              console.log(reply + '\n');
              messages.push({ role: 'assistant', content: reply });
            }
          } catch (e) {
            console.log(rawData + '\n');
          }
          askPrompt();
        });
      });

      req.on('error', (e) => {
        console.log(`\x1b[31m[Network Error]: ${e.message}\x1b[0m\n`);
        askPrompt();
      });

      req.write(body);
      req.end();
    } catch (err) {
      console.log(`\x1b[31m[Error]: ${err.message}\x1b[0m\n`);
      askPrompt();
    }
  });
}

askPrompt();
