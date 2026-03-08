"""
Vercel Serverless Function Entry Point
This file serves as the main entry point for Vercel's Python serverless functions.
"""

import os
import sys

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Import and expose the FastAPI app
from backend.main import app

# Vercel serverless handler
# The app will be served via ASGI
