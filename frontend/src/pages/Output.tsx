import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { loadState, BG_STYLES, type Variant } from "@/lib/store";
import api from "@/lib/api";

type Filter = "all" | "approved" | "skipped" | "pending";

const Output = () => {
  const state = loadState();
  const variants = state.batch?.variants || [];
  const [filter, setFilter] = useState<Filter>("all");
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  const filtered = filter === "all" ? variants : variants.filter((v) => v.status === filter);
  const counts = {
    total: variants.length,
    approved: variants.filter((v) => v.status === "approved").length,
    skipped: variants.filter((v) => v.status === "skipped").length,
  };

  const modeClass = (m: string) => (m === "A" ? "t-cyan" : m === "B" ? "t-accent" : "t-purple");

  // Helper to download a single image
  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  // Download all approved variants with images
  const downloadAll = async () => {
    const variantsWithImages = variants.filter((v) => v.status === "approved" && v.imageB64 && !v.imageB64.startsWith("/placeholder") && !v.imageB64.startsWith("http"));
    if (variantsWithImages.length === 0) return;
    
    setDownloading(true);
    for (const v of variantsWithImages) {
      const imageUrl = api.getImageUrl(v.imageB64!);
      await downloadImage(imageUrl, `ad_${v.id}_${v.angle.replace(/\s+/g, '_')}.png`);
      // Small delay between downloads
      await new Promise(r => setTimeout(r, 200));
    }
    setDownloading(false);
  };

  // Download single variant
  const downloadSingle = async () => {
    if (!lbVariant || !lbVariant.imageB64 || lbVariant.imageB64.startsWith("/placeholder")) return;
    const imageUrl = api.getImageUrl(lbVariant.imageB64);
    await downloadImage(imageUrl, `ad_${lbVariant.id}_${lbVariant.angle.replace(/\s+/g, '_')}.png`);
  };

  // Keyboard nav for lightbox
  useEffect(() => {
    if (lbIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLbIndex(null);
      if (e.key === "ArrowLeft" && lbIndex > 0) setLbIndex(lbIndex - 1);
      if (e.key === "ArrowRight" && lbIndex < filtered.length - 1) setLbIndex(lbIndex + 1);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lbIndex, filtered.length]);

  const lbVariant = lbIndex !== null ? filtered[lbIndex] : null;

  return (
    <AppLayout
      topbarTitle={`${state.project?.name || "Output"} — Output`}
      topbarExtra={
        <div className="font-mono text-[10px] text-muted-foreground px-2 py-0.5 bg-surface2 border border-border rounded">
          {state.batch?.num ? `batch ${state.batch.num} · ${state.batch.date}` : "—"}
        </div>
      }
    >
      {/* Toolbar */}
      <div className="px-5 py-2.5 border-b border-border bg-surface flex items-center gap-2.5 flex-wrap shrink-0">
        <div className="font-mono text-[10px] text-muted-foreground flex items-center gap-1.5">
          <strong className="text-foreground font-bold">{counts.total}</strong> variants
        </div>
        <span className="font-mono text-[10px] text-border2">·</span>
        <div className="font-mono text-[10px] flex items-center gap-1.5">
          <strong className="text-primary font-bold">{counts.approved}</strong> <span className="text-muted-foreground">approved</span>
        </div>
        <span className="font-mono text-[10px] text-border2">·</span>
        <div className="font-mono text-[10px] flex items-center gap-1.5">
          <strong className="text-destructive font-bold">{counts.skipped}</strong> <span className="text-muted-foreground">skipped</span>
        </div>
        <div className="flex-1 flex gap-1.5">
          {(["all", "approved", "skipped", "pending"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-[3px] rounded-full font-mono text-[9px] border transition-all select-none ${
                filter === f ? "border-primary text-primary bg-primary/[0.04]" : "border-border2 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button 
          onClick={downloadAll}
          disabled={downloading || variants.filter(v => v.status === "approved" && v.imageB64 && !v.imageB64.startsWith("/placeholder")).length === 0}
          className="text-[11px] font-semibold px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:bg-border2 disabled:text-muted-foreground disabled:cursor-not-allowed"
        >
          {downloading ? (
            <><div className="w-3 h-3 rounded-full border-2 border-transparent border-t-current animate-spin" /> Downloading...</>
          ) : (
            <>↓ Download All</>
          )}
        </button>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 gap-3 content-start min-h-0">
        {filtered.length === 0 && (
          <div className="col-span-4 flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="text-4xl opacity-10">◈</div>
            <div className="text-sm font-semibold text-muted-foreground">No variants here</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {variants.length ? "Try a different filter" : "Go to Batch Studio and generate a batch first"}
            </div>
          </div>
        )}
        {filtered.map((v, i) => {
          const bg = BG_STYLES[v.bg] || BG_STYLES["bg-dark"];
          const status = v.status || "pending";
          const hasImage = v.imageB64 && !v.imageB64.startsWith("/placeholder");
          const imageUrl = hasImage ? api.getImageUrl(v.imageB64) : null;
          
          return (
            <div
              key={v.id}
              onClick={() => setLbIndex(i)}
              className={`bg-surface border border-border rounded-[10px] overflow-hidden cursor-pointer transition-all hover:border-border2 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] animate-fi ${
                status === "skipped" ? "opacity-40" : ""
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="h-[140px] relative overflow-hidden" style={hasImage ? undefined : { background: bg }}>
                {hasImage ? (
                  <img
                    src={imageUrl!}
                    alt={v.headline}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="h-full flex flex-col text-[9px] leading-tight overflow-hidden p-2.5">
                    <div className="font-bold text-foreground mb-1 line-clamp-2">{v.hook}</div>
                    <div className="text-muted-foreground/80 mb-1 line-clamp-1">{v.headline}</div>
                    {v.subhead && (
                      <div className="text-[8px] text-muted-foreground/60 line-clamp-2">{v.subhead}</div>
                    )}
                  </div>
                )}
                <div className={`absolute top-1.5 right-1.5 tag ${modeClass(v.mode)}`}>{v.mode}</div>
                {status !== "pending" && (
                  <div className={`absolute top-1.5 left-1.5 font-mono text-[7px] px-1.5 py-0.5 rounded border ${
                    status === "approved"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-destructive/[0.04] text-destructive border-destructive/15"
                  }`}>
                    {status === "approved" ? "✓" : "✕"}
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <div className="font-mono text-[9px] text-muted-foreground mb-1 flex items-center gap-1.5">
                  <span>#{v.id}</span>
                  <span className="tag t-purple">{v.angle}</span>
                </div>
                <div className="text-[10px] font-semibold text-foreground leading-snug line-clamp-2">{v.hook}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lbVariant && (
        <div
          className="fixed inset-0 bg-black/[0.88] z-50 flex items-center justify-center p-8"
          onClick={(e) => { if (e.target === e.currentTarget) setLbIndex(null); }}
        >
          <button onClick={() => setLbIndex(null)} className="absolute top-5 right-5 font-mono text-[11px] text-muted-foreground px-3 py-1.5 border border-border2 rounded-md bg-surface hover:text-foreground transition-colors">
            ✕ close
          </button>
          {lbIndex! > 0 && (
            <button onClick={() => setLbIndex(lbIndex! - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg text-muted-foreground px-3.5 py-2.5 rounded-lg border border-border2 bg-surface hover:text-foreground transition-colors">
              ‹
            </button>
          )}
          {lbIndex! < filtered.length - 1 && (
            <button onClick={() => setLbIndex(lbIndex! + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-lg text-muted-foreground px-3.5 py-2.5 rounded-lg border border-border2 bg-surface hover:text-foreground transition-colors">
              ›
            </button>
          )}

          <div className="flex gap-7 items-start max-w-[860px] w-full animate-fi">
            {/* Generated Image or Schema Preview */}
            {(() => {
              const hasLbImage = lbVariant.imageB64 && !lbVariant.imageB64.startsWith("/placeholder");
              const lbImageUrl = hasLbImage ? api.getImageUrl(lbVariant.imageB64) : null;
              return (
                <div className="w-[380px] min-w-[380px] rounded-[10px] overflow-hidden border border-border2">
                  {hasLbImage ? (
                    <img
                      src={lbImageUrl!}
                      alt={lbVariant.headline}
                      className="w-full aspect-square object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="aspect-square flex flex-col justify-center p-4" style={{ background: BG_STYLES[lbVariant.bg] || BG_STYLES["bg-dark"] }}>
                      <div className="text-sm font-bold text-foreground mb-3 leading-snug">{lbVariant.hook}</div>
                      <div className="text-xs text-muted-foreground mb-2">{lbVariant.headline}</div>
                      {lbVariant.subhead && (
                        <div className="text-[11px] text-muted-foreground/70 mb-3">{lbVariant.subhead}</div>
                      )}
                      {lbVariant.bullets.length > 0 && (
                        <ul className="list-none space-y-1">
                          {lbVariant.bullets.map((b, i) => (
                            <li key={i} className="text-[10px] text-muted-foreground/60 pl-3 relative">
                              <span className="absolute left-0">·</span>{b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Details */}
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[80vh]">
              <div className="flex gap-1.5 flex-wrap items-center">
                <span className="font-mono text-[10px] text-muted-foreground">#{lbVariant.id}</span>
                <span className="tag t-purple">{lbVariant.angle}</span>
                <span className={`tag ${modeClass(lbVariant.mode)}`}>Mode {lbVariant.mode}</span>
                {lbVariant.status !== "pending" && (
                  <span className={`tag ${lbVariant.status === "approved" ? "t-accent" : "t-muted"}`}>{lbVariant.status}</span>
                )}
              </div>

              <div className="bg-surface2 border border-border rounded-[9px] p-3.5">
                <div className="font-mono text-[8px] text-muted-foreground tracking-widest uppercase mb-1.5">Copy</div>
                <div className="text-sm font-bold leading-snug mb-2">{lbVariant.hook}</div>
                <div className="text-[11px] text-muted-foreground mb-2 leading-relaxed">{lbVariant.headline}</div>
                <div className="font-mono text-[10px] text-primary">{lbVariant.cta}</div>
              </div>

              {lbVariant.imgNote && (
                <div className="bg-surface2 border border-border rounded-[9px] p-3">
                  <div className="font-mono text-[8px] text-muted-foreground tracking-widest uppercase mb-1.5">Image Direction</div>
                  <div className="font-mono text-[9px] text-muted-foreground leading-relaxed">{lbVariant.imgNote}</div>
                </div>
              )}

              <div className="flex gap-2">
                <button 
                  onClick={downloadSingle}
                  disabled={!lbVariant?.imageB64 || lbVariant.imageB64.startsWith("/placeholder")}
                  className="flex-1 text-[11px] font-semibold py-2.5 bg-primary text-primary-foreground rounded-[7px] hover:opacity-90 transition-opacity disabled:bg-border2 disabled:text-muted-foreground disabled:cursor-not-allowed"
                >
                  ↓ Download
                </button>
                <button onClick={() => setLbIndex(null)} className="text-[11px] font-semibold px-3.5 py-2.5 border border-border2 text-muted-foreground rounded-[7px] hover:text-foreground transition-colors">
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Output;
