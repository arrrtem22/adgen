// API client for backend communication

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Foundation types
export interface FoundationDoc {
  name: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  content: string;
  desc: string;
  type: 'doc' | 'json' | 'key' | 'angle';
}

export interface FoundationData {
  research: FoundationDoc;
  avatar: FoundationDoc;
  beliefs: FoundationDoc;
  positioning: FoundationDoc;
  context: FoundationDoc;
  anglesDoc: FoundationDoc;
}

export interface FoundationGenerationRequest {
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
  compliance: {
    level: string;
    forbidden_claims: string[];
    disclaimer: string;
  };
  comp_intel?: string;
}

export interface FoundationGenerationResponse {
  foundation: FoundationData;
  angles: Array<{
    name: string;
    perf_tag: 'winner' | 'proven' | 'comp' | 'untested';
  }>;
}

export interface CompletionStatus {
  brandConfig: boolean;
  foundation: boolean;
  refs: boolean;
  intel: boolean;
}

export interface CompletionCheckResponse {
  completion: CompletionStatus;
  allComplete: boolean;
  missing: string[];
}

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

  async generateFoundation(request: FoundationGenerationRequest): Promise<FoundationGenerationResponse> {
    return fetchJson(`${API_BASE_URL}/foundation/generate`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  async checkCompletion(project: {
    id: string;
    name: string;
    status: string;
    brand: FoundationGenerationRequest["brand"];
    compliance: FoundationGenerationRequest["compliance"];
    foundation?: FoundationData;
    angles: Array<{ name: string; perf_tag: string }>;
  }): Promise<CompletionCheckResponse> {
    return fetchJson(`${API_BASE_URL}/foundation/check-completion`, {
      method: "POST",
      body: JSON.stringify(project),
    });
  },

  getImageUrl(path: string): string {
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
    return `${API_BASE_URL}/${path}`;
  },
};

export default api;
