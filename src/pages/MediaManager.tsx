import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Image as ImageIcon, UploadCloud, Copy, Check, ExternalLink,
  Trash2, RefreshCw, Key, HardDrive, AlertTriangle, X, ZoomIn, FilmIcon
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import api from "@/services/api";
import { toast } from "sonner";

interface MediaFile {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  size?: string;
  created_at?: string;
  provider: "cloudinary" | "imagekit" | "uploadcare" | "pexels" | "pixabay";
  isVideo?: boolean;
  format?: string;
}

export default function MediaManager() {
  const [activeTab, setActiveTab] = useState<"cloudinary" | "imagekit" | "uploadcare" | "pexels" | "pixabay">("cloudinary");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [cloudinaryPreset, setCloudinaryPreset] = useState("ml_default");
  const [searchQuery, setSearchQuery] = useState("nature");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [credentials, setCredentials] = useState<any[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [detailFile, setDetailFile] = useState<MediaFile | null>(null);

  // Dedicated Upload Target State
  const [uploadProvider, setUploadProvider] = useState<"cloudinary" | "imagekit" | "uploadcare">("cloudinary");
  const [uploadCredentialId, setUploadCredentialId] = useState<string>("");

  // Sync target credentials on provider change
  useEffect(() => {
    const providerCreds = credentials.filter(
      (c) => c.provider_name === uploadProvider
    );
    if (providerCreds.length > 0) {
      // Keep selected if still valid, otherwise default to first
      const stillValid = providerCreds.some(c => String(c.id) === uploadCredentialId);
      if (!stillValid) {
        setUploadCredentialId(String(providerCreds[0].id));
      }
    } else {
      setUploadCredentialId("");
    }
  }, [uploadProvider, credentials]);

  const openUploadModal = () => {
    let defaultUploadProvider = "cloudinary";
    const availableProviders = ["cloudinary", "imagekit", "uploadcare"];
    const firstAvailable = availableProviders.find(prov => 
      credentials.some(c => c.provider_name === prov && c.status === "active")
    );
    if (firstAvailable) {
      defaultUploadProvider = firstAvailable;
    }

    const targetProvider = (activeTab === "pexels" || activeTab === "pixabay") 
      ? defaultUploadProvider 
      : activeTab;
      
    setUploadProvider(targetProvider as any);
    
    const provCreds = credentials.filter(c => c.provider_name === targetProvider);
    if (provCreds.length > 0) {
      setUploadCredentialId(String(provCreds[0].id));
    } else {
      setUploadCredentialId("");
    }
    setIsUploadModalOpen(true);
  };

  const fetchCredentials = async () => {
    try {
      const { data } = await api.get("/api/credentials");
      const list = data?.items || data || [];
      setCredentials(list);
    } catch (err) {
      console.error("Error fetching credentials:", err);
    }
  };

  useEffect(() => { fetchCredentials(); }, []);

  const activeCredentials = credentials.filter(
    (c) => c.provider_name === activeTab
  );

  useEffect(() => {
    if (activeCredentials.length > 0) {
      const stillActive = activeCredentials.find((c) => String(c.id) === selectedCredentialId);
      if (!stillActive) setSelectedCredentialId(String(activeCredentials[0].id));
    } else {
      setSelectedCredentialId("");
      setFiles([]);
    }
  }, [activeTab, credentials]);

  useEffect(() => {
    if (selectedCredentialId) fetchFiles();
  }, [selectedCredentialId]);

  const fetchFiles = async () => {
    if (!selectedCredentialId) return;
    setIsLoading(true);
    setFiles([]);
    try {
      const provider = activeTab;
      const mappedFiles: MediaFile[] = [];
      const credHeaders = { "X-Credential-ID": selectedCredentialId };

      if (provider === "cloudinary") {
        const [resImg, resVid] = await Promise.all([
          api.post("/gateway/cloudinary/proxy", { method: "GET", path: "/resources/image" }, { headers: credHeaders })
            .catch(() => ({ data: { resources: [] } })),
          api.post("/gateway/cloudinary/proxy", { method: "GET", path: "/resources/video" }, { headers: credHeaders })
            .catch(() => ({ data: { resources: [] } })),
        ]);
        (resImg.data?.resources || []).forEach((r: any) => {
          mappedFiles.push({
            id: r.public_id,
            name: r.public_id.split("/").pop() || r.public_id,
            url: r.secure_url || r.url,
            thumbnailUrl: r.secure_url || r.url,
            size: `${(r.bytes / 1024).toFixed(1)} KB`,
            created_at: r.created_at,
            provider: "cloudinary",
            isVideo: false,
            format: r.format,
          });
        });
        (resVid.data?.resources || []).forEach((r: any) => {
          const thumbUrl = (r.secure_url || r.url).replace(/\.[^/.]+$/, ".jpg");
          mappedFiles.push({
            id: r.public_id,
            name: r.public_id.split("/").pop() || r.public_id,
            url: r.secure_url || r.url,
            thumbnailUrl: thumbUrl,
            size: `${(r.bytes / 1024).toFixed(1)} KB`,
            created_at: r.created_at,
            provider: "cloudinary",
            isVideo: true,
            format: r.format,
          });
        });
      } else if (provider === "uploadcare") {
        const response = await api.post(
          "/gateway/uploadcare/proxy",
          { method: "GET", path: "/files/" },
          { headers: credHeaders }
        );
        const data = response.data || {};
        const results = data.results || [];
        if (Array.isArray(results)) {
          results.forEach((f: any) => {
            const isVideo =
              f.mime_type?.startsWith("video/") ||
              (f.original_filename && f.original_filename.match(/\.(mp4|webm|ogg|mov|m4v|mkv)$/i));
            const fileUrl = `https://ucarecdn.com/${f.uuid}/`;
            const thumbnailUrl = isVideo
              ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300"
              : `${fileUrl}-/preview/300x300/-/quality/smart/-/format/auto/`;
            mappedFiles.push({
              id: f.uuid,
              name: f.original_filename || f.uuid,
              url: fileUrl,
              thumbnailUrl: thumbnailUrl,
              size: `${((f.size || 0) / 1024).toFixed(1)} KB`,
              created_at: f.datetime_uploaded,
              provider: "uploadcare",
              isVideo: !!isVideo,
              format: f.mime_type?.split("/").pop() || f.original_filename?.split(".").pop(),
            });
          });
        }
      } else if (provider === "pixabay") {
        const path = "/api/";
        const queryParams = searchQuery.trim()
          ? { q: searchQuery.trim(), per_page: 30 }
          : { q: "nature", per_page: 30 };
        const response = await api.post(
          "/gateway/pixabay/proxy",
          { method: "GET", path, queryParams },
          { headers: credHeaders }
        );
        const data = response.data || {};
        const hits = data.hits || [];
        if (Array.isArray(hits)) {
          hits.forEach((p: any) => {
            mappedFiles.push({
              id: String(p.id),
              name: p.tags || `Photo by ${p.user}`,
              url: p.largeImageURL || p.webformatURL,
              thumbnailUrl: p.webformatURL || p.previewURL,
              size: `${p.imageWidth}x${p.imageHeight}`,
              created_at: new Date().toISOString(),
              provider: "pixabay",
              isVideo: false,
              format: "jpg"
            });
          });
        }
      } else if (provider === "pexels") {
        const path = searchQuery.trim() ? "/v1/search" : "/v1/curated";
        const queryParams = searchQuery.trim()
          ? { query: searchQuery.trim(), per_page: 30 }
          : { per_page: 30 };
        const response = await api.post(
          "/gateway/pexels/proxy",
          { method: "GET", path, queryParams },
          { headers: credHeaders }
        );
        const data = response.data || {};
        const photos = data.photos || [];
        if (Array.isArray(photos)) {
          photos.forEach((p: any) => {
            mappedFiles.push({
              id: String(p.id),
              name: p.alt || `Photo by ${p.photographer}`,
              url: p.src?.original || p.url,
              thumbnailUrl: p.src?.large || p.src?.medium,
              size: `${p.width}x${p.height}`,
              created_at: new Date().toISOString(),
              provider: "pexels",
              isVideo: false,
              format: "jpg"
            });
          });
        }
      } else if (provider === "imagekit") {
        const response = await api.post(
          "/gateway/imagekit/proxy",
          { method: "GET", path: "/v1/files" },
          { headers: credHeaders }
        );
        const data = response.data || [];
        if (Array.isArray(data)) {
          data.forEach((f: any) => {
            const isVideo =
              f.fileType === "non-image" &&
              (f.name.match(/\.(mp4|webm|ogg|mov|m4v|mkv)$/i) ||
                f.filePath?.match(/\.(mp4|webm|ogg|mov|m4v|mkv)$/i));
            mappedFiles.push({
              id: f.fileId,
              name: f.name,
              url: f.url,
              thumbnailUrl: isVideo ? (f.thumbnail || f.url) : (f.thumbnailUrl || f.url),
              size: `${((f.size || 0) / 1024).toFixed(1)} KB`,
              created_at: f.createdAt,
              provider: "imagekit",
              isVideo: !!isVideo,
              format: f.name.split(".").pop(),
            });
          });
        }
      }
      setFiles(mappedFiles);
    } catch (error: any) {
      console.error("Fetch files error:", error);
      toast.error(`Gagal mengambil media: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setFilePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !filePreview || !uploadCredentialId) {
      toast.error("Pilih akun API target terlebih dahulu");
      return;
    }
    setIsUploading(true);
    try {
      const provider = uploadProvider;
      


      const isVideo = selectedFile.type.startsWith("video/");
      let body: any = {};
      if (provider === "cloudinary") {
        body = { file: filePreview, upload_preset: cloudinaryPreset };
      } else {
        body = { file: filePreview, fileName: selectedFile.name };
      }
      const payload = {
        method: "POST",
        path:
          provider === "cloudinary"
            ? isVideo ? "/video/upload" : "/image/upload"
            : provider === "uploadcare"
            ? "/base/"
            : "/v1/files/upload",
        body,
      };
      await api.post(`/gateway/${provider}/proxy`, payload, {
        headers: { "X-Credential-ID": uploadCredentialId },
      });
      toast.success("Media berhasil diunggah!");
      setSelectedFile(null);
      setFilePreview(null);
      setIsUploadModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      // Auto refresh if we uploaded to currently active tab's provider
      if (provider === activeTab) {
        fetchFiles();
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Gagal upload: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (file: MediaFile) => {
    if (!selectedCredentialId) return;
    if (file.provider === "pexels") {
      toast.error("Tidak dapat menghapus foto stok dari Pexels");
      return;
    }
    if (file.provider === "pixabay") {
      toast.error("Tidak dapat menghapus foto stok dari Pixabay");
      return;
    }
    if (!confirm(`Yakin ingin menghapus "${file.name}" dari ${file.provider}?`)) return;
    try {
      const provider = file.provider;
      let payload: any = {};


      if (provider === "cloudinary") {
        payload = {
          method: "DELETE",
          path: file.isVideo ? "/resources/video/upload" : "/resources/image/upload",
          queryParams: { "public_ids[]": file.id },
        };
      } else if (provider === "uploadcare") {
        payload = {
          method: "DELETE",
          path: `/files/${file.id}/`,
        };
      } else {
        payload = { method: "DELETE", path: `/v1/files/${file.id}` };
      }
      await api.post(`/gateway/${provider}/proxy`, payload, {
        headers: { "X-Credential-ID": selectedCredentialId },
      });
      toast.success("Media berhasil dihapus!");
      setDetailFile(null);
      fetchFiles();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(`Gagal menghapus: ${error.message}`);
    }
  };

  const handleCopyUrl = async (file: MediaFile) => {
    try {
      await navigator.clipboard.writeText(file.url);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("URL disalin ke clipboard!");
    } catch {
      toast.error("Gagal menyalin URL");
    }
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen pb-10">
      <AppHeader
        title="Media & File Manager"
        subtitle="Kelola gambar & video dari Cloudinary dan ImageKit — sinkronisasi otomatis dari akun Anda"
      />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="w-full">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 bg-secondary/15 border border-border/40 p-4 rounded-2xl">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full md:w-auto">
              {/* Provider Selection Dropdown */}
              <div className="flex items-center gap-2 w-full sm:w-56">
                <Label className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                  🌐 Provider:
                </Label>
                <Select value={activeTab || ""} onValueChange={(val: any) => setActiveTab(val)}>
                  <SelectTrigger className="bg-background/50 border-border/40 text-sm rounded-xl h-9">
                    <SelectValue placeholder="Pilih Provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cloudinary">☁️ Cloudinary</SelectItem>
                    <SelectItem value="imagekit">🖼️ ImageKit</SelectItem>
                    <SelectItem value="uploadcare">📦 Uploadcare</SelectItem>
                    <SelectItem value="pexels">🖼️ Pexels Stock</SelectItem>
                    <SelectItem value="pixabay">🖼️ Pixabay Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(activeTab === "pexels" || activeTab === "pixabay") && (
                <div className="flex items-center gap-2 w-full sm:w-60">
                  <Label className="text-xs text-muted-foreground shrink-0">Cari:</Label>
                  <Input
                    placeholder="Contoh: nature, space..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchFiles()}
                    className="bg-background/50 border-border/40 text-sm rounded-xl h-9"
                  />
                </div>
              )}

              {activeCredentials.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-72">
                  <Label className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-primary" /> Akun:
                  </Label>
                  <Select value={selectedCredentialId || ""} onValueChange={setSelectedCredentialId}>
                    <SelectTrigger className="bg-background/50 border-border/40 text-sm rounded-xl h-9">
                      <SelectValue placeholder="Pilih akun..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCredentials.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.label || `${c.provider_name} #${c.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-2 w-full md:w-auto shrink-0">
              <Button
                onClick={openUploadModal}
                className="flex-1 md:flex-none flex items-center gap-2 bg-primary hover:bg-primary/90 text-white h-10 px-5 rounded-xl font-semibold"
              >
                <UploadCloud className="w-4 h-4" />
                Upload Media
              </Button>
              <Button
                variant="outline"
                onClick={fetchFiles}
                disabled={isLoading || !selectedCredentialId}
                className="flex-1 md:flex-none flex items-center gap-2 bg-secondary/20 hover:bg-secondary/40 border-border/50 h-10 px-4 rounded-xl"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {activeCredentials.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-border/40 rounded-2xl bg-secondary/5 min-h-[350px]">
              <AlertTriangle className="w-14 h-14 text-amber-500 mb-4 opacity-80" />
              <h3 className="font-bold text-xl mb-2">
                Belum Ada Akun {activeTab === "cloudinary" ? "Cloudinary" : "ImageKit"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-5 leading-relaxed">
                Tambahkan kredensial {activeTab === "cloudinary" ? "Cloudinary" : "ImageKit"} Anda di halaman Providers terlebih dahulu.
              </p>
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/providers">⚙️ Konfigurasi di Providers</Link>
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Sinkronisasi media dari {activeTab}...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center gap-4 border-2 border-dashed border-border/30 rounded-2xl bg-secondary/5">
              <HardDrive className="w-16 h-16 text-muted-foreground/30" />
              <div>
                <h4 className="font-semibold text-lg">Galeri Kosong</h4>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Belum ada media ditemukan. Klik <strong>Upload Media</strong> untuk menambahkan file.
                </p>
              </div>
              <Button onClick={openUploadModal} className="rounded-xl">
                <UploadCloud className="w-4 h-4 mr-2" /> Upload Sekarang
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-primary" />
                  <span>
                    <strong className="text-foreground">{files.length}</strong> file &nbsp;·&nbsp;
                    {files.filter((f) => f.isVideo).length} video &nbsp;·&nbsp;
                    {files.filter((f) => !f.isVideo).length} gambar
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {files.map((file, idx) => (
                  <motion.div
                    key={file.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => setDetailFile(file)}
                    className="group relative rounded-xl overflow-hidden cursor-pointer border border-border/30 hover:border-primary/60 transition-all duration-300 bg-secondary/10 shadow-sm hover:shadow-xl hover:-translate-y-0.5 aspect-square"
                  >
                    <img
                      src={file.thumbnailUrl}
                      alt={file.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/300x300/1a1a2e/6366f1?text=Media";
                      }}
                    />

                    {file.isVideo && (
                      <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 pointer-events-none">
                        <FilmIcon className="w-2.5 h-2.5" /> VIDEO
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2">
                      <div className="flex items-center justify-center h-full">
                        {file.isVideo ? (
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/50 shadow-lg">
                            <svg className="w-5 h-5 text-white fill-white ml-0.5" viewBox="0 0 24 24">
                              <polygon points="5,3 19,12 5,21" />
                            </svg>
                          </div>
                        ) : (
                          <ZoomIn className="w-8 h-8 text-white/80 drop-shadow-lg" />
                        )}
                      </div>

                      <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleCopyUrl(file)}
                          className="w-7 h-7 rounded-lg bg-white/15 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center transition-colors"
                          title="Salin URL"
                        >
                          {copiedId === file.id ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-white" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          className="w-7 h-7 rounded-lg bg-red-500/70 backdrop-blur-sm hover:bg-red-500 flex items-center justify-center transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-[10px] text-white/90 truncate font-medium">{file.name}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeUploadModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30 bg-gradient-to-r from-primary/10 to-accent/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">Upload Media</h2>
                    <p className="text-xs text-muted-foreground">
                      ke {uploadProvider.charAt(0).toUpperCase() + uploadProvider.slice(1)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeUploadModal}
                  className="w-8 h-8 rounded-lg hover:bg-secondary/60 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Target Destination Selectors */}
                <div className="grid grid-cols-2 gap-3 bg-secondary/15 p-3.5 rounded-2xl border border-border/45">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Target Provider</Label>
                    <Select value={uploadProvider} onValueChange={(val: any) => setUploadProvider(val)}>
                      <SelectTrigger className="bg-background/50 border-border/40 text-xs rounded-xl h-8">
                        <SelectValue placeholder="Pilih target..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cloudinary">Cloudinary</SelectItem>
                        <SelectItem value="imagekit">ImageKit</SelectItem>
                        <SelectItem value="uploadcare">Uploadcare</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Akun Target</Label>
                    <Select value={uploadCredentialId} onValueChange={setUploadCredentialId}>
                      <SelectTrigger className="bg-background/50 border-border/40 text-xs rounded-xl h-8">
                        <SelectValue placeholder="Pilih akun..." />
                      </SelectTrigger>
                      <SelectContent>
                        {credentials
                          .filter((c) => c.provider_name === uploadProvider)
                          .map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.label || `${c.provider_name} #${c.id}`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {uploadProvider === "cloudinary" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Upload Preset (Unsigned)</Label>
                    <Input
                      placeholder="contoh: ml_default"
                      value={cloudinaryPreset}
                      onChange={(e) => setCloudinaryPreset(e.target.value)}
                      className="bg-secondary/30 border-border/40 text-sm h-9 rounded-xl"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Aktifkan <strong>Unsigned upload</strong> di dashboard Cloudinary terlebih dahulu.
                    </p>
                  </div>
                )}

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all min-h-[200px] flex flex-col items-center justify-center overflow-hidden group ${
                    isDragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border/50 hover:border-primary/60 bg-secondary/10 hover:bg-secondary/20"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*,video/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  {filePreview ? (
                    <div className="absolute inset-0 p-3">
                      {selectedFile?.type.startsWith("video/") ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <FilmIcon className="w-12 h-12 text-primary" />
                          <p className="text-sm font-semibold text-foreground truncate max-w-full px-4">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">Video siap diupload</p>
                        </div>
                      ) : (
                        <img src={filePreview} alt="Preview" className="w-full h-full object-contain rounded-xl" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                        <span className="text-sm text-white font-semibold bg-black/60 px-3 py-1.5 rounded-full">Ganti File</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-colors ${isDragging ? "bg-primary/20" : "bg-secondary/40 group-hover:bg-primary/15"}`}>
                        <UploadCloud className={`w-7 h-7 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {isDragging ? "Lepaskan file di sini" : "Klik atau drag & drop file"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Gambar: PNG, JPG, WEBP &nbsp;·&nbsp; Video: MP4, WEBM, MOV
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Maks. 100MB</p>
                    </>
                  )}
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-3 bg-secondary/20 border border-border/30 rounded-xl p-3 text-xs">
                    {selectedFile.type.startsWith("video/") ? (
                      <FilmIcon className="w-8 h-8 text-primary shrink-0" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-primary shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{selectedFile.name}</p>
                      <p className="text-muted-foreground mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &nbsp;·&nbsp; {selectedFile.type}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setFilePreview(null); }}
                      className="w-6 h-6 rounded-full bg-secondary/60 hover:bg-red-500/20 flex items-center justify-center transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 p-5 pt-0">
                <Button variant="outline" onClick={closeUploadModal} className="flex-1 rounded-xl">
                  Batal
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !selectedFile}
                  className="flex-1 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
                >
                  {isUploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mengunggah...</>
                  ) : (
                    <><UploadCloud className="w-4 h-4 mr-2" />Unggah Sekarang</>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setDetailFile(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${detailFile.isVideo ? "bg-purple-500/15" : "bg-blue-500/15"}`}>
                    {detailFile.isVideo ? (
                      <FilmIcon className="w-4 h-4 text-purple-400" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" title={detailFile.name}>{detailFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">{detailFile.size} &nbsp;·&nbsp; {detailFile.provider}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailFile(null)}
                  className="w-8 h-8 rounded-lg hover:bg-secondary/60 flex items-center justify-center transition-colors shrink-0 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-black/30 flex items-center justify-center min-h-[280px] max-h-[55vh]">
                {detailFile.isVideo ? (
                  <video
                    src={detailFile.url}
                    controls
                    className="w-full max-h-[55vh] object-contain"
                    style={{ outline: "none" }}
                  >
                    Browser Anda tidak mendukung pemutaran video.
                  </video>
                ) : (
                  <img
                    src={detailFile.url}
                    alt={detailFile.name}
                    className="w-full max-h-[55vh] object-contain p-3"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://placehold.co/600x400/1a1a2e/6366f1?text=Preview+Tidak+Tersedia";
                    }}
                  />
                )}
              </div>

              <div className="px-5 py-4 border-t border-border/30 space-y-3 shrink-0">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    readOnly
                    value={detailFile.url}
                    className="flex-1 bg-secondary/30 border border-border/40 rounded-xl px-3 py-2 text-xs text-muted-foreground font-mono truncate focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-secondary/20 rounded-xl p-2.5">
                    <p className="text-muted-foreground mb-0.5 text-[10px]">Ukuran</p>
                    <p className="font-semibold">{detailFile.size || "—"}</p>
                  </div>
                  <div className="bg-secondary/20 rounded-xl p-2.5">
                    <p className="text-muted-foreground mb-0.5 text-[10px]">Format</p>
                    <p className="font-semibold uppercase">{detailFile.format || detailFile.name.split(".").pop() || "—"}</p>
                  </div>
                  <div className="bg-secondary/20 rounded-xl p-2.5">
                    <p className="text-muted-foreground mb-0.5 text-[10px]">Tipe</p>
                    <p className="font-semibold">{detailFile.isVideo ? "🎬 Video" : "🖼️ Gambar"}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleCopyUrl(detailFile)}
                    className="flex-1 rounded-xl h-9 text-sm gap-2"
                  >
                    {copiedId === detailFile.id ? (
                      <><Check className="w-4 h-4 text-green-500" /> Disalin!</>
                    ) : (
                      <><Copy className="w-4 h-4" /> Salin URL</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(detailFile.url, "_blank")}
                    className="flex-1 rounded-xl h-9 text-sm gap-2"
                  >
                    <ExternalLink className="w-4 h-4" /> Buka
                  </Button>
                  {detailFile.provider !== "pexels" && detailFile.provider !== "pixabay" && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(detailFile)}
                      className="flex-1 rounded-xl h-9 text-sm gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Hapus
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
