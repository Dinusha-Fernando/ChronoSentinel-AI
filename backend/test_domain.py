import asyncio
import aiohttp
from bs4 import BeautifulSoup
import re

async def run_test_domain():
    domain = "redhat-gitops-patterns.io"
    print("Testing domain:", domain)
    
    # 1. Fetch from CDX
    url = "https://web.archive.org/cdx/search/cdx"
    # Test simple query first
    params = {
        "url": domain,
        "output": "json"
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params, headers=headers) as res:
            if res.status != 200:
                body = await res.text()
                print("Simple query failed. Status:", res.status, "Body:", body)
                return
            data = await res.json()
            print("Simple query succeeded, found entries:", len(data))
            if not data or len(data) <= 1:
                return
            
            headers_list = data[0]
            snapshots = []
            for row in data[1:]:
                snapshot = dict(zip(headers_list, row))
                snapshots.append(snapshot)
            
            print(f"Total raw snapshots: {len(snapshots)}")
        
        print(f"Total snapshots found: {len(snapshots)}")
        
        # Let's inspect the latest one
        if snapshots:
            latest = snapshots[-1]
            print(f"\nFetching latest snapshot: timestamp={latest['timestamp']}, url={latest['original']}")
            raw_url = f"https://web.archive.org/web/{latest['timestamp']}id_/{latest['original']}"
            async with session.get(raw_url, headers=headers) as html_res:
                html_content = await html_res.text(errors='ignore')
                print(f"Fetched HTML size: {len(html_content)} characters")
                
                # Clean text
                soup = BeautifulSoup(html_content, "html.parser")
                for el in soup(["script", "style", "head", "iframe", "noscript", "meta", "link"]):
                    el.decompose()
                text = soup.get_text(separator=" ")
                text = re.sub(r'\s+', ' ', text).strip().lower()
                print("\nCleaned text (first 1000 chars):")
                print(text[:1000])
                
                # Check for some gambling / adult words
                keywords_to_check = ["casino", "gambling", "betting", "slots", "poker", "roulette", "blackjack", "jackpot", "wager", "baccarat", "online casino", "slot machine", "lottery"]
                print("\nChecking matching keywords:")
                for kw in keywords_to_check:
                    cnt = text.count(kw)
                    if cnt > 0:
                        print(f"- '{kw}': {cnt} matches")

if __name__ == '__main__':
    asyncio.run(run_test_domain())
