import requests

api_key = "d66dimhr01qnh6sdfbhgd66dimhr01qnh6sdfbi0"

endpoints = [
    ("Symbol Lookup", "/search", {"q": "apple"}),
    ("Stock Symbols (US)", "/stock/symbol", {"exchange": "US"}),
    ("Market Status", "/stock/market-status", {"exchange": "US"}),
    ("Market News", "/news", {"category": "general"}),
    ("Company Profile 2", "/stock/profile2", {"symbol": "AAPL"}),
    (
        "Stock Candle",
        "/stock/candle",
        {"symbol": "AAPL", "resolution": "D", "from": "1609459200", "to": "1640995200"},
    ),
    ("Economic Calendar", "/calendar/economic", {}),
    ("Company News", "/company-news", {"symbol": "AAPL", "from": "2025-01-01", "to": "2025-02-11"}),
    ("Peers", "/stock/peers", {"symbol": "AAPL"}),
    ("Basic Financials", "/stock/metric", {"symbol": "AAPL", "metric": "all"}),
]

print("Testing Finnhub API endpoints with your key:\n")
print("=" * 70)

for name, endpoint, params in endpoints:
    params["token"] = api_key
    try:
        r = requests.get(f"https://finnhub.io/api/v1{endpoint}", params=params, timeout=10)
        status = "✓ AVAILABLE" if r.status_code == 200 else f"✗ HTTP {r.status_code}"
        print(f"{name:.<45} {status}")
        if r.status_code != 200:
            try:
                error_msg = r.json().get("error", r.text[:80])
                print(f"  └─ {error_msg}")
            except Exception:
                print(f"  └─ {r.text[:80]}")
    except Exception as e:
        print(f"{name:.<45} ✗ ERROR: {str(e)[:50]}")

print("=" * 70)
