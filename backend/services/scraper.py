import requests
from bs4 import BeautifulSoup


def scrape_product(url: str) -> dict:
    """
    Scrape product information from a URL
    
    TODO: Implement product scraping
    
    What to do:
    1. Send GET request to the URL
    2. Parse HTML with BeautifulSoup
    3. Extract:
       - Product title (try <h1>, meta tags, og:title)
       - Product description (try meta description, og:description, <p> tags)
       - Price (look for common price selectors, regex patterns)
       - Main product image URL (try og:image, first <img> in product area)
    4. Return structured dict with all extracted info
    5. Add error handling for failed requests or missing data
    
    Example return:
    {
        "title": "Product Name",
        "description": "Product description...",
        "price": "$99.99",
        "image_url": "https://example.com/product.jpg"
    }
    
    Tips:
    - Use headers to avoid bot detection: {'User-Agent': 'Mozilla/5.0...'}
    - Try multiple selectors/strategies (meta tags are most reliable)
    - Handle cases where elements don't exist (use .get(), try/except)
    """
    # STUB: Return mock data for now
    return {
        "title": "Example Product",
        "description": "This is a sample product description for testing.",
        "price": "$49.99",
        "image_url": "https://via.placeholder.com/500"
    }
