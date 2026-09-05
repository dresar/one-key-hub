import { useState, useEffect, useRef } from "react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, UploadCloud, RefreshCw, X, Image as ImageIcon, Download, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import api from "@/services/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function RemoveBgTest() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCredentials = async () => {
    try {
      const { data } = await api.get("/api/credentials");
      const list = data?.items || data || [];
      const removebgCreds = list.filter((c: any) => c.provider_name === "removebg" && c.status === "active");
      setCredentials(removebgCreds);
      if (removebgCreds.length > 0) {
        setSelectedCredentialId(String(removebgCreds[0].id));
      }
    } catch (err) {
      console.error("Failed to load credentials", err);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (JPEG/PNG)");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 12MB");
      return;
    }
    setSelectedFile(file);
    setResultImage(null);
    const reader = new FileReader();
    reader.onloadend = () => setFilePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleProcess = async () => {
    if (!selectedFile || !filePreview || !selectedCredentialId) {
      toast.error("Pilih gambar dan akun target terlebih dahulu");
      return;
    }
    setIsProcessing(true);
    try {
      const payload = {
        method: "POST",
        path: "/v1.0/removebg",
        body: {
          image_file_b64: filePreview,
          size: "auto"
        }
      };

      const response = await api.post(`/gateway/removebg/proxy`, payload, {
        headers: {
          "X-Credential-ID": selectedCredentialId
        },
        responseType: "blob"
      });

      const blob = new Blob([response.data], { type: "image/png" });
      const objectUrl = URL.createObjectURL(blob);
      setResultImage(objectUrl);
      toast.success("Latar belakang berhasil dihapus!");
    } catch (err: any) {
      console.error("Removebg error:", err);
      toast.error("Gagal menghapus latar belakang. Pastikan API key valid dan memiliki kuota.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement("a");
    link.href = resultImage;
    link.download = `removebg-${selectedFile?.name.split(".")[0] || "image"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setResultImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen pb-10">
      {/* Checkerboard Pattern Inline CSS */}
      <style>{`
        .checkerboard-pattern {
          background-color: #eaeef6;
          background-image: 
            linear-gradient(45deg, #cbd5e1 25%, transparent 25%), 
            linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #cbd5e1 75%), 
            linear-gradient(-45deg, transparent 75%, #cbd5e1 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        .dark .checkerboard-pattern {
          background-color: #0f172a;
          background-image: 
            linear-gradient(45deg, #1e293b 25%, transparent 25%), 
            linear-gradient(-45deg, #1e293b 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #1e293b 75%), 
            linear-gradient(-45deg, transparent 75%, #1e293b 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>

      <AppHeader
        title="Background Remover AI"
        subtitle="Hapus latar belakang gambar secara instan menggunakan kecerdasan buatan remove.bg"
      />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-secondary/15 border border-border/40 p-4 rounded-2xl">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full md:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-80">
              <Label className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-primary" /> Akun Remove.bg:
              </Label>
              <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId}>
                <SelectTrigger className="bg-background/50 border-border/40 text-sm rounded-xl h-9">
                  <SelectValue placeholder="Pilih akun..." />
                </SelectTrigger>
                <SelectContent>
                  {credentials.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.label || `Remove.bg #${c.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto shrink-0">
            {credentials.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl font-medium">
                <AlertTriangle className="w-4 h-4" />
                Tambahkan akun Remove.bg di Providers
              </div>
            )}
            <Button
              variant="outline"
              onClick={fetchCredentials}
              className="flex-1 md:flex-none flex items-center gap-2 bg-secondary/20 hover:bg-secondary/40 border-border/50 h-10 px-4 rounded-xl"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Akun
            </Button>
          </div>
        </div>

        {/* Comparative Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side: Upload / Original */}
          <div className="bg-card border border-border/60 p-5 rounded-2xl flex flex-col justify-between min-h-[460px]">
            <div>
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" /> Gambar Asli
              </h3>

              {!filePreview ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl h-[320px] flex flex-col items-center justify-center text-center p-6 cursor-pointer transition-all duration-300 ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[0.98]"
                      : "border-border/60 hover:border-primary/50 hover:bg-secondary/10"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <UploadCloud className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-medium text-sm">Seret gambar di sini atau klik untuk browse</p>
                  <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                    Mendukung format PNG atau JPEG (maksimal 12MB).
                  </p>
                </div>
              ) : (
                <div className="relative border border-border/40 rounded-xl overflow-hidden bg-secondary/15 h-[320px] flex items-center justify-center p-4">
                  <img
                    src={filePreview}
                    alt="Original Preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                  />
                  <button
                    onClick={handleReset}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {filePreview && (
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleProcess}
                  disabled={isProcessing || !selectedCredentialId}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl h-11 font-bold flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isProcessing ? "Memproses..." : "Hapus Latar Belakang"}
                </Button>
                <Button variant="outline" onClick={handleReset} className="rounded-xl h-11 px-5 border-border/50">
                  Batal
                </Button>
              </div>
            )}
          </div>

          {/* Right Side: Result */}
          <div className="bg-card border border-border/60 p-5 rounded-2xl flex flex-col justify-between min-h-[460px]">
            <div>
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" /> Hasil Transparent
              </h3>

              {!resultImage ? (
                <div className="border border-border/30 rounded-xl h-[320px] bg-secondary/10 flex flex-col items-center justify-center text-center p-6 text-muted-foreground/40">
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                      <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <p className="text-sm font-medium">Sedang menghapus latar belakang...</p>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="w-16 h-16 text-muted-foreground/20 mb-3" />
                      <p className="text-sm">Hasil transparent akan ditampilkan di sini</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative border border-border/40 rounded-xl overflow-hidden checkerboard-pattern h-[320px] flex items-center justify-center p-4">
                  <img
                    src={resultImage}
                    alt="Transparent Result"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>

            {resultImage && (
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleDownload}
                  className="flex-1 bg-accent hover:bg-accent/90 text-white rounded-xl h-11 font-bold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Unduh Gambar PNG
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
