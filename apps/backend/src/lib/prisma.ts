import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Ensure environment variables are loaded if not already in process.env
if (!process.env.DATABASE_URL) {
  const backendEnv = path.resolve(process.cwd(), "apps/backend/.env");
  const rootEnv = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(backendEnv)) {
    dotenv.config({ path: backendEnv });
  } else if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
  } else {
    dotenv.config();
  }
}

// Default fallback for zero-friction local development
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});