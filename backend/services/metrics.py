import random


def generate_mock_metrics(iteration: bool = False, is_winner: bool = False) -> dict:
    """
    Generate realistic mock metrics for ads
    
    TODO: Implement mock metrics generation
    
    What to do:
    1. Generate CTR (click-through rate):
       - First generation: 0.8% - 3.5%
       - If iteration=True: slightly higher range (1.5% - 4.2%)
       - If is_winner=True: bias toward higher end
    2. Generate impressions: 500 - 5000
    3. Calculate clicks: int(impressions * (ctr / 100))
    4. Return dict with ctr, impressions, clicks
    
    Tips:
    - Use random.uniform() for realistic variation
    - Round CTR to 1 decimal place
    - Make iteration metrics slightly better (shows "learning")
    - Add some randomness so not all metrics are similar
    """
    # STUB: Return basic mock data
    ctr = round(random.uniform(1.0, 3.5), 1)
    impressions = random.randint(800, 3000)
    clicks = int(impressions * (ctr / 100))
    
    return {
        "ctr": ctr,
        "impressions": impressions,
        "clicks": clicks
    }
