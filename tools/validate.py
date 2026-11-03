#!/usr/bin/env python3
"""فحص ملفات البيانات قبل النشر.  الاستعمال:  python3 tools/validate.py
يتحقق من: الحقول الإلزامية، تفرّد المعرّفات، صيغة التواريخ، الروابط، والإحالات بين الملفات."""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
def load(n): return json.load(open(os.path.join(ROOT, n + ".json"), encoding="utf-8"))
meta, res, docs, rights, reps, tn = (load(n) for n in ["meta", "resources", "documents", "rights", "reports", "tunisia"])
errors, warns = [], []
DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")
ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
sections = {s["id"]: s for s in meta["sections"]}
types = set(meta["doc_types"])
topics = {t["id"] for t in meta["topics"]}
right_ids = {r["id"] for r in rights}
seen = {}

def chk_id(i, where):
    if not ID.match(i or ""): errors.append(f"{where}: معرّف غير صالح «{i}» (حروف لاتينية صغيرة وأرقام وشرطات فقط)")
    if i in seen: errors.append(f"{where}: المعرّف «{i}» مكرر (موجود أيضًا في {seen[i]})")
    seen[i] = where
def chk_url(u, where, required=True):
    if not u:
        if required: errors.append(f"{where}: رابط مفقود")
        return
    if not re.match(r"^https?://", u): errors.append(f"{where}: رابط غير صالح «{u}»")
def chk_date(d, where):
    if d and not DATE.match(str(d)): errors.append(f"{where}: تاريخ بصيغة غير صحيحة «{d}» (المطلوب YYYY أو YYYY-MM أو YYYY-MM-DD)")
def chk_sections(lst, where):
    for s in lst:
        if s[0] not in sections: errors.append(f"{where}: قسم غير معروف «{s[0]}»")
        elif sections[s[0]].get("groups") and s[1] not in sections[s[0]]["groups"]:
            errors.append(f"{where}: مجموعة «{s[1]}» غير موجودة في قسم «{s[0]}»")

for r in res:
    w = "resources/" + r.get("id", "?")
    chk_id(r.get("id"), w)
    for f in ["title", "url", "summary", "section", "group", "checked"]:
        if not r.get(f): errors.append(f"{w}: الحقل «{f}» فارغ")
    chk_url(r.get("url"), w); chk_date(r.get("checked"), w)
    chk_sections([[r["section"], r["group"]]] + r.get("also", []), w)
for d in docs:
    w = "documents/" + d.get("id", "?")
    chk_id(d.get("id"), w)
    for f in ["title", "type", "publisher", "checked"]:
        if not d.get(f): errors.append(f"{w}: الحقل «{f}» فارغ")
    if d.get("type") not in types: errors.append(f"{w}: نوع غير معروف «{d.get('type')}»")
    chk_url(d.get("url"), w, required=False)
    if not d.get("url"): warns.append(f"{w}: لا يوجد رابط بعد")
    chk_date(d.get("date"), w); chk_date(d.get("checked"), w)
    chk_sections(d.get("sections", []), w)
    for x in d.get("rights", []):
        if x not in right_ids: errors.append(f"{w}: حق غير معروف «{x}»")
for r in reps:
    w = "reports/" + r.get("id", "?")
    chk_id(r.get("id"), w)
    for f in ["title", "title_orig", "publisher", "date", "year", "type", "summary", "lang_orig", "langs", "url", "topics", "checked"]:
        if not r.get(f): errors.append(f"{w}: الحقل «{f}» فارغ")
    if r.get("publisher") not in meta["publishers"]: errors.append(f"{w}: جهة ناشرة غير معرّفة في meta.json «{r.get('publisher')}»")
    if str(r.get("year")) != str(r.get("date", ""))[:4]: errors.append(f"{w}: السنة لا تطابق التاريخ")
    for t in r.get("topics", []):
        if t not in topics: errors.append(f"{w}: موضوع غير معروف «{t}»")
    chk_url(r.get("url"), w); chk_url(r.get("pdf"), w, required=False); chk_date(r.get("date"), w)
all_ids = set(seen)
for r in rights:
    w = "rights/" + r["id"]
    for x in r["interp"] + r["soft"] + r["regional"] + [l["doc"] for l in r["legal"] if l.get("doc")]:
        if x not in all_ids: errors.append(f"{w}: إحالة إلى وثيقة غير موجودة «{x}»")
    for x in r.get("related", []):
        if x not in right_ids: errors.append(f"{w}: حق مرتبط غير موجود «{x}»")
for x in tn.get("co", []):
    if x not in all_ids: errors.append(f"tunisia: إحالة إلى وثيقة غير موجودة «{x}»")

print(f"موارد: {len(res)} · وثائق: {len(docs)} · تقارير: {len(reps)} · حقوق: {len(rights)}")
for w in warns: print("تنبيه:", w)
if errors:
    for e in errors: print("خطأ:", e)
    print(f"\n{len(errors)} خطأ. صحّحها قبل النشر."); sys.exit(1)
print("لا أخطاء. البيانات جاهزة للنشر.")
