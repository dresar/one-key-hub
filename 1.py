import json

nodes = []
connections = {}

def add_node(name, ntype, params, position, typeVersion=1, credentials=None, extra=None, notes=None):
    node = {
        "parameters": params,
        "id": name.lower().replace(" ", "-").replace("(", "").replace(")", ""),
        "name": name,
        "type": ntype,
        "typeVersion": typeVersion,
        "position": position,
    }
    if credentials:
        node["credentials"] = credentials
    if extra:
        node.update(extra)
    nodes.append(node)
    return name

def connect(src, dst, src_index=0, dst_index=0):
    connections.setdefault(src, {"main": []})
    while len(connections[src]["main"]) <= src_index:
        connections[src]["main"].append([])
    connections[src]["main"][src_index].append({"node": dst, "type": "main", "index": dst_index})

def sticky(content, position, size, color=3):
    nodes.append({
        "parameters": {"content": content, "height": size[1], "width": size[0], "color": color},
        "id": "sticky-" + str(len(nodes)),
        "name": "Sticky-" + str(len(nodes)),
        "type": "n8n-nodes-base.stickyNote",
        "typeVersion": 1,
        "position": position,
    })

CRED_AIRTABLE = {"airtableTokenApi": {"id": "AbYqCc6ZdNGvzBSy", "name": "Airtable Personal Access Token account"}}
CRED_FB = {"facebookGraphApi": {"id": "p2nV37T8gVHXU2m0", "name": "Facebook Graph account"}}
CRED_GDRIVE = {"googleDriveOAuth2Api": {"id": "sSjCMUXWgv6xebzu", "name": "Google Drive account"}}
CRED_GOOGLE = {"googleOAuth2Api": {"id": "0sZ3AhgRR0qUwBTb", "name": "Google account"}}
CRED_CLOUDINARY = {"cloudinaryApi": {"id": "ENvXgfaMDbnlpfHW", "name": "Cloudinary account"}}
CRED_TELEGRAM = {"telegramApi": {"id": "l1sKxkGYf5u23N3N", "name": "Telegram account"}}
CRED_BEARER = {"httpBearerAuth": {"id": "YzQRxob7VBKoYEoU", "name": "Bearer Auth account"}}

BASE_ID = "appafQ1viq4sJXOve"
TBL_AKUN = "tblAkunMultiAccount01"
TBL_UPLOAD = "tblBAgS2enNJfFo5R"

ADMIN_CHAT_ID = "7896674035"
TG_CHAT_EXPR = "={{ $('Telegram Masuk').item.json.message ? $('Telegram Masuk').item.json.message.chat.id : $('Telegram Masuk').item.json.callback_query.message.chat.id }}"

sticky("## \U0001F7E2 TRIGGER\nMode Otomatis (Scheduler) & Mode Manual (Telegram)", [-260, -1300], [460, 260], 4)
sticky("## \U0001F4AC TELEGRAM DASHBOARD\nMenu utama, router, dan seluruh menu administrasi", [420, -1300], [900, 900], 5)
sticky("## \U0001F3AC PENGAMBILAN VIDEO\nAmbil akun aktif, cek antrean, ambil & unduh video", [620, 1050], [1200, 260], 3)
sticky("## \u2601\uFE0F CLOUD STORAGE\nUpload video ke Cloudinary (CDN)", [2140, 1050], [260, 260], 6)
sticky("## \U0001F916 ARTIFICIAL INTELLIGENCE\nGenerate caption otomatis (OpenAI Compatible)", [2360, 1050], [500, 260], 7)
sticky("## \U0001F5C4\uFE0F DATABASE\nSimpan data upload ke Airtable", [2820, 1050], [260, 260], 3)
sticky("## \U0001F4F8 INSTAGRAM\nBuat container, polling status, publish", [3040, 1050], [700, 500], 2)
sticky("## \U0001F9F9 CLEANUP\nPindahkan file ke arsip & hapus dari Cloudinary", [4140, 1050], [460, 260], 6)
sticky("## \U0001F4CA MONITORING & LAPORAN\nLaporan sukses ke Telegram", [4580, 1050], [260, 260], 5)
sticky("## \u26A0\uFE0F ERROR HANDLING\nMenangani seluruh kegagalan workflow", [620, 1550], [700, 260], 1)

add_node("Jadwal Otomatis", "n8n-nodes-base.scheduleTrigger",
    {"rule": {"interval": [{"field": "hours", "hoursInterval": 3}]}},
    [-220, -1240], 1.2)

add_node("Mode Otomatis", "n8n-nodes-base.set",
    {"assignments": {"assignments": [
        {"id": "1", "name": "mode", "value": "otomatis", "type": "string"},
    ]}, "options": {}},
    [0, -1240], 3.4)

add_node("Telegram Masuk", "n8n-nodes-base.telegramTrigger",
    {"updates": ["message", "callback_query"], "additionalFields": {}},
    [-220, -1020], 1.1, CRED_TELEGRAM)

add_node("Cek Perintah Menu", "n8n-nodes-base.if",
    {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
        "conditions": [{"id": "1", "leftValue": "={{ $json.message ? $json.message.text : '' }}",
            "rightValue": "/menu", "operator": {"type": "string", "operation": "equals"}},
            {"id": "2", "leftValue": "={{ $json.message ? $json.message.text : '' }}",
            "rightValue": "/start", "operator": {"type": "string", "operation": "equals"}}],
        "combinator": "or"}, "options": {}},
    [40, -1020], 2.2)

add_node("Menu Utama", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "\U0001F916 <b>DASHBOARD INSTAGRAM REELS AUTOMATION</b>\n\nPilih menu di bawah ini:",
     "additionalFields": {"parse_mode": "HTML"},
     "replyMarkup": "inlineKeyboard",
     "inlineKeyboard": {"rows": [
        {"row": {"buttons": [{"text": "\U0001F680 Upload Sekarang", "additionalFields": {"callback_data": "upload_now"}},
                              {"text": "\u23F0 Scheduler", "additionalFields": {"callback_data": "scheduler"}}]}},
        {"row": {"buttons": [{"text": "\U0001F4CB Queue Upload", "additionalFields": {"callback_data": "queue"}},
                              {"text": "\U0001F4D2 Daftar Akun", "additionalFields": {"callback_data": "list_accounts"}}]}},
        {"row": {"buttons": [{"text": "\u2795 Tambah Akun", "additionalFields": {"callback_data": "add_account"}},
                              {"text": "\U0001F500 Ganti Akun Aktif", "additionalFields": {"callback_data": "switch_account"}}]}},
        {"row": {"buttons": [{"text": "\U0001F4CA Statistik", "additionalFields": {"callback_data": "stats"}},
                              {"text": "\U0001F553 Riwayat Upload", "additionalFields": {"callback_data": "history"}}]}},
        {"row": {"buttons": [{"text": "\u2699\uFE0F Pengaturan", "additionalFields": {"callback_data": "settings"}},
                              {"text": "\U0001F5A5\uFE0F Status Server", "additionalFields": {"callback_data": "server_status"}}]}},
        {"row": {"buttons": [{"text": "\u2139\uFE0F Tentang Workflow", "additionalFields": {"callback_data": "about"}}]}},
     ]}},
    [260, -1120], 1.2, CRED_TELEGRAM)

add_node("Cek Aktivasi Akun", "n8n-nodes-base.if",
    {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
        "conditions": [{"id": "1",
            "leftValue": "={{ $json.callback_query ? $json.callback_query.data : '' }}",
            "rightValue": "activate_", "operator": {"type": "string", "operation": "startsWith"}}],
        "combinator": "and"}, "options": {}},
    [40, -820], 2.2)

add_node("Router Menu", "n8n-nodes-base.switch",
    {"mode": "rules", "rules": {"values": [
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "1", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "upload_now",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Upload Sekarang"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "2", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "scheduler",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Scheduler"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "3", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "queue",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Queue"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "4", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "list_accounts",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Daftar Akun"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "5", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "add_account",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Tambah Akun"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "6", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "switch_account",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Ganti Akun"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "7", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "stats",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Statistik"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "8", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "history",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Riwayat"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "9", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "settings",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Pengaturan"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "10", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "server_status",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Status Server"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "11", "leftValue": "={{ $json.callback_query.data }}", "rightValue": "about",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Tentang"},
    ]}, "options": {"fallbackOutput": "none"}},
    [260, -820], 3.2)

add_node("Mode Manual", "n8n-nodes-base.set",
    {"assignments": {"assignments": [
        {"id": "1", "name": "mode", "value": "manual", "type": "string"},
    ]}, "options": {}},
    [480, -1120], 3.4)

add_node("Aktifkan Akun", "n8n-nodes-base.airtable",
    {"operation": "update", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_AKUN, "mode": "id"},
     "columns": {"mappingMode": "defineBelow", "matchingColumns": ["id"], "value": {
         "id": "={{ $json.callback_query.data.replace('activate_', '') }}",
         "Status": "Aktif"}, "schema": []}, "options": {}},
    [480, -800], 2.1, CRED_AIRTABLE)

add_node("Konfirmasi Aktivasi", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR, "text": "\u2705 Akun aktif berhasil diganti.",
     "additionalFields": {"parse_mode": "HTML"}},
    [700, -800], 1.2, CRED_TELEGRAM)

add_node("Ambil Semua Akun", "n8n-nodes-base.airtable",
    {"operation": "search", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_AKUN, "mode": "id"}, "options": {}},
    [480, -640], 2.1, CRED_AIRTABLE)

add_node("Format Daftar Akun", "n8n-nodes-base.set",
    {"assignments": {"assignments": [
        {"id": "1", "name": "ringkasan", "value": "={{ '\u2022 ' + $json.fields.NamaAkun + ' (@' + $json.fields.Username + ') - ' + $json.fields.Status }}", "type": "string"}
    ]}, "options": {}},
    [700, -640], 3.4)

add_node("Kirim Daftar Akun", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "=\U0001F4D2 <b>DAFTAR AKUN INSTAGRAM</b>\n\n{{ $items().map(i => i.json.ringkasan).join('\\n') }}",
     "additionalFields": {"parse_mode": "HTML"}},
    [920, -640], 1.2, CRED_TELEGRAM)

add_node("Ambil Akun Untuk Ganti", "n8n-nodes-base.airtable",
    {"operation": "search", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_AKUN, "mode": "id"}, "options": {}},
    [480, -480], 2.1, CRED_AIRTABLE)

add_node("Kirim Pilihan Akun", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR, "text": "\U0001F500 Pilih akun yang ingin diaktifkan:",
     "additionalFields": {"parse_mode": "HTML"},
     "replyMarkup": "inlineKeyboard",
     "inlineKeyboard": {"rows": [
        {"row": {"buttons": [{"text": "={{ $json.fields.NamaAkun }}",
                               "additionalFields": {"callback_data": "={{ 'activate_' + $json.id }}"}}]}}
     ]}},
    [700, -480], 1.2, CRED_TELEGRAM)

add_node("Ambil Antrian", "n8n-nodes-base.airtable",
    {"operation": "search", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_UPLOAD, "mode": "id"},
     "filterByFormula": "=OR({Status}='Waiting',{Status}='Downloading',{Status}='Uploading',{Status}='Generating Caption',{Status}='Publishing')",
     "options": {}},
    [480, -320], 2.1, CRED_AIRTABLE)

add_node("Kirim Antrian", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "=\U0001F4CB <b>QUEUE UPLOAD</b>\n\nJumlah antrean: {{ $items().length }}\n\n{{ $items().map(i => '\u2022 ' + i.json.fields.Name + ' - ' + i.json.fields.Status).join('\\n') }}",
     "additionalFields": {"parse_mode": "HTML"}},
    [700, -320], 1.2, CRED_TELEGRAM)

add_node("Ambil Statistik", "n8n-nodes-base.airtable",
    {"operation": "search", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_UPLOAD, "mode": "id"}, "options": {}},
    [480, -160], 2.1, CRED_AIRTABLE)

add_node("Hitung Statistik", "n8n-nodes-base.summarize",
    {"fieldsToSummarize": {"values": [{"aggregation": "count", "field": "fields.Status"}]},
     "fieldsToSplitBy": "fields.Status", "options": {}},
    [700, -160], 1.1)

add_node("Kirim Statistik", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "=\U0001F4CA <b>STATISTIK UPLOAD</b>\n\n{{ $items().map(i => '\u2022 ' + i.json['fields.Status'] + ': ' + i.json.count).join('\\n') }}",
     "additionalFields": {"parse_mode": "HTML"}},
    [920, -160], 1.2, CRED_TELEGRAM)

add_node("Ambil Riwayat", "n8n-nodes-base.airtable",
    {"operation": "search", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_UPLOAD, "mode": "id"},
     "sort": {"property": [{"field": "PostedAt", "direction": "desc"}]},
     "limit": 10, "options": {}},
    [480, 0], 2.1, CRED_AIRTABLE)

add_node("Kirim Riwayat", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "=\U0001F553 <b>RIWAYAT UPLOAD TERAKHIR</b>\n\n{{ $items().map(i => '\u2022 ' + i.json.fields.Name + ' - ' + i.json.fields.Status).join('\\n') }}",
     "additionalFields": {"parse_mode": "HTML"}},
    [700, 0], 1.2, CRED_TELEGRAM)

add_node("Kirim Info Scheduler", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "\u23F0 <b>SCHEDULER</b>\n\nMode otomatis berjalan setiap 3 jam sekali.\nUbah interval pada node \"Jadwal Otomatis\".",
     "additionalFields": {"parse_mode": "HTML"}},
    [480, 160], 1.2, CRED_TELEGRAM)

add_node("Kirim Status Server", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "=\U0001F5A5\uFE0F <b>STATUS SERVER</b>\n\nWorkflow: {{ $workflow.name }}\nWaktu Server: {{ $now.format('dd MMM yyyy \u2022 HH:mm:ss') }}\nStatus: \U0001F7E2 Online",
     "additionalFields": {"parse_mode": "HTML"}},
    [480, 320], 1.2, CRED_TELEGRAM)

add_node("Kirim Tentang", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "\u2139\uFE0F <b>TENTANG WORKFLOW</b>\n\nInstagram Reels Automation Multi-Akun\nDibangun dengan n8n Self-Hosted 2026.\nMendukung banyak akun Instagram melalui satu workflow.",
     "additionalFields": {"parse_mode": "HTML"}},
    [480, 480], 1.2, CRED_TELEGRAM)

add_node("Kirim Pengaturan", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "\u2699\uFE0F <b>PENGATURAN</b>\n\nUntuk mengubah endpoint AI, prompt caption, atau folder Google Drive per akun, silakan ubah langsung di tabel Akun pada Airtable.",
     "additionalFields": {"parse_mode": "HTML"}},
    [480, 640], 1.2, CRED_TELEGRAM)

add_node("Kirim Instruksi Tambah Akun", "n8n-nodes-base.telegram",
    {"chatId": TG_CHAT_EXPR,
     "text": "=\u2795 <b>TAMBAH AKUN BARU</b>\n\nTambahkan baris baru pada tabel Akun di Airtable berikut:\nhttps://airtable.com/{{ '" + BASE_ID + "' }}\n\nIsi kolom: NamaAkun, Username, InstagramBusinessID, FacebookPageID, Status, Token, DriveFolderSumber, DriveFolderArsip, AIEndpoint, AIModel, AIPromptTemplate.",
     "additionalFields": {"parse_mode": "HTML"}},
    [480, 800], 1.2, CRED_TELEGRAM)

add_node("Ambil Akun Aktif", "n8n-nodes-base.airtable",
    {"operation": "search", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_AKUN, "mode": "id"},
     "filterByFormula": "={Status}='Aktif'", "options": {"pageSize": 1}},
    [660, 1100], 2.1, CRED_AIRTABLE)

add_node("Set Data Akun", "n8n-nodes-base.set",
    {"assignments": {"assignments": [
        {"id": "1", "name": "namaAkun", "value": "={{ $json.fields.NamaAkun }}", "type": "string"},
        {"id": "2", "name": "businessId", "value": "={{ $json.fields.InstagramBusinessID }}", "type": "string"},
        {"id": "3", "name": "pageId", "value": "={{ $json.fields.FacebookPageID }}", "type": "string"},
        {"id": "4", "name": "folderSumber", "value": "={{ $json.fields.DriveFolderSumber }}", "type": "string"},
        {"id": "5", "name": "folderArsip", "value": "={{ $json.fields.DriveFolderArsip }}", "type": "string"},
        {"id": "6", "name": "aiEndpoint", "value": "={{ $json.fields.AIEndpoint }}", "type": "string"},
        {"id": "7", "name": "aiModel", "value": "={{ $json.fields.AIModel }}", "type": "string"},
        {"id": "8", "name": "promptTemplate", "value": "={{ $json.fields.AIPromptTemplate }}", "type": "string"},
    ]}, "options": {}},
    [880, 1100], 3.4)

add_node("Cek Antrian Berjalan", "n8n-nodes-base.airtable",
    {"operation": "search", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_UPLOAD, "mode": "id"},
     "filterByFormula": "=AND({NamaAkun}='{{ $json.namaAkun }}',OR({Status}='Downloading',{Status}='Uploading',{Status}='Generating Caption',{Status}='Publishing'))",
     "options": {}},
    [1100, 1100], 2.1, CRED_AIRTABLE)

add_node("IF Ada Proses Berjalan", "n8n-nodes-base.if",
    {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
        "conditions": [{"id": "1", "leftValue": "={{ $items().length }}", "rightValue": 0,
            "operator": {"type": "number", "operation": "gt"}}], "combinator": "and"}, "options": {}},
    [1320, 1100], 2.2)

add_node("Kirim Info Sedang Proses", "n8n-nodes-base.telegram",
    {"chatId": ADMIN_CHAT_ID,
     "text": "\u23F3 Proses upload sebelumnya masih berjalan. Video baru dimasukkan ke antrean.",
     "additionalFields": {"parse_mode": "HTML"}},
    [1320, 1300], 1.2, CRED_TELEGRAM)

add_node("Ambil Daftar Video", "n8n-nodes-base.httpRequest",
    {"url": "https://www.googleapis.com/drive/v3/files",
     "authentication": "predefinedCredentialType", "nodeCredentialType": "googleOAuth2Api",
     "sendQuery": True, "queryParameters": {"parameters": [
        {"name": "q", "value": "={{ \"'\" + $('Set Data Akun').item.json.folderSumber + \"' in parents and mimeType='video/mp4' and trashed = false\" }}"},
        {"name": "fields", "value": "files(id, name, mimeType, parents)"},
        {"name": "supportsAllDrives", "value": "true"},
        {"name": "includeItemsFromAllDrives", "value": "true"}]},
     "options": {}},
    [1540, 1100], 4.2, CRED_GOOGLE)

add_node("Pilih Video Acak", "n8n-nodes-base.code",
    {"jsCode": "const files = items[0].json.files;\nif (!files || files.length === 0) { return []; }\nconst pick = files[Math.floor(Math.random() * files.length)];\nreturn [{ json: pick }];"},
    [1760, 1100], 2)

add_node("Unduh Video", "n8n-nodes-base.googleDrive",
    {"operation": "download", "fileId": {"__rl": True, "mode": "id", "value": "={{ $json.id }}"}, "options": {}},
    [1980, 1100], 3, CRED_GDRIVE)

add_node("Upload Cloudinary", "n8n-nodes-cloudinary.cloudinary",
    {"operation": "uploadFile", "resource_type_file": "video", "additionalFieldsFile": {}},
    [2200, 1100], 2, CRED_CLOUDINARY)

add_node("Siapkan Prompt Caption", "n8n-nodes-base.set",
    {"assignments": {"assignments": [
        {"id": "1", "name": "prompt", "value": "={{ $('Set Data Akun').item.json.promptTemplate || 'Buat satu caption singkat gaya hidup sehari-hari, maksimal 25 kata, tanpa menjelaskan isi video, tambahkan 3 hashtag relevan.' }}", "type": "string"}
    ]}, "options": {}},
    [2420, 1100], 3.4)

add_node("Buat Caption AI", "n8n-nodes-base.httpRequest",
    {"method": "POST", "url": "={{ $('Set Data Akun').item.json.aiEndpoint }}",
     "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth",
     "sendBody": True, "bodyParameters": {"parameters": [
        {"name": "model", "value": "={{ $('Set Data Akun').item.json.aiModel }}"},
        {"name": "messages", "value": "={{ [{role:'user', content: $json.prompt}] }}"}]},
     "options": {}},
    [2640, 1100], 4.4, CRED_BEARER)

add_node("Simpan Data Upload", "n8n-nodes-base.airtable",
    {"operation": "create", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_UPLOAD, "mode": "id"},
     "columns": {"mappingMode": "defineBelow", "value": {
        "Name": "={{ $('Pilih Video Acak').item.json.name }}",
        "FileID": "={{ $('Pilih Video Acak').item.json.id }}",
        "URL": "={{ $('Upload Cloudinary').item.json.secure_url }}",
        "caption": "={{ $json.choices[0].message.content }}",
        "NamaAkun": "={{ $('Set Data Akun').item.json.namaAkun }}",
        "Status": "Publishing",
        "PostedAt": "={{ $now.toISO() }}"}, "schema": []}, "options": {}},
    [2860, 1100], 2.1, CRED_AIRTABLE)

add_node("Buat Container Instagram", "n8n-nodes-base.facebookGraphApi",
    {"httpRequestMethod": "POST", "graphApiVersion": "v25.0",
     "node": "={{ $('Set Data Akun').item.json.businessId }}", "edge": "media",
     "options": {"queryParameters": {"parameter": [
        {"name": "video_url", "value": "={{ $('Simpan Data Upload').item.json.fields.URL }}"},
        {"name": "media_type", "value": "REELS"},
        {"name": "caption", "value": "={{ $('Simpan Data Upload').item.json.fields.caption }}"}]}}},
    [3080, 1100], 1, CRED_FB)

add_node("Cek Status Container", "n8n-nodes-base.facebookGraphApi",
    {"httpRequestMethod": "GET", "graphApiVersion": "v25.0",
     "node": "={{ $('Buat Container Instagram').item.json.id }}", "edge": "",
     "options": {"queryParameters": {"parameter": [{"name": "fields", "value": "status_code"}]}}},
    [3300, 1100], 1, CRED_FB)

add_node("Tunggu Polling", "n8n-nodes-base.wait", {"amount": 15, "unit": "seconds"}, [3300, 1300], 1.1)

add_node("Router Status Container", "n8n-nodes-base.switch",
    {"mode": "rules", "rules": {"values": [
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "1", "leftValue": "={{ $json.status_code }}", "rightValue": "FINISHED",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Selesai"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"id": "2", "leftValue": "={{ $json.status_code }}", "rightValue": "ERROR",
                "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
         "renameOutput": True, "outputKey": "Error"},
    ]}, "options": {"fallbackOutput": "extra"}},
    [3520, 1100], 3.2)

add_node("Publikasikan Reels", "n8n-nodes-base.facebookGraphApi",
    {"httpRequestMethod": "POST", "graphApiVersion": "v25.0",
     "node": "={{ $('Set Data Akun').item.json.businessId }}", "edge": "media_publish",
     "options": {"queryParameters": {"parameter": [
        {"name": "creation_id", "value": "={{ $('Buat Container Instagram').item.json.id }}"}]}}},
    [3740, 1100], 1, CRED_FB)

add_node("Update Status Published", "n8n-nodes-base.airtable",
    {"operation": "update", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_UPLOAD, "mode": "id"},
     "columns": {"mappingMode": "defineBelow", "matchingColumns": ["id"], "value": {
        "id": "={{ $('Simpan Data Upload').item.json.id }}",
        "Status": "Completed",
        "InstagramMediaID": "={{ $json.id }}"}, "schema": []}, "options": {}},
    [3960, 1100], 2.1, CRED_AIRTABLE)

add_node("Pindahkan ke Arsip", "n8n-nodes-base.httpRequest",
    {"method": "PATCH", "url": "={{ 'https://www.googleapis.com/drive/v3/files/' + $('Pilih Video Acak').item.json.id }}",
     "authentication": "predefinedCredentialType", "nodeCredentialType": "googleOAuth2Api",
     "sendQuery": True, "queryParameters": {"parameters": [
        {"name": "addParents", "value": "={{ $('Set Data Akun').item.json.folderArsip }}"},
        {"name": "removeParents", "value": "={{ $('Set Data Akun').item.json.folderSumber }}"},
        {"name": "fields", "value": "id,name,parents,webViewLink"}]},
     "options": {}},
    [4180, 1100], 4.2, CRED_GOOGLE)

add_node("Hapus File Cloudinary", "n8n-nodes-cloudinary.cloudinary",
    {"resource": "asset", "operation": "deleteAssets",
     "publicIds": "={{ $('Upload Cloudinary').item.json.public_id }}",
     "resourceType": "video", "deleteOptions": {}},
    [4400, 1100], 2, CRED_CLOUDINARY)

add_node("Kirim Laporan Sukses", "n8n-nodes-base.telegram",
    {"chatId": ADMIN_CHAT_ID,
     "text": "=\u2705 <b>INSTAGRAM REELS AUTOMATION</b>\n\n\U0001F464 Akun: {{ $('Set Data Akun').item.json.namaAkun }}\n\U0001F3AC Video: {{ $('Pilih Video Acak').item.json.name }}\n\U0001F4DD Caption: {{ $('Simpan Data Upload').item.json.fields.caption }}\n\U0001F4CC Status: Published\n\U0001F194 Execution ID: {{ $execution.id }}\n\u23F0 Selesai: {{ $now.format('dd MMM yyyy \u2022 HH:mm:ss') }}",
     "additionalFields": {"parse_mode": "HTML"},
     "replyMarkup": "inlineKeyboard",
     "inlineKeyboard": {"rows": [
        {"row": {"buttons": [{"text": "\U0001F4F8 Lihat Reels", "additionalFields": {"url": "={{ 'https://instagram.com/reel/' + $('Update Status Published').item.json.fields.InstagramMediaID }}"}}]}},
        {"row": {"buttons": [{"text": "\U0001F5C4\uFE0F Lihat Airtable", "additionalFields": {"url": "https://airtable.com/" + BASE_ID}}]}},
        {"row": {"buttons": [{"text": "\U0001F680 Upload Lagi", "additionalFields": {"callback_data": "upload_now"}}]}},
     ]}},
    [4620, 1100], 1.2, CRED_TELEGRAM)

add_node("Selesai", "n8n-nodes-base.noOp", {}, [4840, 1100], 1)

add_node("Error Trigger", "n8n-nodes-base.errorTrigger", {}, [660, 1620], 1)

add_node("Update Status Gagal", "n8n-nodes-base.airtable",
    {"operation": "update", "base": {"__rl": True, "value": BASE_ID, "mode": "id"},
     "table": {"__rl": True, "value": TBL_UPLOAD, "mode": "id"},
     "columns": {"mappingMode": "defineBelow", "matchingColumns": ["id"], "value": {
        "id": "={{ $('Simpan Data Upload') ? $('Simpan Data Upload').item.json.id : '' }}",
        "Status": "Failed",
        "ErrorMessage": "={{ $json.execution ? $json.execution.error.message : $json.error?.message || 'Unknown error' }}"},
        "schema": []}, "options": {}},
    [880, 1620], 2.1, CRED_AIRTABLE)

add_node("Kirim Laporan Gagal", "n8n-nodes-base.telegram",
    {"chatId": ADMIN_CHAT_ID,
     "text": "=\u274C <b>WORKFLOW GAGAL</b>\n\n\u26A0\uFE0F Error: {{ $json.execution ? $json.execution.error.message : ($json.error?.message || 'Terjadi kesalahan') }}\n\U0001F194 Execution ID: {{ $execution.id }}\n\u23F0 Waktu: {{ $now.format('dd MMM yyyy \u2022 HH:mm:ss') }}",
     "additionalFields": {"parse_mode": "HTML"},
     "replyMarkup": "inlineKeyboard",
     "inlineKeyboard": {"rows": [
        {"row": {"buttons": [{"text": "\U0001F501 Retry", "additionalFields": {"callback_data": "upload_now"}},
                              {"text": "\U0001F50D Lihat Error", "additionalFields": {"url": "https://airtable.com/" + BASE_ID}}]}}
     ]}},
    [1100, 1620], 1.2, CRED_TELEGRAM)

connect("Jadwal Otomatis", "Mode Otomatis")
connect("Mode Otomatis", "Ambil Akun Aktif")

connect("Telegram Masuk", "Cek Perintah Menu")
connect("Cek Perintah Menu", "Menu Utama", 0, 0)
connect("Cek Perintah Menu", "Cek Aktivasi Akun", 1, 0)

connect("Cek Aktivasi Akun", "Aktifkan Akun", 0, 0)
connect("Cek Aktivasi Akun", "Router Menu", 1, 0)
connect("Aktifkan Akun", "Konfirmasi Aktivasi")

connect("Router Menu", "Mode Manual", 0, 0)
connect("Router Menu", "Kirim Info Scheduler", 1, 0)
connect("Router Menu", "Ambil Antrian", 2, 0)
connect("Router Menu", "Ambil Semua Akun", 3, 0)
connect("Router Menu", "Kirim Instruksi Tambah Akun", 4, 0)
connect("Router Menu", "Ambil Akun Untuk Ganti", 5, 0)
connect("Router Menu", "Ambil Statistik", 6, 0)
connect("Router Menu", "Ambil Riwayat", 7, 0)
connect("Router Menu", "Kirim Pengaturan", 8, 0)
connect("Router Menu", "Kirim Status Server", 9, 0)
connect("Router Menu", "Kirim Tentang", 10, 0)

connect("Mode Manual", "Ambil Akun Aktif")

connect("Ambil Semua Akun", "Format Daftar Akun")
connect("Format Daftar Akun", "Kirim Daftar Akun")

connect("Ambil Akun Untuk Ganti", "Kirim Pilihan Akun")

connect("Ambil Antrian", "Kirim Antrian")

connect("Ambil Statistik", "Hitung Statistik")
connect("Hitung Statistik", "Kirim Statistik")

connect("Ambil Riwayat", "Kirim Riwayat")

connect("Ambil Akun Aktif", "Set Data Akun")
connect("Set Data Akun", "Cek Antrian Berjalan")
connect("Cek Antrian Berjalan", "IF Ada Proses Berjalan")
connect("IF Ada Proses Berjalan", "Kirim Info Sedang Proses", 0, 0)
connect("IF Ada Proses Berjalan", "Ambil Daftar Video", 1, 0)
connect("Ambil Daftar Video", "Pilih Video Acak")
connect("Pilih Video Acak", "Unduh Video")
connect("Unduh Video", "Upload Cloudinary")
connect("Upload Cloudinary", "Siapkan Prompt Caption")
connect("Siapkan Prompt Caption", "Buat Caption AI")
connect("Buat Caption AI", "Simpan Data Upload")
connect("Simpan Data Upload", "Buat Container Instagram")
connect("Buat Container Instagram", "Cek Status Container")
connect("Cek Status Container", "Router Status Container")
connect("Router Status Container", "Publikasikan Reels", 0, 0)
connect("Router Status Container", "Update Status Gagal", 1, 0)
connect("Router Status Container", "Tunggu Polling", 2, 0)
connect("Tunggu Polling", "Cek Status Container")
connect("Publikasikan Reels", "Update Status Published")
connect("Update Status Published", "Pindahkan ke Arsip")
connect("Pindahkan ke Arsip", "Hapus File Cloudinary")
connect("Hapus File Cloudinary", "Kirim Laporan Sukses")
connect("Kirim Laporan Sukses", "Selesai")

connect("Update Status Gagal", "Kirim Laporan Gagal")
connect("Error Trigger", "Update Status Gagal")

workflow = {
    "name": "Instagram Reels Automation - Multi Akun 2026",
    "nodes": nodes,
    "connections": connections,
    "pinData": {},
    "settings": {"executionOrder": "v1"},
    "meta": {"templateCredsSetupCompleted": True, "instanceId": "c2f7fc800e8f942e459a536a1c35644e54d007b227caebbcad93db95243301c4"}
}

with open("instagram_reels_automation_multi_akun.json", "w", encoding="utf-8") as f:
    json.dump(workflow, f, ensure_ascii=False, indent=2)

print("OK - nodes:", len(nodes))