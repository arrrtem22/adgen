import google.generativeai as genai
import json
import os
from typing import Optional

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def generate_ad_copy_variations(
    product_info: dict,
    iteration: bool = False,
    previous_winners: Optional[list[str]] = None
) -> list[dict]:
    """
    Generate 3-4 ad copy variations using Gemini 2.0 Flash
    
    TODO: Implement Gemini ad copy generation
    
    What to do:
    1. Initialize Gemini model: genai.GenerativeModel('gemini-2.0-flash-exp')
    2. Build prompt that includes:
       - Product information (title, description, price)
       - Instructions to generate 3 variations
       - Different angles: problem-solution, social proof, FOMO, urgency
       - Different personas: busy professionals, budget-conscious, quality-seekers
       - Keep primary text under 125 characters
       - Request JSON output format
    3. If iteration=True, include previous_winners in prompt to build on what worked
    4. Call model.generate_content(prompt)
    5. Parse JSON response
    6. Add unique IDs to each variation
    7. Return list of ad variation dicts
    
    Example prompt structure:
    '''
    Generate 3 Meta ad copy variations for this product:
    Title: {title}
    Description: {description}
    Price: {price}
    
    Use different angles: problem-solution, social proof, FOMO
    Target different personas: busy professionals, budget-conscious, quality-seekers
    Keep primary text under 125 characters
    
    Return as JSON array:
    [
      {
        "angle": "Problem-Solution",
        "persona": "Busy professionals",
        "headline": "Short catchy headline",
        "copy": "Primary ad text (max 125 chars)"
      }
    ]
    '''
    
    Expected return format:
    [
        {
            "id": "ad_1",
            "angle": "Problem-Solution",
            "persona": "Busy professionals",
            "headline": "Save Hours Every Week",
            "copy": "Stop wasting time. Get results in minutes with our automated solution."
        },
        ...
    ]
    
    Tips:
    - Use response_mime_type="application/json" for better JSON parsing
    - Add error handling for API failures
    - Validate that response has 3+ variations
    - Generate unique IDs (uuid or simple counter)
    """
    # STUB: Return mock variations
    return [
        {
            "id": "ad_1",
            "angle": "Problem-Solution",
            "persona": "Busy professionals",
            "headline": "Save Time, Get Results",
            "copy": "Stop wasting hours. Our product delivers results in minutes."
        },
        {
            "id": "ad_2",
            "angle": "Social Proof",
            "persona": "Quality-seekers",
            "headline": "Join 10,000+ Happy Customers",
            "copy": "Trusted by professionals worldwide. See why everyone's switching."
        },
        {
            "id": "ad_3",
            "angle": "FOMO",
            "persona": "Budget-conscious",
            "headline": "Limited Time: 40% Off",
            "copy": "Sale ends tonight. Don't miss your chance to save big."
        }
    ]
