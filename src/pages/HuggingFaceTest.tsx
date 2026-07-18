import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, RefreshCw, AlertTriangle, Play, Loader2, MessageSquare, Image as ImageIcon, Volume2, Sparkles, Download, Copy, Check } from "lucide-react";
import api, { API_URL } from "@/services/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const POPULAR_MODELS = {
  text: [
    { id: "Qwen/Qwen2.5-72B-Instruct", name: "Qwen 2.5 72B Instruct (Highly Recommended)" },
    { id: "meta-llama/Llama-3.2-3B-Instruct", name: "Llama 3.2 3B Instruct (Fast)" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3", name: "Mistral 7B Instruct v0.3" }
  ],
  image: [
    { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell (Realistic & Fast)" },
    { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "Stable Diffusion XL 1.0" }
  ],
  audio: [
    { id: "facebook/mms-tts-eng", name: "Facebook MMS Text-to-Speech English" },
    { id: "espnet/kan-bayashi_ljspeech_vits", name: "LJSpeech VITS (High Quality)" }
  ]
};

export default function HuggingFaceTest() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [task, setTask] = useState<"text" | "image" | "audio">("text");
  
  const [modelId, setModelId] = useState(POPULAR_MODELS.text[0].id);
  const [customModelId, setCustomModelId] = useState("");
  const [isCustomModel, setIsCustomModel] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Results
  const [textResult, setTextResult] = useState("");
  const [imageResultUrl, setImageResultUrl] = useState("");
  const [audioResultUrl, setAudioResultUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchCredentials = async () => {
    try {
      const { data } = await api.get("/api/credentials");
      const list = data?.items || data || [];
      const hfCreds = list.filter((c: any) => c.provider_name === "huggingface" && c.status === "active");
      setCredentials(hfCreds);
      if (hfCreds.length > 0) {
        setSelectedCredentialId(String(hfCreds[0].id));
      }
    } catch (err) {
      console.error("Failed to load credentials", err);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  // Update default model when task changes
  useEffect(() => {
    setIsCustomModel(false);
    setCustomModelId("");
    setModelId(POPULAR_MODELS[task][0].id);
  }, [task]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(textResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Teks berhasil disalin!");
    } catch {
      toast.error("Gagal menyalin teks");
    }
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredentialId) {
      toast.error("Pilih kredensial Hugging Face terlebih dahulu");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Prompt tidak boleh kosong");
      return;
    }

    const activeModel = isCustomModel ? customModelId.trim() : modelId;
    if (!activeModel) {
      toast.error("Model ID tidak boleh kosong");
      return;
    }

    setIsLoading(true);
    setTextResult("");
    // Revoke old object URLs to prevent memory leaks
    if (imageResultUrl) URL.revokeObjectURL(imageResultUrl);
    if (audioResultUrl) URL.revokeObjectURL(audioResultUrl);
    setImageResultUrl("");
    setAudioResultUrl("");

    try {
      const targetUrl = `${API_URL}/gateway/huggingface/proxy/models/${activeModel}`;
      
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("jwt_token") || ""}`,
          "X-Credential-ID": selectedCredentialId
        },
        body: JSON.stringify({
          inputs: prompt
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `HTTP ${response.status}`;
        try {
          const parsedErr = JSON.parse(errText);
          errMsg = parsedErr.error || parsedErr.message || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("image/")) {
        const blob = await response.blob();
        const localUrl = URL.createObjectURL(blob);
        setImageResultUrl(localUrl);
        toast.success("Gambar berhasil digenerasikan!");
      } else if (contentType.includes("audio/")) {
        const blob = await response.blob();
        const localUrl = URL.createObjectURL(blob);
        setAudioResultUrl(localUrl);
        toast.success("Audio berhasil disintesis!");
      } else {
        // Text / JSON response
        const data = await response.json();
        let textVal = "";
        if (Array.isArray(data)) {
          textVal = data[0]?.generated_text || JSON.stringify(data, null, 2);
        } else {
          textVal = data?.generated_text || JSON.stringify(data, null, 2);
        }
        setTextResult(textVal);
        toast.success("Respons teks berhasil diterima!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gagal memproses request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-10">
      <AppHeader
        title="Hugging Face Playground"
        subtitle="Uji coba bebas model Text, Image (Flux/SDXL), dan Audio (TTS) Hugging Face menggunakan token Anda lewat Gateway"
      />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Configurations Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Setup */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass rounded-xl p-5 md:p-6 space-y-5">
              <h2 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-primary" /> Setup Model
              </h2>

              <div className="space-y-4">
                {/* Credentials */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Akun Hugging Face</Label>
                  <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId}>
                    <SelectTrigger className="bg-background/50 border-border/40 text-sm h-10 rounded-xl">
                      <SelectValue placeholder="Pilih akun..." />
                    </SelectTrigger>
                    <SelectContent>
                      {credentials.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.label || `Hugging Face #${c.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {credentials.length === 0 && (
                    <p className="text-[11px] text-amber-500 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" /> Tambahkan token Hugging Face di menu Provider Keys
                    </p>
                  )}
                </div>

                {/* Task Selection */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Pilih Tipe Task</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTask("text")}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-center transition-all ${
                        task === "text"
                          ? "bg-primary/10 border-primary text-primary font-semibold"
                          : "bg-background/40 border-border/40 hover:bg-secondary/30 text-muted-foreground"
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 mb-1" />
                      <span className="text-[10px]">Text Gen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTask("image")}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-center transition-all ${
                        task === "image"
                          ? "bg-primary/10 border-primary text-primary font-semibold"
                          : "bg-background/40 border-border/40 hover:bg-secondary/30 text-muted-foreground"
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 mb-1" />
                      <span className="text-[10px]">Image Gen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTask("audio")}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-center transition-all ${
                        task === "audio"
                          ? "bg-primary/10 border-primary text-primary font-semibold"
                          : "bg-background/40 border-border/40 hover:bg-secondary/30 text-muted-foreground"
                      }`}
                    >
                      <Volume2 className="w-4 h-4 mb-1" />
                      <span className="text-[10px]">Speech Gen</span>
                    </button>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-muted-foreground">Model Hugging Face</Label>
                    <button
                      type="button"
                      onClick={() => setIsCustomModel(!isCustomModel)}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      {isCustomModel ? "Pilih Model Populer" : "Tulis Model Custom"}
                    </button>
                  </div>

                  {isCustomModel ? (
                    <Input
                      placeholder="e.g. Qwen/Qwen2.5-Coder-32B-Instruct"
                      value={customModelId}
                      onChange={(e) => setCustomModelId(e.target.value)}
                      className="bg-background/50 border-border/40 h-10 rounded-xl"
                    />
                  ) : (
                    <Select value={modelId} onValueChange={setModelId}>
                      <SelectTrigger className="bg-background/50 border-border/40 text-sm h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_MODELS[task].map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-[10px] text-muted-foreground italic">
                    Model: {isCustomModel ? customModelId || "(ketik model ID)" : modelId}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Playground Canvas (Prompt & Output) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-xl p-5 md:p-6 space-y-5 flex flex-col h-full min-h-[500px]">
              <form onSubmit={handleRun} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Input Prompt</Label>
                  <Textarea
                    placeholder={
                      task === "text"
                        ? "Jelaskan konsep machine learning dengan analogi sederhana..."
                        : task === "image"
                        ? "A highly detailed cinematic photo of a futuristic cyberpunk city with neon lights..."
                        : "Hello! Welcome to One Key Hub Hugging Face Text-to-Speech playground."
                    }
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="bg-background/50 border-border/40 rounded-xl min-h-[100px] resize-y text-sm"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={isLoading || !selectedCredentialId}
                    className="w-full md:w-auto px-6 h-10 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Memproses Model...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        Jalankan Model
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Output Section */}
              <div className="flex-1 flex flex-col border border-border/30 bg-secondary/10 rounded-xl p-4 min-h-[250px]">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hasil Output</span>
                  {textResult && (
                    <Button variant="ghost" size="sm" onClick={handleCopyText} className="h-8 gap-1.5 text-xs">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Disalin" : "Salin"}
                    </Button>
                  )}
                  {imageResultUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = imageResultUrl;
                        link.download = "generated-image.png";
                        link.click();
                      }}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh Gambar
                    </Button>
                  )}
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center text-center text-muted-foreground p-6"
                      >
                        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                        <p className="text-sm font-medium">Hugging Face sedang memuat & memproses model Anda...</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                          Model yang jarang digunakan mungkin membutuhkan waktu hingga 1-2 menit untuk loading cold start ke server Hugging Face.
                        </p>
                      </motion.div>
                    ) : textResult ? (
                      <motion.div
                        key="text"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full h-full"
                      >
                        <pre className="w-full text-xs font-mono bg-background/50 border border-border/30 p-4 rounded-lg overflow-auto max-h-[350px] whitespace-pre-wrap leading-relaxed text-foreground">
                          {textResult}
                        </pre>
                      </motion.div>
                    ) : imageResultUrl ? (
                      <motion.div
                        key="image"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center max-w-full"
                      >
                        <img
                          src={imageResultUrl}
                          alt="Hugging Face Generated"
                          className="max-h-[380px] object-contain rounded-lg border border-border/40 shadow-md"
                        />
                      </motion.div>
                    ) : audioResultUrl ? (
                      <motion.div
                        key="audio"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-4 text-center p-6 bg-background/40 border border-border/30 rounded-xl w-full max-w-md"
                      >
                        <Volume2 className="w-12 h-12 text-primary" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">Audio Berhasil Dihasilkan</p>
                          <p className="text-xs text-muted-foreground">Klik play pada pemutar audio di bawah ini</p>
                        </div>
                        <audio controls src={audioResultUrl} className="w-full mt-2" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center text-muted-foreground p-6"
                      >
                        <Play className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-sm font-medium">Siap Dijalankan</p>
                        <p className="text-xs text-muted-foreground max-w-xs mt-1">
                          Pilih model, masukkan prompt, lalu klik "Jalankan Model" untuk memulai.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
