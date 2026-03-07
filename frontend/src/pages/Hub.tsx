import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { loadState, saveState, addImage, removeImage, getImagesByCategory, type AppState, type ImageCategory, type FoundationData } from "@/lib/store";
import { api } from "@/lib/api";
import { Upload, X, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Sparkles, Lock, ChevronRight } from "lucide-react";

type Tab = "brand" | "foundation" | "refs" | "intel";

interface TabConfig {
  id: Tab;
  label: string;
  color: string;
  step: keyof AppState["project"]["completion"];
}

const tabs: TabConfig[] = [
  { id: "brand", label: "Brand Config", color: "bg-primary", step: "brandConfig" },
  { id: "foundation", label: "Foundation", color: "bg-accent", step: "foundation" },
  { id: "refs", label: "Refs", color: "bg-warn", step: "refs" },
  { id: "intel", label: "Intel", color: "bg-cyan-400", step: "intel" },
];

const IMAGE_CATEGORIES: { key: ImageCategory; label: string; desc: string }[] = [
  { key: "brand_assets", label: "Product Photos", desc: "Main product shots, lifestyle images" },
  { key: "winning_ads", label: "Winning Ads", desc: "High-performing competitor ads" },
  { key: "raw_images", label: "Raw Images", desc: "Unedited photos, behind-the-scenes" },
];

// Helper to check if brand config is valid
const isBrandConfigValid = (brand: AppState["project"]["brand"]): boolean => {
  return !!(
    brand.name?.trim() &&
    brand.voice?.trim() &&
    brand.product.name?.trim() &&
    brand.product.promise?.trim()
  );
};

// Helper to check if foundation is complete
const isFoundationComplete = (foundation: FoundationData): boolean => {
  const docs = [foundation.research, foundation.avatar, foundation.beliefs, foundation.positioning, foundation.context, foundation.anglesDoc];
  return docs.every((doc) => doc.status === "done");
};

// Helper to check if refs are complete (have images or angles)
const isRefsComplete = (state: AppState): boolean => {
  const hasWinningAds = getImagesByCategory(state, "winning_ads").length > 0;
  const hasAngles = state.project.angles.length > 0;
  return hasWinningAds || hasAngles;
};

// Helper to check if intel is complete
const isIntelComplete = (state: AppState): boolean => {
  return state.project.refs.comp_intel?.trim().length > 50;
};

const Hub = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<AppState>(loadState());
  const [activeTab, setActiveTab] = useState<Tab>("brand");
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCategory, setUploadingCategory] = useState<ImageCategory | null>(null);
  
  // Foundation generation state
  const [generatingFoundation, setGeneratingFoundation] = useState(false);
  const [foundationError, setFoundationError] = useState<string | null>(null);
  
  // Completion status
  const [completion, setCompletion] = useState({
    brandConfig: false,
    foundation: false,
    refs: false,
    intel: false,
  });

  // Update completion status whenever state changes
  useEffect(() => {
    const newCompletion = {
      brandConfig: isBrandConfigValid(state.project.brand),
      foundation: isFoundationComplete(state.project.foundation),
      refs: isRefsComplete(state),
      intel: isIntelComplete(state),
    };
    setCompletion(newCompletion);
    
    // Update state with new completion
    setState((s) => ({
      ...s,
      project: {
        ...s.project,
        completion: newCompletion,
      },
    }));
  }, [
    state.project.brand,
    state.project.foundation,
    state.project.refs.comp_intel,
    state.project.angles.length,
    state.imageLibrary.length,
  ]);

  const save = useCallback(() => {
    saveState(state);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }, [state]);

  const p = state.project;
  const b = p.brand;
  const c = p.compliance;

  const updateBrand = (key: string, value: string) => {
    setState((s) => ({ ...s, project: { ...s.project, brand: { ...s.project.brand, [key]: value } } }));
  };

  const updateProduct = (key: string, value: string) => {
    setState((s) => ({
      ...s,
      project: {
        ...s.project,
        brand: { ...s.project.brand, product: { ...s.project.brand.product, [key]: value } },
      },
    }));
  };

  const updateCompliance = (key: string, value: string) => {
    setState((s) => ({
      ...s,
      project: { ...s.project, compliance: { ...s.project.compliance, [key]: value } },
    }));
  };

  const removeClaim = (claim: string) => {
    setState((s) => ({
      ...s,
      project: {
        ...s.project,
        compliance: {
          ...s.project.compliance,
          forbidden_claims: s.project.compliance.forbidden_claims.filter((c) => c !== claim),
        },
      },
    }));
  };

  const addClaim = (claim: string) => {
    if (!claim.trim() || c.forbidden_claims.includes(claim)) return;
    setState((s) => ({
      ...s,
      project: {
        ...s.project,
        compliance: {
          ...s.project.compliance,
          forbidden_claims: [...s.project.compliance.forbidden_claims, claim.trim()],
        },
      },
    }));
  };

  // Foundation generation handler
  const generateFoundation = async () => {
    if (!isBrandConfigValid(state.project.brand)) {
      setFoundationError("Please complete Brand Config first (Brand Name, Voice, Product Name, and Promise are required)");
      setActiveTab("brand");
      return;
    }

    setGeneratingFoundation(true);
    setFoundationError(null);

    try {
      // Mark foundation as generating
      setState((s) => ({
        ...s,
        project: {
          ...s.project,
          foundation: {
            ...s.project.foundation,
            research: { ...s.project.foundation.research, status: "generating" },
            avatar: { ...s.project.foundation.avatar, status: "generating" },
            beliefs: { ...s.project.foundation.beliefs, status: "generating" },
            positioning: { ...s.project.foundation.positioning, status: "generating" },
            context: { ...s.project.foundation.context, status: "generating" },
            anglesDoc: { ...s.project.foundation.anglesDoc, status: "generating" },
          },
        },
      }));

      const response = await api.generateFoundation({
        brand: state.project.brand,
        compliance: state.project.compliance,
        comp_intel: state.project.refs.comp_intel,
      });

      // Update state with generated foundation and angles
      setState((s) => ({
        ...s,
        project: {
          ...s.project,
          foundation: response.foundation,
          angles: response.angles.map((a) => ({ name: a.name, perf_tag: a.perf_tag })),
        },
      }));

      saveState({
        ...state,
        project: {
          ...state.project,
          foundation: response.foundation,
          angles: response.angles.map((a) => ({ name: a.name, perf_tag: a.perf_tag })),
        },
      });
    } catch (err) {
      console.error("Failed to generate foundation:", err);
      setFoundationError(err instanceof Error ? err.message : "Failed to generate foundation");
      
      // Mark as error
      setState((s) => ({
        ...s,
        project: {
          ...s.project,
          foundation: {
            ...s.project.foundation,
            research: { ...s.project.foundation.research, status: "error" },
            avatar: { ...s.project.foundation.avatar, status: "error" },
            beliefs: { ...s.project.foundation.beliefs, status: "error" },
            positioning: { ...s.project.foundation.positioning, status: "error" },
            context: { ...s.project.foundation.context, status: "error" },
            anglesDoc: { ...s.project.foundation.anglesDoc, status: "error" },
          },
        },
      }));
    } finally {
      setGeneratingFoundation(false);
    }
  };

  // Image library handlers
  const handleFileSelect = async (files: FileList | null, category: ImageCategory) => {
    if (!files || files.length === 0) return;
    setUploadingCategory(category);
    try {
      let newState = state;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        newState = await addImage(newState, file, category);
      }
      setState(newState);
    } catch (err) {
      console.error("Failed to upload image:", err);
    } finally {
      setUploadingCategory(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, category: ImageCategory) => {
    e.preventDefault();
    setDragOver(null);
    await handleFileSelect(e.dataTransfer.files, category);
  };

  const handleRemoveImage = (imageId: string) => {
    const newState = removeImage(state, imageId);
    setState(newState);
  };

  const perfTagLabel: Record<string, string> = { winner: "★ winner", proven: "proven", comp: "competitor ↑", untested: "untested" };
  const perfTagClass: Record<string, string> = { winner: "t-accent", proven: "t-accent", comp: "t-cyan", untested: "t-muted" };

  const allComplete = completion.brandConfig && completion.foundation && completion.refs && completion.intel;
  const missingSteps = Object.entries(completion)
    .filter(([, v]) => !v)
    .map(([k]) => tabs.find((t) => t.step === k)?.label || k);

  return (
    <AppLayout
      topbarTitle={p.name}
      topbarExtra={
        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          <div className="hidden sm:flex items-center gap-2 mr-2">
            {tabs.map((tab) => {
              const isComplete = completion[tab.step];
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    isComplete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                  title={`Go to ${tab.label}`}
                >
                  {isComplete ? <CheckCircle2 size={10} /> : <div className={`w-2 h-2 rounded-full ${tab.color}`} />}
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
          
          {/* Batch Studio button */}
          <button
            onClick={() => {
              saveState(state);
              navigate("/batch");
            }}
            disabled={!allComplete}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all ${
              allComplete
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            title={allComplete ? "Go to Batch Studio" : `Complete required: ${missingSteps.join(", ")}`}
          >
            {allComplete ? (
              <>
                → Batch Studio <ChevronRight size={12} />
              </>
            ) : (
              <>
                <Lock size={11} /> Complete Steps
              </>
            )}
          </button>
        </div>
      }
    >
      {/* Warning banner if not all complete */}
      {!allComplete && (
        <div className="bg-warn/10 border-b border-warn/20 px-5 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-warn">
            <AlertCircle size={14} />
            <span>
              Complete all steps to unlock Batch Studio:
              <span className="font-semibold ml-1">{missingSteps.join(", ")}</span>
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {Object.values(completion).filter(Boolean).length} / 4 complete
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-border bg-surface px-5 shrink-0">
        {tabs.map((tab) => {
          const isComplete = completion[tab.step];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-[7px] px-4 py-3 text-xs font-semibold border-b-2 transition-all select-none ${
                activeTab === tab.id
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              <div className={`w-[5px] h-[5px] rounded-full ${isComplete ? "bg-primary" : tab.color}`} />
              {tab.label}
              {isComplete && <CheckCircle2 size={10} className="text-primary ml-0.5" />}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-5 min-h-0">
        {activeTab === "brand" && (
          <div className="animate-fi grid grid-cols-2 gap-4 max-w-5xl">
            {/* Brand panel */}
            <div className="space-y-4">
              <Panel dotColor="bg-primary" title="Brand" extra={completion.brandConfig && <CheckBadge />}>
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  <Field label="Brand Name" required>
                    <input 
                      value={b.name} 
                      onChange={(e) => updateBrand("name", e.target.value)} 
                      className={`field-input ${!b.name?.trim() ? "border-warn/50" : ""}`}
                      placeholder="Required"
                    />
                  </Field>
                  <Field label="Category">
                    <select value={b.category} onChange={(e) => updateBrand("category", e.target.value)} className="field-input">
                      {["pet", "health", "beauty", "apparel", "food", "general"].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Brand Voice" required>
                  <input 
                    value={b.voice} 
                    onChange={(e) => updateBrand("voice", e.target.value)} 
                    className={`field-input ${!b.voice?.trim() ? "border-warn/50" : ""}`}
                    placeholder="e.g. confident, direct response, men's transformation"
                  />
                </Field>
                <Field label="Palette">
                  <div className="flex gap-2 flex-wrap items-end">
                    {b.palette.map((color, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newPalette = [...b.palette];
                            newPalette[i] = e.target.value;
                            setState((s) => ({
                              ...s,
                              project: { ...s.project, brand: { ...s.project.brand, palette: newPalette } },
                            }));
                          }}
                          className="w-9 h-9 rounded-[7px] border-2 border-border2 cursor-pointer p-0 bg-transparent"
                        />
                        <span className="font-mono text-[8px] text-muted-foreground">
                          {["primary", "accent", "bg", "text"][i] || "color"}
                        </span>
                      </div>
                    ))}
                  </div>
                </Field>
              </Panel>

              <Panel dotColor="bg-secondary" title="Product" extra={b.product.name && b.product.promise ? <CheckBadge /> : null}>
                <Field label="Product Name" required>
                  <input 
                    value={b.product.name} 
                    onChange={(e) => updateProduct("name", e.target.value)} 
                    className={`field-input ${!b.product.name?.trim() ? "border-warn/50" : ""}`}
                    placeholder="Required"
                  />
                </Field>
                <Field label="Product URL">
                  <input value={b.product.url} onChange={(e) => updateProduct("url", e.target.value)} className="field-input" />
                </Field>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Promise" required>
                    <input 
                      value={b.product.promise} 
                      onChange={(e) => updateProduct("promise", e.target.value)} 
                      className={`field-input ${!b.product.promise?.trim() ? "border-warn/50" : ""}`}
                      placeholder="Required - key value proposition"
                    />
                  </Field>
                  <Field label="Offer">
                    <input value={b.product.offer} onChange={(e) => updateProduct("offer", e.target.value)} className="field-input" />
                  </Field>
                </div>
                <Field label="Visual Description">
                  <input
                    value={b.product.visualDesc}
                    onChange={(e) => updateProduct("visualDesc", e.target.value)}
                    placeholder="e.g. fitted black compression tank top, worn by a regular-looking man"
                    className="field-input"
                  />
                </Field>
              </Panel>
            </div>

            {/* Right col */}
            <div className="space-y-4">
              <Panel dotColor="bg-destructive" title="Compliance">
                <Field label="Level">
                  <select value={c.level} onChange={(e) => updateCompliance("level", e.target.value)} className="field-input">
                    <option value="">— none —</option>
                    {["pet_non-medical", "supplement", "cosmetic", "general"].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Forbidden Claims">
                  <div className="flex flex-wrap gap-1.5 p-[7px] bg-surface2 border border-border rounded-[7px] min-h-[38px] cursor-text transition-colors focus-within:border-primary">
                    {c.forbidden_claims.map((cl) => (
                      <span
                        key={cl}
                        className="flex items-center gap-1 px-2 py-0.5 bg-surface border border-destructive/25 rounded-full font-mono text-[9px] text-destructive"
                      >
                        {cl}
                        <span onClick={() => removeClaim(cl)} className="cursor-pointer opacity-50 hover:opacity-100 text-[10px]">
                          ×
                        </span>
                      </span>
                    ))}
                    <input
                      placeholder="type + enter"
                      className="flex-1 min-w-[80px] border-none bg-transparent outline-none font-mono text-[9px] text-foreground"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addClaim((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                  </div>
                </Field>
                <Field label="Disclaimer">
                  <textarea
                    value={c.disclaimer}
                    onChange={(e) => updateCompliance("disclaimer", e.target.value)}
                    rows={2}
                    className="field-input resize-y"
                  />
                </Field>
              </Panel>

              {/* Product Photos - Image Library */}
              <Panel dotColor="bg-warn" title="Product Photos" subtitle="Upload your image library">
                <ImageLibrarySection
                  images={getImagesByCategory(state, "brand_assets")}
                  category="brand_assets"
                  onUpload={handleFileSelect}
                  onRemove={handleRemoveImage}
                  dragOver={dragOver}
                  setDragOver={setDragOver}
                  onDrop={handleDrop}
                  uploading={uploadingCategory === "brand_assets"}
                />
              </Panel>
            </div>

            {/* Save bar */}
            <div className="col-span-2 flex justify-between items-center mt-2">
              <div className="text-[10px] text-muted-foreground">
                {!completion.brandConfig && (
                  <span className="text-warn flex items-center gap-1">
                    <AlertCircle size={10} /> Complete required fields to proceed
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setState(loadState())} className="text-[11px] font-semibold px-3 py-1.5 rounded-md border border-border2 text-muted-foreground hover:text-foreground transition-colors">
                  Reset
                </button>
                <button onClick={save} className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                  {saved ? "✓ Saved" : "Save Config"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "foundation" && (
          <div className="animate-fi space-y-4 max-w-5xl">
            {/* Foundation generation banner */}
            {!completion.foundation && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-accent">
                      <Sparkles size={14} />
                      Generate Foundation Documents
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
                      Foundation documents are generated from your Brand Config. They include market research, 
                      ideal customer profile, belief maps, and positioning strategy. These power all ad generation.
                    </p>
                  </div>
                  <button
                    onClick={generateFoundation}
                    disabled={generatingFoundation || !completion.brandConfig}
                    className={`flex items-center gap-1.5 text-[11px] font-semibold px-4 py-2 rounded-md transition-all ${
                      generatingFoundation || !completion.brandConfig
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-accent text-accent-foreground hover:opacity-90"
                    }`}
                  >
                    {generatingFoundation ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        Generate Foundation
                      </>
                    )}
                  </button>
                </div>
                {foundationError && (
                  <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-[10px] text-destructive">
                    {foundationError}
                  </div>
                )}
                {!completion.brandConfig && (
                  <div className="mt-3 text-[10px] text-warn flex items-center gap-1">
                    <AlertCircle size={10} />
                    Complete Brand Config first (Brand Name, Voice, Product Name, Promise)
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              <StatCard value={p.angles.length} label="Angles" color="text-primary" />
              <StatCard value={p.formats.filter((f) => f.status === "done").length} label="Formats indexed" color="text-secondary" />
              <StatCard value={p.batchCount} label="Batches run" color="text-warn" />
            </div>

            {/* Angles */}
            <Panel dotColor="bg-accent" title="angles.json" subtitle="★ critical — drives all copy generation" extra={p.angles.length > 0 ? <CheckBadge /> : null}>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {p.angles.map((a) => (
                  <div key={a.name} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border border-border2 text-muted-foreground bg-surface2 ${a.perf_tag === "winner" ? "border-primary/25" : ""}`}>
                    {(a.perf_tag === "winner" || a.perf_tag === "comp") && (
                      <div className={`w-[5px] h-[5px] rounded-full ${a.perf_tag === "winner" ? "bg-primary shadow-[0_0_5px_hsl(var(--primary))]" : "bg-secondary"}`} />
                    )}
                    {a.name}
                    <span className={`tag ${perfTagClass[a.perf_tag]}`}>{perfTagLabel[a.perf_tag]}</span>
                  </div>
                ))}
                {p.angles.length === 0 && (
                  <div className="text-[11px] text-muted-foreground italic">
                    No angles defined. Generate Foundation to create angles from your brand config.
                  </div>
                )}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground p-[7px_10px] bg-background rounded-md border-l-2 border-border2 leading-relaxed">
                Winner = our data proves it. Proven = good but not top. Competitor ↑ = seen working in competitor ads. Untested = no data yet.
              </div>
            </Panel>

            {/* Foundation docs */}
            <Panel dotColor="bg-secondary" title="Foundation Documents" extra={completion.foundation ? <CheckBadge /> : null}>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'research', name: "research.md", status: p.foundation.research.status, desc: "market landscape, product facts, ICP demographics" },
                  { key: 'avatar', name: "avatar.md", status: p.foundation.avatar.status, desc: "ICP profile with emotional states per angle" },
                  { key: 'beliefs', name: "beliefs.md", status: p.foundation.beliefs.status, desc: "belief shift map — current → desired belief per angle" },
                  { key: 'positioning', name: "positioning.md", status: p.foundation.positioning.status, desc: "core positioning + which angles it suits" },
                  { key: 'context', name: "context.json", status: p.foundation.context.status, desc: "compressed ICP summary — feeds all copy prompts" },
                  { key: 'anglesDoc', name: "angles.json", status: p.foundation.anglesDoc.status, desc: "angle defs + hooks + proof points — edit above" },
                ].map((d) => {
                  const getDotClass = (status: string) => {
                    switch (status) {
                      case 'done': return "bg-primary shadow-[0_0_5px_hsl(var(--primary))]";
                      case 'generating': return "bg-warn animate-pulse";
                      case 'error': return "bg-destructive";
                      default: return "bg-muted";
                    }
                  };
                  const getTagClass = (status: string) => {
                    switch (status) {
                      case 'done': return "t-cyan";
                      case 'generating': return "t-warn";
                      case 'error': return "t-destructive";
                      default: return "t-muted";
                    }
                  };
                  const getLabel = (status: string) => {
                    switch (status) {
                      case 'done': return "done";
                      case 'generating': return "generating...";
                      case 'error': return "error";
                      default: return "pending";
                    }
                  };
                  return (
                    <div key={d.key} className="bg-surface2 border border-border rounded-lg p-2.5 flex items-start gap-2">
                      <div className={`w-[7px] h-[7px] rounded-full mt-[3px] shrink-0 ${getDotClass(d.status)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold mb-0.5">{d.name}</div>
                        <div className="font-mono text-[9px] text-muted-foreground leading-relaxed">{d.desc}</div>
                      </div>
                      <span className={`tag ${getTagClass(d.status)}`}>{getLabel(d.status)}</span>
                    </div>
                  );
                })}
              </div>
              
              {/* View content buttons */}
              {completion.foundation && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['research', 'avatar', 'beliefs', 'positioning'] as const).map((docKey) => (
                    <button
                      key={docKey}
                      onClick={() => {
                        const doc = p.foundation[docKey];
                        if (doc.content) {
                          const blob = new Blob([doc.content], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        }
                      }}
                      className="text-[10px] px-2 py-1 rounded-md border border-border hover:border-primary hover:text-primary transition-colors"
                    >
                      View {p.foundation[docKey].name}
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab === "refs" && (
          <div className="animate-fi space-y-5 max-w-5xl">
            {/* Refs completion status */}
            {!completion.refs && (
              <div className="bg-warn/10 border border-warn/20 rounded-lg p-3">
                <div className="text-[11px] text-warn flex items-center gap-2">
                  <AlertCircle size={12} />
                  Upload winning ads or generate Foundation to complete this step
                </div>
              </div>
            )}

            {/* Image Library Sections */}
            {IMAGE_CATEGORIES.filter((cat) => cat.key !== "brand_assets").map((cat) => (
              <Panel 
                key={cat.key} 
                dotColor={cat.key === "winning_ads" ? "bg-cyan-400" : "bg-accent"} 
                title={cat.label} 
                subtitle={cat.desc}
                extra={getImagesByCategory(state, cat.key).length > 0 ? <CheckBadge /> : null}
              >
                <ImageLibrarySection
                  images={getImagesByCategory(state, cat.key)}
                  category={cat.key}
                  onUpload={handleFileSelect}
                  onRemove={handleRemoveImage}
                  dragOver={dragOver}
                  setDragOver={setDragOver}
                  onDrop={handleDrop}
                  uploading={uploadingCategory === cat.key}
                />
              </Panel>
            ))}
          </div>
        )}

        {activeTab === "intel" && (
          <div className="animate-fi space-y-5 max-w-5xl">
            {/* Comp intel */}
            <Panel 
              dotColor="bg-secondary" 
              title="Competitive Intelligence"
              extra={completion.intel ? <CheckBadge /> : null}
            >
              <div className="font-mono text-[9px] text-muted-foreground p-[7px_10px] bg-background rounded-md border-l-2 border-border2 leading-relaxed mb-2.5">
                Paste winning competitor copy here. Foundation Builder uses this to identify working angles + themes in the market.
                {state.project.refs.comp_intel.length > 0 && state.project.refs.comp_intel.length < 50 && (
                  <span className="text-warn block mt-1">
                    Add at least 50 characters to complete this step.
                  </span>
                )}
              </div>
              <textarea
                value={state.project.refs.comp_intel}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    project: { ...s.project, refs: { ...s.project.refs, comp_intel: e.target.value } },
                  }))
                }
                rows={12}
                placeholder="Paste competitor hooks, winning headlines, proven copy, market insights, customer reviews from competitors, ad screenshots descriptions..."
                className="field-input font-mono text-[11px]"
              />
              <div className="mt-2 flex justify-between items-center text-[10px] text-muted-foreground">
                <span>{state.project.refs.comp_intel.length} characters</span>
                {completion.intel && <span className="text-primary flex items-center gap-1"><CheckCircle2 size={10} /> Complete</span>}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

// Check badge component
const CheckBadge = () => (
  <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
    <CheckCircle2 size={12} />
  </span>
);

// Image Library Section Component
interface ImageLibrarySectionProps {
  images: { id: string; name: string; data: string }[];
  category: ImageCategory;
  onUpload: (files: FileList | null, category: ImageCategory) => void;
  onRemove: (imageId: string) => void;
  dragOver: string | null;
  setDragOver: (id: string | null) => void;
  onDrop: (e: React.DragEvent, category: ImageCategory) => void;
  uploading: boolean;
}

const ImageLibrarySection = ({
  images,
  category,
  onUpload,
  onRemove,
  dragOver,
  setDragOver,
  onDrop,
  uploading,
}: ImageLibrarySectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDragOver = dragOver === category;

  return (
    <div className="space-y-3">
      {/* Image Grid */}
      <div
        className={`grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 transition-all ${
          isDragOver ? "opacity-50 scale-[0.98]" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(category);
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => onDrop(e, category)}
      >
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative aspect-square rounded-lg bg-surface2 border border-border overflow-hidden hover:border-primary transition-colors"
          >
            <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
              <span className="text-[8px] text-white/80 text-center px-1 truncate w-full">{img.name}</span>
              <button
                onClick={() => onRemove(img.id)}
                className="p-1.5 rounded-full bg-destructive/90 text-white hover:bg-destructive transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ))}

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`aspect-square rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
            isDragOver
              ? "border-primary bg-primary/10"
              : "border-border2 hover:border-primary hover:bg-primary/[0.04]"
          } ${uploading ? "opacity-50 cursor-wait" : ""}`}
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : (
            <>
              <Upload size={16} className="opacity-40" />
              <span className="font-mono text-[8px] text-muted-foreground">{isDragOver ? "Drop here" : "Upload"}</span>
            </>
          )}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onUpload(e.target.files, category);
          e.target.value = "";
        }}
      />

      {/* Info text */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ImageIcon size={10} />
          {images.length} image{images.length !== 1 ? "s" : ""} in library
        </span>
        <span>Drag & drop or click to upload</span>
      </div>
    </div>
  );
};

// Shared components
const Panel = ({ dotColor, title, subtitle, children, extra }: { dotColor: string; title: string; subtitle?: string; children: React.ReactNode; extra?: React.ReactNode }) => (
  <div className="bg-surface border border-border rounded-[11px] overflow-hidden">
    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
      <div className="text-xs font-bold flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {title}
        {subtitle && <span className="font-mono text-[9px] text-muted-foreground font-normal ml-1.5">{subtitle}</span>}
      </div>
      {extra}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div className="mb-3 last:mb-0">
    <label className="block font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-1.5">
      {label}
      {required && <span className="text-warn ml-1">*</span>}
    </label>
    {children}
  </div>
);

const StatCard = ({ value, label, color }: { value: number; label: string; color: string }) => (
  <div className="bg-surface border border-border rounded-[9px] p-3">
    <div className={`text-[22px] font-extrabold leading-none mb-1 ${color}`}>{value}</div>
    <div className="font-mono text-[8px] text-muted-foreground tracking-widest uppercase">{label}</div>
  </div>
);

export default Hub;
