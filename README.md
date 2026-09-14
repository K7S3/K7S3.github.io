# Keshavan Seshadri — Personal Website

Static personal portfolio site for Keshavan Seshadri, live at
[https://k7s3.github.io](https://k7s3.github.io). Plain HTML/CSS/JS —
**no build step, no frameworks**. Deployed to GitHub Pages on every push to
`main` via `.github/workflows/deploy.yml`.

## Structure

```
├── index.html          # The whole site (single page: hero, about, timeline,
│                       #   education, entrepreneurship, publications, projects,
│                       #   speaking, life-in-pictures, contact)
├── styles.css          # All styling
├── script.js           # Interactivity (nav, scroll effects, matrix canvas,
│                       #   stat counters, section rendering)
├── data.js             # Content data: projects, publications, timeline,
│                       #   education (lastUpdated: 2026-09-14)
├── linkedin.json        # Source of truth for timeline/education (curated by
│                       #   hand from LinkedIn; see "Keeping content fresh")
├── refresh_content.py   # Regenerates data.js timeline/education from
│                       #   linkedin.json (manual, no network)
├── update_data.py      # Helper that refreshes data.js (GitHub repos are the
│                       #   only part fetched live; the rest is curated manually)
├── images/             # Publication figures
├── profile-photo.jpg / panel-photo-{1,2,3}.jpg
├── resume.pdf          # Downloadable resume
├── favicon.svg / favicon.png
└── PHOTO_GUIDE.md      # Photo placement guide
```

## How to update content

1. **Timeline / publications / education** — edit the literals in `data.js`
   directly (newest-first for the timeline), then commit.
2. **Hero / about / skills** — edit `index.html` directly.
3. **Projects** — the site renders the first 6 repos from `data.js`; refresh
   them with `python3 update_data.py` (needs `requests` from
   `requirements.txt`) or let the `update-data.yml` workflow do it.
4. **Images** — keep photos small: profile ≤ 200 KB, others ≤ 400 KB
   (e.g. `PIL`: open, `thumbnail`, save as optimized progressive JPEG).

## Keeping content fresh

**LinkedIn refresh (~10 minutes, quarterly or after a role change):**

1. Open your LinkedIn profile and copy any changed facts (role, dates,
   location, about text, new publications).
2. Edit `linkedin.json` by hand to match — it's the source of truth for the
   timeline and education sections.
3. Run `python3 refresh_content.py` — it rewrites only the
   `<linkedin:timeline>` and `<linkedin:education>` blocks in `data.js` and
   bumps `lastUpdated`. Nothing else is touched, and nothing is fetched over
   the network.
4. If the hero/about copy in `index.html` also needs the new role, edit it
   directly (it's hand-written prose, not generated).
5. Commit and push; GitHub Pages redeploys automatically.

There is intentionally **no automation** for this: LinkedIn has no public API
for profile data, so a scripted sync would just be hardcoded guesses. The only
scheduled job (`update-data.yml`, weekly) refreshes the GitHub projects list
from the public GitHub API.

## Notes

- The contact form uses `mailto:` — it opens the visitor's mail client. It
  intentionally shows no fake "sent" confirmation.
- The Instagram section is 4 static thumbnails linking out (no embed payload).
- The binary-matrix background is disabled on small screens and for users
  with `prefers-reduced-motion`.
- **Never commit secrets to this repo.** There is no client-side API key
  anywhere in the site; the old chatbot that needed one has been removed.

## Contact

- Email: keshavanseshadri@gmail.com
- LinkedIn: [keshavan-seshadri](https://www.linkedin.com/in/keshavan-seshadri/)
- GitHub: [K7S3](https://github.com/K7S3)
