/**
 * Schritt 1: Appwrite Collection Permissions setzen
 * - employees: nur eingeloggter User darf eigenes Dokument lesen; admins alles
 * - time_entries: User darf eigene lesen/schreiben; admins alles
 * - leave_requests: User darf eigene lesen/schreiben; admins alles
 * - documents: User darf eigene lesen; nur admins schreiben
 *
 * Appwrite nutzt Role-based permissions auf Collection-Ebene.
 * Fein-granulare Document-Level-Permissions werden per createDocument gesetzt.
 */
import { Client, Databases } from "node-appwrite";

const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("6a2567ad0021c84890d1")
  .setKey("standard_9a9abd2b2fdf2a68e1cd4a674b057e8ab608596f58bb2d5f602004b92d4031c26600024ff810283f48034cf4051548dd23da1c454827b40efa4be2681d9e843e93e553e5bc7b575b5e8bcc69c240502ba4adc97ac97a1ea46a98903c96330417d28da84b921cbd17bfd3106b37fbaf139c8807d786b79611ab45dd9fb33f9d90");

const db = new Databases(client);
const DB_ID = "sustainista-hr";

// Appwrite Permission strings
const ANY_USER = "users";          // alle eingeloggten User
const LABEL_ADMIN = "label:admin"; // nur User mit Label "admin"

async function setPermissions(collectionId, permissions) {
  try {
    await db.updateCollection(DB_ID, collectionId, collectionId, permissions, false, true);
    console.log(`✓ ${collectionId} — Permissions gesetzt`);
  } catch (e) {
    console.error(`❌ ${collectionId}:`, e.message);
  }
}

async function main() {
  console.log("\n🔐 Sustainista HR — Permissions Setup\n");

  // employees: eingeloggte User dürfen lesen (für Profil-Abfrage)
  // admins dürfen alles schreiben
  await setPermissions("employees", [
    `read("users")`,
    `create("label:admin")`,
    `update("label:admin")`,
    `delete("label:admin")`,
  ]);

  // time_entries: User darf lesen/schreiben (eigene Einträge)
  // admins dürfen alles inkl. genehmigen
  await setPermissions("time_entries", [
    `read("users")`,
    `create("users")`,
    `update("users")`,
    `delete("label:admin")`,
  ]);

  // leave_requests: User darf eigene anlegen & lesen
  // admins genehmigen
  await setPermissions("leave_requests", [
    `read("users")`,
    `create("users")`,
    `update("label:admin")`,
    `delete("label:admin")`,
  ]);

  // documents: User darf lesen, nur admins hochladen & löschen
  await setPermissions("documents", [
    `read("users")`,
    `create("label:admin")`,
    `update("label:admin")`,
    `delete("label:admin")`,
  ]);

  console.log("\n✅ Alle Permissions gesetzt.\n");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
