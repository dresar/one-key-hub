import { useState, useEffect, useRef } from "react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, RefreshCw, AlertTriangle, Search, Sparkles, Copy, Check, ExternalLink, X, Film, Info, Loader2 } from "lucide-react";
import api, { API_URL } from "@/services/api";
import { toast } from "sonner";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";
import { motion, AnimatePresence } from "framer-motion";

export default function GiphyTest() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [gfClient, setGfClient] = useState<GiphyFetch | null>(null);
  const [detailGif, setDetailGif] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(800);

  // Sync grid width on resize
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setGridWidth(containerRef.current.getBoundingClientRect().width || 800);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const fetchCredentials = async () => {
    try {
      const { data } = await api.get("/api/credentials");
      const list = data?.items || data || [];
      const giphyCreds = list.filter((c: any) => c.provider_name === "giphy" && c.status === "active");
      setCredentials(giphyCreds);
      if (giphyCreds.length > 0) {
        setSelectedCredentialId(String(giphyCreds[0].id));
      }
    } catch (err) {
      console.error("Failed to load credentials", err);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  // Initialize GiphyFetch client with a dummy token
  useEffect(() => {
    if (selectedCredentialId) {
      setGfClient(new GiphyFetch("secure-gateway-token"));
    } else {
      setGfClient(null);
    }
  }, [selectedCredentialId]);

  // Intercept GIPHY API calls and route them via secure gateway
  useEffect(() => {
    if (!selectedCredentialId) return;

    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === "string" ? input : input.toString();

      if (urlStr.startsWith("https://api.giphy.com/")) {
        const urlObj = new URL(urlStr);
        const path = urlObj.pathname;
        const queryParams: Record<string, string> = {};

        urlObj.searchParams.forEach((val, key) => {
          if (key !== "api_key") {
            queryParams[key] = val;
          }
        });

        const response = await originalFetch(`${API_URL}/gateway/giphy/proxy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("jwt_token") || ""}`,
            "X-Credential-ID": selectedCredentialId
          },
          body: JSON.stringify({
            method: "GET",
            path,
            queryParams
          })
        });
        return response;
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [selectedCredentialId]);

  const fetchGifs = (offset: number) => {
    if (!gfClient) return Promise.resolve({ data: [], pagination: { total_count: 0, count: 0, offset: 0 } } as any);

    if (activeQuery.trim()) {
      return gfClient.search(activeQuery.trim(), { offset, limit: 15, rating: "g" });
    }
    return gfClient.trending({ offset, limit: 15, rating: "g" });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchQuery);
  };

  const handleCopyUrl = async (gif: any) => {
    try {
      const url = gif.images?.original?.url || gif.url;
      await navigator.clipboard.writeText(url);
      setCopiedId("url");
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("URL GIF disalin!");
    } catch {
      toast.error("Gagal menyalin URL");
    }
  };

  const handleCopyMarkdown = async (gif: any) => {
    try {
      const url = gif.images?.original?.url || gif.url;
      const markdown = `![${gif.title || "Giphy GIF"}](${url})`;
      await navigator.clipboard.writeText(markdown);
      setCopiedId("md");
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Format Markdown disalin!");
    } catch {
      toast.error("Gagal menyalin Markdown");
    }
  };

  return (
    <div className="min-h-screen pb-10">
      <AppHeader
        title="GIPHY GIF Explorer"
        subtitle="Cari dan temukan GIF menarik menggunakan official GIPHY SDK yang terhubung aman lewat gateway"
      />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Control & Selector Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-secondary/15 border border-border/40 p-4 rounded-2xl">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full md:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-80">
              <Label className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-primary" /> Akun GIPHY:
              </Label>
              <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId}>
                <SelectTrigger className="bg-background/50 border-border/40 text-sm rounded-xl h-9">
                  <SelectValue placeholder="Pilih akun..." />
                </SelectTrigger>
                <SelectContent>
                  {credentials.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.label || `GIPHY #${c.id}`}
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
                Tambahkan akun GIPHY di halaman Providers
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

        {/* Search Bar Form */}
        {selectedCredentialId && (
          <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari GIF menarik di sini..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-background/50 border-border/40 rounded-xl"
              />
            </div>
            <Button type="submit" className="h-11 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold gap-2">
              <Search className="w-4 h-4" /> Cari
            </Button>
          </form>
        )}

        {/* Giphy SDK Grid Canvas */}
        <div ref={containerRef} className="w-full bg-card/45 border border-border/50 p-6 rounded-2xl shadow-sm min-h-[400px]">
          {selectedCredentialId ? (
            gfClient ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    {activeQuery ? `Hasil untuk "${activeQuery}"` : "Trending GIF"}
                  </h3>
                </div>
                <Grid
                  key={`${selectedCredentialId}-${activeQuery}-${gridWidth}`}
                  width={gridWidth}
                  columns={gridWidth < 600 ? 2 : gridWidth < 900 ? 3 : 4}
                  gutter={10}
                  fetchGifs={fetchGifs}
                  onGifClick={(gif, e) => {
                    e.preventDefault();
                    setDetailGif(gif);
                  }}
                />
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm">Menyiapkan SDK client...</p>
              </div>
            )
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border/60 rounded-xl">
              <Film className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <h4 className="font-bold text-base mb-1">Eksplorasi GIPHY</h4>
              <p className="text-sm text-muted-foreground max-w-sm">
                Pilih atau tambahkan akun kredensial GIPHY Anda terlebih dahulu untuk memulai penjelajahan GIF.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* GIF Detail Modal */}
      <AnimatePresence>
        {detailGif && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetailGif(null)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left Side: GIF Player */}
              <div className="flex-1 bg-black/90 flex items-center justify-center p-4 min-h-[300px] md:min-h-auto">
                <img
                  src={detailGif.images?.original?.url}
                  alt={detailGif.title}
                  className="max-w-full max-h-[400px] object-contain rounded-lg"
                />
              </div>

              {/* Right Side: Details & Actions */}
              <div className="w-full md:w-64 p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-border/30">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <h4 className="font-bold text-base truncate">{detailGif.title || "Giphy GIF"}</h4>
                      <p className="text-xs text-muted-foreground truncate">by {detailGif.username || "Anonymous"}</p>
                    </div>
                    <button
                      onClick={() => setDetailGif(null)}
                      className="w-7 h-7 rounded-lg hover:bg-secondary/60 flex items-center justify-center transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Info className="w-3.5 h-3.5" /> Detail Media
                    </div>
                    <div className="bg-secondary/20 border border-border/30 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rating:</span>
                        <span className="font-bold uppercase text-primary">{detailGif.rating || "G"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dimensi:</span>
                        <span className="font-medium">{detailGif.images?.original?.width}x{detailGif.images?.original?.height} px</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-6">
                  <Button
                    onClick={() => handleCopyUrl(detailGif)}
                    className="w-full h-9 rounded-xl text-xs font-semibold gap-2 bg-primary text-white hover:bg-primary/90"
                  >
                    {copiedId === "url" ? <><Check className="w-4 h-4 text-green-400" /> Disalin</> : <><Copy className="w-4 h-4" /> Salin URL GIF</>}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyMarkdown(detailGif)}
                    className="w-full h-9 rounded-xl text-xs gap-2 border-border/50"
                  >
                    {copiedId === "md" ? <><Check className="w-4 h-4 text-green-500" /> Disalin</> : <><Copy className="w-4 h-4" /> Salin Markdown</>}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => window.open(detailGif.url, "_blank")}
                    className="w-full h-9 rounded-xl text-xs gap-2 hover:bg-secondary/50 text-muted-foreground"
                  >
                    <ExternalLink className="w-4 h-4" /> Buka di Giphy
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
