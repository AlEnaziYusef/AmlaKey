/**
 * Backup & restore functionality — Web version.
 * Uses Blob download for export and file input for import.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { userKey, LAST_BACKUP_KEY } from "./storage";

export interface BackupData {
  version: 1;
  exportedAt: string;
  properties: any[];
  tenants: any[];
  payments: any[];
  expenses: any[];
}

/** Fetch all data from Supabase and trigger browser download */
export async function exportAllData(userId: string = ""): Promise<string | null> {
  try {
    const [
      { data: properties },
      { data: tenants },
      { data: payments },
      { data: expenses },
    ] = await Promise.all([
      supabase.from("properties").select("*"),
      supabase.from("tenants").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("expenses").select("*"),
    ]);

    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      properties: properties ?? [],
      tenants: tenants ?? [],
      payments: payments ?? [],
      expenses: expenses ?? [],
    };

    const json = JSON.stringify(backup, null, 2);
    const fileName = `amlakey_backup_${new Date().toISOString().split("T")[0]}.json`;

    // Trigger browser download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Save backup date
    const bKey = userId ? userKey(userId, LAST_BACKUP_KEY) : LAST_BACKUP_KEY;
    await AsyncStorage.setItem(bKey, new Date().toISOString());

    return fileName;
  } catch (e: any) {
    throw new Error(e.message || "Export failed");
  }
}

/** Validate backup JSON structure */
function validateBackup(data: any): data is BackupData {
  return (
    data &&
    data.version === 1 &&
    Array.isArray(data.properties) &&
    Array.isArray(data.tenants) &&
    Array.isArray(data.payments) &&
    Array.isArray(data.expenses)
  );
}

/** Open file picker and restore data into Supabase */
export async function importAllData(): Promise<{ properties: number; tenants: number; payments: number; expenses: number }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error("cancelled"));
        return;
      }

      try {
        const content = await file.text();
        let data: any;
        try {
          data = JSON.parse(content);
        } catch {
          reject(new Error("invalid_json"));
          return;
        }

        if (!validateBackup(data)) {
          reject(new Error("invalid_format"));
          return;
        }

        const counts = { properties: 0, tenants: 0, payments: 0, expenses: 0 };

        if (data.properties.length > 0) {
          const { error } = await supabase.from("properties").upsert(data.properties, { onConflict: "id" });
          if (!error) counts.properties = data.properties.length;
        }
        if (data.tenants.length > 0) {
          const { error } = await supabase.from("tenants").upsert(data.tenants, { onConflict: "id" });
          if (!error) counts.tenants = data.tenants.length;
        }
        if (data.payments.length > 0) {
          const { error } = await supabase.from("payments").upsert(data.payments, { onConflict: "id" });
          if (!error) counts.payments = data.payments.length;
        }
        if (data.expenses.length > 0) {
          const { error } = await supabase.from("expenses").upsert(data.expenses, { onConflict: "id" });
          if (!error) counts.expenses = data.expenses.length;
        }

        resolve(counts);
      } catch (err: any) {
        reject(new Error(err.message || "Import failed"));
      }
    };
    input.click();
  });
}

/** Get the last backup date from AsyncStorage */
export async function getLastBackupDate(userId: string = ""): Promise<string | null> {
  const bKey = userId ? userKey(userId, LAST_BACKUP_KEY) : LAST_BACKUP_KEY;
  return AsyncStorage.getItem(bKey);
}
