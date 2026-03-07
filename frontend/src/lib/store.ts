// Shared state for AdGen app — persisted in localStorage

export type ImageCategory = 'winning_ads' | 'raw_images' | 'brand_assets';

export interface LibraryImage {
  id: string;
  name: string;
  category: ImageCategory;
  data: string; // base64
  uploadedAt: string;
}

export interface ProductInfo {
  name: string;
  url: string;
  promise: string;
  offer: string;
  visualDesc: string;
}

export interface BrandConfig {
  name: string;
  category: string;
  voice: string;
  palette: string[];
  product: ProductInfo;
}

export interface Compliance {
  level: string;
  forbidden_claims: string[];
  disclaimer: string;
}

export interface Angle {
  name: string;
  perf_tag: 'winner' | 'proven' | 'comp' | 'untested';
}

export interface FormatDoc {
  id: string;
  name: string;
  resolution: string;
  slots: number;
  chars: string;
  status: string;
}

export interface Refs {
  winning_ads: string[];
  raw_images: string[];
  brand_assets: string[];
  comp_intel: string;
}

export interface Variant {
  id: string;
  angle: string;
  mode: 'A' | 'B' | 'C';
  format: string;
  hook: string;
  headline: string;
  subhead: string;
  bullets: string[];
  cta: string;
  imgNote: string;
  bg: string;
  status: 'pending' | 'approved' | 'skipped';
  imageB64: string | null;
}

export interface BatchConfig {
  count: number;
  focus: string;
  angles: string[];
  dryRun: boolean;
  modeRatio: { A: number; B: number; C: number };
}

export interface Batch {
  id: string;
  num: number;
  date: string;
  config: BatchConfig;
  variants: Variant[];
  status: 'idle' | 'generating' | 'reviewing';
}

export interface Project {
  id: string;
  name: string;
  status: string;
  brand: BrandConfig;
  compliance: Compliance;
  refs: Refs;
  angles: Angle[];
  formats: FormatDoc[];
  batchCount: number;
}

export interface AppState {
  project: Project;
  batch: Batch;
  settings: { geminiKey: string };
  imageLibrary: LibraryImage[];
}

const KEY = 'adgen_state';

const SEED: AppState = {
  project: {
    id: 'proj_selure_5pack',
    name: 'Selure Shaping Tank 5-Pack',
    status: 'live',
    brand: {
      name: 'Selure Wear',
      category: 'apparel',
      voice: 'confident, direct response, men\'s transformation',
      palette: ['#0a0a0a', '#ffffff', '#c8f060', '#1a1a1a'],
      product: {
        name: 'SELURE™ Shaping Tank 2.0 (5-Pack)',
        url: 'https://selurewear.com/products/selure%E2%84%A2-shaping-tank-2-0-5-pack',
        promise: 'instantly slimmer look — hides chest, belly & back fat under any clothing',
        offer: '5-Pack for $49.95 (77% off) — 60-day money-back guarantee',
        visualDesc: 'fitted black compression tank top, worn by a regular-looking man, tight around torso, invisible under a regular shirt',
      },
    },
    compliance: {
      level: 'cosmetic',
      forbidden_claims: [
        'permanent fat reduction',
        'weight loss',
        'cures gynecomastia',
        'medical device',
        'guaranteed results',
      ],
      disclaimer: 'Results may vary. Visual shaping effect only while wearing the garment. Not a medical device.',
    },
    refs: {
      winning_ads: ['competitor_shapewear_01.png', 'competitor_01.png', 'winner_jan_01.png'],
      raw_images: ['lifestyle_gym.png', 'lifestyle_office.png'],
      brand_assets: ['selure_logo.png', 'tank_black.png', 'tank_white.png'],
      comp_intel: '',
    },
    angles: [
      { name: 'instant transformation', perf_tag: 'winner' },
      { name: 'social confidence', perf_tag: 'proven' },
      { name: 'hidden secret', perf_tag: 'winner' },
      { name: 'nightmare / insecurity', perf_tag: 'proven' },
      { name: 'comparison vs others', perf_tag: 'comp' },
      { name: 'objection busting', perf_tag: 'untested' },
      { name: 'social proof', perf_tag: 'untested' },
    ],
    formats: [
      { id: 'fmt1', name: 'Testimonial Overlay', resolution: '1080×1080', slots: 3, chars: '38/80/60 ch', status: 'done' },
      { id: 'fmt2', name: 'Before / After', resolution: '1080×1080', slots: 2, chars: '40/20 ch', status: 'done' },
      { id: 'fmt3', name: 'Story Hero', resolution: '1080×1920', slots: 4, chars: 'story format', status: 'done' },
      { id: 'fmt4', name: 'Feature Callouts', resolution: '1080×1080', slots: 5, chars: '40/20 ch ea', status: 'done' },
      { id: 'fmt5', name: 'Minimal Text', resolution: '1080×1080', slots: 2, chars: '30/20 ch', status: 'done' },
    ],
    batchCount: 0,
  },
  batch: {
    id: 'batch_1',
    num: 1,
    date: '2026-03-07',
    config: { count: 8, focus: '', angles: ['instant transformation', 'social confidence'], dryRun: true, modeRatio: { A: 50, B: 30, C: 20 } },
    variants: [],
    status: 'idle',
  },
  settings: { geminiKey: '' },
  imageLibrary: [],
};

export const SEED_VARIANTS: Omit<Variant, 'status' | 'imageB64'>[] = [
  { id: '001', angle: 'instant transformation', mode: 'A', format: 'testimonial', hook: '"I look 20 lbs lighter instantly. My wife noticed immediately."', headline: 'The 10-Second Body Fix', subhead: 'Hides chest, belly & back fat under any shirt.', bullets: ['Instant slimming effect', 'Invisible under clothing', 'Comfortable all day'], cta: 'Get 5-Pack →', imgNote: 'Before/after split with tank visible, transformation focus.', bg: 'bg-dark' },
  { id: '002', angle: 'social confidence', mode: 'B', format: 'feature callout', hook: '"I finally feel confident taking my shirt off at the beach."', headline: 'Confidence You Can Wear', subhead: '47,000+ men have already transformed their look.', bullets: ['Secret slimming layer', 'Boosts confidence instantly', 'Worn by regular guys'], cta: 'Claim Yours →', imgNote: 'Man in social setting, confident posture, product subtle.', bg: 'bg-warm' },
  { id: '003', angle: 'hidden secret', mode: 'C', format: 'bold hook', hook: '"My secret weapon under every outfit. Nobody knows."', headline: 'The Invisible Advantage', subhead: 'Your hidden edge for looking your best.', bullets: ['Undetectable under shirts', 'Instant physique upgrade', 'Your secret to keep'], cta: 'Try It Now →', imgNote: 'Layered look showing tank under dress shirt, seamless fit.', bg: 'bg-cool' },
  { id: '004', angle: 'nightmare / insecurity', mode: 'A', format: 'testimonial', hook: '"I used to avoid mirrors and photos. Not anymore."', headline: 'Stop Hiding Your Body', subhead: 'The insecurity ends today.', bullets: ['Eliminates man boobs look', 'Flattens belly instantly', 'Looks like natural muscle'], cta: 'Transform Now →', imgNote: 'Emotional hook, man looking at reflection, hope vs despair.', bg: 'bg-neutral' },
  { id: '005', angle: 'comparison vs others', mode: 'A', format: 'minimal text', hook: '"Tried other shapewear? This is different."', headline: 'Why Men Choose Selure', subhead: 'Unlike cheap alternatives that ride up and show lines.', bullets: ['Stays in place all day', 'Truly invisible design', 'Premium compression fabric'], cta: 'See The Difference →', imgNote: 'Side-by-side comparison visual, quality contrast.', bg: 'bg-dark' },
  { id: '006', angle: 'objection busting', mode: 'B', format: 'feature callout', hook: '"Won\'t it be hot and uncomfortable? Actually, no."', headline: 'Comfort Meets Confidence', subhead: 'Breathable fabric you\'ll forget you\'re wearing.', bullets: ['Cooling mesh panels', '4-way stretch fabric', 'Won\'t roll or bunch'], cta: 'Feel The Comfort →', imgNote: 'Close-up of fabric texture, comfort-focused imagery.', bg: 'bg-warm' },
  { id: '007', angle: 'instant transformation', mode: 'C', format: 'bold hook', hook: '"Put it on, look in the mirror, see the difference."', headline: '10 Seconds To A New You', subhead: 'No workouts. No diets. Just results.', bullets: ['Instant visual slimming', 'Works under any outfit', '60-day guarantee'], cta: 'Get Yours →', imgNote: 'Mirror reflection shot, dramatic but believable transformation.', bg: 'bg-dark' },
  { id: '008', angle: 'social proof', mode: 'B', format: 'minimal text', hook: '"47,000 men can\'t be wrong. Here\'s what they\'re saying."', headline: 'The Shapewear Secret Men Love', subhead: 'Join the confidence revolution.', bullets: ['4.9★ average rating', '60-day money back', '5-pack value deal'], cta: 'Join 47,000+ Men →', imgNote: 'Review stars, customer photo grid, social proof elements.', bg: 'bg-cool' },
];

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(SEED));
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export const BG_STYLES: Record<string, string> = {
  'bg-dark': 'linear-gradient(145deg,#1a1020,#0c0c14)',
  'bg-warm': 'linear-gradient(145deg,#1a1408,#0e0c0a)',
  'bg-cool': 'linear-gradient(145deg,#081418,#0a0c12)',
  'bg-neutral': 'linear-gradient(145deg,#14141c,#0c0c10)',
};

// Image Library helpers
export function addImage(state: AppState, file: File, category: ImageCategory): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const newImage: LibraryImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        category,
        data: reader.result as string,
        uploadedAt: new Date().toISOString(),
      };
      const newState = { ...state, imageLibrary: [...state.imageLibrary, newImage] };
      saveState(newState);
      resolve(newState);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function removeImage(state: AppState, imageId: string): AppState {
  const newState = { ...state, imageLibrary: state.imageLibrary.filter((img) => img.id !== imageId) };
  saveState(newState);
  return newState;
}

export function getImagesByCategory(state: AppState, category: ImageCategory): LibraryImage[] {
  return state.imageLibrary.filter((img) => img.category === category);
}

export function getImageById(state: AppState, imageId: string): LibraryImage | undefined {
  return state.imageLibrary.find((img) => img.id === imageId);
}
