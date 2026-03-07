import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { loadState, saveState, addImage, removeImage, getImagesByCategory, type AppState, type ImageCategory } from "@/lib/store";
import { Upload, X, Image as ImageIcon } from "lucide-react";

type Tab = "brand" | "foundation" | "refs";

const tabs: { id: Tab; label: string; color: string }[] = [
  { id: "brand", label: "Brand Config", color: "bg-primary" },
  { id: "foundation", label: "Foundation", color: "bg-accent" },
  { id: "refs", label: "Refs & Intel", color: "bg-warn" },
];

const IMAGE_CATEGORIES: { key: ImageCategory; label: string; desc: string }[] = [
  { key: "brand_assets", label: "Product Photos", desc: "Main product shots, lifestyle images" },
  { key: "winning_ads", label: "Winning Ads", desc: "High-performing competitor ads" },
  { key: "raw_images", label: "Raw Images", desc: "Unedited photos, behind-the-scenes" },
];

const Hub = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<AppState>(loadState());
  const [activeTab, setActiveTab] = useState<Tab>("brand");
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCategory, setUploadingCategory] = useState<ImageCategory | null>(null);

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

  return (
    <AppLayout
      topbarTitle={p.name}
      topbarExtra={
        <button
          onClick={() => {
            saveState(state);
            navigate("/batch");
          }}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          → Batch Studio
        </button>
      }
    >
      {/* Tab bar */}
      <div className="flex border-b border-border bg-surface px-5 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-[7px] px-4 py-3 text-xs font-semibold border-b-2 transition-all select-none ${
              activeTab === tab.id
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            <div className={`w-[5px] h-[5px] rounded-full ${tab.color}`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 min-h-0">
        {activeTab === "brand" && (
          <div className="animate-fi grid grid-cols-2 gap-4 max-w-5xl">
            {/* Brand panel */}
            <div className="space-y-4">
              <Panel dotColor="bg-primary" title="Brand">
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  <Field label="Brand Name">
                    <input value={b.name} onChange={(e) => updateBrand("name", e.target.value)} className="field-input" />
                  </Field>
                  <Field label="Category">
                    <select value={b.category} onChange={(e) => updateBrand("category", e.target.value)} className="field-input">
                      {["pet", "health", "beauty", "apparel", "food", "general"].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Brand Voice">
                  <input value={b.voice} onChange={(e) => updateBrand("voice", e.target.value)} className="field-input" />
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

              <Panel dotColor="bg-secondary" title="Product">
                <Field label="Product Name">
                  <input value={b.product.name} onChange={(e) => updateProduct("name", e.target.value)} className="field-input" />
                </Field>
                <Field label="Product URL">
                  <input value={b.product.url} onChange={(e) => updateProduct("url", e.target.value)} className="field-input" />
                </Field>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Promise">
                    <input value={b.product.promise} onChange={(e) => updateProduct("promise", e.target.value)} className="field-input" />
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
            <div className="col-span-2 flex justify-end gap-2 mt-2">
              <button onClick={() => setState(loadState())} className="text-[11px] font-semibold px-3 py-1.5 rounded-md border border-border2 text-muted-foreground hover:text-foreground transition-colors">
                Reset
              </button>
              <button onClick={save} className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                {saved ? "✓ Saved" : "Save Config"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "foundation" && (
          <div className="animate-fi space-y-4 max-w-5xl">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              <StatCard value={p.angles.length} label="Angles" color="text-primary" />
              <StatCard value={p.formats.filter((f) => f.status === "done").length} label="Formats indexed" color="text-secondary" />
              <StatCard value={p.batchCount} label="Batches run" color="text-warn" />
            </div>

            {/* Angles */}
            <Panel dotColor="bg-accent" title="angles.json" subtitle="★ critical — drives all copy generation">
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
              </div>
              <div className="font-mono text-[9px] text-muted-foreground p-[7px_10px] bg-background rounded-md border-l-2 border-border2 leading-relaxed">
                Winner = our data proves it. Proven = good but not top. Competitor ↑ = seen working in competitor ads. Untested = no data yet.
              </div>
            </Panel>

            {/* Foundation docs */}
            <Panel dotColor="bg-secondary" title="Foundation Documents">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: "research.md", status: "done", desc: "market landscape, product facts, ICP demographics" },
                  { name: "avatar.md", status: "done", desc: "ICP profile with emotional states per angle" },
                  { name: "beliefs.md", status: "done", desc: "belief shift map — current → desired belief per angle" },
                  { name: "positioning.md", status: "done", desc: "core positioning + which angles it suits" },
                  { name: "context.json", status: "key", desc: "compressed ICP summary — feeds all copy prompts" },
                  { name: "angles.json", status: "angle", desc: "angle defs + hooks + proof points — edit above" },
                ].map((d) => {
                  const dotMap: Record<string, string> = { done: "bg-primary shadow-[0_0_5px_hsl(var(--primary))]", key: "bg-warn shadow-[0_0_4px_hsl(var(--warn))]", angle: "bg-accent shadow-[0_0_4px_hsl(var(--accent))]" };
                  const tagMap: Record<string, string> = { done: "t-cyan", key: "t-warn", angle: "t-purple" };
                  const lblMap: Record<string, string> = { done: "generic", key: "compiled", angle: "★ critical" };
                  return (
                    <div key={d.name} className="bg-surface2 border border-border rounded-lg p-2.5 flex items-start gap-2">
                      <div className={`w-[7px] h-[7px] rounded-full mt-[3px] shrink-0 ${dotMap[d.status]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold mb-0.5">{d.name}</div>
                        <div className="font-mono text-[9px] text-muted-foreground leading-relaxed">{d.desc}</div>
                      </div>
                      <span className={`tag ${tagMap[d.status]}`}>{lblMap[d.status]}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "refs" && (
          <div className="animate-fi space-y-5 max-w-5xl">
            {/* Comp intel */}
            <Panel dotColor="bg-secondary" title="Competitive Intelligence">
              <div className="font-mono text-[9px] text-muted-foreground p-[7px_10px] bg-background rounded-md border-l-2 border-border2 leading-relaxed mb-2.5">
                Paste winning competitor copy here. Foundation Builder uses this to identify working angles + themes in the market.
              </div>
              <textarea
                value={state.project.refs.comp_intel}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    project: { ...s.project, refs: { ...s.project.refs, comp_intel: e.target.value } },
                  }))
                }
                rows={4}
                placeholder="Paste competitor hooks, winning headlines, proven copy…"
                className="field-input"
              />
            </Panel>

            {/* Image Library Sections */}
            {IMAGE_CATEGORIES.filter((cat) => cat.key !== "brand_assets").map((cat) => (
              <Panel key={cat.key} dotColor={cat.key === "winning_ads" ? "bg-cyan-400" : "bg-accent"} title={cat.label} subtitle={cat.desc}>
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
      </div>
    </AppLayout>
  );
};

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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-3 last:mb-0">
    <label className="block font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-1.5">{label}</label>
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
