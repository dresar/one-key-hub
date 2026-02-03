import { motion } from 'framer-motion';
import { BookOpen, RotateCcw, TestTube, Bell, BarChart3, Key, Zap, ArrowRight } from 'lucide-react';
import AppHeader from '@/components/AppHeader';

export default function Documentation() {
  return (
    <div className="min-h-screen">
      <AppHeader title="Dokumentasi" subtitle="Panduan penggunaan One Key" />
      
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        {/* Introduction */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Tentang One Key</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            One Key adalah sistem manajemen API key untuk AI yang memungkinkan Anda menyatukan 
            banyak API key dari berbagai provider (Gemini, Groq, OpenAI, dll) ke dalam satu endpoint. 
            Sistem ini secara otomatis melakukan rotasi API key ketika terjadi error atau quota habis.
          </p>
        </motion.section>

        {/* Auto Rotation */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-xl font-bold">Cara Kerja Auto-Rotasi API Key</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p className="leading-relaxed">
              Sistem rotasi bekerja dengan prinsip <strong className="text-foreground">fail-fast dan auto-fallback</strong>:
            </p>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
                <div>
                  <strong className="text-foreground">Request Masuk</strong>
                  <p className="text-sm">Sistem memilih API key dengan prioritas tertinggi yang aktif dan sehat (tanpa error).</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
                <div>
                  <strong className="text-foreground">Jika Berhasil</strong>
                  <p className="text-sm">Counter sukses bertambah, error counter di-reset, API key tetap di prioritas tinggi.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning text-warning-foreground text-xs font-bold shrink-0">3</span>
                <div>
                  <strong className="text-foreground">Jika Gagal (429 / 401 / 5xx)</strong>
                  <p className="text-sm">
                    API key langsung <strong>diturunkan ke prioritas paling rendah</strong>, 
                    lalu sistem <strong>otomatis mencoba API key berikutnya</strong> tanpa delay.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold shrink-0">4</span>
                <div>
                  <strong className="text-foreground">Fallback Provider</strong>
                  <p className="text-sm">
                    Jika semua API key dalam satu provider habis, sistem otomatis beralih ke provider 
                    berikutnya sesuai strategi rotasi (per-provider atau global).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Test API Key */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <TestTube className="w-5 h-5 text-success" />
            </div>
            <h2 className="text-xl font-bold">Mekanisme Test API Key</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p className="leading-relaxed">
              Fitur test memungkinkan Anda memverifikasi apakah API key masih berfungsi tanpa 
              harus menunggu request sebenarnya gagal:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 mt-1 text-primary shrink-0" />
                <span>Klik tombol <strong className="text-foreground">Play</strong> pada API key di halaman API Key Provider</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-1 text-primary shrink-0" />
                <span>Sistem mengirim request test singkat ke provider dengan model yang dipilih</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-1 text-primary shrink-0" />
                <span>Hasil test ditampilkan langsung: ✅ Berhasil, ⚠️ Quota Habis, atau ❌ Invalid</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-1 text-primary shrink-0" />
                <span>Status API key diperbarui secara realtime di database dan UI</span>
              </li>
            </ul>
          </div>
        </motion.section>

        {/* Realtime Notifications */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-warning" />
            </div>
            <h2 className="text-xl font-bold">Sistem Notifikasi Realtime</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p className="leading-relaxed">
              Notifikasi muncul otomatis sebagai toast ketika:
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <strong className="text-destructive">❌ API Key Gagal</strong>
                <p className="text-sm mt-1">Notifikasi error dengan pesan dari provider</p>
              </div>
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <strong className="text-warning">⚠️ Quota Habis</strong>
                <p className="text-sm mt-1">Notifikasi ketika API key mencapai limit</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <strong className="text-primary">🔄 Fallback Terjadi</strong>
                <p className="text-sm mt-1">Notifikasi saat sistem beralih ke key/provider lain</p>
              </div>
              <div className="p-3 rounded-lg bg-muted border border-border">
                <strong className="text-foreground">ℹ️ Status Berubah</strong>
                <p className="text-sm mt-1">Notifikasi saat API key diaktifkan/nonaktifkan</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Usage Charts */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Cara Membaca Grafik Penggunaan</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p className="leading-relaxed">
              Grafik di Dashboard menampilkan statistik penggunaan API:
            </p>
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-success shrink-0" />
                <span><strong className="text-foreground">Hijau:</strong> Request yang berhasil</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-destructive shrink-0" />
                <span><strong className="text-foreground">Merah:</strong> Request yang gagal</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 mt-4">
              <p className="text-sm">
                <strong className="text-foreground">Tips:</strong> Gunakan mode <strong>Mingguan</strong> untuk 
                monitoring harian dan mode <strong>Bulanan</strong> untuk analisis trend jangka panjang.
                Success rate yang sehat adalah di atas 95%.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Status Indicators */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Key className="w-5 h-5 text-foreground" />
            </div>
            <h2 className="text-xl font-bold">Indikator Status API Key</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p className="leading-relaxed">
              Setiap API key menampilkan status visual:
            </p>
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/30">
                <span className="w-3 h-3 rounded-full bg-success" />
                <div>
                  <strong className="text-success">🟢 Aktif</strong>
                  <p className="text-sm">API key berfungsi normal, tidak ada error</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <span className="w-3 h-3 rounded-full bg-warning" />
                <div>
                  <strong className="text-warning">🟡 Hampir Habis</strong>
                  <p className="text-sm">Quota mendekati limit atau ada beberapa error (rate limit)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <span className="w-3 h-3 rounded-full bg-destructive pulse-dot" />
                <div>
                  <strong className="text-destructive">🔴 Error</strong>
                  <p className="text-sm">API key invalid, expired, atau quota habis total</p>
                </div>
              </div>
            </div>
            <p className="text-sm mt-4 p-3 rounded-lg bg-muted">
              <strong className="text-foreground">Catatan:</strong> API key dengan status 🔴 Error 
              otomatis dipindahkan ke urutan paling akhir dalam rotasi.
            </p>
          </div>
        </motion.section>
        {/* n8n Integration */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
              <Workflow className="w-5 h-5 text-pink-500" />
            </div>
            <h2 className="text-xl font-bold">Integrasi n8n</h2>
          </div>
          
          <div className="space-y-6 text-muted-foreground">
            <p className="leading-relaxed">
              Gunakan One Key Hub langsung di dalam workflow automation Anda. 
              Berikut adalah konfigurasi node HTTP Request yang siap pakai.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-secondary/30 space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    Konfigurasi Cepat
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Method</span>
                      <code className="bg-secondary px-2 py-0.5 rounded text-foreground">POST</code>
                    </div>
                    <div className="flex justify-between">
                      <span>URL</span>
                      <code className="bg-secondary px-2 py-0.5 rounded text-foreground text-xs">https://one.apprentice.cyou/api/v1...</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Auth Type</span>
                      <code className="bg-secondary px-2 py-0.5 rounded text-foreground">Header Auth</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Header</span>
                      <code className="bg-secondary px-2 py-0.5 rounded text-foreground">Authorization: Bearer sk-...</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-blue-500" />
                    Copy-Paste Node JSON
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2"
                    onClick={() => copyToClipboard(n8nNodeJson, 'n8n-json')}
                  >
                    {copiedId === 'n8n-json' ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedId === 'n8n-json' ? 'Disalin!' : 'Salin JSON'}
                  </Button>
                </div>
                <div className="relative rounded-lg overflow-hidden border border-border bg-slate-950">
                  <pre className="p-4 text-xs font-mono text-slate-50 overflow-auto h-[180px]">
                    {n8nNodeJson}
                  </pre>
                  <div className="absolute inset-0 pointer-events-none shadow-[inset_0_-20px_20px_-10px_rgba(0,0,0,0.5)]" />
                </div>
                <p className="text-xs">
                  *Salin JSON di atas dan paste langsung (Ctrl+V) ke canvas n8n untuk membuat node otomatis.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}