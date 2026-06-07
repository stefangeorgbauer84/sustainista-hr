import { Client, Account, Databases, Storage } from "appwrite";

function createClient() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
  return new Client().setEndpoint(endpoint).setProject(projectId);
}

export const client = createClient();
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "sustainista-hr";

export const COLLECTIONS = {
  EMPLOYEES: "employees",
  TIME_ENTRIES: "time_entries",
  LEAVE_REQUESTS: "leave_requests",
  DOCUMENTS: "documents",
};

export const BUCKETS = {
  DOCUMENTS: "documents",
};
