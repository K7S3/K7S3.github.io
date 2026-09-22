#!/usr/bin/env python3
"""Refresh the projects section of data.js from the public GitHub API.

This is the ONLY automated data refresh for the site, and the only part that
touches the network. It fetches K7S3's public repos (no auth needed) and
rewrites just the block delimited by <github:projects> markers in data.js.

Everything else (timeline, education, publications) is curated by hand:
see linkedin.json + refresh_content.py.

Usage:  python3 update_data.py
"""
import json
import re
from datetime import date
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
DATA_JS = ROOT / "data.js"

USERNAME = "K7S3"
# Priority repos first (in this order), then the most recently updated others.
PRIORITY_REPOS = [
    "synergii", "3dmol.js", "endless-runner", "k7-shell",
    "fighter-jet", "gpcr_ml_residue_importance",
]
MAX_OTHER = 10


def fetch_github_data():
    """Fetch public repository data from the GitHub API (unauthenticated)."""
    resp = requests.get(
        f"https://api.github.com/users/{USERNAME}/repos",
        params={"sort": "updated", "per_page": 50},
        timeout=30,
    )
    resp.raise_for_status()
    repos = resp.json()

    projects, others = [], []
    for repo in repos:
        if repo.get("fork"):
            continue
        project = {
            "name": repo["name"],
            "description": repo["description"] or "No description available",
            "url": repo["html_url"],
            # The synergii.org domain is discontinued: never surface it as a
            # project homepage link. The GitHub repo URL above stays.
            "homepage": (None if (repo["homepage"] or "").lower().find("synergii.org") != -1
                         else repo["homepage']),
            "language": repo["language"],
            "stars": repo["stargazers_count"],
            "forks": repo["forks_count"],
            "updated_at": repo["updated_at"],
        }
        if repo["name"].lower() in PRIORITY_REPOS:
            projects.append(project)
        else:
            others.append(project)

    by_name = {p["name"].lower(): p for p in projects}
    ordered = [by_name[n] for n in PRIORITY_REPOS if n in by_name]
    return ordered + others[:MAX_OTHER]


def js_block(items):
    body = json.dumps(items, indent=2, ensure_ascii=False)
    inner = "\n".join("  " + line if line.strip() else line
                      for line in body.splitlines()[1:])
    return f'  "projects": [\n{inner}'


def main():
    projects = fetch_github_data()
    text = DATA_JS.read_text(encoding="utf-8")

    start, end = "// <github:projects>", "// </github:projects>"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
    if not pattern.search(text):
        raise SystemExit("marker block <github:projects> not found in data.js")
    text = pattern.sub(f"{start}\n{js_block(projects)},\n  {end}", text)

    today = date.today().isoformat()
    text = re.sub(r'"lastUpdated": "\d{4}-\d{2}-\d{2}"',
                  f'"lastUpdated": "{today}"', text, count=1)
    text = re.sub(r"// Content data - Last updated: \d{4}-\d{2}-\d{2}",
                  f"// Content data - Last updated: {today}", text, count=1)

    DATA_JS.write_text(text, encoding="utf-8")
    print(f"projects refreshed from GitHub API: {len(projects)} repos "
          f"(lastUpdated={today})")


if __name__ == "__main__":
    main()
