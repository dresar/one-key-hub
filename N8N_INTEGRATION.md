# Panduan Integrasi n8n (Edisi 2025)

Dokumen ini menjelaskan cara mengintegrasikan **One Key Hub** dengan **n8n** menggunakan node **HTTP Request**.

## Prasyarat

1.  Pastikan Anda memiliki akun n8n yang aktif (Self-hosted atau Cloud).
2.  Anda telah memiliki **Unified API Key** dari One Key Hub.
    -   Masuk ke Dashboard One Key Hub.
    -   Buka menu **Unified API**.
    -   Generate atau salin API Key yang tersedia (berawalan `sk-unified-...`).

---

## Konfigurasi Node HTTP Request

Ikuti langkah-langkah berikut untuk mengatur node HTTP Request di workflow n8n Anda.

### 1. Tambahkan Node
Cari dan tambahkan node **HTTP Request** ke canvas workflow Anda.

### 2. Tab "Settings" (Pengaturan Utama)

Isi konfigurasi dasar sebagai berikut:

*   **Method**: `POST`
*   **URL**: `https://one.apprentice.cyou/api/v1/chat/completions`
    > **Catatan**: URL ini menggunakan endpoint production sesuai konfigurasi environment terbaru.
*   **Authentication**: `Generic Credential Type` -> `Header Auth`

### 3. Konfigurasi Kredensial (Header Auth)

Buat kredensial baru (atau pilih yang sudah ada) dengan detail:

*   **Name**: `Authorization`
*   **Value**: `Bearer sk-unified-xxxxxxxxxxxxxxxx`
    *   *Ganti `sk-unified-xxxxxxxxxxxxxxxx` dengan Unified API Key Anda yang sebenarnya.*

### 4. Tab "Options" (Opsional tapi Direkomendasikan)

*   **Response Format**: `JSON`
*   **Split Into Items**: `Off` (biasanya lebih mudah memproses 1 respons utuh untuk chat completion)

### 5. Body Parameters

Pada bagian **Send Body**, pilih format **JSON**.
Masukkan payload JSON berikut (sesuaikan dengan kebutuhan workflow Anda):

```json
{
  "model": "gemini-1.5-flash",
  "messages": [
    {
      "role": "user",
      "content": "Halo, ceritakan lelucon tentang programmer!"
    }
  ],
  "temperature": 0.7
}
```

> **Tips Dinamis**: Di n8n, Anda biasanya mengambil `content` dari node sebelumnya. Contoh Expression untuk content:
> `{{ $json.input_text }}` atau `{{ $node["Webhook"].json.body.message }}`

---

## Contoh Output

Jika konfigurasi berhasil, Anda akan menerima respons JSON standar format OpenAI:

```json
{
  "id": "chatcmpl-123abc456",
  "object": "chat.completion",
  "created": 1709123456,
  "model": "gemini-1.5-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Kenapa programmer suka gelap? Karena light mode menarik serangga (bugs)!"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 20,
    "total_tokens": 35
  }
}
```

## Troubleshooting

*   **Error 401 (Unauthorized)**: Periksa kembali API Key Anda. Pastikan formatnya `Bearer <KEY>` (dengan spasi).
*   **Error 404 (Not Found)**: Pastikan URL endpoint tepat: `https://one.apprentice.cyou/api/v1/chat/completions`.
*   **Error 429 (Too Many Requests)**: Kuota API Key provider habis atau rate limit terlampaui. One Key Hub akan otomatis mencoba key lain jika tersedia.
*   **Error 502 (Bad Gateway)**: Terjadi masalah koneksi ke provider AI (misal: Gemini/OpenAI down), atau server One Key Hub sedang maintenance.
