"""
Foundation document generator for AdGen.

Generates foundation documents based on brand configuration:
- research.md: market landscape, product facts, ICP demographics
- avatar.md: ICP profile with emotional states per angle
- beliefs.md: belief shift map — current → desired belief per angle
- positioning.md: core positioning + which angles it suits
- context.json: compressed ICP summary — feeds all copy prompts
- angles.json: angle defs + hooks + proof points
"""

import google.generativeai as genai
import json
import os
from typing import Optional

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# Model configuration - Uses Gemini Pro for foundation generation
GEMINI_MODEL = 'gemini-3.1-pro-preview'  # Fast, cost-efficient model

# FOUNDATION GENERATION PROMPTS
# These prompts generate the core foundation documents from brand config.
# Each document builds on the previous one to create a complete marketing foundation.

FOUNDATION_PROMPTS = {
    'research': """You are a direct-response market researcher. Based on the product inputs below, generate a comprehensive research.md document.

PRODUCT INPUTS:
- Brand: {brand_name}
- Category: {category}
- Product: {product_name}
- Promise: {product_promise}
- Offer: {product_offer}
- Brand Voice: {voice}
- Compliance Level: {compliance_level}
- Forbidden Claims: {forbidden_claims}

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

Write in clear, factual prose. No fluff. Be specific — avoid vague generalities. If something cannot be known from the inputs, make a clearly reasoned assumption and mark it (assumed).""",

    'avatar': """You are a direct-response customer research specialist. Using the research document and product inputs below, generate a detailed avatar.md — a deep customer profile that will be used to write conversion-focused ad copy.

PRODUCT INPUTS:
- Brand: {brand_name}
- Category: {category}
- Product: {product_name}
- Promise: {product_promise}
- Offer: {product_offer}
- Brand Voice: {voice}

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

### What They Tell Themselves
The internal narrative running in their head. The objections, the self-doubt, the rationalizations for not buying.

### The Dream Outcome
Not the product benefit — the downstream life change. What does life look like 30 days after the problem is solved?

### Language They Use
Actual words, phrases, and expressions this person uses when talking about the problem. These become hooks.

Be ruthlessly specific. A vague avatar produces generic copy. Name real situations, real moments, real feelings.""",

    'beliefs': """You are a direct-response conversion strategist. Using the avatar and product inputs below, generate a beliefs.md — a belief shift map that shows what the customer currently believes vs what they need to believe to buy.

PRODUCT INPUTS:
- Brand: {brand_name}
- Product: {product_name}
- Promise: {product_promise}
- Offer: {product_offer}
- Compliance: {compliance_level}
- Forbidden Claims: {forbidden_claims}

Generate beliefs.md with these sections:

## Core Belief Shift
The single most important belief the customer must shift to go from scrolling past to buying.
- Current belief: [what they believe now]
- Required belief: [what they must believe to buy]
- The bridge: [what argument, proof, or reframe creates the shift]

## Universal Objections
Beliefs that block purchase regardless of angle:
- Price objection: current belief + reframe
- Skepticism objection: current belief + reframe  
- Timing objection: current belief + reframe

## Compliance Guardrails
Given the compliance level ({compliance_level}) and forbidden claims, note which belief shifts must be handled carefully and how to frame them without triggering violations.

Be direct and specific. Every belief and reframe must be rooted in the product promise and offer.""",

    'positioning': """You are a brand strategist specializing in direct-response positioning. Using the product inputs below, generate positioning.md — the strategic positioning document that defines how this product should be framed in every ad.

PRODUCT INPUTS:
- Brand: {brand_name}
- Category: {category}
- Product: {product_name}
- Promise: {product_promise}
- Offer: {product_offer}
- Brand Voice: {voice}
- Compliance: {compliance_level}

Generate positioning.md with these sections:

## Core Position
One sentence. What this product is, who it's for, and why it's different. This is the north star every ad must be consistent with.

## The Unique Mechanism
What specifically makes this product work in a way competitors don't. This is the "because" behind every claim — the reason the promise is credible.

## Category Framing
Are we competing head-to-head in the existing category, or reframing into a new one? Define the frame we want customers to use when evaluating this product.

## What We Are Not
Explicit statements about what this product should never be compared to or positioned as. Protects against copy that dilutes the position.

## Voice & Tone Constraints
Given brand voice ({voice}), define what this means practically in ad copy:
- Words and phrases to use
- Words and phrases to avoid
- Sentence structure preferences
- What "on-brand" feels like vs off-brand

## Offer Framing
How to present {product_offer} in a way that feels like a no-brainer, not a discount. The psychological frame around the price and risk reversal.""",

    'context': """You are a prompt engineering specialist. Your job is to compress the foundation documents into a single structured context.json file that will be injected into every AI copy generation prompt.

This file must be:
- Dense but readable
- Under 800 tokens when serialized
- Structured so a copy AI can extract exactly what it needs per angle
- Free of redundancy

PRODUCT INPUTS:
- Brand: {brand_name}
- Category: {category}
- Product: {product_name}
- Promise: {product_promise}
- Offer: {product_offer}
- Brand Voice: {voice}
- Visual Description: {visual_desc}
- Compliance Level: {compliance_level}
- Forbidden Claims: {forbidden_claims}
- Disclaimer: {disclaimer}

Output a single valid JSON object with this exact structure:

{{
  "product": {{
    "name": "",
    "promise": "",
    "offer": "",
    "mechanism": "",
    "visualDesc": ""
  }},
  "brand": {{
    "name": "",
    "voice": "",
    "category": "",
    "toneWords": [],
    "avoidWords": []
  }},
  "avatar": {{
    "name": "",
    "oneLiner": "",
    "feltProblem": "",
    "dreamOutcome": "",
    "alreadyTried": [],
    "language": []
  }},
  "angles": [
    {{
      "name": "",
      "perf_tag": "",
      "blockingBelief": "",
      "triggeringBelief": "",
      "hookDirection": "",
      "bestProofType": "",
      "frame": ""
    }}
  ],
  "objections": {{
    "price": "",
    "skepticism": "",
    "timing": ""
  }},
  "compliance": {{
    "level": "",
    "forbidden": [],
    "disclaimer": "",
    "guardrails": ""
  }},
  "positioning": {{
    "corePosition": "",
    "uniqueMechanism": "",
    "categoryFrame": "",
    "notThis": ""
  }}
}}

Output ONLY the JSON. No explanation, no markdown, no backticks.""",

    'angles': """You are a direct-response hook specialist. Using the product inputs below, generate angles.json — an enriched angle definition file that the copy AI will reference when writing hooks and headlines for each angle.

PRODUCT INPUTS:
- Brand: {brand_name}
- Category: {category}
- Product: {product_name}
- Promise: {product_promise}
- Offer: {product_offer}
- Brand Voice: {voice}
- Visual Description: {visual_desc}
- Compliance: {compliance_level}

For each angle, produce a rich definition. Output a JSON array with this structure:

[
  {{
    "name": "snake_case_angle_identifier",
    "perf_tag": "winner|proven|comp|untested",
    "emotionalCore": "single emotional driver in one sentence",
    "hookFormulas": [
      "template 1 with [BLANK]",
      "template 2 with [BLANK]",
      "template 3 with [BLANK]"
    ],
    "provenHooks": [],
    "headlines": ["headline 1", "headline 2", "headline 3"],
    "proofPoints": ["point 1", "point 2", "point 3"],
    "avoidPhrases": ["phrase 1", "phrase 2"],
    "bestFormat": "Testimonial|Feature Callout|Bold Hook|Minimal Text",
    "bestMode": "A|B|C",
    "cta": "Call to action text"
  }}
]

Generate 6-8 angles including:
- name: "instant_transformation", perf_tag: "winner"
- name: "social_confidence", perf_tag: "proven"
- name: "hidden_secret", perf_tag: "winner"
- name: "problem_solution", perf_tag: "comp"
- name: "objection_busting", perf_tag: "untested"
- name: "social_proof", perf_tag: "untested"
- name: "comparison_vs_others", perf_tag: "comp"
- name: "urgency_scarcity", perf_tag: "untested" (only if offer supports it)

CRITICAL RULES:
- name: MUST be snake_case identifier (e.g., "instant_transformation", "social_confidence")
- perf_tag: MUST be exactly one of: "winner", "proven", "comp", or "untested"
- Do NOT put the angle name in perf_tag
- Do NOT put perf_tag values in the name field

Output ONLY the JSON array. No explanation, no markdown, no backticks."""
}


def get_model():
    """Get the Gemini model instance."""
    return genai.GenerativeModel(GEMINI_MODEL)


def parse_foundation_response(text: str, doc_type: str) -> str:
    """Parse and clean the foundation generation response."""
    text = text.strip()
    
    # If wrapped in markdown code blocks, extract it
    if '```markdown' in text:
        text = text.split('```markdown')[1].split('```')[0]
    elif '```json' in text:
        text = text.split('```json')[1].split('```')[0]
    elif '```' in text:
        text = text.split('```')[1].split('```')[0]
    
    return text.strip()


def build_enhanced_prompt(doc_type: str, brand: dict, compliance: dict, comp_intel: str, previous_docs: dict) -> str:
    """Build prompt with previous document context for sequential generation."""
    
    brand_name = brand.get('name', 'Unknown Brand')
    category = brand.get('category', 'general')
    voice = brand.get('voice', 'professional')
    product = brand.get('product', {})
    product_name = product.get('name', 'Unknown Product')
    product_promise = product.get('promise', '')
    product_offer = product.get('offer', '')
    visual_desc = product.get('visualDesc', '')
    
    compliance_level = compliance.get('level', 'general')
    forbidden_claims = compliance.get('forbidden_claims', [])
    disclaimer = compliance.get('disclaimer', '')
    
    comp_context = f"\nCompetitive Intelligence:\n{comp_intel}\n" if comp_intel else ""
    
    # Build base template
    template = FOUNDATION_PROMPTS.get(doc_type, "Generate marketing foundation document.")
    
    # Add previous document context for sequential documents
    context_prefix = ""
    if doc_type == 'avatar' and 'research' in previous_docs:
        context_prefix = f"""RESEARCH DOCUMENT:
{previous_docs['research']}

---

"""
    elif doc_type == 'beliefs' and 'avatar' in previous_docs:
        context_prefix = f"""AVATAR DOCUMENT:
{previous_docs['avatar']}

---

"""
    elif doc_type == 'positioning' and 'beliefs' in previous_docs:
        context_prefix = f"""BELIEFS DOCUMENT:
{previous_docs['beliefs']}

---

"""
    elif doc_type == 'context' and all(k in previous_docs for k in ['research', 'avatar', 'beliefs', 'positioning']):
        context_prefix = f"""FOUNDATION DOCUMENTS:

RESEARCH:
{previous_docs['research']}

AVATAR:
{previous_docs['avatar']}

BELIEFS:
{previous_docs['beliefs']}

POSITIONING:
{previous_docs['positioning']}

---

"""
    elif doc_type == 'angles' and 'context' in previous_docs:
        context_prefix = f"""CONTEXT JSON:
{previous_docs['context']}

---

"""
    
    # Format template with values
    formatted = template.format(
        brand_name=brand_name,
        category=category,
        voice=voice,
        product_name=product_name,
        product_promise=product_promise,
        product_offer=product_offer,
        visual_desc=visual_desc,
        compliance_level=compliance_level,
        forbidden_claims=', '.join(forbidden_claims) if forbidden_claims else 'None specified',
        forbidden_claims_json=json.dumps(forbidden_claims),
        disclaimer=disclaimer if disclaimer else 'Standard disclaimers apply',
        comp_intel=comp_context
    )
    
    return context_prefix + formatted


def generate_foundation_document(
    doc_type: str,
    brand: dict,
    compliance: dict,
    comp_intel: str = "",
    previous_docs: dict = None
) -> dict:
    """
    Generate a single foundation document using Gemini.
    
    Args:
        doc_type: Type of document to generate
        brand: Brand configuration
        compliance: Compliance settings
        comp_intel: Competitive intelligence text
        previous_docs: Dict of previously generated documents for context
    
    Returns:
        dict with name, status, content, desc, type
    """
    doc_info = {
        'research': {'name': 'research.md', 'desc': 'market landscape, product facts, ICP demographics', 'type': 'doc'},
        'avatar': {'name': 'avatar.md', 'desc': 'ICP profile with emotional states per angle', 'type': 'doc'},
        'beliefs': {'name': 'beliefs.md', 'desc': 'belief shift map — current → desired belief per angle', 'type': 'doc'},
        'positioning': {'name': 'positioning.md', 'desc': 'core positioning + which angles it suits', 'type': 'doc'},
        'context': {'name': 'context.json', 'desc': 'compressed ICP summary — feeds all copy prompts', 'type': 'key'},
        'angles': {'name': 'angles.json', 'desc': 'angle defs + hooks + proof points', 'type': 'angle'},
    }
    
    info = doc_info.get(doc_type, {'name': 'unknown.md', 'desc': '', 'type': 'doc'})
    previous_docs = previous_docs or {}
    
    # Check if API key is configured
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set. Please set it to use the foundation generator.")
    
    try:
        model = get_model()
        prompt = build_enhanced_prompt(doc_type, brand, compliance, comp_intel, previous_docs)
        
        # Generation configuration optimized for Pro model
        response = model.generate_content(
            prompt,
            generation_config={
                'temperature': 0.7,
                'top_p': 0.95,
                'top_k': 40,
                'max_output_tokens': 8192,
            }
        )
        
        if not response.text:
            print(f"Warning: Empty response from Gemini for {doc_type}")
            return {
                'name': info['name'],
                'status': 'error',
                'content': f"Error: Empty response from AI for {doc_type}",
                'desc': info['desc'],
                'type': info['type'],
            }
        
        content = parse_foundation_response(response.text, doc_type)
        
        return {
            'name': info['name'],
            'status': 'done',
            'content': content,
            'desc': info['desc'],
            'type': info['type'],
        }
        
    except Exception as e:
        print(f"Error generating foundation {doc_type}: {e}")
        return {
            'name': info['name'],
            'status': 'error',
            'content': f"Error generating document: {str(e)}",
            'desc': info['desc'],
            'type': info['type'],
        }


def generate_all_foundation(
    brand: dict,
    compliance: dict,
    comp_intel: str = ""
) -> dict:
    """
    Generate all foundation documents sequentially.
    Each document builds on the previous ones for consistency.
    
    Returns:
        dict with all foundation documents and extracted angles
    """
    doc_order = ['research', 'avatar', 'beliefs', 'positioning', 'context', 'angles']
    
    foundation = {}
    previous_docs = {}
    
    for doc_type in doc_order:
        print(f"Generating {doc_type}...")
        doc = generate_foundation_document(doc_type, brand, compliance, comp_intel, previous_docs)
        foundation[doc_type] = doc
        
        # Store content for next documents (only if successful)
        if doc['status'] == 'done':
            previous_docs[doc_type] = doc['content']
    
    # Try to parse angles from the angles document
    angles = []
    valid_perf_tags = {'winner', 'proven', 'comp', 'untested'}
    
    try:
        angles_content = foundation.get('angles', {}).get('content', '{}')
        angles_data = json.loads(angles_content)
        
        # Handle both list format and nested format
        angle_list = []
        if isinstance(angles_data, list):
            angle_list = angles_data
        elif 'angles' in angles_data:
            angle_list = angles_data['angles']
        
        # Parse and validate each angle
        for i, a in enumerate(angle_list):
            name = a.get('name', f'angle_{i}')
            perf_tag = a.get('perf_tag', 'untested')
            
            # Validate/fix perf_tag - must be one of valid values
            if perf_tag not in valid_perf_tags:
                # AI might have swapped name and perf_tag, or used wrong value
                print(f"Warning: Invalid perf_tag '{perf_tag}' for angle '{name}', defaulting to 'untested'")
                perf_tag = 'untested'
            
            angles.append({'name': name, 'perf_tag': perf_tag})
            
    except Exception as e:
        print(f"Warning: Could not parse angles from foundation: {e}")
    
    # Fallback to default angles if parsing failed or returned empty
    if not angles:
        angles = [
            {'name': 'instant transformation', 'perf_tag': 'winner'},
            {'name': 'social confidence', 'perf_tag': 'proven'},
            {'name': 'hidden secret', 'perf_tag': 'winner'},
            {'name': 'problem solution', 'perf_tag': 'comp'},
            {'name': 'objection busting', 'perf_tag': 'untested'},
            {'name': 'social proof', 'perf_tag': 'untested'},
        ]
    
    return {
        'foundation': foundation,
        'angles': angles,
    }

