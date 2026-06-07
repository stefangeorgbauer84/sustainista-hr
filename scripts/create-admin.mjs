import { Client, Users, Databases, ID } from "node-appwrite";
import * as readline from "readline";

const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("6a2567ad0021c84890d1")
  .setKey("standard_9a9abd2b2fdf2a68e1cd4a674b057e8ab608596f58bb2d5f602004b92d4031c26600024ff810283f48034cf4051548dd23da1c454827b40efa4be2681d9e843e93e553e5bc7b575b5e8bcc69c240502ba4adc97ac97a1ea46a98903c96330417d28da84b921cbd17bfd3106b37fbaf139c8807d786b79611ab45dd9fb33f9d90");

const users = new Users(client);
const db = new Databases(client);
const DB_ID = "sustainista-hr";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
  console.log("\n🌿 Sustainista HR — Admin anlegen\n");

  const email = await ask("E-Mail: ");
  const password = await ask("Passwort (min. 8 Zeichen): ");
  const firstName = await ask("Vorname: ");
  const lastName = await ask("Nachname: ");
  const department = await ask("Abteilung (z.B. Geschäftsführung): ");
  const position = await ask("Position (z.B. CEO): ");
  rl.close();

  console.log("\nLege User an…");
  const user = await users.create(ID.unique(), email, undefined, password, `${firstName} ${lastName}`);
  console.log("✓ User erstellt:", user.$id);

  await users.updateLabels(user.$id, ["admin"]);
  console.log("✓ Admin-Label gesetzt");

  await db.createDocument(DB_ID, "employees", ID.unique(), {
    userId: user.$id,
    firstName,
    lastName,
    email,
    role: "admin",
    department,
    position,
    startDate: new Date().toISOString().split("T")[0],
    vacationDaysTotal: 25,
    vacationDaysUsed: 0,
  });
  console.log("✓ Mitarbeiter-Profil erstellt");

  console.log(`\n✅ Admin angelegt! Login mit: ${email}\n`);
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
