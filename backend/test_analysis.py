import asyncio
import aiohttp
from bs4 import BeautifulSoup
import re
from backend.app.services.analyzer import analyze_snapshot_content

async def run_test():
    domain = "redhat-gitops-patterns.io"
    print("Starting robust analysis test for:", domain)
    # 1. Fetch from CDX
    url = f"https://web.archive.org/cdx/search/cdx?url={domain}/*&output=json&limit=100"
    params = None
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    snapshots = []
    async with aiohttp.ClientSession() as session:
        # Retry loop for 503/network issues
        for attempt in range(5):
            print(f"CDX fetch attempt {attempt+1}...")
            try:
                async with session.get(url, params=params, headers=headers, timeout=15) as res:
                    if res.status == 200:
                        data = await res.json()
                        if data and len(data) > 1:
                            headers_list = data[0]
                            for row in data[1:]:
                                snapshots.append(dict(zip(headers_list, row)))
                            print(f"Successfully retrieved {len(snapshots)} snapshots.")
                            break
                        else:
                            print("Empty data received.")
                    else:
                        body = await res.text()
                        print(f"Attempt {attempt+1} failed with status {res.status}. Body: {body[:200]}")
            except Exception as e:
                print(f"Attempt {attempt+1} failed with exception: {e}")
            await asyncio.sleep(2)
            
        if not snapshots:
            print("Failed to fetch snapshots after 5 attempts.")
            return

        # Filter for statuscode == 200 and text/html mimetype
        valid_snapshots = []
        for snap in snapshots:
            status = snap.get("statuscode", "")
            mime = snap.get("mimetype", snap.get("mime", ""))
            if status == "200" and "text/html" in mime:
                valid_snapshots.append(snap)
                
        if not valid_snapshots:
            print("No valid status 200 text/html snapshots found.")
            return

        # Sort and take the latest snapshot
        valid_snapshots = sorted(valid_snapshots, key=lambda s: s["timestamp"])
        latest = valid_snapshots[-1]
        print(f"\nLatest snapshot found: timestamp={latest['timestamp']}, url={latest['original']}")
        
        # Fetch the content of the latest snapshot
        raw_url = f"https://web.archive.org/web/{latest['timestamp']}id_/{latest['original']}"
        print(f"Fetching raw HTML from: {raw_url}")
        
        html_content = ""
        for attempt in range(5):
            print(f"HTML fetch attempt {attempt+1}...")
            try:
                async with session.get(raw_url, headers=headers, timeout=15) as html_res:
                    if html_res.status == 200:
                        html_content = await html_res.text(errors='ignore')
                        print(f"Successfully fetched HTML ({len(html_content)} chars).")
                        break
                    else:
                        print(f"Attempt {attempt+1} failed with status {html_res.status}")
            except Exception as e:
                print(f"Attempt {attempt+1} failed with exception: {e}")
            await asyncio.sleep(2)

        if not html_content:
            print("Failed to fetch HTML content.")
            return

        # Run analysis
        score, category_scores, flags = analyze_snapshot_content(html_content)
        print("\n=== Analysis Result ===")
        print("Overall Score:", score)
        print("Category Confidence:", category_scores)
        print("Flags Triggered:")
        for flag in flags:
            print(f"- {flag['category'].upper()} | Keyword: '{flag['keyword']}' | Weight: {flag['weight']} | Matches: {flag['match_count']}")

if __name__ == '__main__':
    asyncio.run(run_test())
