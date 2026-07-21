# 🤖 MASTER AI CODING PROMPT & SYSTEM SPECIFICATION FOR ONE KEY HUB
*(Salin seluruh dokumen ini dan berikan ke AI Coding Assistant seperti AntiGravity, Cursor, Copilot, ChatGPT, Claude, dll. saat mengembangkan aplikasi)*

---

## 📌 INSTRUKSIONAL SISTEM & ATURAN WAJIB AI

> Anda adalah AI Coding Assistant senior. Anda bertugas mengintegrasikan API Gateway **One Key Hub** ke dalam project ini.
> 
> ⚠️ **ATURAN WAJIB SEBELUM MENULIS ATAU MENYISIPKAN KODE KE PROJECT UTAMA**:
> **SEBELUM** membuat atau mengubah file aplikasi utama, Anda **WAJIB MEMBUAT FILE UJI COBA TERPISAH** (misalnya `test-one-key-hub.js` atau `test_gateway.py`) untuk menguji validitas API Key, endpoint AI Chat (`/v1/chat/completions`), dan endpoint Storage CDN (`/v1/storage/upload`).
>
> Jalankan file uji coba tersebut via terminal shell/command prompt. Setelah tes menghasilkan status `200 OK` / `201 Created` dan memberikan output yang valid, barulah Anda diperbolehkan mengimplementasikan kode ke dalam struktur project utama!

---

## 🔑 Setelan Kredensial & Server Gateway

- **Base URL API**: `https://airotation.my.id/v1` *(atau `http://localhost:5000/v1` jika testing lokal)*
- **Gateway API Key**: `<YOUR_GATEWAY_API_KEY>`
- **Tipe API Key**: Universal Key (Akses Tanpa Batas ke Semua Provider AI & Storage CDN)
- **Header Autentikasi Standard**:
  ```http
  Authorization: Bearer <YOUR_GATEWAY_API_KEY>
  ```
  *(alternatif jika dipanggil via query/header khusus: `X-API-Key: <YOUR_GATEWAY_API_KEY>`)*

---

## 🛰️ 1. ENDPOINT AI CHAT & COMPLETIONS (OpenAI Standard Format)

Gunakan endpoint ini untuk memanggil model AI (Google Gemini, Groq, DeepSeek, Mistral, Cohere, dll.) menggunakan SDK resmi OpenAI (`openai` npm/python package) atau HTTP request biasa (`fetch` / `axios`).

- **URL**: `POST https://airotation.my.id/v1/chat/completions`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <YOUR_GATEWAY_API_KEY>`
- **Request Body JSON**:
  ```json
  {
    "model": "gemini-2.5-flash",
    "messages": [
      { "role": "system", "content": "Kamu adalah asisten AI yang cerdas." },
      { "role": "user", "content": "Halo, jelaskan tentang fitur One Key Hub!" }
    ],
    "temperature": 0.7
  }
  ```
- **Model yang Tersedia**:
  - Google Gemini: `gemini-2.5-flash`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`
  - Groq: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`
  - DeepSeek: `deepseek-chat`, `deepseek-reasoner`
  - Mistral: `mistral-large-latest`, `mistral-small-latest`
  - Cohere: `command-r-plus-08-2024`, `command-r-08-2024`
  - Cerebras: `llama3.1-70b`, `llama3.1-8b`

---

## 📸 2. ENDPOINT STORAGE GATEWAY (Multi-CDN Failover & Auto-Rotate)

Gunakan endpoint ini untuk mengunggah berkas media (gambar/foto) dengan rotasi posisi otomatis (fix EXIF orientation) dan failover otomatis (ImageKit ➔ Cloudinary ➔ Uploadcare).

### A. Upload File Media (Base64 atau Remote URL)
- **URL**: `POST https://airotation.my.id/v1/storage/upload`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <YOUR_GATEWAY_API_KEY>`
- **Body JSON**:
  ```json
  {
    "file": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "file_name": "foto_user.png",
    "auto_rotate": true
  }
  ```
- **Response Success (`201 Created`)**:
  ```json
  {
    "success": true,
    "file": {
      "id": "e4b2d5a1-7c89-4d10-a299-123456789abc",
      "provider": "imagekit",
      "url": "https://ik.imagekit.io/your_account/foto_user_123.png",
      "file_id": "foto_user_123",
      "file_name": "foto_user.png",
      "file_size": 15420,
      "mime_type": "image/png",
      "width": 1080,
      "height": 1080,
      "auto_rotated": true,
      "created_at": "2026-07-21T13:40:00.000Z"
    }
  }
  ```

### B. List File Terunggah Milik API Key Ini
- **URL**: `GET https://airotation.my.id/v1/storage/list?page=1&limit=20`
- **Headers**: `Authorization: Bearer <YOUR_GATEWAY_API_KEY>`

### C. Hapus File CDN dari Database
- **URL**: `DELETE https://airotation.my.id/v1/storage/files/:id`
- **Headers**: `Authorization: Bearer <YOUR_GATEWAY_API_KEY>`

---

## 🧪 3. SKRIP TEST UJI COBA WAJIB (`test-one-key-hub.js`)

AI **WAJIB** membuat file `test-one-key-hub.js` di root folder project dan menjalankannya via Node.js sebelum menyentuh file utama:

```javascript
// test-one-key-hub.js — Skrip Verifikasi Koneksi & Testing One Key Hub
const GATEWAY_KEY = 'GANTI_DENGAN_GATEWAY_KEY_ANDA';
const BASE_URL = 'https://airotation.my.id/v1';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 Memulai Testing Konektivitas One Key Hub Gateway');
  console.log('====================================================\n');

  // Test 1: Testing AI Chat Completions
  try {
    console.log('[1/2] Menguji AI Chat Completion (/v1/chat/completions)...');
    const chatRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Tes koneksi singkat. Jawab "KONEKSI OK".' }],
      }),
    });

    const chatData = await chatRes.json();
    if (chatRes.ok) {
      console.log('✅ AI Chat Completion Berhasil!');
      console.log('   Balasan AI:', chatData.choices?.[0]?.message?.content?.trim());
    } else {
      console.error('❌ AI Chat Completion Gagal:', chatData);
    }
  } catch (err) {
    console.error('❌ AI Chat Error:', err.message);
  }

  // Test 2: Testing Storage CDN Upload
  try {
    console.log('\n[2/2] Menguji Storage CDN Upload (/v1/storage/upload)...');
    const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const uploadRes = await fetch(`${BASE_URL}/storage/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_KEY}`,
      },
      body: JSON.stringify({
        file: dummyBase64,
        file_name: 'test_auto_upload.png',
        auto_rotate: true,
      }),
    });

    const uploadData = await uploadRes.json();
    if (uploadRes.ok && uploadData.success) {
      console.log('✅ Storage CDN Upload Berhasil!');
      console.log('   Provider Terpakai:', uploadData.file.provider);
      console.log('   Direct CDN URL   :', uploadData.file.url);
    } else {
      console.error('❌ Storage CDN Upload Gagal:', uploadData);
    }
  } catch (err) {
    console.error('❌ Storage CDN Error:', err.message);
  }

  console.log('\n====================================================');
  console.log('✨ Pengujian Selesai. Jika semua sukses, lanjutkan penulisan kode!');
  console.log('====================================================');
}

runTests();
```

---

## 💻 4. CONTOH KODE INTEGRASI KE PROJECT UTAMA

### Contoh Integration JavaScript / Node.js (OpenAI SDK):
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://airotation.my.id/v1',
  apiKey: 'YOUR_GATEWAY_API_KEY',
});

// Panggilan Chat
export async function getAiResponse(userMessage) {
  const response = await openai.chat.completions.create({
    model: 'gemini-2.5-flash',
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.choices[0].message.content;
}
```

### Contoh Upload Media / Gambar ke CDN:
```javascript
export async function uploadImageToCDN(base64Image, fileName) {
  const response = await fetch('https://airotation.my.id/v1/storage/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_GATEWAY_API_KEY',
    },
    body: JSON.stringify({
      file: base64Image,
      file_name: fileName,
      auto_rotate: true,
    }),
  });

  const data = await response.json();
  if (data.success) {
    return data.file.url; // URL langsung CDN (ImageKit/Cloudinary/Uploadcare)
  }
  throw new Error(data.error?.message || 'Gagal mengunggah gambar');
}
```
