import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { loadState, saveState, BG_STYLES, type AppState, type Variant } from "@/lib/store";

function parseClaudeJSON(text: string) {
  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(clean);
}

type Filter = "all" | "pending" | "approved" | "skipped";

const BatchStudio = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<AppState>(loadState());
  const [dryRun, setDryRun] = useState(true);
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(
    new Set(loadState().project.angles.slice(0, 2).map((a) => a.name))
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [count, setCount] = useState(8);
  const [focus, setFocus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const variants = state.batch.variants;
  const filtered = filter === "all" ? variants : variants.filter((v) => v.status === filter);

  const counts = {
    approved: variants.filter((v) => v.status === "approved").length,
    skipped: variants.filter((v) => v.status === "skipped").length,
    pending: variants.filter((v) => v.status === "pending").length,
  };

  const persist = useCallback((s: AppState) => { setState(s); saveState(s); }, []);

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

  const updateVariant = (id: string, patch: Partial<Variant>) => {
    setState((s) => {
      const newState = {
        ...s,
        batch: {
          ...s.batch,
          variants: s.batch.variants.map((v) => v.id === id ? { ...v, ...patch } : v),
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

    // API keys are now handled by the backend
    // The backend will use ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY (Gemini)
    // Just check if backend is available
    if (!backendReady) {
      setError("Backend API not available. Please check your API keys are set on the server.");
      setGenerating(false);
      return;
    }

    const realCount = Math.min(20, Math.max(1, count));
    const batchNum = (state.project.batchCount || 0) + 1;
    const angleList = [...selectedAngles];

    // Create skeleton slots
    const skeletons: Variant[] = Array.from({ length: realCount }, (_, i) => ({
      id: String(i + 1).padStart(3, "0"),
      angle: "",
      mode: "A" as const,
      format: "",
      hook: "",
      headline: "",
      subhead: "",
      bullets: [],
      cta: "",
      imgNote: "",
      bg: "bg-dark",
      status: "pending" as const,
      imageB64: null,
      _generating: true,
    }));

    const newState: AppState = {
      ...state,
      project: { ...state.project, batchCount: batchNum },
      batch: {
        id: "batch_" + Date.now(),
        num: batchNum,
        date: new Date().toISOString().slice(0, 10),
        config: { count: realCount, focus, angles: angleList, dryRun, modeRatio: { A: 50, B: 30, C: 20 } },
        variants: skeletons,
        status: "generating",
      },
    };
    persist(newState);
    setGenProgress({ done: 0, total: realCount });

    // Build context from foundation
    const foundation = state.foundation;
    const contextJson = foundation.context.status === "done" && foundation.context.content
      ? foundation.context.content
      : "";

    const brand = state.project.brand;
    const prod = brand.product;
    const comp = state.project.compliance;

    const systemPrompt = `You are a world-class direct-response copywriter specializing in performance ad creatives. Write scroll-stopping ad copy variants.

RULES:
- Hook: first-person testimonial OR bold fear/urgency statement. Max 15 words. No fluff.
- Headline: 3-6 words. Active voice. No punctuation at end. No duplicate words.
- Subhead: 5-9 words. Supports headline. Lowercase.
- Bullets: exactly 3. Max 5 words each. Benefit-focused.
- CTA: 2-4 words + arrow. Action verb first.
- imgNote: 1 sentence describing the visual for image generation.
- Every variant must feel emotionally distinct.
- Output ONLY a valid JSON array. No explanation, no markdown, no backticks.`;

    const userPrompt = `PRODUCT: ${prod.name}
BRAND: ${brand.name} (${brand.category})
PROMISE: ${prod.promise}
OFFER: ${prod.offer}
VOICE: ${brand.voice}
VISUAL: ${prod.visualDesc}
COMPLIANCE LEVEL: ${comp.level}
FORBIDDEN CLAIMS: ${comp.forbidden_claims.join(", ")}
DISCLAIMER: ${comp.disclaimer}
BATCH FOCUS: ${focus || "none"}

${contextJson ? `STRATEGIC CONTEXT:\n${contextJson}\n` : ""}
ANGLES TO USE (cycle through these for the variants):
${angleList.join(", ")}

ANGLE PERFORMANCE:
${state.project.angles.map((a) => `${a.name}: ${a.perf_tag}`).join("\n")}

Generate exactly ${realCount} ad copy variants.
Assign angles from the list above cycling round-robin.
Assign modes cycling: A, B, C, A, B, A, C, B...
Assign bg cycling: bg-dark, bg-warm, bg-cool, bg-neutral...

Return a JSON array where each element has exactly these fields:
{
  "id": "zero-padded string (001, 002...)",
  "angle": "string",
  "mode": "A | B | C",
  "bg": "bg-dark | bg-warm | bg-cool | bg-neutral",
  "hook": "string",
  "headline": "string",
  "subhead": "string",
  "bullets": ["string", "string", "string"],
  "cta": "string",
  "imgNote": "string",
  "format": "string"
}`;

    try {
      console.log(`[BatchStudio] Generating ${realCount} variants via Claude…`);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const rawText = data.content[0].text;

      let parsed: Variant[];
      try {
        parsed = parseClaudeJSON(rawText);
      } catch {
        throw new Error("Failed to parse Claude response as JSON");
      }

      if (!Array.isArray(parsed)) throw new Error("Claude response is not an array");

      // Stagger reveal — copy only. Images are generated on the Output page.
      for (let i = 0; i < parsed.length; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 200 : 400));

        const v = parsed[i];
        const variant: Variant = {
          id: v.id || String(i + 1).padStart(3, "0"),
          angle: v.angle || "",
          mode: (v.mode || "A") as Variant["mode"],
          format: v.format || "ad",
          hook: v.hook || "",
          headline: v.headline || "",
          subhead: v.subhead || "",
          bullets: Array.isArray(v.bullets) ? v.bullets : [],
          cta: v.cta || "",
          imgNote: v.imgNote || "",
          bg: v.bg || "bg-dark",
          status: "pending",
          imageB64: null,
        };

        setState((s) => {
          const updatedVariants = [...s.batch.variants];
          updatedVariants[i] = variant;
          const ns = { ...s, batch: { ...s.batch, variants: updatedVariants } };
          saveState(ns);
          return ns;
        });
        setGenProgress({ done: i + 1, total: parsed.length });
      }

      setState((s) => {
        const done = { ...s, batch: { ...s.batch, status: "reviewing" as const } };
        saveState(done);
        return done;
      });
    } catch (err) {
      console.error("Generation failed:", err);
      setError(err instanceof Error ? err.message : "Generation failed");
      setState((s) => {
        const failed = { ...s, batch: { ...s.batch, variants: [], status: "idle" as const } };
        saveState(failed);
        return failed;
      });
    }

    setGenerating(false);
  };

  const progressPct = genProgress.total ? Math.round((genProgress.done / genProgress.total) * 100) : 0;

  const modeTagClass = (m: string) => m === "A" ? "t-cyan" : m === "B" ? "t-accent" : "t-purple";
  const perfTag = (angle: string) => state.project.angles.find((a) => a.name === angle)?.perf_tag || "untested";
  const perfTagClass: Record<string, string> = { winner: "t-accent", proven: "t-accent", comp: "t-cyan", untested: "t-muted" };

  // API keys are set on backend, frontend just checks backend health
  const hasApiKey = backendReady !== false;

  return (
    <AppLayout
      topbarTitle={`${state.project.name} — Batch Studio`}
      topbarExtra={
        <div className="flex items-center gap-[7px] font-mono text-[10px] text-muted-foreground">
          <div className={`w-[7px] h-[7px] rounded-full ${generating ? "bg-warn shadow-[0_0_6px_hsl(var(--warn))] animate-pulse" : variants.length ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]" : "bg-muted-foreground"}`} />
          <span>{generating ? "generating" : variants.length ? `batch ${state.batch.num} ready` : "idle"}</span>
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
              <div className="mb-2.5">
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
                  { mode: "A", label: "Ref Edit", color: "text-secondary", borderColor: "border-secondary/15" },
                  { mode: "B", label: "Overlay", color: "text-primary", borderColor: "border-primary/15" },
                  { mode: "C", label: "Generate", color: "text-accent", borderColor: "border-accent/15" },
                ].map((m) => (
                  <div key={m.mode} className={`text-center py-[7px] px-1.5 rounded-[7px] border ${m.borderColor}`}>
                    <div className={`font-mono text-[8px] ${m.color} mb-0.5`}>Mode {m.mode}</div>
                    <div className="text-[9px] font-semibold">{m.label}</div>
                    <div className="font-mono text-[8px] text-primary">✓ ready</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-mono text-[8px] text-muted-foreground mb-1">
                <span>A 50%</span><span>B 30%</span><span>C 20%</span>
              </div>
              <div className="h-1.5 bg-border rounded-sm overflow-hidden flex">
                <div className="bg-secondary" style={{ width: "50%" }} />
                <div className="bg-primary" style={{ width: "30%" }} />
                <div className="bg-accent" style={{ width: "20%" }} />
              </div>
            </ConfigSection>

            {/* Dry run */}
            <div className="flex items-center justify-between p-2.5 bg-warn/[0.03] border border-warn/15 rounded-[7px]">
              <div>
                <div className="font-mono text-[10px] text-warn">Dry Run</div>
                <div className="font-mono text-[8px] text-muted-foreground">Copy only · no image calls</div>
              </div>
              <button
                onClick={() => setDryRun(!dryRun)}
                className={`w-8 h-[18px] rounded-[9px] relative cursor-pointer transition-colors ${dryRun ? "bg-warn" : "bg-border2"}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-background absolute top-0.5 transition-all ${dryRun ? "right-0.5" : "right-4"}`} />
              </button>
            </div>

            {/* API status */}
            {!backendReady && (
              <div className="p-2.5 rounded-[7px] border border-destructive/15 bg-destructive/[0.03]">
                <div className="font-mono text-[9px] text-destructive">Backend offline — set ANTHROPIC_API_KEY or GEMINI_API_KEY on server</div>
              </div>
            )}

            {/* Generate */}
            <button
              onClick={startGeneration}
              disabled={generating || !backendReady}
              className={`w-full py-3 font-sans text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                generating
                  ? "bg-surface2 text-warn border border-warn/25 cursor-default"
                  : !backendReady
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {generating && <div className="w-3 h-3 rounded-full border-2 border-transparent border-t-current animate-spin" />}
              {generating ? "Generating…" : variants.length ? "Regenerate" : "Generate Batch"}
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
            {filtered.length === 0 && !generating && (
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
            {filtered.map((v, i) => {
              const isSkeleton = !v.hook && !v.headline && generating;
              if (isSkeleton) {
                return (
                  <div key={v.id} className="bg-surface border border-border rounded-[10px] flex flex-col" style={{ animationDelay: `${i * 40}ms`, minHeight: 160 }}>
                    <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
                      <div className="h-[18px] w-14 bg-surface2 rounded animate-shimmer" />
                      <div className="h-[18px] w-20 bg-surface2 rounded animate-shimmer" />
                      <div className="ml-auto w-4 h-4 rounded-full border-2 border-transparent border-t-warn animate-spin" />
                    </div>
                    <div className="p-3 space-y-2.5 flex-1">
                      <div className="h-3.5 bg-surface2 rounded animate-shimmer" style={{ width: "85%" }} />
                      <div className="h-3 bg-surface2 rounded animate-shimmer" style={{ width: "100%" }} />
                      <div className="h-3 bg-surface2 rounded animate-shimmer" style={{ width: "55%" }} />
                    </div>
                  </div>
                );
              }

              return (
                <VariantCard
                  key={v.id}
                  variant={v}
                  index={i}
                  modeTagClass={modeTagClass(v.mode)}
                  perfTagName={perfTag(v.angle)}
                  perfTagClass={perfTagClass[perfTag(v.angle)]}
                  onApprove={() => setVariantStatus(v.id, "approve")}
                  onSkip={() => setVariantStatus(v.id, "skip")}
                  onUpdate={(patch) => updateVariant(v.id, patch)}
                />
              );
            })}
          </div>

          {/* Proceed bar */}
          {variants.length > 0 && !generating && (
            <div className="border-t border-pink bg-pink/[0.03] px-4 py-2.5 flex items-center gap-3.5 shrink-0">
              <div className="flex-1">
                <div className="text-xs font-bold text-pink mb-1">Ready to proceed?</div>
                <div className="flex gap-3.5">
                  <span className="font-mono text-[9px] text-muted-foreground">{counts.approved} approved</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{counts.pending} pending</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{counts.skipped} skipped</span>
                </div>
              </div>
              <button
                disabled={!(counts.approved > 0 && counts.pending === 0)}
                onClick={() => { saveState(state); navigate("/output"); }}
                className="text-[11px] font-bold px-5 py-2 rounded-lg bg-pink text-primary-foreground shrink-0 transition-all hover:opacity-90 disabled:bg-border2 disabled:text-muted-foreground disabled:cursor-not-allowed"
              >
                → Output
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
  onUpdate,
}: {
  variant: Variant;
  index: number;
  modeTagClass: string;
  perfTagName: string;
  perfTagClass: string;
  onApprove: () => void;
  onSkip: () => void;
  onUpdate: (patch: Partial<Variant>) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const bg = BG_STYLES[v.bg] || BG_STYLES["bg-dark"];

  // BatchStudio is copy-only — always show compact text layout, images are for Output
  const hasImage = false;

  return (
    <div
      className={`bg-surface border rounded-[10px] flex flex-col animate-card-in ${
        v.status === "approved" ? "border-primary/20" : v.status === "skipped" ? "border-destructive/10 opacity-45" : "border-border"
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Thumb — only when image exists */}
      {hasImage && (
        <div className="h-40 relative overflow-hidden rounded-t-[10px]">
          <img src={v.imageB64!} alt={v.headline} className="w-full h-full object-cover" />
          <div className={`absolute top-1.5 right-1.5 tag ${modeTagClass}`}>Mode {v.mode}</div>
        </div>
      )}

      {/* Compact header bar — only when NO image */}
      {!hasImage && (
        <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 flex-wrap">
          <span className={`tag ${modeTagClass}`}>Mode {v.mode}</span>
          <span className="tag t-purple">{v.angle}</span>
          <span className={`tag ${perfTagClass}`}>{perfTagName}</span>
          <span className="font-mono text-[8px] text-border2">|</span>
          <span className="font-mono text-[9px] text-muted-foreground">#{v.id}</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto font-mono text-[8px] px-[7px] py-[2px] rounded border border-border2 bg-transparent text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? "– less" : "+ more"}
          </button>
        </div>
      )}

      {/* Body */}
      <div className="p-3 border-b border-border">
        {/* Tags row — only when image exists (compact header handles this otherwise) */}
        {hasImage && (
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
        )}
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate({ hook: (e.target as HTMLDivElement).innerText.trim() })}
          className="text-[13px] font-bold leading-snug mb-2 p-[4px_7px] rounded border border-transparent hover:bg-surface2 hover:border-border2 cursor-text transition-colors outline-none"
        >
          {v.hook}
        </div>
        <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground mb-1">Headline</div>
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate({ headline: (e.target as HTMLDivElement).innerText.trim() })}
          className="text-[10px] text-muted-foreground p-[4px_7px] rounded border border-transparent hover:bg-surface2 hover:border-border2 cursor-text transition-colors outline-none"
        >
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
