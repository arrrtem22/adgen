"""
AI Provider abstraction layer supporting both Claude and Gemini.
Uses whichever API key is available.
Priority: Claude (if ANTHROPIC_API_KEY set) > Gemini (if GEMINI_API_KEY set)
"""

import os
import json
from abc import ABC, abstractmethod
from typing import Optional, List


class AIProvider(ABC):
    """Abstract base class for AI providers."""
    
    @abstractmethod
    def generate_text(self, prompt: str, temperature: float = 0.8, max_tokens: int = 2000) -> str:
        """Generate text from prompt."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if this provider is configured and available."""
        pass


class ClaudeProvider(AIProvider):
    """Anthropic Claude provider."""
    
    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.client = None
        self.model = "claude-3-5-sonnet-20241022"
        
        if self.api_key:
            try:
                from anthropic import Anthropic
                self.client = Anthropic(api_key=self.api_key)
            except ImportError:
                print("Warning: anthropic package not installed")
    
    def is_available(self) -> bool:
        return self.api_key is not None and self.client is not None
    
    def generate_text(self, prompt: str, temperature: float = 0.8, max_tokens: int = 2000) -> str:
        if not self.client:
            raise RuntimeError("Claude client not initialized")
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return response.content[0].text


class GeminiProvider(AIProvider):
    """Google Gemini provider."""
    
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.client = None
        self.model_text = "gemini-3.1-flash-image-preview"  # Use the model user specified
        self.model_image = "gemini-3.1-flash-image-preview"
        
        if self.api_key:
            try:
                # Try new SDK first
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                self.use_new_sdk = True
            except ImportError:
                # Fall back to old SDK
                try:
                    import google.generativeai as genai_old
                    genai_old.configure(api_key=self.api_key)
                    self.client = genai_old
                    self.use_new_sdk = False
                except ImportError:
                    print("Warning: google-generativeai package not installed")
    
    def is_available(self) -> bool:
        return self.api_key is not None and self.client is not None
    
    def generate_text(self, prompt: str, temperature: float = 0.8, max_tokens: int = 2000) -> str:
        if not self.client:
            raise RuntimeError("Gemini client not initialized")
        
        if self.use_new_sdk:
            # New SDK
            from google.genai import types
            response = self.client.models.generate_content(
                model=self.model_text,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                )
            )
            return response.text
        else:
            # Old SDK
            model = self.client.GenerativeModel(self.model_text)
            response = model.generate_content(
                prompt,
                generation_config={
                    'temperature': temperature,
                    'max_output_tokens': max_tokens,
                }
            )
            return response.text
    
    def generate_image(self, prompt: str) -> Optional[bytes]:
        """Generate image using Gemini."""
        if not self.client:
            raise RuntimeError("Gemini client not initialized")
        
        try:
            if self.use_new_sdk:
                from google.genai import types
                response = self.client.models.generate_content(
                    model=self.model_image,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_modalities=['Text', 'Image']
                    )
                )
                
                # Extract image from response
                if response.candidates:
                    for candidate in response.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if part.inline_data:
                                    return part.inline_data.data
                return None
            else:
                # Old SDK
                model = self.client.GenerativeModel(self.model_image)
                response = model.generate_content(prompt)
                
                if hasattr(response, 'parts') and response.parts:
                    for part in response.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            return part.inline_data.data
                return None
        except Exception as e:
            print(f"Image generation error: {e}")
            return None


# Singleton provider instance
_provider: Optional[AIProvider] = None
_provider_type: Optional[str] = None


def get_provider() -> Optional[AIProvider]:
    """Get the configured AI provider (Claude preferred, then Gemini)."""
    global _provider, _provider_type
    
    if _provider is not None:
        return _provider
    
    # Try Claude first
    claude = ClaudeProvider()
    if claude.is_available():
        print("Using Claude (Anthropic) for text generation")
        _provider = claude
        _provider_type = "claude"
        return _provider
    
    # Fall back to Gemini
    gemini = GeminiProvider()
    if gemini.is_available():
        print("Using Gemini for text generation")
        _provider = gemini
        _provider_type = "gemini"
        return _provider
    
    print("Warning: No AI provider available (set ANTHROPIC_API_KEY or GEMINI_API_KEY)")
    return None


def get_provider_type() -> Optional[str]:
    """Get the type of provider being used."""
    global _provider_type
    if _provider_type is None:
        get_provider()
    return _provider_type


def get_gemini_provider() -> Optional[GeminiProvider]:
    """Get Gemini provider specifically for image generation."""
    gemini = GeminiProvider()
    if gemini.is_available():
        return gemini
    return None


def reset_provider():
    """Reset the provider (useful for testing)."""
    global _provider, _provider_type
    _provider = None
    _provider_type = None
