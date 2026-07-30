"""E2E test: hit the API endpoint and verify check-all."""
import urllib.request
import json
import sys

domain = sys.argv[1] if len(sys.argv) > 1 else "davidmannmedia.com"

body = json.dumps({"domain": domain, "force_refresh": True}).encode()
req = urllib.request.Request(
    "http://localhost:8000/api/v1/domains/analyze",
    data=body,
    headers={"Content-Type": "application/json"},
)

print(f"Scanning {domain} via API (force_refresh=True)...")
resp = urllib.request.urlopen(req, timeout=180)
data = json.loads(resp.read())

d = data["domain"]
rs = data["risk_score"]
rl = data["risk_level"]
sc = data["snapshots_checked"]
fl = data.get("flags", [])
ps = data.get("peak_score", "N/A")
tl = len(data.get("timeline", []))

print(f"Domain:            {d}")
print(f"Risk Score:        {rs}/100")
print(f"Risk Level:        {rl}")
print(f"Snapshots Checked: {sc}")
print(f"Peak Score:        {ps}")
print(f"Flags:             {fl}")
print(f"Timeline Years:    {tl}")

if sc > 10:
    print(f"\nCHECK-ALL VERIFIED: {sc} snapshots analyzed (not capped at 10)")
elif sc > 0:
    print(f"\n{sc} snapshots analyzed (domain has <= 10 available)")
else:
    print(f"\nNo snapshots found")
