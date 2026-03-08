import json
import os
import uuid
from typing import Optional

# Try to use the new google.genai package, fall back to old one
try:
    from google import genai
    from google.genai import types
    USE_NEW_GENAI = True
    print("Using new google.genai package")
except ImportError:
    try:
        import google.generativeai as genai
        USE_NEW_GENAI = False
        print("Using deprecated google.generativeai package")
    except ImportError:
        genai = None
        USE_NEW_GENAI = False
        print("WARNING: No Gemini package installed")

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
client = None

if api_key and genai:
    if USE_NEW_GENAI:
        client = genai.Client(api_key=api_key)
    else:
        genai.configure(api_key=api_key)


def get_model():
    """Get the Gemini model instance."""
    if USE_NEW_GENAI:
        return "gemini-3.1-flash-image-preview"  # Model name for new API
    else:
        return genai.GenerativeModel('gemini-3.1-flash-image-preview')


def generate_with_new_genai(prompt: str) -> str:
    """Generate content using the new google.genai package."""
    if not client:
        raise ValueError("Gemini client not initialized. Check GEMINI_API_KEY.")
    
    response = client.models.generate_content(
        model="gemini-3.1-flash-image-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.8,
            top_p=0.9,
            top_k=40,
            max_output_tokens=4096,
        )
    )
    return response.text


def generate_with_old_genai(prompt: str) -> str:
    """Generate content using the old google.generativeai package."""
    model = get_model()
    response = model.generate_content(
        prompt,
        generation_config={
            'temperature': 0.8,
            'top_p': 0.9,
            'top_k': 40,
            'max_output_tokens': 4096,
        }
    )
    return response.text


def build_foundation_prompt(
    product_info: dict,
    foundation_data: Optional[dict] = None,
    compliance_data: Optional[dict] = None,
    selected_angles: Optional[list] = None,
    iteration: bool = False,
    previous_winners: Optional[list[str]] = None,
    count: int = 3
) -> str:
    """Build an enhanced prompt using foundation documents for better ad copy generation."""
    
    title = product_info.get('title', 'Unknown Product')
    description = product_info.get('description', '')
    price = product_info.get('price', '')
    promise = product_info.get('promise', '')
    offer = product_info.get('offer', '')
    visual_desc = product_info.get('visualDesc', '')
    
    # Parse foundation documents
    context_json = {}
    angles_json = []
    
    if foundation_data:
        try:
            context_content = foundation_data.get('context', '')
            if context_content:
                context_json = json.loads(context_content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Warning: Could not parse context.json: {e}")
            context_json = {}
        
        try:
            angles_content = foundation_data.get('angles', '')
            if angles_content:
                angles_json = json.loads(angles_content)
                if isinstance(angles_json, dict) and 'angles' in angles_json:
                    angles_json = angles_json['angles']
        except (json.JSONDecodeError, Exception) as e:
            print(f"Warning: Could not parse angles.json: {e}")
            angles_json = []
    
    # Extract key information from context
    avatar = context_json.get('avatar', {})
    product = context_json.get('product', {})
    brand = context_json.get('brand', {})
    positioning = context_json.get('positioning', {})
    objections = context_json.get('objections', {})
    compliance_info = context_json.get('compliance', {})
    
    # Build angle information
    angle_info = ""
    if angles_json:
        angle_info = "\n\n## ANGLE DEFINITIONS\n"
        for angle in angles_json[:6]:  # Limit to first 6 angles
            angle_name = angle.get('name', '')
            if selected_angles and angle_name not in selected_angles:
                continue
            perf_tag = angle.get('perf_tag', 'untested')
            emotional_core = angle.get('emotionalCore', '')
            hook_formulas = angle.get('hookFormulas', [])
            proven_hooks = angle.get('provenHooks', [])
            
            angle_info += f"\n### {angle_name} (tag: {perf_tag})\n"
            if emotional_core:
                angle_info += f"Emotional Core: {emotional_core}\n"
            if hook_formulas:
                angle_info += f"Hook Formulas: {', '.join(hook_formulas[:2])}\n"
            if proven_hooks:
                angle_info += f"Proven Hooks: {', '.join(proven_hooks[:2])}\n"
    
    # Build compliance section
    compliance_section = ""
    if compliance_data or compliance_info:
        level = compliance_data.get('level', '') if compliance_data else compliance_info.get('level', '')
        forbidden = compliance_data.get('forbidden_claims', []) if compliance_data else compliance_info.get('forbidden', [])
        disclaimer = compliance_data.get('disclaimer', '') if compliance_data else compliance_info.get('disclaimer', '')
        
        compliance_section = f"""

## COMPLIANCE REQUIREMENTS
- Level: {level}
- Forbidden Claims: {', '.join(forbidden) if forbidden else 'None specified'}
- Required Disclaimer: {disclaimer if disclaimer else 'Standard disclaimers apply'}
"""
    
    # Build avatar section
    avatar_section = ""
    if avatar:
        avatar_name = avatar.get('name', '')
        felt_problem = avatar.get('feltProblem', '')
        dream_outcome = avatar.get('dreamOutcome', '')
        language = avatar.get('language', [])
        
        avatar_section = f"""

## IDEAL CUSTOMER PROFILE (AVATAR)
- Name: {avatar_name}
- Felt Problem: {felt_problem}
- Dream Outcome: {dream_outcome}
- Language They Use: {', '.join(language[:5]) if language else 'Not specified'}
"""
    
    # Build positioning section
    positioning_section = ""
    if positioning:
        core_position = positioning.get('corePosition', '')
        unique_mechanism = positioning.get('uniqueMechanism', '')
        category_frame = positioning.get('categoryFrame', '')
        
        positioning_section = f"""

## POSITIONING
- Core Position: {core_position}
- Unique Mechanism: {unique_mechanism}
- Category Frame: {category_frame}
"""
    
    # Build objections section
    objections_section = ""
    if objections:
        price_obj = objections.get('price', '')
        skepticism_obj = objections.get('skepticism', '')
        timing_obj = objections.get('timing', '')
        
        if price_obj or skepticism_obj or timing_obj:
            objections_section = f"""

## COMMON OBJECTIONS TO ADDRESS
- Price: {price_obj}
- Skepticism: {skepticism_obj}
- Timing: {timing_obj}
"""
    
    iteration_context = ""
    if iteration and previous_winners:
        iteration_context = f"""

## ITERATION CONTEXT
This is an iteration based on previous winning ads. Previous winners used these angles: {', '.join(previous_winners)}
Build on what worked well - similar themes, emotional hooks, and messaging patterns.
"""
    
    # Build the final prompt
    prompt = f"""You are an expert direct-response copywriter specializing in Meta ad creative. Generate {count} high-converting ad variations using the foundation research provided below.

## PRODUCT INFORMATION
- Title: {title}
- Promise: {promise}
- Offer: {offer}
- Visual Description: {visual_desc}
{avatar_section}{positioning_section}{objections_section}{angle_info}{compliance_section}{iteration_context}

## GENERATION REQUIREMENTS

For each ad variation, create:

1. **angle**: The strategic angle name (e.g., "instant transformation", "social confidence", "hidden secret")
2. **persona**: The target persona segment (Busy professionals, Budget-conscious, Quality-seekers, or Health-conscious)
3. **headline**: Short catchy headline (5-8 words max, attention-grabbing)
4. **copy**: Primary ad text (under 125 characters, punchy and engaging)
5. **hook**: Opening hook statement in quotes (emotional trigger, use avatar's language)
6. **subhead**: Supporting subheadline (10-15 words)
7. **bullets**: Array of 3 key benefit bullets (short phrases)
8. **cta**: Call-to-action text (action-oriented, include arrow)
9. **imgNote**: Image direction/prompt for later image generation (describe visual concept)
10. **format**: Ad format type (testimonial, feature callout, bold hook, minimal text, before-after)

## CRITICAL RULES

1. Use the AVATAR's language from the "Language They Use" section - mirror their exact words and phrases
2. Address the FELT PROBLEM directly in hooks - be specific about their pain
3. Lead with the DREAM OUTCOME - show the transformation
4. Reference the UNIQUE MECHANISM to make claims credible
5. Use the HOOK FORMULAS provided for each angle
6. Respect COMPLIANCE - NEVER use forbidden claims
7. Match the BRAND VOICE: {brand.get('voice', 'professional')}
8. Each variation must be DISTINCT - different angles, hooks, and approaches

Return ONLY valid JSON in this exact format:
[
  {{
    "angle": "instant_transformation",
    "persona": "Busy professionals",
    "headline": "Headline Here",
    "copy": "Primary text under 125 chars",
    "hook": "\\"Quoted hook statement.\\"",
    "subhead": "Supporting subheadline text",
    "bullets": ["Benefit 1", "Benefit 2", "Benefit 3"],
    "cta": "Get Yours Now →",
    "imgNote": "Description for image generation",
    "format": "testimonial"
  }}
]

Make each variation compelling and distinct. Ensure copy is under 125 characters."""
    
    return prompt


def parse_response(text: str) -> list[dict]:
    """Parse the Gemini response into structured data."""
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
    count: int = 3,
    foundation_data: Optional[dict] = None,
    compliance_data: Optional[dict] = None,
    selected_angles: Optional[list] = None,
) -> list[dict]:
    """
    Generate ad copy variations using Gemini.
    
    Args:
        product_info: Basic product information
        iteration: Whether this is an iteration based on previous winners
        previous_winners: List of previous winning angles
        count: Number of variations to generate
        foundation_data: Optional foundation documents (research, avatar, beliefs, positioning, context, angles)
        compliance_data: Optional compliance information
        selected_angles: List of selected angles to focus on
    
    Returns:
        List of ad variation dictionaries
    """
    # Check if API key is configured
    if not api_key:
        print("WARNING: GEMINI_API_KEY environment variable not set. Using mock data.")
        print("To use real AI generation, set GEMINI_API_KEY environment variable.")
        return get_mock_variations(count)
    
    if not genai:
        print("WARNING: Gemini package not installed. Using mock data.")
        return get_mock_variations(count)
    
    try:
        # Use foundation-enhanced prompt if foundation data is available
        if foundation_data and foundation_data.get('context'):
            prompt = build_foundation_prompt(
                product_info=product_info,
                foundation_data=foundation_data,
                compliance_data=compliance_data,
                selected_angles=selected_angles,
                iteration=iteration,
                previous_winners=previous_winners,
                count=count
            )
            print("Using foundation-enhanced prompt generation")
        else:
            # Fall back to basic prompt
            prompt = build_basic_prompt(product_info, iteration, previous_winners, count)
            print("Using basic prompt generation (no foundation data)")
        
        # Generate content using appropriate API
        if USE_NEW_GENAI:
            response_text = generate_with_new_genai(prompt)
        else:
            response_text = generate_with_old_genai(prompt)
        
        if not response_text:
            print("Warning: Empty response from Gemini, using mock data")
            return get_mock_variations(count)
        
        variations = parse_response(response_text)
        
        if not variations:
            print("Warning: Could not parse variations, using mock data")
            return get_mock_variations(count)
        
        # Add IDs and ensure all fields exist
        formatted_variations = []
        bg_styles = ["bg-dark", "bg-warm", "bg-cool", "bg-neutral"]
        
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
                "cta": var.get("cta", "Shop Now →"),
                "mode": ["A", "B", "C"][i % 3],
                "format": var.get("format", "standard"),
                "imgNote": var.get("imgNote", f"Image for {var.get('angle', 'product')} angle"),
                "bg": bg_styles[i % len(bg_styles)],
                "status": "pending",
                "imageB64": None,
                "image_url": None,
            }
            formatted_variations.append(formatted_var)
        
        print(f"Successfully generated {len(formatted_variations)} variations with AI")
        return formatted_variations
        
    except Exception as e:
        print(f"Error generating ad copy with AI: {e}")
        print("Falling back to mock data. To fix this:")
        print("1. Ensure GEMINI_API_KEY environment variable is set")
        print("2. Ensure you have a valid Gemini API key")
        print("3. Check that the model name is correct")
        import traceback
        print(traceback.format_exc())
        return get_mock_variations(count)


def build_basic_prompt(
    product_info: dict,
    iteration: bool = False,
    previous_winners: Optional[list[str]] = None,
    count: int = 3
) -> str:
    """Build a basic prompt when foundation data is not available."""
    
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
    
    return f"""Generate {count} Meta ad copy variations for this product:

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
- cta: Call-to-action text (action-oriented, include arrow)
- imgNote: Image direction/prompt for later image generation
- format: Ad format type (testimonial, feature callout, bold hook, minimal text, before-after)

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
    "cta": "Get Yours Now →",
    "imgNote": "Description for image generation",
    "format": "testimonial"
  }}
]

Make each variation distinct and compelling. Ensure copy is under 125 characters."""


def get_mock_variations(count: int = 3) -> list[dict]:
    """Return mock variations when API is unavailable."""
    variations = [
        {
            "id": f"ad_1_{uuid.uuid4().hex[:8]}",
            "angle": "instant_transformation",
            "persona": "Busy professionals",
            "headline": "Save Time, Get Results",
            "copy": "Stop wasting hours. Our product delivers results in minutes.",
            "hook": '"I wish I found this sooner - game changer!"',
            "subhead": "Designed for people who value their time",
            "bullets": ["Works in minutes", "No setup required", "Proven results"],
            "cta": "Get Started →",
            "mode": "A",
            "format": "testimonial",
            "imgNote": "Professional lifestyle image",
            "bg": "bg-dark",
            "status": "pending",
            "imageB64": None,
            "image_url": None,
        },
        {
            "id": f"ad_2_{uuid.uuid4().hex[:8]}",
            "angle": "social_proof",
            "persona": "Quality-seekers",
            "headline": "Join 10,000+ Happy Customers",
            "copy": "Trusted by professionals worldwide. See why everyone's switching.",
            "hook": '"47,000 people made the switch last month"',
            "subhead": "Join the community of satisfied customers",
            "bullets": ["4.9★ rating", "47,000+ happy users", "Featured in top publications"],
            "cta": "Join Them →",
            "mode": "B",
            "format": "testimonial",
            "imgNote": "Crowd or community image",
            "bg": "bg-warm",
            "status": "pending",
            "imageB64": None,
            "image_url": None,
        },
        {
            "id": f"ad_3_{uuid.uuid4().hex[:8]}",
            "angle": "urgency_scarcity",
            "persona": "Budget-conscious",
            "headline": "Limited Time: 40% Off",
            "copy": "Sale ends tonight. Don't miss your chance to save big.",
            "hook": '"Last chance - offer expires at midnight!"',
            "subhead": "Only 50 spots left at this price",
            "bullets": ["40% off today only", "Free shipping included", "30-day guarantee"],
            "cta": "Claim Offer →",
            "mode": "C",
            "format": "promotional",
            "imgNote": "Bold promotional graphic",
            "bg": "bg-cool",
            "status": "pending",
            "imageB64": None,
            "image_url": None,
        },
        {
            "id": f"ad_4_{uuid.uuid4().hex[:8]}",
            "angle": "transformation",
            "persona": "Health-conscious",
            "headline": "Transform Your Routine",
            "copy": "See visible results in just 7 days. Your transformation starts now.",
            "hook": '"I noticed the difference within a week"',
            "subhead": "Results you can see and feel",
            "bullets": ["Visible in 7 days", "Clinically tested", "100% natural"],
            "cta": "Start Today →",
            "mode": "A",
            "format": "before-after",
            "imgNote": "Transformation visual",
            "bg": "bg-neutral",
            "status": "pending",
            "imageB64": None,
            "image_url": None,
        },
    ]
    
    return variations[:count]
