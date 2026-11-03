#!/usr/bin/env python3
"""فحص كل روابط المكتبة.  الاستعمال:
  python3 tools/check_links.py            يطبع تقريرًا ويحفظه في tools/link-report.csv
  python3 tools/check_links.py --update   يحدّث أيضًا حقل checked للروابط السليمة إلى تاريخ اليوم
بعض المواقع (منها مواقع الأمم المتحدة) ترفض الطلبات الآلية أحيانًا: افتح الروابط المعلَّمة يدويًا قبل حذفها."""
import csv, datetime, json, os, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
UPDATE = "--update" in sys.argv
TODAY = datetime.date.today().isoformat()
FILES = ["resources", "documents", "reports"]
data = {n: json.load(open(os.path.join(ROOT, n + ".json"), encoding="utf-8")) for n in FILES}
jobs = []
for n, items in data.items():
    for it in items:
        for field in ("url", "pdf"):
            if it.get(field): jobs.append((n, it, field, it[field]))
        for l in it.get("links", []) or []:
            jobs.append((n, it, "links", l[1]))
urls = sorted({j[3] for j in jobs})

def probe(u):
    hdr = {"User-Agent": "Mozilla/5.0 (YoungResearchersLibrary link checker)"}
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(u, method=method, headers=hdr)
            with urllib.request.urlopen(req, timeout=25) as r:
                return u, r.status, ""
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 400, 501): continue
            return u, e.code, str(e.reason)
        except Exception as e:
            if method == "HEAD": continue
            return u, 0, str(e)[:120]
    return u, 0, "no response"

print(f"فحص {len(urls)} رابطًا…")
with ThreadPoolExecutor(8) as ex: results = dict((u, (s, m)) for u, s, m in ex.map(probe, urls))
bad = {u: v for u, v in results.items() if not (200 <= v[0] < 400)}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "link-report.csv")
with open(out, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["file", "id", "field", "url", "status", "message"])
    for n, it, field, u in jobs:
        s, m = results[u]; w.writerow([n, it.get("id"), field, u, s, m])
for u, (s, m) in sorted(bad.items()): print(f"  {s or 'ERR'}  {u}  {m}")
print(f"سليم: {len(urls) - len(bad)} · يحتاج مراجعة: {len(bad)} · التقرير: {out}")
if UPDATE:
    for n, items in data.items():
        for it in items:
            if it.get("url") and it["url"] not in bad: it["checked"] = TODAY
        json.dump(items, open(os.path.join(ROOT, n + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("حُدّث تاريخ التحقق للروابط السليمة.")
