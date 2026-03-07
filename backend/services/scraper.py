import requests
from bs4 import BeautifulSoup
import re
import json
from typing import Optional


def extract_price(soup: BeautifulSoup) -> Optional[str]:
    """Extract price from common selectors and patterns."""
    # Common price selectors
    price_selectors = [
        '[data-price]',
        '.price',
        '.product-price',
        '.current-price',
        '.sale-price',
        '[class*="price"]',
        '[class*="Price"]',
        '.money',
        '[itemprop="price"]',
    ]
    
    for selector in price_selectors:
        elem = soup.select_one(selector)
        if elem:
            text = elem.get_text(strip=True)
            if text and '$' in text:
                return text
    
    # Look for price in meta tags
    meta_price = soup.find('meta', {'property': 'product:price:amount'})
    if meta_price:
        currency = soup.find('meta', {'property': 'product:price:currency'})
        symbol = '$' if currency and currency.get('content') == 'USD' else '$'
        return f"{symbol}{meta_price.get('content', '')}"
    
    # Regex pattern for prices
    text = soup.get_text()
    price_pattern = r'\$[\d,]+\.?\d*'
    matches = re.findall(price_pattern, text)
    if matches:
        # Return the most common price (likely the actual product price)
        from collections import Counter
        return Counter(matches).most_common(1)[0][0]
    
    return None


def extract_title(soup: BeautifulSoup) -> str:
    """Extract product title from various sources."""
    # Try meta tags first (most reliable)
    og_title = soup.find('meta', {'property': 'og:title'})
    if og_title and og_title.get('content'):
        return og_title['content'].strip()
    
    # Try h1
    h1 = soup.find('h1')
    if h1:
        return h1.get_text(strip=True)
    
    # Try product title class
    title_selectors = [
        '[data-product-title]',
        '.product-title',
        '.product-name',
        '[class*="product-title"]',
        '[class*="ProductTitle"]',
        'h1[class*="title"]',
    ]
    
    for selector in title_selectors:
        elem = soup.select_one(selector)
        if elem:
            return elem.get_text(strip=True)
    
    # Fallback to title tag
    title_tag = soup.find('title')
    if title_tag:
        title = title_tag.get_text(strip=True)
        # Remove site name if present
        return title.split('|')[0].split('-')[0].strip()
    
    return "Unknown Product"


def extract_description(soup: BeautifulSoup) -> str:
    """Extract product description."""
    # Try meta description
    meta_desc = soup.find('meta', {'name': 'description'})
    if meta_desc and meta_desc.get('content'):
        return meta_desc['content'].strip()
    
    og_desc = soup.find('meta', {'property': 'og:description'})
    if og_desc and og_desc.get('content'):
        return og_desc['content'].strip()
    
    # Try product description
    desc_selectors = [
        '[data-product-description]',
        '.product-description',
        '.description',
        '[class*="description"]',
        '[itemprop="description"]',
    ]
    
    for selector in desc_selectors:
        elem = soup.select_one(selector)
        if elem:
            text = elem.get_text(strip=True)
            if len(text) > 20:
                return text[:500]  # Limit length
    
    # Try first meaningful paragraph
    for p in soup.find_all('p'):
        text = p.get_text(strip=True)
        if len(text) > 50:
            return text[:500]
    
    return "No description available"


def extract_image(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Extract main product image."""
    # Try og:image
    og_image = soup.find('meta', {'property': 'og:image'})
    if og_image and og_image.get('content'):
        return og_image['content']
    
    # Try product image selectors
    img_selectors = [
        '[data-product-image]',
        '.product-image img',
        '.product-photo',
        '[class*="product-image"] img',
        '[itemprop="image"]',
        'img[alt*="product"]',
        'img[alt*="Product"]',
    ]
    
    for selector in img_selectors:
        elem = soup.select_one(selector)
        if elem:
            src = elem.get('data-src') or elem.get('src')
            if src:
                # Handle relative URLs
                if src.startswith('//'):
                    return 'https:' + src
                elif src.startswith('/'):
                    from urllib.parse import urlparse
                    parsed = urlparse(base_url)
                    return f"{parsed.scheme}://{parsed.netloc}{src}"
                return src
    
    # Try first large image
    for img in soup.find_all('img'):
        src = img.get('data-src') or img.get('src')
        if src and ('product' in src.lower() or 'large' in src.lower()):
            return src
    
    return None


def extract_json_ld(soup: BeautifulSoup) -> dict:
    """Extract structured data from JSON-LD."""
    scripts = soup.find_all('script', {'type': 'application/ld+json'})
    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict) and data.get('@type') == 'Product':
                return data
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get('@type') == 'Product':
                        return item
        except:
            continue
    return {}


def scrape_product(url: str) -> dict:
    """
    Scrape product information from a URL.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract basic info
        title = extract_title(soup)
        description = extract_description(soup)
        price = extract_price(soup)
        image_url = extract_image(soup, url)
        
        # Try to get more info from JSON-LD
        json_ld = extract_json_ld(soup)
        if json_ld:
            if not price and json_ld.get('offers'):
                offers = json_ld['offers']
                if isinstance(offers, list) and offers:
                    price = offers[0].get('price', '')
                elif isinstance(offers, dict):
                    price = offers.get('price', '')
            if json_ld.get('image'):
                if isinstance(json_ld['image'], list):
                    image_url = json_ld['image'][0]
                else:
                    image_url = json_ld['image']
        
        # Generate additional fields for the frontend
        promise = f"Premium quality {title.lower()} designed for everyday use"
        offer = f"Get yours today{f' for {price}' if price else ''}"
        visual_desc = f"Product photo of {title.lower()}, clean professional shot"
        
        return {
            "title": title,
            "description": description,
            "price": price,
            "image_url": image_url,
            "promise": promise,
            "offer": offer,
            "visualDesc": visual_desc,
        }
        
    except requests.RequestException as e:
        # Return mock data on error but with error flag
        return {
            "title": "Example Product",
            "description": f"Could not fetch product data: {str(e)}",
            "price": "$49.99",
            "image_url": None,
            "promise": "Premium quality product designed for everyday use",
            "offer": "Get yours today for $49.99",
            "visualDesc": "Product photo, clean professional shot",
            "error": str(e),
        }
