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
      </div>
    </div>
  );
}