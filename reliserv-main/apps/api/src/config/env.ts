import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || process.env.dotenv_config_path });

export const env = {
  PORT: Number(process.env.PORT || 4000),
  WEB_ORIGIN: process.env.WEB_ORIGIN || "http://localhost:5173",
  DATABASE_URL: process.env.DATABASE_URL || "",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  JWT_SECRET: process.env.JWT_SECRET || "dev_secret_change_me"
};
