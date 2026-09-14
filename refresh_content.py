#!/usr/bin/env python3
"""Refresh data.js timeline/education sections from linkedin.json.

Manual, repeatable content refresh (~10 minutes, quarterly or after a role
change). No network access, no secrets, no automation: edit linkedin.json by
hand from the LinkedIn profile, then run:

    python3 refresh_content.py

This rewrites only the blocks delimited by <linkedin:...> markers in data.js
and bumps lastUpdated. Everything else in data.js is left untouched.
"""
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LINKEDIN = ROOT / "linkedin.json"
DATA_JS = ROOT / "data.js"


def js_block(key, items):
    """Render a `  "key": [...]` block in data.js style (2-space indent)."""
    body = json.dumps(items, indent=2, ensure_ascii=False)
    inner = "\n".join("  " + line if line.strip() else line
                      for line in body.splitlines()[1:])
    return f'  "{key}": [\n{inner}'


def replace_block(text, name, block, trailing_comma=True):
    start = f"// <linkedin:{name}>"
    end = f"// </linkedin:{name}>"
    pattern = re.compile(
        re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
    if not pattern.search(text):
        raise SystemExit(f"marker block <linkedin:{name}> not found in data.js")
    comma = "," if trailing_comma else ""
    return pattern.sub(f"{start}\n{block}{comma}\n  {end}", text)


def main():
    profile = json.loads(LINKEDIN.read_text(encoding="utf-8"))
    text = DATA_JS.read_text(encoding="utf-8")

    text = replace_block(text, "timeline",
                         js_block("timeline", profile["experience"]))
    text = replace_block(text, "education",
                         js_block("education", profile["education"]),
                         trailing_comma=False)

    today = date.today().isoformat()
    text = re.sub(r'"lastUpdated": "\d{4}-\d{2}-\d{2}"',
                  f'"lastUpdated": "{today}"', text, count=1)
    text = re.sub(r"// Content data - Last updated: \d{4}-\d{2}-\d{2}",
                  f"// Content data - Last updated: {today}", text, count=1)

    DATA_JS.write_text(text, encoding="utf-8")
    print(f"data.js refreshed from linkedin.json (lastUpdated={today})")


if __name__ == "__main__":
    main()
