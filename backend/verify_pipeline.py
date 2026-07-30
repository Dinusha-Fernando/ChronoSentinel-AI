import asyncio
from backend.app.core.database import AsyncSessionLocal, engine
from backend.app.services.pipeline import analyze_domain_pipeline

TEST_CASES = [
    # (domain, expected_level, description)
    ("redhat-gitops-patterns.io",       "HIGH|MEDIUM",  "Gambling/casino content (known bad)"),
    ("geld-lenen-zonder-bkr-toetsing.nl", "ANY",        "Dutch loan site"),
    ("shopsocielle.com",               "ANY",           "Shopify store"),
    ("google.com",                     "SAFE",          "Known clean domain"),
    ("wikipedia.org",                  "SAFE|MEDIUM",   "Known clean domain (contains historic flags on some snapshots)"),
]

async def verify():
    from backend.app.core.http_client import http_client
    try:
        async with AsyncSessionLocal() as db:
            for domain, expected, desc in TEST_CASES:
                print(f"\n{'='*60}")
                print(f"Domain   : {domain}")
                print(f"Expected : {expected}")
                print(f"About    : {desc}")
                try:
                    result = await analyze_domain_pipeline(
                        domain=domain,
                        force_refresh=True,
                        db=db
                    )
                    level  = result.get("risk_level")
                    score  = result.get("risk_score")
                    peak   = result.get("peak_score")
                    avg    = result.get("avg_score")
                    flags  = result.get("flags")
                    snaps  = result.get("snapshots_checked")
                    history = result.get("history_summary", [])

                    print(f"Result   : Level={level}  Final={score}  Peak={peak}  Avg={avg}")
                    print(f"Snapshots: {snaps} checked")
                    print(f"Flags    : {flags}")
                    print(f"History  :")
                    for h in history:
                        filled = '#' * (h['risk_score'] // 10)
                        empty  = '.' * (10 - h['risk_score'] // 10)
                        bar = f"[{filled}{empty}]"
                        cats = ", ".join(h['categories']) if h['categories'] else "clean"
                        print(f"  {h['year']}  {bar} {h['risk_score']:3d}  {cats}")

                    if expected != "ANY":
                        expected_levels = expected.split("|")
                        is_pass = False
                        if level in expected_levels:
                            is_pass = True
                        elif level == "UNSAFE" and ("HIGH" in expected_levels or "MEDIUM" in expected_levels):
                            is_pass = True
                        
                        if is_pass:
                            print(f"PASS")
                        else:
                            print(f"FAIL -- expected {expected}, got {level}")
                except Exception as e:
                    print(f"EXCEPTION: {e}")

        await engine.dispose()
    finally:
        await http_client.close_session()

if __name__ == '__main__':
    asyncio.run(verify())
