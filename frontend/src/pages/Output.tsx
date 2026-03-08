import { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { loadState, BG_STYLES, type AppState, type Variant } from "@/lib/store";
import { geminiImageGen } from "@/lib/imageGen";
import { saveImage, loadAllImages } from "@/lib/imageStore";

type Filter = "all" | "approved" | "skipped" | "pending";

const Output = () => {
  const [state] = useState<AppState>(loadState());
  const [filter, setFilter] = useState<Filter>("all");
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  const [imgProgress, setImgProgress] = useState({ done: 0, total: 0, generating: false });
  const [images, setImages] = useState<Record<string, string>>({});
  const generatingRef = useRef(false);

  const variants = state.batch?.variants || [];
  const filtered = filter === "all" ? variants : variants.filter((v) => v.status === filter);
  const counts = {
    total: variants.length,
    approved: variants.filter((v) => v.status === "approved").length,
    skipped: variants.filter((v) => v.status === "skipped").length,
  };

  const modeClass = (m: string) => (m === "A" ? "t-cyan" : m === "B" ? "t-accent" : "t-purple");

  const getImage = useCallback((v: Variant) => images[v.id] || null, [images]);

  // Load images from IndexedDB, then generate any missing ones
  useEffect(() => {
    if (generatingRef.current) return;
    generatingRef.current = true;

    const approved = variants.filter((v) => v.status === "approved");
    if (approved.length === 0) { generatingRef.current = false; return; }

    const ids = approved.map((v) => v.id);

    loadAllImages(ids).then((stored) => {
      // Show already-stored images immediately
      if (Object.keys(stored).length > 0) {
        setImages((prev) => ({ ...prev, ...stored }));
      }

      const geminiKey = import.meta.env.VITE_GEMINI_KEY || "";
      const needsGen = approved.filter((v) => !stored[v.id]);

      if (needsGen.length === 0 || !geminiKey) {
        generatingRef.current = false;
        return;
      }

      setImgProgress({ done: 0, total: needsGen.length, generating: true });

      let completed = 0;
      const promises = needsGen.map((v) =>
        geminiImageGen(v, state.project, geminiKey).then(async (result) => {
          completed++;
          setImgProgress((p) => ({ ...p, done: completed }));
          if (result) {
            await saveImage(v.id, result);
            setImages((prev) => ({ ...prev, [v.id]: result }));
          }
        })
      );

      Promise.all(promises).then(() => {
        setImgProgress((p) => ({ ...p, generating: false }));
        generatingRef.current = false;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const imgPct = imgProgress.total ? Math.round((imgProgress.done / imgProgress.total) * 100) : 0;

  const downloadVariant = (v: Variant) => {
    const src = getImage(v);
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = `adgen_${state.batch.num}_${v.id}_${v.angle.replace(/\s+/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    const withImages = filtered.filter((v) => getImage(v));
    withImages.forEach((v, i) => {
      setTimeout(() => downloadVariant(v), i * 200);
    });
  };

  return (
    <AppLayout
      topbarTitle={`${state.project?.name || "Output"} — Output`}
      topbarExtra={
        <div className="flex items-center gap-2">
          {imgProgress.generating && (
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-warn">
              <div className="w-3 h-3 rounded-full border-2 border-transparent border-t-current animate-spin" />
              generating images {imgProgress.done}/{imgProgress.total}
            </div>
          )}
          <div className="font-mono text-[10px] text-muted-foreground px-2 py-0.5 bg-surface2 border border-border rounded">
            {state.batch?.num ? `batch ${state.batch.num} · ${state.batch.date}` : "—"}
          </div>
        </div>
      }
    >
      {/* Image gen progress bar */}
      {imgProgress.generating && (
        <div className="h-0.5 bg-border shrink-0">
          <div className="h-full bg-warn shadow-[0_0_6px_hsl(var(--warn))] transition-all duration-500" style={{ width: `${imgPct}%` }} />
        </div>
      )}

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
          disabled={!filtered.some((v) => getImage(v))}
          className="text-[11px] font-semibold px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:bg-border2 disabled:text-muted-foreground disabled:cursor-not-allowed"
        >
          ↓ Download All
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
          const imageUrl = getImage(v);
          const isGeneratingImg = imgProgress.generating && v.status === "approved" && !imageUrl;

          return (
            <div
              key={v.id}
              onClick={() => setLbIndex(i)}
              className={`bg-surface border border-border rounded-[10px] overflow-hidden cursor-pointer transition-all hover:border-border2 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] animate-fi ${
                status === "skipped" ? "opacity-40" : ""
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="h-[140px] relative overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={v.headline}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <>
                    <div className="absolute inset-0" style={{ background: bg }} />
                    {isGeneratingImg ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                        <div className="w-5 h-5 rounded-full border-2 border-transparent border-t-warn animate-spin" />
                        <span className="font-mono text-[8px] text-muted-foreground">generating…</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[28px] opacity-15">◈</div>
                    )}
                  </>
                )}
                <div className={`absolute top-1.5 right-1.5 tag ${modeClass(v.mode)}`}>Mode {v.mode}</div>
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
      {lbVariant && (() => {
        const lbImage = getImage(lbVariant);
        return (
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
              {/* Image */}
              <div className="w-[380px] min-w-[380px] rounded-[10px] overflow-hidden border border-border2">
                {lbImage ? (
                  <img
                    src={lbImage}
                    alt={lbVariant.headline}
                    className="w-full aspect-square object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="aspect-square flex items-center justify-center" style={{ background: BG_STYLES[lbVariant.bg] || BG_STYLES["bg-dark"] }}>
                    {imgProgress.generating && lbVariant.status === "approved" ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-7 h-7 rounded-full border-2 border-transparent border-t-warn animate-spin" />
                        <span className="font-mono text-[10px] text-muted-foreground">generating image…</span>
                      </div>
                    ) : (
                      <span className="text-5xl opacity-10">◈</span>
                    )}
                  </div>
                )}
              </div>

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
                    onClick={() => downloadVariant(lbVariant)}
                    disabled={!lbImage}
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
        );
      })()}
    </AppLayout>
  );
};

export default Output;
