import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8080),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5-mini",
  cacheTtlMinutes: Number(process.env.CACHE_TTL_MINUTES || 360),
  allowedOrigins: process.env.ALLOWED_ORIGINS || "*",
  refreshCron: process.env.REFRESH_CRON || "0 */6 * * *"
};
