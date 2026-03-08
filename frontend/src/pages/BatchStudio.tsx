import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { loadState, saveState, SEED_VARIANTS, BG_STYLES, type AppState, type Variant } from "@/lib/store";
import api from "@/lib/api";

type Filter = "all" | "pending" | "approved" | "skipped";

const BatchStudio = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<AppState>(loadState());
  const [dryRun, setDryRun] = useState(false);
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(
    new Set(loadState().project.angles.slice(0, 2).map((a) => a.name))
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [count, setCount] = useState(8);
  const [focus, setFocus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [imageMode, setImageMode] = useState<"stock" | "ai" | "competitor">("ai");
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageGenProgress, setImageGenProgress] = useState({ done: 0, total: 0 });

  const variants = state.batch.variants;
  const filtered = filter === "all" ? variants : variants.filter((v) => v.status === filter);

  const counts = {
    approved: variants.filter((v) => v.status === "approved").length,
    skipped: variants.filter((v) => v.status === "skipped").length,
    pending: variants.filter((v) => v.status === "pending").length,
  };

  const persist = useCallback((s: AppState) => { setState(s); saveState(s); }, []);

  // Check backend health on mount
  useEffect(() => {
    api.checkHealth()
      .then((health) => setBackendReady(health.status === "ok"))
      .catch(() => setBackendReady(false));
  }, []);

  const toggleAngle = (name: string) => {
    setSelectedAngles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const setVariantStatus = (id: string, action: "approve" | "skip") => {
    setState((s) => {
      const newState = {
        ...s,
        batch: {
          ...s.batch,
          variants: s.batch.variants.map((v) => {
            if (v.id !== id) return v;
            if (action === "approve") return { ...v, status: (v.status === "approved" ? "pending" : "approved") as Variant["status"] };
            return { ...v, status: (v.status === "skipped" ? "pending" : "skipped") as Variant["status"] };
          }),
        },
      };
      saveState(newState);
      return newState;
    });
  };

  const setAllStatus = (status: Variant["status"]) => {
    setState((s) => {
      const newState = {
        ...s,
        batch: {
          ...s.batch,
          variants: s.batch.variants.map((v) => ({ ...v, status })),
        },
      };
      saveState(newState);
      return newState;
    });
  };

  const startGeneration = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);

    const realCount = Math.min(20, Math.max(1, count));
    const batchNum = (state.project.batchCount || 0) + 1;

    // Build initial batch state
    const newState: AppState = {
      ...state,
      project: { ...state.project, batchCount: batchNum },
      batch: {
        id: "batch_" + Date.now(),
        num: batchNum,
        date: new Date().toISOString().slice(0, 10),
        config: { count: realCount, focus, angles: [...selectedAngles], dryRun, modeRatio: { A: 50, B: 30, C: 20 } },
        variants: [],
        status: "generating",
      },
    };
    persist(newState);
    setGenProgress({ done: 0, total: realCount });

    if (dryRun) {
      // Use seed variants for dry run (no backend call)
      const newVariants: Variant[] = SEED_VARIANTS.slice(0, realCount).map((v) => ({
        ...v,
        status: "pending" as const,
        imageB64: null,
      }));

      // Simulate staggered generation
      for (let i = 0; i < newVariants.length; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 300 : 600));
        setGenProgress({ done: i + 1, total: newVariants.length });
      }

      setState((s) => {
        const done = { ...s, batch: { ...s.batch, variants: newVariants, status: "reviewing" as const } };
        saveState(done);
        return done;
      });
    } else {
      // Call real backend API
      console.log("Calling backend API with foundation data:", {
        hasFoundation: !!state.project.foundation,
        foundationStatus: state.project.foundation ? {
          research: state.project.foundation.research.status,
          avatar: state.project.foundation.avatar.status,
          context: state.project.foundation.context.status,
        } : 'none',
        angles: state.project.angles.length,
      });
      try {
        const response = await api.generateBatch({
          project: {
            id: state.project.id,
            name: state.project.name,
            status: state.project.status,
            brand: state.project.brand,
            compliance: state.project.compliance,
            foundation: state.project.foundation,
            angles: state.project.angles,
          },
          batch_config: {
            count: realCount,
            focus,
            angles: [...selectedAngles],
            dryRun: false,
            modeRatio: { A: 50, B: 30, C: 20 },
          },
          mode: imageMode,
        });

        // Map backend response to frontend Variant format
        const newVariants: Variant[] = response.batch.variants.map((v) => ({
          id: v.id,
          angle: v.angle,
          mode: v.mode,
          format: v.format,
          hook: v.hook,
          headline: v.headline,
          subhead: v.subhead,
          bullets: v.bullets,
          cta: v.cta,
          imgNote: v.imgNote,
          bg: v.bg || "bg-dark",
          status: "pending",
          imageB64: v.image_url || null,
        }));

        setGenProgress({ done: newVariants.length, total: newVariants.length });

        setState((s) => {
          const done = { ...s, batch: { ...s.batch, variants: newVariants, status: "reviewing" as const } };
          saveState(done);
          return done;
        });
      } catch (err) {
        console.error("Generation failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to generate ads. Please try again.";
        setError(errorMessage);
        
        // Log more details about the error
        if (err instanceof Error && 'cause' in err) {
          console.error("Error cause:", (err as any).cause);
        }

        // Fall back to dry run mode with seed variants
        const fallbackVariants: Variant[] = SEED_VARIANTS.slice(0, realCount).map((v) => ({
          ...v,
          status: "pending" as const,
          imageB64: null,
        }));

        setState((s) => {
          const fallback = { ...s, batch: { ...s.batch, variants: fallbackVariants, status: "reviewing" as const } };
          saveState(fallback);
          return fallback;
        });
      }
    }

    setGenerating(false);
  };

  const progressPct = genProgress.total ? Math.round((genProgress.done / genProgress.total) * 100) : 0;

  const handleOutput = async () => {
    if (generatingImages) return;
    
    const approvedVariants = variants.filter((v) => v.status === "approved");
    if (approvedVariants.length === 0) return;

    setGeneratingImages(true);
    setImageGenProgress({ done: 0, total: approvedVariants.length });
    setError(null);

    try {
      // Build product info from project
      const productInfo = {
        name: state.project.brand.product.name,
        url: state.project.brand.product.url,
        promise: state.project.brand.product.promise,
        offer: state.project.brand.product.offer,
        visualDesc: state.project.brand.product.visualDesc,
      };

      // Call image generation API
      const response = await api.generateImages({
        variants: approvedVariants,
        product_info: productInfo,
        mode: imageMode,
      });

      // Update variants with generated images
      const updatedVariants = variants.map((v) => {
        const generated = response.variants.find((gv) => gv.id === v.id);
        if (generated && generated.imageB64) {
          return { ...v, imageB64: generated.imageB64 };
        }
        return v;
      });

      // Save state with images
      const newState = {
        ...state,
        batch: {
          ...state.batch,
          variants: updatedVariants,
        },
      };
      saveState(newState);

      // Navigate to output
      navigate("/output");
    } catch (err) {
      console.error("Image generation failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to generate images. Please try again.";
      setError(errorMessage);
    } finally {
      setGeneratingImages(false);
    }
  };

  const modeTagClass = (m: string) => m === "A" ? "t-cyan" : m === "B" ? "t-accent" : "t-purple";
  const perfTag = (angle: string) => state.project.angles.find((a) => a.name === angle)?.perf_tag || "untested";
  const perfTagClass: Record<string, string> = { winner: "t-accent", proven: "t-accent", comp: "t-cyan", untested: "t-muted" };

  return (
    <AppLayout
      topbarTitle={`${state.project.name} — Batch Studio`}
      topbarExtra={
        <div className="flex items-center gap-[7px] font-mono text-[10px] text-muted-foreground">
          <div className={`w-[7px] h-[7px] rounded-full ${
            generatingImages 
              ? "bg-pink shadow-[0_0_6px_hsl(var(--pink))] animate-pulse" 
              : generating 
                ? "bg-warn shadow-[0_0_6px_hsl(var(--warn))] animate-pulse" 
                : variants.length 
                  ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]" 
                  : "bg-muted-foreground"
          }`} />
          <span>{generatingImages ? "generating images" : generating ? "generating copy" : variants.length ? `batch ${state.batch.num} ready` : "idle"}</span>
        </div>
      }
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-border shrink-0">
        <div className="h-full bg-primary shadow-[0_0_6px_hsl(var(--primary))] transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-destructive">⚠</span>
            <span className="text-xs text-destructive">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-[10px] text-destructive/70 hover:text-destructive">✕</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left config panel */}
        <div className="w-[272px] min-w-[272px] bg-surface border-r border-border flex flex-col overflow-hidden">
          <div className="px-3.5 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="text-xs font-bold">Batch Config</div>
            <div className="font-mono text-[9px] text-primary px-[7px] py-0.5 bg-primary/[0.06] border border-primary/15 rounded">
              #{state.batch.num || "—"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0">
            {/* Settings */}
            <ConfigSection dotColor="bg-secondary" title="Settings">
              <div className="mb-2.5">
                <label className="block font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-1">Variant Count</label>
                <input type="number" value={count} onChange={(e) => setCount(+e.target.value)} min={1} max={20} className="field-input" />
              </div>
              <div>
                <label className="block font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-1">Batch Focus Note</label>
                <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. test fear angle headlines" className="field-input" />
              </div>
            </ConfigSection>

            {/* Angles */}
            <ConfigSection dotColor="bg-accent" title="Angles">
              <div className="flex flex-wrap gap-1.5">
                {state.project.angles.map((a) => (
                  <button
                    key={a.name}
                    onClick={() => toggleAngle(a.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-all select-none ${
                      selectedAngles.has(a.name)
                        ? a.perf_tag === "winner"
                          ? "border-primary/40 text-primary bg-primary/[0.06]"
                          : "border-accent/40 text-accent bg-accent/[0.06]"
                        : "border-border2 text-muted-foreground bg-background hover:border-accent hover:text-accent"
                    }`}
                  >
                    {(a.perf_tag === "winner" || a.perf_tag === "comp") && (
                      <div className={`w-[5px] h-[5px] rounded-full ${a.perf_tag === "winner" ? "bg-primary" : "bg-secondary"}`} />
                    )}
                    {a.name}
                  </button>
                ))}
              </div>
            </ConfigSection>

            {/* Image Mode */}
            <ConfigSection dotColor="bg-primary" title="Image Mode">
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[
                  { mode: "stock", label: "Stock", desc: "Unsplash + overlay", color: "text-secondary" },
                  { mode: "ai", label: "AI Gen", desc: "Gemini 3.1 Flash", color: "text-primary" },
                  { mode: "competitor", label: "Comp", desc: "Match style", color: "text-accent" },
                ].map((m) => (
                  <button
                    key={m.mode}
                    onClick={() => setImageMode(m.mode as "stock" | "ai" | "competitor")}
                    className={`text-center py-[7px] px-1.5 rounded-[7px] border transition-all ${
                      imageMode === m.mode 
                        ? "border-primary bg-primary/[0.08]" 
                        : "border-border2 hover:border-primary/30"
                    }`}
                  >
                    <div className={`font-mono text-[8px] ${m.color} mb-0.5`}>{m.label}</div>
                    <div className="text-[9px] font-semibold">{m.desc}</div>
                    {imageMode === m.mode && <div className="font-mono text-[8px] text-primary mt-0.5">✓ selected</div>}
                  </button>
                ))}
              </div>
              <div className="font-mono text-[8px] text-muted-foreground text-center">
                Images generated on Output using gemini-3.1-flash-image-preview
              </div>
            </ConfigSection>

            {/* Backend status */}
            <div className={`flex items-center justify-between p-2.5 rounded-[7px] border ${backendReady ? "bg-primary/[0.03] border-primary/15" : "bg-warn/[0.03] border-warn/15"}`}>
              <div>
                <div className={`font-mono text-[10px] ${backendReady ? "text-primary" : "text-warn"}`}>
                  {backendReady === null ? "Checking backend..." : backendReady ? "Backend Ready" : "Backend Offline"}
                </div>
                <div className="font-mono text-[8px] text-muted-foreground">
                  {backendReady ? "Will call API to generate ads" : "Will use seed data (no API)"}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${backendReady ? "bg-primary animate-pulse" : "bg-warn"}`} />
            </div>

            {/* Dry run */}
            <div className="flex items-center justify-between p-2.5 bg-warn/[0.03] border border-warn/15 rounded-[7px]">
              <div>
                <div className="font-mono text-[10px] text-warn">Dry Run {dryRun ? "(ON)" : "(OFF)"}</div>
                <div className="font-mono text-[8px] text-muted-foreground">
                  {dryRun ? "Using seed data (no API call)" : "Will call backend API"}
                </div>
              </div>
              <button
                onClick={() => setDryRun(!dryRun)}
                className={`w-8 h-[18px] rounded-[9px] relative cursor-pointer transition-colors ${dryRun ? "bg-warn" : "bg-border2"}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-background absolute top-0.5 transition-all ${dryRun ? "right-0.5" : "right-4"}`} />
              </button>
            </div>

            {/* Generate */}
            <button
              onClick={() => {
                console.log("Generate button clicked", { dryRun, backendReady, hasFoundation: !!state.project.foundation });
                startGeneration();
              }}
              disabled={generating}
              className={`w-full py-3 font-sans text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                generating
                  ? "bg-surface2 text-warn border border-warn/25 cursor-default"
                  : dryRun 
                    ? "bg-warn text-warn-foreground hover:opacity-90"
                    : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {generating && <div className="w-3 h-3 rounded-full border-2 border-transparent border-t-current animate-spin" />}
              {generating ? "Generating…" : dryRun ? "Generate (Dry Run)" : variants.length ? "Regenerate (API)" : "Generate Batch (API)"}
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0 bg-surface flex-wrap">
            <div className="text-xs font-bold">Variants</div>
            <div className="flex gap-2 items-center">
              <span className="font-mono text-[10px] font-bold text-primary">{counts.approved} approved</span>
              <span className="font-mono text-[10px] text-border2">·</span>
              <span className="font-mono text-[10px] font-bold text-destructive">{counts.skipped} skipped</span>
              <span className="font-mono text-[10px] text-border2">·</span>
              <span className="font-mono text-[10px] font-bold text-muted-foreground">{counts.pending} pending</span>
            </div>
            <div className="flex-1" />
            <div className="flex gap-1.5">
              {(["all", "pending", "approved", "skipped"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-[3px] rounded-full font-mono text-[8px] border transition-all select-none ${
                    filter === f ? "border-primary text-primary bg-primary/[0.04]" : "border-border2 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button onClick={() => setAllStatus("approved")} className="font-mono text-[9px] px-2.5 py-[3px] rounded border border-primary/20 text-primary hover:bg-primary/[0.06] transition-colors">✓ all</button>
            <button onClick={() => setAllStatus("skipped")} className="font-mono text-[9px] px-2.5 py-[3px] rounded border border-destructive/20 text-destructive hover:bg-destructive/[0.04] transition-colors">✕ all</button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5 content-start min-h-0">
            {filtered.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="text-4xl opacity-10">◈</div>
                <div className="text-sm font-semibold text-muted-foreground">
                  {variants.length ? "No variants here" : "No variants yet"}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {variants.length ? "Try a different filter" : "Configure left panel then click Generate"}
                </div>
              </div>
            )}
            {filtered.map((v, i) => (
              <VariantCard
                key={v.id}
                variant={v}
                index={i}
                modeTagClass={modeTagClass(v.mode)}
                perfTagName={perfTag(v.angle)}
                perfTagClass={perfTagClass[perfTag(v.angle)]}
                onApprove={() => setVariantStatus(v.id, "approve")}
                onSkip={() => setVariantStatus(v.id, "skip")}
              />
            ))}
          </div>

          {/* Proceed bar */}
          {variants.length > 0 && (
            <div className="border-t border-pink bg-pink/[0.03] px-4 py-2.5 flex items-center gap-3.5 shrink-0">
              <div className="flex-1">
                <div className="text-xs font-bold text-pink mb-1">
                  {generatingImages ? "Generating images..." : "Ready to proceed?"}
                </div>
                <div className="flex gap-3.5">
                  <span className="font-mono text-[9px] text-muted-foreground">{counts.approved} approved</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{counts.pending} pending</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{counts.skipped} skipped</span>
                </div>
                {generatingImages && (
                  <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-pink transition-all duration-300" 
                      style={{ width: `${(imageGenProgress.done / imageGenProgress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
              <button
                disabled={!(counts.approved > 0 && counts.pending === 0) || generatingImages}
                onClick={handleOutput}
                className="text-[11px] font-bold px-5 py-2 rounded-lg bg-pink text-primary-foreground shrink-0 transition-all hover:opacity-90 disabled:bg-border2 disabled:text-muted-foreground disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generatingImages && <div className="w-3 h-3 rounded-full border-2 border-transparent border-t-current animate-spin" />}
                {generatingImages ? "Generating..." : "→ Output"}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

const ConfigSection = ({ dotColor, title, children }: { dotColor: string; title: string; children: React.ReactNode }) => (
  <div className="bg-surface2 border border-border rounded-lg overflow-hidden">
    <div className="px-3 py-[7px] border-b border-border flex items-center gap-1.5">
      <div className={`w-[5px] h-[5px] rounded-full ${dotColor}`} />
      <div className="text-[11px] font-bold">{title}</div>
    </div>
    <div className="p-3">{children}</div>
  </div>
);

const VariantCard = ({
  variant: v,
  index,
  modeTagClass,
  perfTagName,
  perfTagClass,
  onApprove,
  onSkip,
}: {
  variant: Variant;
  index: number;
  modeTagClass: string;
  perfTagName: string;
  perfTagClass: string;
  onApprove: () => void;
  onSkip: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const bg = BG_STYLES[v.bg] || BG_STYLES["bg-dark"];

  return (
    <div
      className={`bg-surface border rounded-[10px] flex flex-col animate-card-in ${
        v.status === "approved" ? "border-primary/20" : v.status === "skipped" ? "border-destructive/10 opacity-45" : "border-border"
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Schema Preview (replacing image) */}
      <div 
        className="h-40 relative overflow-hidden rounded-t-[10px] p-2.5"
        style={{ background: bg }}
      >
        <div className="h-full flex flex-col text-[10px] leading-tight overflow-hidden">
          {/* Hook - most prominent */}
          <div className="font-bold text-foreground mb-1 line-clamp-2">{v.hook}</div>
          {/* Headline */}
          <div className="text-muted-foreground mb-1.5 line-clamp-1">{v.headline}</div>
          {/* Subhead - if space allows */}
          {v.subhead && (
            <div className="text-[9px] text-muted-foreground/70 line-clamp-2 mb-1">{v.subhead}</div>
          )}
          {/* Bullets - compact */}
          {v.bullets.length > 0 && (
            <ul className="list-none space-y-0.5 mt-auto">
              {v.bullets.slice(0, 2).map((b, i) => (
                <li key={i} className="text-[8px] text-muted-foreground/60 pl-2 relative">
                  <span className="absolute left-0">·</span>{b.slice(0, 40)}{b.length > 40 ? '...' : ''}
                </li>
              ))}
              {v.bullets.length > 2 && (
                <li className="text-[8px] text-muted-foreground/40 pl-2">+{v.bullets.length - 2} more</li>
              )}
            </ul>
          )}
        </div>
        <div className={`absolute top-1.5 right-1.5 tag ${modeTagClass}`}>{v.mode}</div>
      </div>

      {/* Body */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="font-mono text-[9px] text-muted-foreground">#{v.id}</span>
          <span className="tag t-purple">{v.angle}</span>
          <span className={`tag ${perfTagClass}`}>{perfTagName}</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto font-mono text-[8px] px-[7px] py-[2px] rounded border border-border2 bg-transparent text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? "– less" : "+ more"}
          </button>
        </div>
        <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground mb-1">
          Hook <span className="opacity-40 text-[7px]">click to edit</span>
        </div>
        <div className="text-[11px] font-bold leading-snug mb-2 p-[4px_7px] rounded border border-transparent hover:bg-surface2 hover:border-border2 cursor-text transition-colors">
          {v.hook}
        </div>
        <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground mb-1">Headline</div>
        <div className="text-[10px] text-muted-foreground p-[4px_7px] rounded border border-transparent hover:bg-surface2 hover:border-border2 cursor-text transition-colors">
          {v.headline}
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="p-3 border-b border-border">
          <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground mb-1">Subhead</div>
          <div className="font-mono text-[9px] text-muted-foreground leading-relaxed mb-2">{v.subhead}</div>
          <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground mb-1">Bullets</div>
          <ul className="list-none mb-2">
            {v.bullets.map((b, i) => (
              <li key={i} className="font-mono text-[9px] text-muted-foreground pl-3 relative leading-relaxed">
                <span className="absolute left-0 text-muted-foreground">·</span>{b}
              </li>
            ))}
          </ul>
          <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground mb-1">Image Direction</div>
          <div className="font-mono text-[9px] text-muted-foreground leading-relaxed p-1.5 bg-background rounded border-l-2 border-border2">
            {v.imgNote}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-[7px_11px] flex items-center gap-2">
        <div className="flex rounded-md overflow-hidden border border-border2">
          <button
            onClick={onApprove}
            className={`px-2.5 py-1 font-mono text-[9px] transition-colors ${v.status === "approved" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}
          >
            ✓ approve
          </button>
          <div className="w-px bg-border2" />
          <button
            onClick={onSkip}
            className={`px-2.5 py-1 font-mono text-[9px] transition-colors ${v.status === "skipped" ? "bg-destructive/[0.08] text-destructive" : "text-muted-foreground hover:bg-destructive/[0.08] hover:text-destructive"}`}
          >
            ✕ skip
          </button>
        </div>
        <span className="font-mono text-[8px] text-muted-foreground ml-auto">Mode {v.mode} · {v.format}</span>
      </div>
    </div>
  );
};

export default BatchStudio;
