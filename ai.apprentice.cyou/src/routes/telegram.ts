import { Hono } from "hono";
import { config } from "../config.js";
import { q } from "../db.js";
import { parseCommandWithAI } from "../services/telegram-parser.js";

export const telegramRouter = new Hono();

// Helper untuk mengirim pesan balik ke Telegram
async function sendTelegramMessage(chatId: string | number, text: string) {
  if (!config.telegramBotToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
  } catch (err) {
    console.error("Failed to send telegram message", err);
  }
}

telegramRouter.post("/webhook", async (c) => {
  try {
    const body = await c.req.json();
    const message = body.message;
    
    if (!message || !message.text || !message.chat) {
      return c.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userId = message.from?.id?.toString();
    const text = message.text;

    // Security: Whitelist check
    if (!config.telegramAdminIds.includes(userId)) {
      console.warn(`Unauthorized Telegram access attempt from User ID: ${userId}`);
      return c.json({ ok: true });
    }

    // Acknowledge quickly to avoid Telegram webhook retry
    setTimeout(async () => {
      try {
        await processTelegramCommand(chatId, text, userId);
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ *Terjadi Kesalahan:*\n${err.message}`);
      }
    }, 0);

    return c.json({ ok: true });
  } catch (err) {
    console.error("Telegram Webhook Error:", err);
    return c.json({ ok: false }, 500);
  }
});

async function processTelegramCommand(chatId: string | number, text: string, userId: string) {
  // Parsing menggunakan AI Parser (Aman dari secret leak)
  const cmd = await parseCommandWithAI(text);

  if (cmd.action === "BULK_INSERT" && cmd.keys && cmd.keys.length > 0 && cmd.provider) {
    let success = 0;
    // Cari admin user id untuk mengisi user_id di provider_credentials
    const users = await q("SELECT id FROM users ORDER BY created_at ASC LIMIT 1");
    if (users.length === 0) throw new Error("Tidak ada user admin di database.");
    const adminId = users[0].id;

    for (const key of cmd.keys) {
      // Cek apakah key sudah ada (menggunakan basic 'LIKE' pada JSONB untuk contoh ini, idealnya dihash)
      const existing = await q(`SELECT id FROM provider_credentials WHERE provider_name = $1 AND credentials->>'apiKey' = $2`, [cmd.provider, key]);
      if (existing.length === 0) {
        const creds = JSON.stringify({ apiKey: key });
        await q(
          `INSERT INTO provider_credentials (user_id, provider_name, credentials, status) VALUES ($1, $2, $3::jsonb, 'active')`,
          [adminId, cmd.provider, creds]
        );
        success++;
      }
    }
    
    const preview = cmd.keys.map(k => `\`${k.substring(0, 6)}...${k.substring(k.length - 4)}\``).join("\n");
    await sendTelegramMessage(chatId, `✅ *Berhasil memasukkan ${success} key untuk ${cmd.provider.toUpperCase()}*\n\nPreview:\n${preview}`);

  } else if (cmd.action === "STATUS") {
    const stats = await q(`
      SELECT provider_name, status, count(*) as total 
      FROM provider_credentials 
      GROUP BY provider_name, status
    `);
    
    let msg = "📊 *Status API Keys Saat Ini:*\n\n";
    for (const row of stats) {
      msg += `- ${String(row.provider_name).toUpperCase()} (${row.status}): ${row.total}\n`;
    }
    await sendTelegramMessage(chatId, msg || "Belum ada API key di database.");

  } else if (cmd.action === "ROTATE" && cmd.provider) {
     // Ganti key aktif menjadi 'exhausted' dan aktifkan 1 key yang 'disabled'/'exhausted'
     await q(`UPDATE provider_credentials SET status = 'exhausted' WHERE provider_name = $1 AND status = 'active'`, [cmd.provider]);
     const nextKey = await q(`SELECT id FROM provider_credentials WHERE provider_name = $1 AND status != 'active' ORDER BY failed_requests ASC, created_at ASC LIMIT 1`, [cmd.provider]);
     if (nextKey.length > 0) {
         await q(`UPDATE provider_credentials SET status = 'active', failed_requests = 0 WHERE id = $1`, [nextKey[0].id]);
         await sendTelegramMessage(chatId, `🔄 *Rotasi berhasil untuk provider ${cmd.provider.toUpperCase()}*`);
     } else {
         await sendTelegramMessage(chatId, `⚠️ *Gagal merotasi ${cmd.provider.toUpperCase()}*. Tidak ada key cadangan.`);
     }

  } else if (cmd.action === "DISABLE" && cmd.provider) {
     await q(`UPDATE provider_credentials SET status = 'disabled' WHERE provider_name = $1`, [cmd.provider]);
     await sendTelegramMessage(chatId, `🚫 *Semua key ${cmd.provider.toUpperCase()} telah dinonaktifkan.*`);
     
  } else {
    await sendTelegramMessage(chatId, `❓ *Perintah tidak dikenali atau format tidak lengkap.*\nAksi terdeteksi: ${cmd.action}\nSilakan perjelas instruksi Anda.`);
  }
}
