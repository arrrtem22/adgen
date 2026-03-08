import json
import os
import uuid
from typing import Optional

from services.ai_provider import get_provider, get_provider_type


def build_prompt(
    product_info: dict,
    iteration: bool = False,
    previous_winners: Optional[list[str]] = None,
    count: int = 3
) -> str:
    """Build the prompt for ad copy generation."""
    
    title = product_info.get('title', 'Unknown Product')
    description = product_info.get('description', '')
    price = product_info.get('price', '')
    promise = product_info.get('promise', '')
    
    iteration_context = ""
    if iteration and previous_winners:
        iteration_context = f"""
This is an ITERATION based on previous winning ads. Previous winners used these angles: {', '.join(previous_winners)}
Build on what worked well - similar themes, emotional hooks, and messaging patterns.
"""
    
    prompt = f"""Generate {count} Meta ad copy variations for this product:

PRODUCT INFO:
Title: {title}
Description: {description}
Price: {price}
Key Promise: {promise}

{iteration_context}

Create {count} variations with different approaches:

1. PROBLEM-SOLUTION: Address a pain point and show how this product solves it
2. SOCIAL PROOF: Use trust signals, reviews, or popularity angles  
3. FOMO/URGENCY: Create scarcity or time-sensitive motivation
4. TRANSFORMATION: Show before/after or lifestyle improvement

For each variation:
- angle: The strategic approach (Problem-Solution, Social Proof, FOMO, or Transformation)
- persona: Target audience (Busy professionals, Budget-conscious, Quality-seekers, or Health-conscious)
- headline: Short catchy headline (5-8 words max, attention-grabbing)
- copy: Primary ad text (under 125 characters, punchy and engaging)
- hook: Opening hook statement (include quotes, emotional trigger)
- subhead: Supporting subheadline (10-15 words)
- bullets: 3 key benefit bullets (short phrases)
- cta: Call-to-action text (action-oriented, use -> for arrow instead of emoji)

Return ONLY valid JSON in this exact format:
[
  {{
    "angle": "Problem-Solution",
    "persona": "Busy professionals",
    "headline": "Headline Here",
    "copy": "Primary text under 125 chars",
    "hook": "\\"Quoted hook statement.\\"",
    "subhead": "Supporting subheadline text",
    "bullets": ["Benefit 1", "Benefit 2", "Benefit 3"],
    "cta": "Get Yours Now ->"
  }}
]

Make each variation distinct and compelling. Ensure copy is under 125 characters.
Do not use emojis or special unicode characters - use simple ASCII only."""
    
    return prompt


def parse_response(text: str) -> list[dict]:
    """Parse the AI response into structured data."""
    try:
        # Try to find JSON in the response
        text = text.strip()
        
        # If wrapped in markdown code blocks, extract it
        if '```json' in text:
            text = text.split('```json')[1].split('```')[0]
        elif '```' in text:
            text = text.split('```')[1].split('```')[0]
        
        data = json.loads(text.strip())
        
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and 'variations' in data:
            return data['variations']
        else:
            return [data]
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"Raw text: {text[:500]}")
        return []


def generate_ad_copy_variations(
    product_info: dict,
    iteration: bool = False,
    previous_winners: Optional[list[str]] = None,
    count: int = 3
) -> list[dict]:
    """
    Generate ad copy variations using configured AI provider (Claude or Gemini).
    """
    provider = get_provider()
    
    # Check if API key is configured
    if not provider:
        print("Warning: No AI provider available, using mock data")
        print("Set ANTHROPIC_API_KEY for Claude or GEMINI_API_KEY for Gemini")
        return get_mock_variations(count)
    
    try:
        prompt = build_prompt(product_info, iteration, previous_winners, count)
        
        response_text = provider.generate_text(
            prompt,
            temperature=0.8,
            max_tokens=2000
        )
        
        if not response_text:
            print("Warning: Empty response from AI, using mock data")
            return get_mock_variations(count)
        
        variations = parse_response(response_text)
        
        if not variations:
            print("Warning: Could not parse variations, using mock data")
            return get_mock_variations(count)
        
        # Add IDs and ensure all fields exist
        formatted_variations = []
        for i, var in enumerate(variations[:count]):
            formatted_var = {
                "id": f"ad_{i+1}_{uuid.uuid4().hex[:8]}",
                "angle": var.get("angle", "General"),
                "persona": var.get("persona", "General audience"),
                "headline": var.get("headline", "Great Product"),
                "copy": var.get("copy", var.get("headline", "Check out this amazing product!")),
                "hook": var.get("hook", f'"{var.get("headline", "Amazing!")}"'),
                "subhead": var.get("subhead", ""),
                "bullets": var.get("bullets", ["Quality guaranteed", "Fast shipping", "Easy returns"]),
                "cta": var.get("cta", "Shop Now ->"),
                "mode": ["A", "B", "C"][i % 3],
                "format": "standard",
                "imgNote": f"Image for {var.get('angle', 'product')} angle",
                "bg": ["bg-dark", "bg-warm", "bg-cool"][i % 3],
                "status": "pending",
                "imageB64": None,
            }
            formatted_variations.append(formatted_var)
        
        return formatted_variations
        
    except Exception as e:
        print(f"Error generating ad copy: {e}")
        return get_mock_variations(count)


def get_mock_variations(count: int = 3) -> list[dict]:
    """Return mock variations when API is unavailable."""
    variations = [
        {
            "id": f"ad_1_{uuid.uuid4().hex[:8]}",
            "angle": "Problem-Solution",
            "persona": "Busy professionals",
            "headline": "Save Time, Get Results",
            "copy": "Stop wasting hours. Our product delivers results in minutes.",
            "hook": '"I wish I found this sooner - game changer!"',
            "subhead": "Designed for people who value their time",
            "bullets": ["Works in minutes", "No setup required", "Proven results"],
            "cta": "Get Started ->",
            "mode": "A",
            "format": "standard",
            "imgNote": "Professional lifestyle image",
            "bg": "bg-dark",
            "status": "pending",
            "imageB64": None,
        },
        {
            "id": f"ad_2_{uuid.uuid4().hex[:8]}",
            "angle": "Social Proof",
            "persona": "Quality-seekers",
            "headline": "Join 10,000+ Happy Customers",
            "copy": "Trusted by professionals worldwide. See why everyone's switching.",
            "hook": '"47,000 people made the switch last month"',
            "subhead": "Join the community of satisfied customers",
            "bullets": ["4.9* rating", "47,000+ happy users", "Featured in top publications"],
            "cta": "Join Them ->",
            "mode": "B",
            "format": "testimonial",
            "imgNote": "Crowd or community image",
            "bg": "bg-warm",
            "status": "pending",
            "imageB64": None,
        },
        {
            "id": f"ad_3_{uuid.uuid4().hex[:8]}",
            "angle": "FOMO",
            "persona": "Budget-conscious",
            "headline": "Limited Time: 40% Off",
            "copy": "Sale ends tonight. Don't miss your chance to save big.",
            "hook": '"Last chance - offer expires at midnight!"',
            "subhead": "Only 50 spots left at this price",
            "bullets": ["40% off today only", "Free shipping included", "30-day guarantee"],
            "cta": "Claim Offer ->",
            "mode": "C",
            "format": "promotional",
            "imgNote": "Bold promotional graphic",
            "bg": "bg-cool",
            "status": "pending",
            "imageB64": None,
        },
        {
            "id": f"ad_4_{uuid.uuid4().hex[:8]}",
            "angle": "Transformation",
            "persona": "Health-conscious",
            "headline": "Transform Your Routine",
            "copy": "See visible results in just 7 days. Your transformation starts now.",
            "hook": '"I noticed the difference within a week"',
            "subhead": "Results you can see and feel",
            "bullets": ["Visible in 7 days", "Clinically tested", "100% natural"],
            "cta": "Start Today ->",
            "mode": "A",
            "format": "before-after",
            "imgNote": "Transformation visual",
            "bg": "bg-neutral",
            "status": "pending",
            "imageB64": None,
        },
    ]
    
    return variations[:count]
