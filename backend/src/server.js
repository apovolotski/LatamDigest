import cors from "cors";
import cron from "node-cron";
import express from "express";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { toArticles } from "./articleMapper.js";
import { countries, isSupportedCountry } from "./countries.js";
import { getDigest, getCachedDigest } from "./digestStore.js";

export function createApp({ readDigest = getCachedDigest } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.allowedOrigins === "*" ? true : config.allowedOrigins.split(",").map(value => value.trim()) }));
  app.use((_req, res, next) => { res.set("X-Content-Type-Options", "nosniff"); next(); });
  app.get("/health", (_req, res) => res.json({ ok: true, service: "latam-digest-backend" }));
  app.get("/countries", (_req, res) => res.json(countries));
  const serveDigest = articles => (req, res) => {
    const code = req.params.countryCode.toUpperCase();
    if (!isSupportedCountry(code)) return res.status(404).json({ error: "Unsupported country." });
    if (req.query.refresh !== undefined) return res.status(403).json({ error: "Refresh is performed by the scheduled worker only." });
    const digest = readDigest(code);
    if (!digest) return res.status(503).json({ error: "News is temporarily unavailable. Please try again later." });
    res.set("Cache-Control", "public, max-age=300");
    res.json(articles ? toArticles(digest, req.params.category) : digest);
  };
  app.get("/digests/:countryCode", serveDigest(false));
  app.get("/countries/:countryCode/top", serveDigest(true));
  app.get("/countries/:countryCode/latest", serveDigest(true));
  app.get("/countries/:countryCode/category/:category", serveDigest(true));
  app.use((_error, _req, res, _next) => res.status(500).json({ error: "News is temporarily unavailable. Please try again later." }));
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (config.openaiApiKey) {
    if (!cron.validate(config.refreshCron)) throw new Error("Invalid REFRESH_CRON configuration.");
    cron.schedule(config.refreshCron, async () => {
      for (const country of countries) {
        try { await getDigest(country.id); }
        catch { console.error(`Failed to refresh ${country.id}`); }
      }
    });
  }
  createApp().listen(config.port, () => console.log(`Latam Digest backend listening on port ${config.port}`));
}
