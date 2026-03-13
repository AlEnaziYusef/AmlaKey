/**
 * User-scoped AsyncStorage key helpers.
 * Keys that contain user data are prefixed with the Supabase user ID
 * so multiple users on the same device have isolated local data.
 */

/** Build a user-scoped storage key */
export function userKey(userId: string, base: string): string {
  return `${base}::${userId}`;
}

// Base key constants (the part before the user ID)
export const PERSONAL_INFO_KEY = "amlaky_personal_info";
export const HIJRI_KEY = "amlaky_show_hijri";
export const NOTIFICATIONS_KEY = "amlaky_notifications";
export const NOTIFICATION_HISTORY_KEY = "amlaky_notification_history";
export const LAST_BACKUP_KEY = "amlaky_last_backup";
export const EJAR_IMPORT_KEY = "ejar_import";
export const BIOMETRIC_LOCK_KEY = "amlaky_biometric_lock";
