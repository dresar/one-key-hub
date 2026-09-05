# Arsitektur Sistem: AI-Assisted API Key Management via Telegram

Dokumen ini mendeskripsikan arsitektur backend untuk mengelola API Key secara terpusat, aman, dan otomatis menggunakan instruksi natural language via Telegram, terintegrasi dengan sistem Unified AI.

## 1. Arsitektur High-Level (Komponen Sistem)

Sistem ini dirancang menggunakan arsitektur modular (direkomendasikan menggunakan **NestJS**) dengan antrian (Queue) untuk proses asinkron dan Cron Job untuk otomatisasi.

```text
[ Telegram App ]
       │ (Webhook / Polling)
       ▼
┌─────────────────────────────────────────────────────────────┐
│                   TELEGRAM BOT GATEWAY                      │
│ - Rate Limiting & Anti-Spam                                 │
│ - Admin Whitelist & Role Verification                       │
└──────────────┬──────────────────────────────────────────────┘
               │ (Raw Text Message)
               ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI COMMAND PARSER                         │
│ 1. Pre-Processor: Regex Masking (Sembunyikan API Key Asli)  │
│ 2. AI Engine: Ekstraksi Intent (Action, Provider, Target)   │
│ 3. Post-Processor: Unmasking (Kembalikan nilai API Key)     │
└──────────────┬──────────────────────────────────────────────┘
               │ (Parsed JSON Command: action, payload)
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                            │
│ - Action Router (Mengarahkan command ke service spesifik)   │
│ - Validation & Business Logic                               │
└──────┬──────────────────────┬───────────────────────┬───────┘
       │                      │                       │
       ▼                      ▼                       ▼
┌──────────────┐       ┌──────────────┐        ┌──────────────┐
│ API KEY MGR  │       │ ROTATION ENG │        │ AUDIT LOG    │
│ - CRUD       │       │ - Cron Jobs  │        │ - Log Action │
│ - Encryption │       │ - Status Cek │        │ - Immutable  │
└──────┬───────┘       └──────┬───────┘        └──────┬───────┘
       │                      │                       │
       ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (PostgreSQL)              │
│ - AES-256-GCM Encryption / Decryption                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Alur Kerja Aman: Ekstraksi Maksud AI (Tanpa Leak Secret)

Tantangan terbesar adalah AI tidak boleh mengetahui API Key mentah untuk mencegah kebocoran log di model pihak ketiga (OpenAI/Gemini).

**Skenario Command:** `"Tolong masukkan 2 API key Google ini: AIzaSy12345..., AIzaSy67890..."`

1. **Pre-Processing (Regex Masking):**
   - Sistem mendeteksi pola API Key menggunakan Regex (misal: `AIza[0-9a-zA-Z_-]{35}`).
   - Kata sandi diganti dengan token sementara.
   - **Teks Masked:** `"Tolong masukkan 2 API key Google ini: {{TOKEN_1}}, {{TOKEN_2}}"`
   - **Memory Map:** `{ "{{TOKEN_1}}": "AIzaSy12345...", "{{TOKEN_2}}": "AIzaSy67890..." }`
2. **AI Intent Extraction:**
   - Teks *Masked* dikirim ke LLM dengan prompt sistem: *"Kamu adalah parser. Ekstrak JSON action, provider, dan list keys dari teks."*
   - **Response AI:** `{ "action": "BULK_INSERT", "provider": "GOOGLE", "keys": ["{{TOKEN_1}}", "{{TOKEN_2}}"] }`
3. **Post-Processing (Unmasking):**
   - Sistem memetakan kembali nilai dari Memory Map.
   - **Final Payload:** `{ "action": "BULK_INSERT", "provider": "GOOGLE", "keys": ["AIzaSy12345...", "AIzaSy67890..."] }`
4. **Execution:** Final payload diteruskan ke *API Key Manager* untuk dienkripsi dan disimpan.

---

## 3. Desain Database (PostgreSQL)

Menggunakan PostgreSQL. Kolom yang mengandung *secret* dienkripsi di level aplikasi sebelum masuk ke DB.

### Tabel: `api_keys`
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `provider` | VARCHAR | Misal: `GOOGLE`, `GEMINI`, `OPENAI` |
| `key_ciphertext` | TEXT | Encrypted dengan AES-256-GCM. Berisi API key mentah + IV + AuthTag |
| `key_hash` | VARCHAR | Hashing SHA-256 dari key asli. Untuk **mendeteksi duplikasi** saat bulk insert tanpa harus dekripsi |
| `key_preview` | VARCHAR | Masked text untuk tampilan (misal: `AIzaSy...7xYz`) |
| `status` | ENUM | `ACTIVE`, `EXHAUSTED`, `ERROR`, `DISABLED` |
| `usage_count` | INT | Jumlah pemakaian sejauh ini |
| `error_count` | INT | Counter jika key sering menghasilkan 401/429 |
| `last_used_at` | TIMESTAMP | Waktu terakhir key digunakan |
| `last_rotated_at` | TIMESTAMP | Waktu kapan key ini di-rotasi menjadi aktif |
| `created_by` | VARCHAR | Telegram User ID yang menginput |
| `created_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | Soft delete. Jika NULL, berarti key belum dihapus |
| `metadata` | JSONB | Data tambahan (limit kuota, tag khusus) |

### Tabel: `audit_logs`
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `action` | VARCHAR | `INSERT`, `BULK_INSERT`, `DELETE`, `ROTATE`, `DISABLE` |
| `performed_by` | VARCHAR | Telegram User ID admin |
| `target_resource` | VARCHAR | `API_KEY` atau `PROVIDER` |
| `target_id` | UUID (Nullable) | ID spesifik (bisa NULL jika aksi massal) |
| `changes` | JSONB | Rincian payload perubahan (hati-hati jangan melog ciphertext) |
| `created_at` | TIMESTAMP | Waktu eksekusi |

---

## 4. Struktur Folder Backend (NestJS Recommendation)

Struktur yang *scalable* untuk enterprise:

```text
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── env.config.ts        # Validasi env variables
│   └── crypto.config.ts     # Konfigurasi master key AES
├── modules/
│   ├── telegram/
│   │   ├── telegram.service.ts       # Menangani webhook/polling bot
│   │   ├── nlp-parser.service.ts     # Masking, prompt AI, Unmasking
│   │   └── telegram.controller.ts    
│   ├── api-keys/
│   │   ├── api-keys.service.ts       # Core logic CRUD API Key
│   │   ├── crypto.service.ts         # AES-256-GCM logic
│   │   ├── entities/api-key.entity.ts
│   │   └── api-keys.controller.ts    # REST endpoint internal
│   ├── rotation/
│   │   ├── rotation.service.ts       # Logika pemilihan next key
│   │   └── rotation.cron.ts          # Scheduler auto-rotation
│   ├── audit/
│   │   └── audit.service.ts          # Immutable logging
│   └── queue/
│       ├── bull.module.ts
│       └── workers/key-processor.ts  # Worker untuk insert 100+ keys
└── common/
    ├── guards/
    │   └── tg-whitelist.guard.ts     # Filter Telegram ID
    └── constants/
        └── providers.enum.ts
```

---

## 5. Daftar Endpoint Internal (REST API Gateway)

Meskipun dikontrol via Telegram, backend tetap mengekspos REST API internal agar sistem *Unified AI* (frontend/backend lain) bisa mengambil key yang sedang aktif.

- `GET /api/v1/keys/active?provider=GOOGLE`
  - Mendapatkan 1 API key yang sedang *ACTIVE* (Didekripsi oleh service sebelum di-return ke internal requestor).
- `POST /api/v1/keys/report-error`
  - Menginformasikan backend bahwa key dengan preview tertentu error (401/429). Jika *error_count* melebih threshold, otomatis trigger `Rotation Engine`.
- `GET /api/v1/keys/stats`
  - Mendapatkan jumlah key aktif, error, dan habis per provider.

---

## 6. Contoh Service Functions (TypeScript)

### A. Encryption & Decryption (Security Layer)
```typescript
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// MASTER_KEY harus 32 bytes, disimpan di process.env aman
const MASTER_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

export function encryptKey(plainTextKey: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  let encrypted = cipher.update(plainTextKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${authTag}`; // Ciphertext Format
}

export function generateHash(plainTextKey: string) {
  return crypto.createHash('sha256').update(plainTextKey).digest('hex');
}
```

### B. Bulk Insert Logic (API Key Manager)
```typescript
async function bulkInsertApiKeys(provider: string, rawKeys: string[], telegramUserId: string) {
  let successCount = 0;
  let duplicateCount = 0;

  for (const key of rawKeys) {
    const keyHash = generateHash(key);
    
    // Deteksi duplikasi secepat kilat menggunakan Hash
    const exists = await db.api_keys.findFirst({ where: { key_hash: keyHash } });
    if (exists) {
      duplicateCount++;
      continue;
    }

    const keyPreview = `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
    
    await db.api_keys.create({
      data: {
        provider,
        key_ciphertext: encryptKey(key),
        key_hash: keyHash,
        key_preview: keyPreview,
        status: 'ACTIVE',
        created_by: telegramUserId
      }
    });
    successCount++;
  }

  await writeAuditLog('BULK_INSERT', telegramUserId, 'PROVIDER', null, { provider, count: successCount });
  return { successCount, duplicateCount };
}
```

### C. Rotation Engine (Cron / Triggered)
```typescript
async function rotateApiKey(provider: string) {
  // 1. Matikan (EXHAUSTED) key aktif saat ini
  await db.api_keys.updateMany({
    where: { provider, status: 'ACTIVE' },
    data: { status: 'EXHAUSTED' }
  });

  // 2. Cari 1 key yang belum pernah dipakai atau error paling sedikit
  const nextKey = await db.api_keys.findFirst({
    where: { provider, status: 'DISABLED', deleted_at: null },
    orderBy: { usage_count: 'asc' }
  });

  if (!nextKey) throw new Error(`No available keys left for ${provider}`);

  // 3. Aktifkan key tersebut
  await db.api_keys.update({
    where: { id: nextKey.id },
    data: { status: 'ACTIVE', last_rotated_at: new Date() }
  });

  return nextKey.key_preview;
}
```

---

## 7. Security Layer & Best Practices

1. **Telegram User Whitelist:**
   Sistem menyimpan array `ALLOWED_TELEGRAM_IDS` di `.env` atau database. Jika pengirim chat bukan admin, abaikan pesan secara diam-diam.
2. **Approval untuk Aksi Berbahaya:**
   Jika command adalah *"hapus semua key google"*, bot tidak langsung mengeksekusi. Bot merespon: *"Peringatan: Anda akan menghapus 150 key Google. Balas dengan PIN Rahasia Anda atau ketik 'CONFIRM' untuk melanjutkan."*
3. **Pemisahan Secret (Encryption):**
   Master key untuk dekripsi (AES) **tidak boleh disimpan di database**. Simpan di environment variable mesin production atau Secret Manager (AWS Secrets / GCP Secret Manager).
4. **Soft Delete:**
   Jangan pernah gunakan `DELETE FROM table`. Selalu `UPDATE deleted_at = NOW()`. Ini untuk mitigasi jika admin Telegram di-hack dan menghapus semua key, data masih bisa di-*restore* via database.
5. **Masking & Sanitization:**
   Pesan bot ke Telegram *selalu* menggunakan `key_preview`. Bot tidak boleh merespon *"Key AIzaSy123456789... berhasil dimasukkan"*. Bot harus membalas: *"Key AIzaSy... berhasil dimasukkan"*.

---

## 8. Contoh Interaksi Bot Telegram (Contract)

**User (Admin):**
> masukkan 3 API key Google ini:
> AIzaSy111111111111
> AIzaSy222222222222
> AIzaSy333333333333

**Bot Gateway -> AI Parser Engine Processing...**

**Bot (Response):**
> ✅ **Proses Selesai!**
> 
> 🔹 **Aksi:** Bulk Insert
> 🔹 **Provider:** GOOGLE
> 🔹 **Berhasil:** 3 key ditambahkan
> 🔹 **Duplikat:** 0 key
> 
> Key Preview:
> 1. `AIzaSy...1111`
> 2. `AIzaSy...2222`
> 3. `AIzaSy...3333`
> 
> Status total key GOOGLE aktif saat ini: 45 keys.

**User (Admin):**
> cek status key yang error

**Bot (Response):**
> ⚠️ **Laporan Status Error API Key**
> 
> **OPENAI:**
> - `sk-1A2b...Z9yX` (Error Count: 5x) - *Auto-disabled*
> - `sk-4Bc2...P0o1` (Error Count: 2x)
> 
> **GEMINI:**
> Tidak ada key bermasalah.
> 
> *Ketik "rotasi API key provider OpenAI" untuk melakukan penggantian key.*
