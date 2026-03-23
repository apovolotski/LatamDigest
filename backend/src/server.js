import crypto from "node:crypto";
import cors from "cors";
import cron from "node-cron";
import express from "express";
import { config } from "./config.js";
import { toArticles } from "./articleMapper.js";
import { countries, isSupportedCountry } from "./countries.js";
import { getDigest } from "./digestStore.js";

const app = express();

app.use(express.json());
app.use(
  cors({
    origin:
      config.allowedOrigins === "*"
        ? true
        : config.allowedOrigins.split(",").map((value) => value.trim())
  })
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "latam-digest-backend",
    model: config.openaiModel
  });
});

app.get("/countries", (_req, res) => {
  res.json(countries);
});

app.get("/digests/:countryCode", async (req, res, next) => {
  try {
    const countryCode = normalizeCountryCode(req.params.countryCode);
    const refresh = req.query.refresh === "true";
    const digest = await getDigest(countryCode, { forceRefresh: refresh });
    res.json(digest);
  } catch (error) {
    next(error);
  }
});

app.get("/countries/:countryCode/top", async (req, res, next) => {
  try {
    const digest = await getDigest(normalizeCountryCode(req.params.countryCode), {
      forceRefresh: req.query.refresh === "true"
    });
    res.json(toArticles(digest));
  } catch (error) {
    next(error);
  }
});

app.get("/countries/:countryCode/latest", async (req, res, next) => {
  try {
    const digest = await getDigest(normalizeCountryCode(req.params.countryCode), {
      forceRefresh: req.query.refresh === "true"
    });
    res.json(toArticles(digest));
  } catch (error) {
    next(error);
  }
});

app.get("/countries/:countryCode/category/:category", async (req, res, next) => {
  try {
    const digest = await getDigest(normalizeCountryCode(req.params.countryCode), {
      forceRefresh: req.query.refresh === "true"
    });
    res.json(toArticles(digest, req.params.category));
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    error: error.message || "Unexpected server error"
  });
});

cron.schedule(config.refreshCron, async () => {
  console.log(`Refreshing LATAM digests on schedule ${config.refreshCron}`);

  for (const country of countries) {
    try {
      await getDigest(country.id, { forceRefresh: true });
      console.log(`Refreshed ${country.id}`);
    } catch (error) {
      console.error(`Failed to refresh ${country.id}:`, error.message);
    }
  }
});

app.listen(config.port, () => {
  console.log(`Latam Digest backend listening on port ${config.port}`);
});

function normalizeCountryCode(countryCode) {
  const normalized = (countryCode || "").toUpperCase();

  if (!isSupportedCountry(normalized)) {
    const error = new Error(`Unsupported country code: ${countryCode}`);
    error.statusCode = 404;
    throw error;
  }

  return normalized;
}
