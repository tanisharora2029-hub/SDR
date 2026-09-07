import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend or root .env if present
const backendEnv = path.resolve(__dirname, "../.env");
const rootEnv = path.resolve(__dirname, "../../../.env");

if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

if (!fs.existsSync(schemaPath)) {
  console.error(`[Prisma Prep] schema.prisma not found at: ${schemaPath}`);
  process.exit(1);
}

const dbUrl = (process.env.DATABASE_URL || "").trim();
const isPostgres =
  dbUrl.startsWith("postgres://") ||
  dbUrl.startsWith("postgresql://") ||
  process.env.DB_PROVIDER === "postgresql";

const targetProvider = isPostgres ? "postgresql" : "sqlite";

let schemaContent = fs.readFileSync(schemaPath, "utf8");

const currentMatch = schemaContent.match(/provider\s*=\s*"(sqlite|postgresql)"/);
const currentProvider = currentMatch ? currentMatch[1] : null;

if (currentProvider !== targetProvider) {
  schemaContent = schemaContent.replace(
    /provider\s*=\s*"(sqlite|postgresql)"/,
    `provider = "${targetProvider}"`
  );
  fs.writeFileSync(schemaPath, schemaContent, "utf8");
  console.log(
    `[Prisma Prep] Switched datasource provider from "${currentProvider}" to "${targetProvider}" for DATABASE_URL: ${
      isPostgres ? "postgresql://***" : dbUrl || "file:./dev.db"
    }`
  );
} else {
  console.log(`[Prisma Prep] Datasource provider is already "${targetProvider}".`);
}
