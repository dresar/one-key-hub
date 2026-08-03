# Panduan Integrasi n8n & Automation — One Key Hub

Panduan ini mendokumentasikan cara menghubungkan **One Key Hub** dengan **n8n** (Platform Otomasi Workflow) menggunakan dua metode utama: **Native OpenAI Node** (untuk AI Agent n8n) dan **HTTP Request Node** (untuk penyesuaian REST API kustom & Vision).

---

## 🚀 Fitur Utama & Keunggulan
- **Automatic Key Rotation & Failover**: Satu API Key One Key Hub (`sk-okh-...`) akan merotasi credential backend secara otomatis. Jika satu credential habis kuota atau rate limit, One Key Hub otomatis beralih ke key aktif berikutnya tanpa menggagalkan workflow n8n Anda.
- **Provider Agnostic**: Akses Google Gemini, Groq (Llama 3.3), OpenRouter, Mistral, Cohere, dan Hugging Face dalam satu format endpoint terpadu.
- **Dukungan OpenAI Compatibility**: Mendukung endpoint standar `/v1/chat/completions` & `/v1/models`.

---

## 📌 Metode 1: Native OpenAI Node / AI Agent (Rekomendasi Utama)

Metode terbaik jika Anda menggunakan node **AI Agent**, **OpenAI Model**, atau **LangChain Chain** di n8n.

### Langkah Konfigurasi:
1. Buka workflow n8n Anda, tambahkan node **OpenAI** (misal: *OpenAI Chat Model*).
2. Di bagian **Credential to connect with**, pilih **Create New Credential** → Pilih **OpenAI API**.
3. Isi parameter credential berikut:
   - **API Key**: `sk-okh-YOUR_GATEWAY_KEY` *(Ganti dengan Gateway Key dari dashboard One Key Hub)*
   - **URL / Base URL**: `https://airotation.my.id/v1` *(atau `http://localhost:3000/v1` jika self-hosted local)*
4. Pada parameter **Model**, isi model yang Anda inginkan (contoh: `gemini-2.5-flash`, `llama-3.3-70b-versatile`, `openrouter/free`, dll).

---

## 📌 Metode 2: HTTP Request Node (Standard OpenAI Format `/v1`)

Gunakan metode ini jika Anda ingin menggunakan node **HTTP Request** standar n8n dengan payload format OpenAI.

### Konfigurasi Node:
- **Method**: `POST`
- **URL**: `https://airotation.my.id/v1/chat/completions`
- **Authentication**: `Header Auth` atau `Predefined Credential`
  - **Header**: `Authorization`
  - **Value**: `Bearer sk-okh-YOUR_GATEWAY_KEY`
- **Header Tambahan**:
  - `Content-Type`: `application/json`

### Body Request (JSON):
```json
{
  "model": "gemini-2.5-flash",
  "messages": [
    {
      "role": "system",
      "content": "Anda adalah asisten AI yang membantu otomasi bisnis."
    },
    {
      "role": "user",
      "content": "={{ $json.message }}"
    }
  ],
  "temperature": 0.7
}
```

### Membaca Respon:
Hasil balasan AI tersedia pada ekspresi berikut di node n8n setelahnya:
- Teks Balasan: `{{ $json.choices[0].message.content }}` atau `{{ $json.text }}`
- ID Model Terpakai: `{{ $json.model }}`
- Total Token: `{{ $json.usage.total_tokens }}`

---

## 📌 Metode 3: HTTP Request Node (Custom Gateway Direct Endpoint `/gateway`)

Gunakan metode ini untuk memanggil provider spesifik secara langsung melalui gateway One Key Hub.

### Konfigurasi Node:
- **Method**: `POST`
- **URL**: `https://airotation.my.id/gateway/:provider/chat`
  *(Contoh: `https://airotation.my.id/gateway/gemini/chat` atau `/gateway/groq/chat`)*
- **Header**:
  - `X-API-Key`: `sk-okh-YOUR_GATEWAY_KEY`
  - `Content-Type`: `application/json`

### Body Request (JSON):
```json
{
  "prompt": "={{ $json.message }}",
  "model_id": "gemini-2.5-flash",
  "system_prompt": "Jawab secara ringkas dan lugas."
}
```

### Membaca Respon:
- Teks Balasan: `{{ $json.text }}` atau `{{ $json.choices[0].message.content }}`

---

## 🖼️ Integrasi Vision & Media (Gambar / Video)

One Key Hub mendukung analisis gambar dan video melalui Gemini & Groq Vision.

### Workflow 3 Node di n8n:
1. **Read Binary File Node**: Membaca file gambar/video dari storage.
2. **Code Node (Convert Base64)**:
   ```javascript
   const items = $input.all();
   return items.map(item => {
     const binaryData = item.binary.data;
     const b64 = binaryData.data; // n8n base64 string
     const mimeType = binaryData.mimeType || 'image/jpeg';
     return {
       json: {
         image_base64: `data:${mimeType};base64,${b64}`
       }
     };
   });
   ```
3. **HTTP Request Node**:
   - **URL**: `https://airotation.my.id/gateway/gemini/chat`
   - **Method**: `POST`
   - **Headers**: `X-API-Key: sk-okh-YOUR_GATEWAY_KEY`
   - **Body**:
     ```json
     {
       "prompt": "Deskripsikan isi gambar ini secara detail.",
       "model_id": "gemini-2.5-flash",
       "image_base64": "={{ $json.image_base64 }}"
     }
     ```

---

## 🎨 Image Generation (Text-to-Image)

Untuk membuat gambar menggunakan AI di n8n:
- **Method**: `POST`
- **URL**: `https://airotation.my.id/gateway/huggingface/images/generations`
- **Headers**: `X-API-Key: sk-okh-YOUR_GATEWAY_KEY`
- **Body**:
  ```json
  {
    "prompt": "A futuristic city in cyberpunk style, highly detailed, 4k",
    "model": "flux"
  }
  ```

---

## ⚠️ Handling Error & Retry Settings di n8n

| Kode Error | Keterangan | Solusi |
| :--- | :--- | :--- |
| **401 Unauthorized** | Gateway API Key salah atau tidak dikirim. | Periksa header `X-API-Key` atau `Authorization: Bearer`. Pastikan key diawali `sk-okh-`. |
| **403 Forbidden** | Gateway Key dibatasi (*allowed_providers*) dan tidak diizinkan untuk provider ini. | Cek pengaturan Gateway Key di dashboard One Key Hub. |
| **429 Rate Limit** | Rate limit dari provider tercapai. | Rotasi otomatis One Key Hub akan mencoba credential lain. Jika tetap 429, tambah credential aktif. |
| **503 Service Unavailable** | Semua credential aktif untuk provider tersebut habis/error. | Tambahkan API Key baru pada menu **Providers** di One Key Hub. |
| **500 / 502** | Error internal atau provider upstream down. | Aktifkan `Retry On Fail` pada node n8n. |

### Setting Best Practice di n8n Node:
1. Buka **Settings** pada HTTP Request Node di n8n.
2. Aktifkan **Always Output Data** = `true` (agar workflow tidak langsung mati jika error).
3. Aktifkan **Retry On Fail** = `true`:
   - **Max Tries**: `3`
   - **Wait Between Tries (ms)**: `2000`
