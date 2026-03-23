# Latam Digest Data Pipeline

The project now uses a static JSON feed for the iOS app instead of a live
per-request news backend.

## What it does

- Pulls recent country-specific news from Google News RSS
- Generates app-ready JSON files under `docs/api`
- Lets the iOS app read those static files directly from GitHub
- Refreshes feeds on a GitHub Actions schedule

## Generate feeds locally

```bash
cd backend
npm install
npm run generate:static
```

Generated files are written to:

- `docs/api/countries.json`
- `docs/api/manifest.json`
- `docs/api/countries/:countryCode/top.json`
- `docs/api/countries/:countryCode/latest.json`
- `docs/api/countries/:countryCode/category/:category.json`

## Hosting model

For the cheapest MVP path, the app points at the repository's static JSON
content on GitHub:

- `https://raw.githubusercontent.com/apovolotski/LatamDigest/main/docs/api`

You can later move the same `docs/api` folder to GitHub Pages, Cloudflare Pages,
or another static host without changing the generator.

## Automation

The workflow at `.github/workflows/refresh-static-feeds.yml` refreshes feeds:

- on demand via `workflow_dispatch`
- every 6 hours on a schedule

## Notes

- This approach is dramatically cheaper and simpler than live AI-powered
  news fetching on every app open.
- Google News links may open through a Google News redirect before landing on
  the publisher page.
