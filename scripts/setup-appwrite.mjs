import { Client, Databases, Storage, ID } from "node-appwrite";

const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("6a2567ad0021c84890d1")
  .setKey("standard_9a9abd2b2fdf2a68e1cd4a674b057e8ab608596f58bb2d5f602004b92d4031c26600024ff810283f48034cf4051548dd23da1c454827b40efa4be2681d9e843e93e553e5bc7b575b5e8bcc69c240502ba4adc97ac97a1ea46a98903c96330417d28da84b921cbd17bfd3106b37fbaf139c8807d786b79611ab45dd9fb33f9d90");

const db = new Databases(client);
const storage = new Storage(client);
const DB_ID = "sustainista-hr";

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function createAttr(fn, label) {
  try { await fn(); console.log("  ✓", label); }
  catch (e) { if (e.code === 409) console.log("  – already exists:", label); else throw e; }
  await wait(300);
}

async function main() {
  console.log("\n🌿 Sustainista HR — Appwrite Setup\n");

  // 1. Database
  try {
    await db.create(DB_ID, "Sustainista HR");
    console.log("✓ Datenbank erstellt");
  } catch (e) {
    console.log("– Datenbank übersprungen:", e.message);
  }
  await wait(500);

  // 2. employees
  console.log("\n📋 Collection: employees");
  try {
    await db.createCollection(DB_ID, "employees", "employees");
    console.log("  ✓ Collection erstellt");
  } catch (e) { if (e.code === 409) console.log("  – existiert bereits"); else throw e; }
  await wait(500);

  await createAttr(() => db.createStringAttribute(DB_ID, "employees", "userId", 36, true), "userId");
  await createAttr(() => db.createStringAttribute(DB_ID, "employees", "firstName", 100, true), "firstName");
  await createAttr(() => db.createStringAttribute(DB_ID, "employees", "lastName", 100, true), "lastName");
  await createAttr(() => db.createEmailAttribute(DB_ID, "employees", "email", true), "email");
  await createAttr(() => db.createEnumAttribute(DB_ID, "employees", "role", ["admin", "employee"], true), "role");
  await createAttr(() => db.createStringAttribute(DB_ID, "employees", "department", 100, true), "department");
  await createAttr(() => db.createStringAttribute(DB_ID, "employees", "position", 100, true), "position");
  await createAttr(() => db.createStringAttribute(DB_ID, "employees", "startDate", 10, true), "startDate");
  await createAttr(() => db.createIntegerAttribute(DB_ID, "employees", "vacationDaysTotal", true, 0, 365), "vacationDaysTotal");
  await createAttr(() => db.createIntegerAttribute(DB_ID, "employees", "vacationDaysUsed", true, 0, 365), "vacationDaysUsed");
  await createAttr(() => db.createStringAttribute(DB_ID, "employees", "bankAccount", 50, false), "bankAccount");
  await createAttr(() => db.createStringAttribute(DB_ID, "employees", "phone", 30, false), "phone");
  await createAttr(() => db.createStringAttribute(DB_ID, "employees", "address", 200, false), "address");
  await wait(1000);
  try { await db.createIndex(DB_ID, "employees", "userId_idx", "key", ["userId"]); console.log("  ✓ Index userId"); } catch {}

  // 3. time_entries
  console.log("\n⏱  Collection: time_entries");
  try {
    await db.createCollection(DB_ID, "time_entries", "time_entries");
    console.log("  ✓ Collection erstellt");
  } catch (e) { if (e.code === 409) console.log("  – existiert bereits"); else throw e; }
  await wait(500);

  await createAttr(() => db.createStringAttribute(DB_ID, "time_entries", "employeeId", 36, true), "employeeId");
  await createAttr(() => db.createStringAttribute(DB_ID, "time_entries", "date", 10, true), "date");
  await createAttr(() => db.createStringAttribute(DB_ID, "time_entries", "startTime", 5, true), "startTime");
  await createAttr(() => db.createStringAttribute(DB_ID, "time_entries", "endTime", 5, false), "endTime");
  await createAttr(() => db.createIntegerAttribute(DB_ID, "time_entries", "breakMinutes", true, 0, 480), "breakMinutes");
  await createAttr(() => db.createStringAttribute(DB_ID, "time_entries", "note", 500, false), "note");
  await createAttr(() => db.createEnumAttribute(DB_ID, "time_entries", "status", ["running", "completed", "approved", "rejected"], true), "status");
  await createAttr(() => db.createStringAttribute(DB_ID, "time_entries", "approvedBy", 36, false), "approvedBy");
  await wait(1000);
  try { await db.createIndex(DB_ID, "time_entries", "emp_date_idx", "key", ["employeeId", "date"]); console.log("  ✓ Index employeeId+date"); } catch {}
  try { await db.createIndex(DB_ID, "time_entries", "status_idx", "key", ["status"]); console.log("  ✓ Index status"); } catch {}

  // 4. leave_requests
  console.log("\n🏖  Collection: leave_requests");
  try {
    await db.createCollection(DB_ID, "leave_requests", "leave_requests");
    console.log("  ✓ Collection erstellt");
  } catch (e) { if (e.code === 409) console.log("  – existiert bereits"); else throw e; }
  await wait(500);

  await createAttr(() => db.createStringAttribute(DB_ID, "leave_requests", "employeeId", 36, true), "employeeId");
  await createAttr(() => db.createStringAttribute(DB_ID, "leave_requests", "employeeName", 150, true), "employeeName");
  await createAttr(() => db.createEnumAttribute(DB_ID, "leave_requests", "type", ["vacation", "sick", "unpaid", "special"], true), "type");
  await createAttr(() => db.createStringAttribute(DB_ID, "leave_requests", "startDate", 10, true), "startDate");
  await createAttr(() => db.createStringAttribute(DB_ID, "leave_requests", "endDate", 10, true), "endDate");
  await createAttr(() => db.createIntegerAttribute(DB_ID, "leave_requests", "days", true, 0, 365), "days");
  await createAttr(() => db.createStringAttribute(DB_ID, "leave_requests", "reason", 500, false), "reason");
  await createAttr(() => db.createEnumAttribute(DB_ID, "leave_requests", "status", ["pending", "approved", "rejected"], true), "status");
  await createAttr(() => db.createStringAttribute(DB_ID, "leave_requests", "approvedBy", 36, false), "approvedBy");
  await createAttr(() => db.createStringAttribute(DB_ID, "leave_requests", "approvedAt", 30, false), "approvedAt");
  await wait(1000);
  try { await db.createIndex(DB_ID, "leave_requests", "emp_status_idx", "key", ["employeeId", "status"]); console.log("  ✓ Index employeeId+status"); } catch {}
  try { await db.createIndex(DB_ID, "leave_requests", "startDate_idx", "key", ["startDate"]); console.log("  ✓ Index startDate"); } catch {}

  // 5. documents
  console.log("\n📄 Collection: documents");
  try {
    await db.createCollection(DB_ID, "documents", "documents");
    console.log("  ✓ Collection erstellt");
  } catch (e) { if (e.code === 409) console.log("  – existiert bereits"); else throw e; }
  await wait(500);

  await createAttr(() => db.createStringAttribute(DB_ID, "documents", "employeeId", 36, true), "employeeId");
  await createAttr(() => db.createEnumAttribute(DB_ID, "documents", "type", ["payslip", "contract", "other"], true), "type");
  await createAttr(() => db.createStringAttribute(DB_ID, "documents", "title", 200, true), "title");
  await createAttr(() => db.createStringAttribute(DB_ID, "documents", "fileId", 36, true), "fileId");
  await createAttr(() => db.createStringAttribute(DB_ID, "documents", "month", 7, false), "month");
  await createAttr(() => db.createStringAttribute(DB_ID, "documents", "uploadedBy", 36, true), "uploadedBy");
  await wait(1000);
  try { await db.createIndex(DB_ID, "documents", "emp_idx", "key", ["employeeId"]); console.log("  ✓ Index employeeId"); } catch {}

  // 6. Storage Bucket
  console.log("\n🗄  Storage Bucket: documents");
  try {
    await storage.createBucket("documents", "documents", [], false, true, 10485760, ["application/pdf", "image/jpeg", "image/png"]);
    console.log("  ✓ Bucket erstellt (max 10 MB, PDF + Bilder)");
  } catch (e) { if (e.code === 409) console.log("  – existiert bereits"); else throw e; }

  console.log("\n✅ Setup abgeschlossen! Alle Collections und Indexes sind bereit.\n");
}

main().catch(e => { console.error("❌ Fehler:", e.message); process.exit(1); });
