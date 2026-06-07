import { Client, Databases, Permission, Role } from "node-appwrite";
import dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config({ path: ".env.local" });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "sustainista-hr";

async function safeCreate(fn, label) {
  try { await fn(); console.log(`✅ ${label}`); }
  catch (e) { console.log(`⏭  ${label} — ${e.message.slice(0, 60)}`); }
}

// ─── wins ────────────────────────────────────────────────────────────────────
await safeCreate(() => db.createCollection(DB, "wins", "wins", [
  Permission.read(Role.label("admin")),
  Permission.create(Role.users()),
  Permission.read(Role.users()),
  Permission.update(Role.users()),
]), "Collection: wins");

for (const [key, size] of [["employeeId","36"],["weekLabel","10"],["content","2000"],["impact","100"],["tags","200"]]) {
  await safeCreate(() => db.createStringAttribute(DB, "wins", key, parseInt(size), key !== "impact" && key !== "tags" && key !== "weekLabel"), `wins.${key}`);
}

// ─── check_ins ───────────────────────────────────────────────────────────────
await safeCreate(() => db.createCollection(DB, "check_ins", "check_ins", [
  Permission.read(Role.label("admin")),
  Permission.create(Role.users()),
  Permission.read(Role.users()),
  Permission.update(Role.users()),
]), "Collection: check_ins");

await safeCreate(() => db.createStringAttribute(DB, "check_ins", "employeeId", 36, true), "check_ins.employeeId");
await safeCreate(() => db.createStringAttribute(DB, "check_ins", "weekLabel", 10, true), "check_ins.weekLabel");
await safeCreate(() => db.createIntegerAttribute(DB, "check_ins", "energyLevel", true, 1, 5), "check_ins.energyLevel");
await safeCreate(() => db.createStringAttribute(DB, "check_ins", "priority", 500, true), "check_ins.priority");
await safeCreate(() => db.createStringAttribute(DB, "check_ins", "blocker", 500, false), "check_ins.blocker");
await safeCreate(() => db.createIntegerAttribute(DB, "check_ins", "satisfaction", false, 1, 5), "check_ins.satisfaction");

// ─── okrs ────────────────────────────────────────────────────────────────────
await safeCreate(() => db.createCollection(DB, "okrs", "okrs", [
  Permission.read(Role.label("admin")),
  Permission.create(Role.users()),
  Permission.read(Role.users()),
  Permission.update(Role.users()),
]), "Collection: okrs");

await safeCreate(() => db.createStringAttribute(DB, "okrs", "employeeId", 36, true), "okrs.employeeId");
await safeCreate(() => db.createStringAttribute(DB, "okrs", "quarter", 7, true), "okrs.quarter");
await safeCreate(() => db.createStringAttribute(DB, "okrs", "objective", 300, true), "okrs.objective");
await safeCreate(() => db.createStringAttribute(DB, "okrs", "keyResults", 2000, true), "okrs.keyResults");
await safeCreate(() => db.createIntegerAttribute(DB, "okrs", "progress", false, 0, 100), "okrs.progress");
await safeCreate(() => db.createStringAttribute(DB, "okrs", "status", 20, false), "okrs.status");

// ─── kaizen_items ─────────────────────────────────────────────────────────────
await safeCreate(() => db.createCollection(DB, "kaizen_items", "kaizen_items", [
  Permission.read(Role.label("admin")),
  Permission.create(Role.users()),
  Permission.read(Role.users()),
  Permission.update(Role.label("admin")),
]), "Collection: kaizen_items");

await safeCreate(() => db.createStringAttribute(DB, "kaizen_items", "employeeId", 36, true), "kaizen_items.employeeId");
await safeCreate(() => db.createStringAttribute(DB, "kaizen_items", "employeeName", 100, true), "kaizen_items.employeeName");
await safeCreate(() => db.createStringAttribute(DB, "kaizen_items", "title", 200, true), "kaizen_items.title");
await safeCreate(() => db.createStringAttribute(DB, "kaizen_items", "description", 2000, true), "kaizen_items.description");
await safeCreate(() => db.createStringAttribute(DB, "kaizen_items", "category", 50, false), "kaizen_items.category");
await safeCreate(() => db.createStringAttribute(DB, "kaizen_items", "status", 20, false), "kaizen_items.status");
await safeCreate(() => db.createStringAttribute(DB, "kaizen_items", "adminComment", 500, false), "kaizen_items.adminComment");
await safeCreate(() => db.createIntegerAttribute(DB, "kaizen_items", "upvotes", false, 0, 9999), "kaizen_items.upvotes");

// ─── performance_reviews ──────────────────────────────────────────────────────
await safeCreate(() => db.createCollection(DB, "performance_reviews", "performance_reviews", [
  Permission.read(Role.label("admin")),
  Permission.create(Role.users()),
  Permission.read(Role.users()),
  Permission.update(Role.users()),
]), "Collection: performance_reviews");

await safeCreate(() => db.createStringAttribute(DB, "performance_reviews", "employeeId", 36, true), "pr.employeeId");
await safeCreate(() => db.createStringAttribute(DB, "performance_reviews", "period", 20, true), "pr.period");
await safeCreate(() => db.createStringAttribute(DB, "performance_reviews", "selfAssessment", 3000, false), "pr.selfAssessment");
await safeCreate(() => db.createStringAttribute(DB, "performance_reviews", "managerAssessment", 3000, false), "pr.managerAssessment");
await safeCreate(() => db.createIntegerAttribute(DB, "performance_reviews", "selfScore", false, 1, 5), "pr.selfScore");
await safeCreate(() => db.createIntegerAttribute(DB, "performance_reviews", "managerScore", false, 1, 5), "pr.managerScore");
await safeCreate(() => db.createStringAttribute(DB, "performance_reviews", "strengths", 1000, false), "pr.strengths");
await safeCreate(() => db.createStringAttribute(DB, "performance_reviews", "growthAreas", 1000, false), "pr.growthAreas");
await safeCreate(() => db.createStringAttribute(DB, "performance_reviews", "status", 20, false), "pr.status");
await safeCreate(() => db.createStringAttribute(DB, "performance_reviews", "reviewedBy", 36, false), "pr.reviewedBy");

console.log("\n🎉 Performance collections ready!");
