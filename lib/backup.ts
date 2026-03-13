/**
 * Backup & restore functionality.
 * Exports all Supabase data as JSON, imports from JSON file.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
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

/** Fetch all data from Supabase and return as BackupData */
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
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Save backup date
    const bKey = userId ? userKey(userId, LAST_BACKUP_KEY) : LAST_BACKUP_KEY;
    await AsyncStorage.setItem(bKey, new Date().toISOString());

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Amlakey Backup",
        UTI: "public.json",
      });
    }

    return fileUri;
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

/** Pick a JSON file and restore data into Supabase */
export async function importAllData(): Promise<{ properties: number; tenants: number; payments: number; expenses: number }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new Error("cancelled");
  }

  const fileUri = result.assets[0].uri;
  const content = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error("invalid_json");
  }

  if (!validateBackup(data)) {
    throw new Error("invalid_format");
  }

  const counts = { properties: 0, tenants: 0, payments: 0, expenses: 0 };

  // Upsert properties
  if (data.properties.length > 0) {
    const { error } = await supabase.from("properties").upsert(data.properties, { onConflict: "id" });
    if (!error) counts.properties = data.properties.length;
  }

  // Upsert tenants
  if (data.tenants.length > 0) {
    const { error } = await supabase.from("tenants").upsert(data.tenants, { onConflict: "id" });
    if (!error) counts.tenants = data.tenants.length;
  }

  // Upsert payments
  if (data.payments.length > 0) {
    const { error } = await supabase.from("payments").upsert(data.payments, { onConflict: "id" });
    if (!error) counts.payments = data.payments.length;
  }

  // Upsert expenses
  if (data.expenses.length > 0) {
    const { error } = await supabase.from("expenses").upsert(data.expenses, { onConflict: "id" });
    if (!error) counts.expenses = data.expenses.length;
  }

  return counts;
}

/** Get the last backup date from AsyncStorage */
export async function getLastBackupDate(userId: string = ""): Promise<string | null> {
  const bKey = userId ? userKey(userId, LAST_BACKUP_KEY) : LAST_BACKUP_KEY;
  return AsyncStorage.getItem(bKey);
}
