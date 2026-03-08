import type { Variant, Project } from "./store";

export function buildImagePrompt(variant: Variant, project: Project): string {
  const systemContext = `Generate a clean 1:1 square ad background photo with NO text or typography.
Product is the visual hero. Real everyday person, face de-emphasized. Clean background.
Authentic lifestyle photography, slightly desaturated film-like grade.
Leave space at the top 30% and bottom 20% for text overlays that will be added later.
Do NOT render any words, letters, or text in the image.\n\n`;

  const prod = project.brand.product;
  const palette = (project.brand.palette || []).join(', ');
  return systemContext + [
    `Product: ${prod.name}.`,
    prod.visualDesc ? `Visual description: ${prod.visualDesc}.` : '',
    `Brand colors: ${palette}.`,
    `Category: ${project.brand.category}.`,
    `Promise: ${prod.promise}.`,
    `Angle: ${variant.angle}.`,
    `Image direction: ${variant.imgNote}`,
    `Generate a 1:1 square (1080x1080) lifestyle photo. Product must be the visual hero. Absolutely no text.`
  ].filter(Boolean).join('\n');
}

const GEMINI_MODELS = [
  'gemini-3.1-flash-image-preview',
];

async function fetchGeminiImage(
  prompt: string,
  geminiKey: string
): Promise<string | null> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
  };

  for (const model of GEMINI_MODELS) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${model}:generateContent?key=${geminiKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 404) {
        console.warn(`Gemini model ${model} returned 404, trying next…`, await res.text());
        continue;
      }
      if (!res.ok) {
        console.warn(`Gemini error (${model})`, res.status, await res.text());
        return null;
      }
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (e) {
      console.warn(`Gemini fetch failed (${model}):`, e);
      return null;
    }
  }

  console.warn('All Gemini models failed:', GEMINI_MODELS.join(', '));
  return null;
}

// --- Canvas text compositor ---

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  shadowColor = 'rgba(0,0,0,0.7)',
  blur = 8
) {
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

// Mood-based overlay tints derived from variant.bg
const BG_MOODS: Record<string, { gradTint: string; accentTint: string }> = {
  'bg-dark':    { gradTint: '0,0,0',       accentTint: 'rgba(200,160,255,0.08)' },
  'bg-warm':    { gradTint: '20,10,0',     accentTint: 'rgba(255,180,80,0.06)' },
  'bg-cool':    { gradTint: '0,10,20',     accentTint: 'rgba(100,200,255,0.06)' },
  'bg-neutral': { gradTint: '10,10,15',    accentTint: 'rgba(180,180,200,0.05)' },
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function compositeTextOverlay(
  rawImageDataUrl: string,
  variant: Variant,
  project: Project
): Promise<string> {
  const SIZE = 1080;
  const PAD = 54;
  const img = await loadImage(rawImageDataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Draw background image
  ctx.drawImage(img, 0, 0, SIZE, SIZE);

  // --- Derive colors from brand palette ---
  const palette = project.brand.palette || ['#0a0a0a', '#ffffff', '#c8f060'];
  // Find the best CTA color: first non-black, non-white, non-dark color
  const ctaColor = palette.find(c => isLightColor(c) && c !== '#ffffff' && c !== '#fff') || '#c8f060';
  const ctaTextColor = isLightColor(ctaColor) ? '#0a0a0a' : '#ffffff';

  // --- Mood-based gradient overlays ---
  const mood = BG_MOODS[variant.bg] || BG_MOODS['bg-dark'];

  // Top gradient — tinted by mood
  const topGrad = ctx.createLinearGradient(0, 0, 0, SIZE * 0.5);
  topGrad.addColorStop(0, `rgba(${mood.gradTint},0.72)`);
  topGrad.addColorStop(0.6, `rgba(${mood.gradTint},0.25)`);
  topGrad.addColorStop(1, `rgba(${mood.gradTint},0)`);
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, SIZE, SIZE * 0.5);

  // Bottom gradient — stronger for CTA area
  const botGrad = ctx.createLinearGradient(0, SIZE * 0.55, 0, SIZE);
  botGrad.addColorStop(0, `rgba(${mood.gradTint},0)`);
  botGrad.addColorStop(0.4, `rgba(${mood.gradTint},0.35)`);
  botGrad.addColorStop(1, `rgba(${mood.gradTint},0.82)`);
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, SIZE * 0.55, SIZE, SIZE * 0.45);

  // Subtle mood accent strip at top
  ctx.fillStyle = mood.accentTint;
  ctx.fillRect(0, 0, SIZE, 4);

  const maxW = SIZE - PAD * 2;
  const FONT = '"Syne", "Helvetica Neue", Arial, sans-serif';

  // --- Hook — top area, large bold ---
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 48px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const hookLines = wrapText(ctx, variant.hook, maxW);
  let hookY = PAD;
  for (const line of hookLines) {
    drawTextWithShadow(ctx, line, PAD, hookY, 'rgba(0,0,0,0.8)', 12);
    hookY += 58;
  }

  // --- Headline — below hook ---
  ctx.font = `600 32px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const headlineLines = wrapText(ctx, variant.headline, maxW);
  let headY = hookY + 14;
  for (const line of headlineLines) {
    drawTextWithShadow(ctx, line, PAD, headY);
    headY += 40;
  }

  // --- Subhead — smaller, slightly muted ---
  if (variant.subhead) {
    ctx.font = `400 24px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const subLines = wrapText(ctx, variant.subhead, maxW);
    let subY = headY + 8;
    for (const line of subLines) {
      drawTextWithShadow(ctx, line, PAD, subY, 'rgba(0,0,0,0.5)', 6);
      subY += 32;
    }
  }

  // --- Bullets — bottom-left, above CTA ---
  if (variant.bullets && variant.bullets.length > 0) {
    ctx.font = `500 20px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const bulletStartY = SIZE - PAD - 70 - (variant.bullets.length * 30);
    variant.bullets.forEach((b, i) => {
      const bulletText = `  ${b}`;
      const dotX = PAD;
      const textY = bulletStartY + i * 30;
      // Accent dot using brand CTA color
      ctx.fillStyle = hexToRgba(ctaColor, 0.9);
      ctx.beginPath();
      ctx.arc(dotX + 4, textY + 10, 4, 0, Math.PI * 2);
      ctx.fill();
      // Bullet text
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      drawTextWithShadow(ctx, bulletText, dotX + 16, textY, 'rgba(0,0,0,0.4)', 4);
    });
  }

  // --- CTA — bottom area, pill button ---
  ctx.font = `bold 28px ${FONT}`;
  const ctaMetrics = ctx.measureText(variant.cta);
  const ctaW = ctaMetrics.width + 56;
  const ctaH = 56;
  const ctaX = PAD;
  const ctaY = SIZE - PAD - ctaH;

  // Button background with brand color
  ctx.fillStyle = hexToRgba(ctaColor, 0.95);
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 14);
  ctx.fill();

  // Subtle glow behind button
  ctx.shadowColor = hexToRgba(ctaColor, 0.3);
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Button text
  ctx.fillStyle = ctaTextColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(variant.cta, ctaX + ctaW / 2, ctaY + ctaH / 2);

  // --- Brand name watermark — bottom right ---
  if (project.brand.name) {
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(project.brand.name.toUpperCase(), SIZE - PAD, SIZE - PAD + 4);
  }

  return canvas.toDataURL('image/png');
}

// --- Main export ---

// TODO: For now all variants use Mode C (pure generation) for images.
// Mode A (ref edit from winning ads) and Mode B (overlay on raw images)
// will be wired in a future step when reference image passing is implemented.
export async function geminiImageGen(
  variant: Variant,
  project: Project,
  geminiKey: string
): Promise<string | null> {
  const prompt = buildImagePrompt(variant, project);
  const rawImage = await fetchGeminiImage(prompt, geminiKey);
  if (!rawImage) return null;

  try {
    return await compositeTextOverlay(rawImage, variant, project);
  } catch (e) {
    console.warn('Canvas composite failed, returning raw image:', e);
    return rawImage;
  }
}
