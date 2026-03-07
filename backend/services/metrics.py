import random


def generate_mock_metrics(iteration: bool = False, is_winner: bool = False) -> dict:
    """
    Generate realistic mock metrics for ads.
    
    Args:
        iteration: If True, metrics are slightly better (showing "learning")
        is_winner: If True, bias toward higher CTR
    """
    # Base CTR ranges
    if iteration:
        # Iteration gets better metrics
        base_ctr_min, base_ctr_max = 1.5, 4.2
    else:
        # First generation
        base_ctr_min, base_ctr_max = 0.8, 3.5
    
    # Bias for winners
    if is_winner:
        base_ctr_min += 0.5
        base_ctr_max += 0.8
    
    # Generate CTR with some randomness
    ctr = round(random.uniform(base_ctr_min, base_ctr_max), 1)
    
    # Generate impressions (more for iterations = larger "budget")
    if iteration:
        impressions = random.randint(1500, 5000)
    else:
        impressions = random.randint(500, 3000)
    
    # Calculate clicks
    clicks = int(impressions * (ctr / 100))
    
    # Ensure at least 1 click
    clicks = max(1, clicks)
    
    return {
        "ctr": ctr,
        "impressions": impressions,
        "clicks": clicks
    }


def generate_metrics_for_batch(
    variations: list[dict],
    iteration: bool = False,
    previous_winners: list[str] = None
) -> list[dict]:
    """
    Generate metrics for a batch of variations.
    Adds variety so not all metrics look the same.
    """
    previous_winners = previous_winners or []
    
    for var in variations:
        # Check if this angle was a previous winner
        angle = var.get("angle", "").lower()
        is_winner = any(winner.lower() in angle or angle in winner.lower() 
                        for winner in previous_winners)
        
        # Generate metrics
        metrics = generate_mock_metrics(iteration, is_winner)
        
        # Add some random variation based on mode
        mode = var.get("mode", "A")
        if mode == "C":  # AI mode tends to perform slightly better
            metrics["ctr"] = round(min(5.0, metrics["ctr"] * 1.1), 1)
            metrics["clicks"] = int(metrics["impressions"] * (metrics["ctr"] / 100))
        
        var["mock_metrics"] = metrics
    
    return variations


def simulate_ab_test(variations: list[dict], days: int = 7) -> dict:
    """
    Simulate an A/B test over time.
    Returns projected metrics after the test period.
    """
    results = []
    
    for var in variations:
        base_ctr = var.get("mock_metrics", {}).get("ctr", 2.0)
        base_impressions = var.get("mock_metrics", {}).get("impressions", 1000)
        
        # Scale up for the test period
        daily_impressions = base_impressions
        total_impressions = daily_impressions * days
        
        # Add some variance to CTR over time
        final_ctr = round(random.uniform(base_ctr * 0.9, base_ctr * 1.1), 1)
        total_clicks = int(total_impressions * (final_ctr / 100))
        
        results.append({
            "variation_id": var.get("id"),
            "angle": var.get("angle"),
            "projected_ctr": final_ctr,
            "projected_impressions": total_impressions,
            "projected_clicks": total_clicks,
            "confidence": random.uniform(0.7, 0.95) if final_ctr > 2.5 else random.uniform(0.5, 0.8)
        })
    
    # Sort by projected CTR
    results.sort(key=lambda x: x["projected_ctr"], reverse=True)
    
    return {
        "test_duration_days": days,
        "projections": results,
        "winner": results[0] if results else None
    }
