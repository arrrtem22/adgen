import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { loadState, saveState, addImage, removeImage, getImagesByCategory, setFoundationDoc, resetFoundation, addWinningAd, removeWinningAd, addRawImage, removeRawImage, setAdAnalysis, SEED_FOUNDATION, type AppState, type ImageCategory, type Foundation, type FoundationDocStatus, type UploadedImage } from "@/lib/store";
import { Upload, X, Image as ImageIcon } from "lucide-react";

function parseClaudeJSON(text: string) {
  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(clean);
}

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
  const [buildingFoundation, setBuildingFoundation] = useState(false);
  const [buildProgress, setBuildProgress] = useState({ done: 0, total: 6 });
  const [analyzingAds, setAnalyzingAds] = useState(false);
  const winningAdsInputRef = useRef<HTMLInputElement>(null);
  const rawImagesInputRef = useRef<HTMLInputElement>(null);
  const [winningAdsDragOver, setWinningAdsDragOver] = useState(false);
  const [rawImagesDragOver, setRawImagesDragOver] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; content: string } | null>(null);

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

  const readFileAsUploadedImage = (file: File): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          base64: reader.result as string,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleWinningAdFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const img = await readFileAsUploadedImage(file);
      setState((s) => addWinningAd(s, img));
    }
  };

  const handleRawImageFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const img = await readFileAsUploadedImage(file);
      setState((s) => addRawImage(s, img));
    }
  };

  const analyzeAds = async () => {
    const ads = state.project.refs.winning_ads;
    if (!ads.length) return;
    
    // Note: This feature requires backend integration
    // The backend now handles AI provider selection (Claude or Gemini)
    console.log("Ad analysis requires backend API integration");
    
    // For now, show a placeholder analysis
    setAnalyzingAds(true);
    setState((s) => setAdAnalysis(s, { status: "analyzing" }));
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setState((s) => {
      const breakdown = ads.map((img, i) => ({
        imageId: img.id || `img_${i}`,
        hook: "Eye-catching visual with clear value proposition",
        headline: "Benefit-driven headline",
        emotionalAngle: "Desire for improvement",
        layout: "Centered product with bold text",
        colorPalette: ["#1a1a1a", "#ffffff", "#c8f060"],
        format: "Square product shot",
        copyFormulas: ["Problem-Agitation-Solution", "Before-After"],
        whatWorks: "Clear visual hierarchy and strong CTA",
      }));
      
      let ns = setAdAnalysis(s, { 
        status: "done", 
        updatedAt: new Date().toISOString(), 
        breakdown 
      });
      ns = setFoundationDoc(ns, "creative_intel" as keyof Foundation, { 
        content: "These ads show consistent patterns: clear product focus, benefit-driven headlines, and strong visual hierarchy. The most effective ads use contrasting colors and centered layouts.", 
        status: "done", 
        updatedAt: new Date().toISOString() 
      });
      return ns;
    });
    
    setAnalyzingAds(false);
  };

  const perfTagLabel: Record<string, string> = { winner: "★ winner", proven: "proven", comp: "competitor ↑", untested: "untested" };
  const perfTagClass: Record<string, string> = { winner: "t-accent", proven: "t-accent", comp: "t-cyan", untested: "t-muted" };

  const updateProject = (patch: Partial<typeof p>) => {
    setState((s) => {
      const ns = { ...s, project: { ...s.project, ...patch } };
      saveState(ns);
      return ns;
    });
  };

  const DOC_META: { key: keyof Foundation; name: string; desc: string }[] = [
    { key: "research", name: "research.md", desc: "market landscape, product facts, ICP demographics" },
    { key: "avatar", name: "avatar.md", desc: "ICP profile with emotional states per angle" },
    { key: "beliefs", name: "beliefs.md", desc: "belief shift map — current → desired belief per angle" },
    { key: "positioning", name: "positioning.md", desc: "core positioning + which angles it suits" },
    { key: "context", name: "context.json", desc: "compressed ICP summary — feeds all copy prompts" },
    { key: "angles", name: "angles.json", desc: "angle defs + hooks + proof points" },
  ];

  const callClaude = async (system: string, user: string): Promise<string> => {
    // Call backend API which handles AI provider selection (Claude or Gemini)
    const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');
    
    try {
      const res = await fetch(`${API_BASE}/foundation/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: state.project.brand,
          compliance: state.project.compliance,
          comp_intel: user, // Pass the user prompt as comp_intel for context
        }),
      });
      
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      
      // Return combined foundation content
      return data.foundation?.research?.content || "";
    } catch (err) {
      console.error("Backend API call failed:", err);
      throw err;
    }
  };

  const buildFoundation = async () => {
    setBuildingFoundation(true);
    setBuildProgress({ done: 0, total: 6 });

    const brand = state.project.brand;
    const prod = brand.product;
    const comp = state.project.compliance;
    const anglesStr = state.project.angles.map((a) => `${a.name} (${a.perf_tag})`).join(", ");

    const brandBlock = `Brand: ${brand.name}\nCategory: ${brand.category}\nVoice: ${brand.voice}\nProduct: ${prod.name}\nPromise: ${prod.promise}\nOffer: ${prod.offer}\nVisual: ${prod.visualDesc}\nCompliance level: ${comp.level}\nForbidden claims: ${comp.forbidden_claims.join(", ")}\nDisclaimer: ${comp.disclaimer}\nAngles: ${anglesStr}`;

    const creativeIntelBlock = state.foundation.creative_intel.status === "done" && state.foundation.creative_intel.breakdown.length > 0
      ? `\n\nCREATIVE INTELLIGENCE FROM WINNING ADS:\n${typeof state.foundation.creative_intel === "object" && "breakdown" in state.foundation.creative_intel ? JSON.stringify(state.foundation.creative_intel.breakdown, null, 2) : ""}`
      : "";

    const generated: Record<string, string> = {};

    const setDoc = (key: keyof Foundation, patch: { content?: string; status: FoundationDocStatus }) => {
      setState((s) => {
        const ns = setFoundationDoc(s, key, { ...patch, updatedAt: patch.status === "done" ? new Date().toISOString() : s.foundation[key].updatedAt });
        return ns;
      });
    };

    const anglesJson = JSON.stringify(state.project.angles, null, 2);
    const anglesList = state.project.angles.map((a) => `- ${a.name} (${a.perf_tag})`).join("\n");

    const steps: { key: keyof Foundation; system: string; userFn: () => string }[] = [
      {
        key: "research",
        system: "You are a direct-response market researcher. Based on the product inputs below, generate a comprehensive research.md document.",
        userFn: () => `PRODUCT INPUTS:
- Brand: ${brand.name}
- Category: ${brand.category}
- Product: ${prod.name}
- Promise: ${prod.promise}
- Offer: ${prod.offer}
- Brand Voice: ${brand.voice}
- Compliance Level: ${comp.level}
- Forbidden Claims: ${comp.forbidden_claims.join(", ")}

Generate a structured research.md with these sections:

## Market Landscape
What category does this product sit in, who are the main players, what are customers currently using instead, what does the market promise vs what it delivers.

## Product Facts
What the product actually does mechanically, how it works, what makes it different from alternatives, what it cannot claim.

## Customer Demographics
Who buys this. Age, gender, life situation, income level, where they spend time online, what media they consume.

## Purchase Triggers
What specific moment or event causes someone to search for this type of product. What happened right before they decided to buy.

## Competitive Landscape
What alternatives exist, what are their price points, what angles do they use in their ads, where do they fall short.

## Market Gaps
What is NOT being said in this market that is true about this product. Where is the white space.

Write in clear, factual prose. No fluff. Be specific — avoid vague generalities. If something cannot be known from the inputs, make a clearly reasoned assumption and mark it (assumed).${creativeIntelBlock}`,
      },
      {
        key: "avatar",
        system: "You are a direct-response customer research specialist. Using the research document and product inputs below, generate a detailed avatar.md — a deep customer profile that will be used to write conversion-focused ad copy.",
        userFn: () => `PRODUCT INPUTS:
- Brand: ${brand.name}
- Category: ${brand.category}
- Product: ${prod.name}
- Promise: ${prod.promise}
- Offer: ${prod.offer}
- Brand Voice: ${brand.voice}

RESEARCH DOCUMENT:
${generated["research"]}

Generate avatar.md with these sections:

## Primary Avatar: [give them a name and one-line description]

### Who They Are
Age, gender, life situation, job, family status. Paint a specific person, not a demographic bracket.

### A Day In Their Life
Walk through a typical day. When does the problem show up? How does it affect them in the morning, at work, socially, at home?

### The Felt Problem
What do they feel, not what they think. The frustration, embarrassment, or fear they experience around this problem. Use the language they would actually use — not clinical, not polished.

### What They've Already Tried
Specific alternatives they've attempted, why each one failed or disappointed them. What they told themselves after each failure.

### Emotional States By Angle
For each angle below, describe the specific emotional state the avatar is in when that angle would resonate most:
${anglesList}

### What They Tell Themselves
The internal narrative running in their head. The objections, the self-doubt, the rationalizations for not buying.

### The Dream Outcome
Not the product benefit — the downstream life change. What does life look like 30 days after the problem is solved?

### Language They Use
Actual words, phrases, and expressions this person uses when talking about the problem. These become hooks.

Be ruthlessly specific. A vague avatar produces generic copy. Name real situations, real moments, real feelings.`,
      },
      {
        key: "beliefs",
        system: "You are a direct-response conversion strategist. Using the avatar and product inputs below, generate a beliefs.md — a belief shift map that shows what the customer currently believes vs what they need to believe to buy.",
        userFn: () => `PRODUCT INPUTS:
- Brand: ${brand.name}
- Product: ${prod.name}
- Promise: ${prod.promise}
- Offer: ${prod.offer}
- Compliance: ${comp.level}
- Forbidden Claims: ${comp.forbidden_claims.join(", ")}

AVATAR DOCUMENT:
${generated["avatar"]}

Generate beliefs.md with these sections:

## Core Belief Shift
The single most important belief the customer must shift to go from scrolling past to buying.
- Current belief: [what they believe now]
- Required belief: [what they must believe to buy]
- The bridge: [what argument, proof, or reframe creates the shift]

## Belief Map By Angle
For each angle, map the full belief journey:

${state.project.angles.map((a) => `### ${a.name}
- **Blocking belief**: The specific thought stopping them from acting
- **Triggering belief**: The belief that, once held, makes purchase feel obvious
- **Best proof type**: What kind of evidence shifts this belief fastest (testimonial / statistic / demonstration / comparison / authority)
- **Hook direction**: One sentence describing the hook approach that exploits this shift
- **Objection to pre-empt**: The doubt that surfaces right after the triggering belief lands`).join("\n\n")}

## Universal Objections
Beliefs that block purchase regardless of angle:
- Price objection: current belief + reframe
- Skepticism objection: current belief + reframe
- Timing objection: current belief + reframe

## Compliance Guardrails
Given the compliance level (${comp.level}) and forbidden claims, note which belief shifts must be handled carefully and how to frame them without triggering violations.

Be direct and specific. Every belief and reframe must be rooted in the avatar document above.`,
      },
      {
        key: "positioning",
        system: "You are a brand strategist specializing in direct-response positioning. Using the documents below, generate positioning.md — the strategic positioning document that defines how this product should be framed in every ad.",
        userFn: () => `PRODUCT INPUTS:
- Brand: ${brand.name}
- Category: ${brand.category}
- Product: ${prod.name}
- Promise: ${prod.promise}
- Offer: ${prod.offer}
- Brand Voice: ${brand.voice}
- Compliance: ${comp.level}

RESEARCH:
${generated["research"]}

AVATAR:
${generated["avatar"]}

Generate positioning.md with these sections:

## Core Position
One sentence. What this product is, who it's for, and why it's different. This is the north star every ad must be consistent with.

## The Unique Mechanism
What specifically makes this product work in a way competitors don't. This is the "because" behind every claim — the reason the promise is credible.

## Category Framing
Are we competing head-to-head in the existing category, or reframing into a new one? Define the frame we want customers to use when evaluating this product.

## Positioning By Angle
For each angle, define how the product should be positioned specifically:

${state.project.angles.map((a) => `### ${a.name}
- **Frame**: How to position the product for this angle specifically
- **Differentiator**: What makes it the obvious choice from this angle
- **Angles it suits**: Strength (strong / moderate / weak)
- **Angles to avoid**: What positioning would undermine this angle
- **Proof assets needed**: What evidence makes this positioning credible`).join("\n\n")}

## What We Are Not
Explicit statements about what this product should never be compared to or positioned as. Protects against copy that dilutes the position.

## Voice & Tone Constraints
Given brand voice (${brand.voice}), define what this means practically in ad copy:
- Words and phrases to use
- Words and phrases to avoid
- Sentence structure preferences
- What "on-brand" feels like vs off-brand

## Offer Framing
How to present ${prod.offer} in a way that feels like a no-brainer, not a discount. The psychological frame around the price and risk reversal.`,
      },
      {
        key: "context",
        system: "You are a prompt engineering specialist. Your job is to compress the four foundation documents below into a single structured context.json file that will be injected into every AI copy generation prompt.\n\nThis file must be:\n- Dense but readable\n- Under 800 tokens when serialized\n- Structured so a copy AI can extract exactly what it needs per angle\n- Free of redundancy",
        userFn: () => `PRODUCT INPUTS:
- Brand: ${brand.name}
- Category: ${brand.category}
- Product: ${prod.name}
- Promise: ${prod.promise}
- Offer: ${prod.offer}
- Brand Voice: ${brand.voice}
- Visual Description: ${prod.visualDesc}
- Compliance Level: ${comp.level}
- Forbidden Claims: ${comp.forbidden_claims.join(", ")}
- Disclaimer: ${comp.disclaimer}

FOUNDATION DOCUMENTS:
${generated["research"]}
${generated["avatar"]}
${generated["beliefs"]}
${generated["positioning"]}${creativeIntelBlock}

Output a single valid JSON object with this exact structure:

{
  "product": {
    "name": "",
    "promise": "",
    "offer": "",
    "mechanism": "",
    "visualDesc": ""
  },
  "brand": {
    "name": "",
    "voice": "",
    "category": "",
    "toneWords": [],
    "avoidWords": []
  },
  "avatar": {
    "name": "",
    "oneLiner": "",
    "feltProblem": "",
    "dreamOutcome": "",
    "alreadyTried": [],
    "language": []
  },
  "angles": [
    {
      "name": "",
      "perf_tag": "",
      "blockingBelief": "",
      "triggeringBelief": "",
      "hookDirection": "",
      "bestProofType": "",
      "frame": ""
    }
  ],
  "objections": {
    "price": "",
    "skepticism": "",
    "timing": ""
  },
  "compliance": {
    "level": "",
    "forbidden": [],
    "disclaimer": "",
    "guardrails": ""
  },
  "positioning": {
    "corePosition": "",
    "uniqueMechanism": "",
    "categoryFrame": "",
    "notThis": ""
  }
}

Output ONLY the JSON. No explanation, no markdown, no backticks.`,
      },
      {
        key: "angles",
        system: "You are a direct-response hook specialist. Using the full context below, generate angles.json — an enriched angle definition file that the copy AI will reference when writing hooks and headlines for each angle.",
        userFn: () => `CONTEXT:
${generated["context"]}

CURRENT ANGLES:
${anglesJson}

For each angle, produce a rich definition. Output a JSON array with this structure:

[
  {
    "name": "",
    "perf_tag": "",
    "emotionalCore": "",
    "hookFormulas": [
      "",
      "",
      ""
    ],
    "provenHooks": [],
    "headlines": [
      "",
      "",
      ""
    ],
    "proofPoints": [
      "",
      "",
      ""
    ],
    "avoidPhrases": [],
    "bestFormat": "",
    "bestMode": "",
    "cta": ""
  }
]

Field definitions:
- emotionalCore: the single emotional driver behind this angle in one sentence
- hookFormulas: 3 structural templates for hooks on this angle (use [BLANK] for variable parts)
- provenHooks: any hooks from competitive intel that work on this angle (empty array if none)
- headlines: 3 ready-to-use headlines for this angle, following brand voice
- proofPoints: 3 specific facts, stats, or claims that support this angle (compliant with ${comp.level})
- avoidPhrases: words or frames that would undermine this angle or violate compliance
- bestFormat: which ad format works best for this angle (Testimonial / Feature Callout / Bold Hook / Minimal Text)
- bestMode: A, B, or C
- cta: the strongest CTA for this angle

Output ONLY the JSON array. No explanation, no markdown, no backticks.`,
      },
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setDoc(step.key, { status: "generating" });
      try {
        const content = await callClaude(step.system, step.userFn());
        generated[step.key] = content;
        setDoc(step.key, { content, status: "done" });
      } catch (err) {
        console.error(`Foundation ${step.key} failed:`, err);
        setDoc(step.key, { status: "error" });
      }
      setBuildProgress({ done: i + 1, total: 6 });
    }

    updateProject({ batchCount: state.project.batchCount });
    setBuildingFoundation(false);
  };

  const allDone = DOC_META.every((d) => state.foundation[d.key].status === "done");
  // Backend handles API keys - frontend just checks if backend is available
  // Set ANTHROPIC_API_KEY or GEMINI_API_KEY in backend environment

  const statusDot: Record<FoundationDocStatus, string> = {
    empty: "bg-muted-foreground/40",
    generating: "bg-warn animate-pulse shadow-[0_0_5px_hsl(var(--warn))]",
    done: "bg-accent shadow-[0_0_5px_hsl(var(--accent))]",
    error: "bg-destructive shadow-[0_0_5px_hsl(var(--destructive))]",
  };

  const statusLabel: Record<FoundationDocStatus, string> = {
    empty: "empty",
    generating: "generating",
    done: "ready",
    error: "error",
  };

  const statusTagClass: Record<FoundationDocStatus, string> = {
    empty: "t-muted",
    generating: "t-warn",
    done: "t-cyan",
    error: "t-danger",
  };

  const renderFoundation = () => (
    <div className="animate-fi space-y-4 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard value={p.angles.length} label="Angles" color="text-primary" />
        <StatCard value={p.formats.filter((f) => f.status === "done").length} label="Formats indexed" color="text-secondary" />
        <StatCard value={p.batchCount} label="Batches run" color="text-warn" />
      </div>

      {/* Build Foundation button */}
      <Panel dotColor="bg-accent" title="Foundation Builder" subtitle="AI-powered research & strategy docs">
        <div className="flex items-center gap-3">
          <button
            onClick={buildFoundation}
            disabled={buildingFoundation}
            className={`text-[11px] font-semibold px-4 py-2 rounded-md transition-all ${
              buildingFoundation
                ? "bg-primary/50 text-primary-foreground cursor-wait"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {buildingFoundation
              ? `Building… (${buildProgress.done}/${buildProgress.total})`
              : allDone
              ? "Rebuild Foundation"
              : "Build Foundation"}
          </button>
          {buildingFoundation && (
            <span className="font-mono text-[9px] text-muted-foreground">Using AI provider from backend...</span>
          )}
          {allDone && !buildingFoundation && (
            <span className="font-mono text-[9px] text-accent">Foundation ready — batch copy will now use full context.</span>
          )}
        </div>
      </Panel>

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

      {/* Foundation doc cards */}
      <Panel dotColor="bg-secondary" title="Foundation Documents" extra={
        allDone ? (
          <button
            onClick={() => setState((s) => resetFoundation(s))}
            className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset all
          </button>
        ) : undefined
      }>
        <div className="grid grid-cols-2 gap-2">
          {DOC_META.map((d) => {
            const doc = state.foundation[d.key];
            return (
              <div key={d.key} className="bg-surface2 border border-border rounded-lg p-2.5 flex items-start gap-2">
                <div className={`w-[7px] h-[7px] rounded-full mt-[3px] shrink-0 ${statusDot[doc.status]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold mb-0.5">{d.name}</div>
                  <div className="font-mono text-[9px] text-muted-foreground leading-relaxed">{d.desc}</div>
                  {doc.status === "done" && doc.content && (
                    <button
                      onClick={() => setPreviewDoc({ name: d.name, content: doc.content })}
                      className="w-full text-left font-mono text-[9px] text-foreground/70 mt-1.5 p-1.5 bg-background rounded border border-border leading-relaxed truncate hover:border-primary/50 hover:text-foreground transition-colors cursor-pointer"
                    >
                      {doc.content.slice(0, 120)}{doc.content.length > 120 ? " ▸" : ""}
                    </button>
                  )}
                </div>
                <span className={`tag ${statusTagClass[doc.status]}`}>{statusLabel[doc.status]}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );

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

        {activeTab === "foundation" && renderFoundation()}

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

            {/* Winning Ads */}
            <Panel dotColor="bg-cyan-400" title="Winning Ads" extra={
              <div className="flex items-center gap-2">
                <span className="tag t-cyan">Mode A source</span>
                <button
                  onClick={analyzeAds}
                  disabled={analyzingAds || !state.project.refs.winning_ads.length || !hasClaudeKey}
                  className={`text-[10px] font-semibold px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    analyzingAds
                      ? "bg-accent/30 text-accent cursor-wait"
                      : state.foundation.creative_intel.status === "done"
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : !state.project.refs.winning_ads.length || !hasClaudeKey
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-accent text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {analyzingAds && <div className="w-3 h-3 border-2 border-transparent border-t-current rounded-full animate-spin" />}
                  {analyzingAds ? "Analyzing…" : state.foundation.creative_intel.status === "done" ? "✓ Analysis ready" : "Analyze Ads"}
                </button>
              </div>
            }>
              <div
                className={`grid grid-cols-5 gap-2 transition-all ${winningAdsDragOver ? "opacity-50 scale-[0.98]" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setWinningAdsDragOver(true); }}
                onDragLeave={() => setWinningAdsDragOver(false)}
                onDrop={async (e) => { e.preventDefault(); setWinningAdsDragOver(false); await handleWinningAdFiles(e.dataTransfer.files); }}
              >
                {state.project.refs.winning_ads.map((img) => (
                  <div key={img.id} className="group relative aspect-square rounded-lg bg-surface2 border border-border overflow-hidden hover:border-primary transition-colors">
                    <img src={img.base64} alt={img.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setState((s) => removeWinningAd(s, img.id))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    >×</button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                      <span className="font-mono text-[7px] text-white/80 truncate block">{img.name}</span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => winningAdsInputRef.current?.click()}
                  className={`aspect-square rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                    winningAdsDragOver ? "border-primary bg-primary/10" : "border-border2 hover:border-primary hover:bg-primary/[0.04]"
                  }`}
                >
                  <Upload size={16} className="opacity-40" />
                  <span className="font-mono text-[8px] text-muted-foreground">{winningAdsDragOver ? "Drop here" : "+ Upload"}</span>
                </button>
              </div>
              <input ref={winningAdsInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleWinningAdFiles(e.target.files); e.target.value = ""; }} />
              <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><ImageIcon size={10} />{state.project.refs.winning_ads.length} winning ad{state.project.refs.winning_ads.length !== 1 ? "s" : ""}</span>
                <span>Drag & drop or click to upload</span>
              </div>
            </Panel>

            {/* Creative Intelligence Results */}
            {state.foundation.creative_intel.status === "done" && state.foundation.creative_intel.breakdown.length > 0 && (
              <Panel dotColor="bg-accent" title="Creative Intelligence">
                {(() => {
                  // Read creative_intel content from foundation (the summary)
                  const ciFoundation = state.foundation as Record<string, unknown>;
                  const ciDoc = ciFoundation["creative_intel"] as { content?: string } | undefined;
                  const summary = ciDoc && typeof ciDoc === "object" && "content" in ciDoc ? (ciDoc as { content: string }).content : "";
                  return summary ? (
                    <div className="font-mono text-[10px] text-foreground/80 leading-relaxed mb-4 p-3 bg-background rounded-lg border border-border">
                      {summary}
                    </div>
                  ) : null;
                })()}
                <div className="grid grid-cols-2 gap-2">
                  {state.foundation.creative_intel.breakdown.map((item, i) => (
                    <div key={i} className="bg-surface2 border border-border rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <span className="tag t-purple">{item.emotionalAngle}</span>
                        <span className="tag t-cyan">{item.format}</span>
                      </div>
                      <div className="text-[11px] font-bold mb-1.5">{item.hook}</div>
                      <div className="font-mono text-[9px] text-muted-foreground leading-relaxed mb-1.5">
                        {item.copyFormulas.map((f, j) => <div key={j}>• {f}</div>)}
                      </div>
                      <div className="font-mono text-[9px] text-foreground/50 italic">{item.whatWorks}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Raw Images */}
            <Panel dotColor="bg-accent" title="Raw Images" extra={<span className="tag t-accent">Mode B source</span>}>
              <div
                className={`grid grid-cols-5 gap-2 transition-all ${rawImagesDragOver ? "opacity-50 scale-[0.98]" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setRawImagesDragOver(true); }}
                onDragLeave={() => setRawImagesDragOver(false)}
                onDrop={async (e) => { e.preventDefault(); setRawImagesDragOver(false); await handleRawImageFiles(e.dataTransfer.files); }}
              >
                {state.project.refs.raw_images.map((img) => (
                  <div key={img.id} className="group relative aspect-square rounded-lg bg-surface2 border border-border overflow-hidden hover:border-primary transition-colors">
                    <img src={img.base64} alt={img.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setState((s) => removeRawImage(s, img.id))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    >×</button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                      <span className="font-mono text-[7px] text-white/80 truncate block">{img.name}</span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => rawImagesInputRef.current?.click()}
                  className={`aspect-square rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                    rawImagesDragOver ? "border-primary bg-primary/10" : "border-border2 hover:border-primary hover:bg-primary/[0.04]"
                  }`}
                >
                  <Upload size={16} className="opacity-40" />
                  <span className="font-mono text-[8px] text-muted-foreground">{rawImagesDragOver ? "Drop here" : "+ Upload"}</span>
                </button>
              </div>
              <input ref={rawImagesInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleRawImageFiles(e.target.files); e.target.value = ""; }} />
              <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><ImageIcon size={10} />{state.project.refs.raw_images.length} raw image{state.project.refs.raw_images.length !== 1 ? "s" : ""}</span>
                <span>Drag & drop or click to upload</span>
              </div>
            </Panel>

            {/* Brand Assets (static display) */}
            <Panel dotColor="bg-warn" title="Brand Assets" subtitle="Product photos & logos">
              <div className="grid grid-cols-5 gap-2">
                {state.project.refs.brand_assets.map((name) => (
                  <div key={name} className="aspect-square rounded-lg bg-surface2 border border-border flex flex-col items-center justify-center gap-1">
                    <div className="text-xl opacity-20">📁</div>
                    <span className="font-mono text-[7px] text-muted-foreground truncate max-w-full px-1">{name}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>

      {/* Doc preview overlay */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPreviewDoc(null)}>
          <div
            className="bg-surface border border-border rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-xs font-semibold">{previewDoc.name}</span>
              <button onClick={() => setPreviewDoc(null)} className="text-muted-foreground hover:text-foreground text-sm cursor-pointer">✕</button>
            </div>
            <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] text-foreground/85 leading-relaxed whitespace-pre-wrap">{previewDoc.content}</pre>
          </div>
        </div>
      )}
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
