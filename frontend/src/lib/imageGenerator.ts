// Client-side image generation using HTML5 Canvas
// Works on Vercel (no server-side PIL needed)

export interface TextOverlay {
  headline: string;
  subhead?: string;
  cta?: string;
  position?: "bottom" | "top" | "center";
  textColor?: string;
  bgColor?: string;
}

export async function generateAdImageWithOverlay(
  baseImageUrl: string,
  overlay: TextOverlay
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    const img = new Image();
    
    // For base64 data URIs, no need for crossOrigin
    // For external URLs, set crossOrigin
    if (!baseImageUrl.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    
    img.onload = () => {
      // Set canvas size to match image (max 1080x1080 for ads)
      const size = Math.min(img.width, img.height, 1080);
      canvas.width = size;
      canvas.height = size;
      
      // Draw base image (cover mode)
      const scale = Math.max(size / img.width, size / img.height);
      const x = (size - img.width * scale) / 2;
      const y = (size - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      
      // Add gradient overlay for text readability
      const gradient = ctx.createLinearGradient(0, size * 0.5, 0, size);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, size * 0.5, size, size * 0.5);
      
      // Configure text styles
      const headlineSize = Math.floor(size * 0.06);
      const subheadSize = Math.floor(size * 0.035);
      const ctaSize = Math.floor(size * 0.03);
      
      // Draw headline
      if (overlay.headline) {
        ctx.fillStyle = overlay.textColor || "#ffffff";
        ctx.font = `bold ${headlineSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Word wrap
        const maxWidth = size * 0.84;
        const lines = wrapText(ctx, overlay.headline, maxWidth);
        const lineHeight = headlineSize * 1.2;
        const startY = size * 0.65;
        
        lines.slice(0, 3).forEach((line, i) => {
          // Text shadow
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillText(line, size / 2 + 2, startY + i * lineHeight + 2);
          // Main text
          ctx.fillStyle = overlay.textColor || "#ffffff";
          ctx.fillText(line, size / 2, startY + i * lineHeight);
        });
      }
      
      // Draw subhead
      if (overlay.subhead) {
        const lines = wrapText(ctx, overlay.subhead, size * 0.8);
        const startY = size * 0.75;
        ctx.font = `${subheadSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        
        lines.slice(0, 2).forEach((line, i) => {
          ctx.fillText(line, size / 2, startY + i * subheadSize * 1.3);
        });
      }
      
      // Draw CTA button
      if (overlay.cta) {
        const ctaText = overlay.cta.replace(/[→←↑↓]/g, ">");
        ctx.font = `bold ${ctaSize}px system-ui, -apple-system, sans-serif`;
        
        const paddingX = size * 0.05;
        const paddingY = size * 0.02;
        const textMetrics = ctx.measureText(ctaText);
        const buttonWidth = textMetrics.width + paddingX * 2;
        const buttonHeight = ctaSize + paddingY * 2;
        const buttonX = (size - buttonWidth) / 2;
        const buttonY = size * 0.88;
        
        // Button background
        ctx.fillStyle = overlay.bgColor || "#ffffff";
        ctx.beginPath();
        ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, size * 0.02);
        ctx.fill();
        
        // Button text
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ctaText, size / 2, buttonY + buttonHeight / 2);
      }
      
      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        },
        "image/png",
        0.95
      );
    };
    
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = baseImageUrl;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Generate a placeholder gradient image (when no base image available)
export function generatePlaceholderImage(
  width: number = 1080,
  height: number = 1080,
  colors: string[] = ["#1a1a2e", "#16213e"]
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  
  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1] || colors[0]);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL("image/png");
}
