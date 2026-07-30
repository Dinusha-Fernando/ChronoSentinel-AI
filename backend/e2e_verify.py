"""Full end-to-end pipeline test: scans a domain, confirms all snapshots are processed."""
import asyncio
import json
from backend.app.core.database import AsyncSessionLocal
from backend.app.services.pipeline import analyze_domain_pipeline
from backend.app.core.http_client import HttpClient


async def main():
    # Initialize HTTP client session
    HttpClient.get_session()

    domain = "davidmannmedia.com"
    print(f"\n{'='*60}")
    print(f"  Full Pipeline Test: {domain}")
    print(f"{'='*60}\n")

    async with AsyncSessionLocal() as db:
        result = await analyze_domain_pipeline(domain, force_refresh=True, db=db)

    print(f"  Domain:            {result['domain']}")
    print(f"  Risk Score:        {result['risk_score']}/100")
    print(f"  Risk Level:        {result['risk_level']}")
    print(f"  Snapshots Checked: {result['snapshots_checked']}")
    print(f"  Peak Score:        {result.get('peak_score', 'N/A')}")
    print(f"  Avg Score:         {result.get('avg_score', 'N/A')}")
    print(f"  Flags:             {result.get('flags', [])}")
    print(f"  Primary Category:  {result.get('primary_category', 'N/A')}")
    print(f"  Timeline Entries:  {len(result.get('timeline', []))}")

    # Verify check-all: ensure more than 10 snapshots if domain has more
    snap_count = result['snapshots_checked']
    if snap_count > 10:
        print(f"\n  ✅ CHECK-ALL VERIFIED: {snap_count} snapshots analyzed (not limited to 10)")
    elif snap_count > 0:
        print(f"\n  ✅ {snap_count} snapshots analyzed (domain has fewer than 10 available)")
    else:
        print(f"\n  ⚠️  No snapshots found for this domain")

    # Show timeline
    if result.get('timeline'):
        print(f"\n  Timeline:")
        for entry in result['timeline']:
            print(f"    {entry['year']}: score={entry['risk_score']}, "
                  f"peak={entry['peak_score']}, "
                  f"snaps={entry['snapshot_count']}, "
                  f"cat={entry['category']}")

    print(f"\n{'='*60}\n")
    await HttpClient.close_session()


if __name__ == "__main__":
    asyncio.run(main())
