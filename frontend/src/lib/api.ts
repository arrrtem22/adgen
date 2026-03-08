// API client for backend communication

// Detect if running on Vercel or local development
const isVercel = import.meta.env.VERCEL || window.location.hostname.includes('vercel.app');
const isProduction = import.meta.env.PROD;

// Set API base URL
// - On Vercel: use '/api' prefix for serverless functions
// - Local dev: use localhost:8000
const API_BASE_URL = import.meta.env.VITE_API_URL || (isVercel || isProduction ? '/api' : 'http://localhost:8000');

export interface GenerateBatchRequest {
  project: {
    brand: {
      name: string;
      category: string;
      voice: string;
      palette: string[];
      product: {
        name: string;
        url: string;
        promise: string;
        offer: string;
        visualDesc: string;
      };
    };
  };
  batch_config: {
    count: number;
    focus: string;
    angles: string[];
    dryRun: boolean;
    modeRatio: { A: number; B: number; C: number };
  };
  mode: string;
  iteration?: boolean;
  previous_winners?: string[];
}

export interface GenerateBatchResponse {
  batch: {
    id: string;
    num: number;
    date: string;
    config: GenerateBatchRequest["batch_config"];
    variants: Array<{
      id: string;
      angle: string;
      mode: "A" | "B" | "C";
      format: string;
      headline: string;
      copy: string;
      hook: string;
      subhead: string;
      bullets: string[];
      cta: string;
      imgNote: string;
      bg: string;
      image_url?: string;
      mock_metrics?: {
        ctr: number;
        impressions: number;
        clicks: number;
      };
    }>;
    status: string;
  };
}

export interface HealthResponse {
  status: string;
  version: string;
  services?: {
    gemini_configured: boolean;
    unsplash_configured: boolean;
  };
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export const api = {
  async checkHealth(): Promise<HealthResponse> {
    return fetchJson(`${API_BASE_URL}/health`);
  },

  async generateBatch(request: GenerateBatchRequest): Promise<GenerateBatchResponse> {
    const params = new URLSearchParams();
    params.append("mode", request.mode);
    if (request.iteration) {
      params.append("iteration", "true");
    }

    return fetchJson(`${API_BASE_URL}/generate/batch?${params.toString()}`, {
      method: "POST",
      body: JSON.stringify({
        project: request.project,
        batch_config: request.batch_config,
      }),
    });
  },

  getImageUrl(path: string): string {
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
    return `${API_BASE_URL}/${path}`;
  },
};

export default api;
