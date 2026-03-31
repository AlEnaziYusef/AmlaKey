import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import { lightColors, spacing, radii } from "../constants/theme";

// ---------------------------------------------------------------------------
// i18n (inline, no context needed)
// ---------------------------------------------------------------------------

const en: Record<string, string> = {
  title: "Maintenance Request",
  subtitle: "Submit a maintenance request for your unit",
  invalidToken: "This link is invalid or expired",
  invalidTokenSub: "Please contact your landlord for a new link.",
  property: "Property",
  unit: "Unit",
  tenant: "Tenant",
  category: "Category",
  categoryRequired: "Please select a category",
  description: "Description",
  descriptionPlaceholder: "Describe the issue in detail...",
  descriptionMin: "Description must be at least 10 characters",
  descriptionRequired: "Please enter a description",
  image: "Photo (optional)",
  chooseImage: "Choose Image",
  changeImage: "Change Image",
  removeImage: "Remove",
  submit: "Submit Request",
  submitting: "Submitting...",
  successTitle: "Request Submitted!",
  successSub: "Your maintenance request has been received. We will get back to you soon.",
  requestNumber: "Request #",
  newRequest: "Submit Another Request",
  error: "Something went wrong. Please try again.",
  loading: "Loading...",
  poweredBy: "Powered by Amlakey",
  paint: "Paint",
  electricity: "Electricity",
  plumbing: "Plumbing",
  floor: "Floor",
  other: "Other",
  uploadingImage: "Uploading image...",
  imageError: "Failed to upload image. Submitting without image.",
};

const ar: Record<string, string> = {
  title: "\u0637\u0644\u0628 \u0635\u064a\u0627\u0646\u0629",
  subtitle: "\u0623\u0631\u0633\u0644 \u0637\u0644\u0628 \u0635\u064a\u0627\u0646\u0629 \u0644\u0648\u062d\u062f\u062a\u0643",
  invalidToken: "\u0647\u0630\u0627 \u0627\u0644\u0631\u0627\u0628\u0637 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d \u0623\u0648 \u0645\u0646\u062a\u0647\u064a \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629",
  invalidTokenSub: "\u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0627\u0644\u0643 \u0644\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0631\u0627\u0628\u0637 \u062c\u062f\u064a\u062f.",
  property: "\u0627\u0644\u0639\u0642\u0627\u0631",
  unit: "\u0627\u0644\u0648\u062d\u062f\u0629",
  tenant: "\u0627\u0644\u0645\u0633\u062a\u0623\u062c\u0631",
  category: "\u0627\u0644\u062a\u0635\u0646\u064a\u0641",
  categoryRequired: "\u064a\u0631\u062c\u0649 \u0627\u062e\u062a\u064a\u0627\u0631 \u062a\u0635\u0646\u064a\u0641",
  description: "\u0627\u0644\u0648\u0635\u0641",
  descriptionPlaceholder: "\u0635\u0641 \u0627\u0644\u0645\u0634\u0643\u0644\u0629 \u0628\u0627\u0644\u062a\u0641\u0635\u064a\u0644...",
  descriptionMin: "\u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0627\u0644\u0648\u0635\u0641 10 \u0623\u062d\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644",
  descriptionRequired: "\u064a\u0631\u062c\u0649 \u0625\u062f\u062e\u0627\u0644 \u0648\u0635\u0641",
  image: "\u0635\u0648\u0631\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)",
  chooseImage: "\u0627\u062e\u062a\u0631 \u0635\u0648\u0631\u0629",
  changeImage: "\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0635\u0648\u0631\u0629",
  removeImage: "\u0625\u0632\u0627\u0644\u0629",
  submit: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628",
  submitting: "\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0631\u0633\u0627\u0644...",
  successTitle: "\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628!",
  successSub: "\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0637\u0644\u0628 \u0627\u0644\u0635\u064a\u0627\u0646\u0629. \u0633\u0646\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u0642\u0631\u064a\u0628\u0627\u064b.",
  requestNumber: "\u0637\u0644\u0628 #",
  newRequest: "\u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0622\u062e\u0631",
  error: "\u062d\u062f\u062b \u062e\u0637\u0623. \u064a\u0631\u062c\u0649 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.",
  loading: "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...",
  poweredBy: "\u0645\u062f\u0639\u0648\u0645 \u0645\u0646 \u0623\u0645\u0644\u0627\u0643\u064a",
  paint: "\u062f\u0647\u0627\u0646",
  electricity: "\u0643\u0647\u0631\u0628\u0627\u0621",
  plumbing: "\u0633\u0628\u0627\u0643\u0629",
  floor: "\u0623\u0631\u0636\u064a\u0627\u062a",
  other: "\u0623\u062e\u0631\u0649",
  uploadingImage: "\u062c\u0627\u0631\u064a \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631\u0629...",
  imageError: "\u0641\u0634\u0644 \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631\u0629. \u0633\u064a\u062a\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0628\u062f\u0648\u0646 \u0635\u0648\u0631\u0629.",
};

type Category = "paint" | "electricity" | "plumbing" | "floor" | "other";

const CATEGORIES: { key: Category; icon: string }[] = [
  { key: "paint", icon: "\uD83C\uDFA8" },
  { key: "electricity", icon: "\u26A1" },
  { key: "plumbing", icon: "\uD83D\uDD27" },
  { key: "floor", icon: "\uD83C\uDFD7\uFE0F" },
  { key: "other", icon: "\uD83D\uDCCB" },
];

// ---------------------------------------------------------------------------
// Detect language from browser
// ---------------------------------------------------------------------------

function detectLang(): "ar" | "en" {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    const browserLang = navigator.language || (navigator as any).userLanguage || "en";
    if (browserLang.startsWith("ar")) return "ar";
  }
  return "en";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type TenantInfo = {
  tenant_name: string;
  unit_label: string;
  property_name: string;
};

export default function MaintenanceRequestScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const isWeb = Platform.OS === "web";

  const [lang, setLang] = useState<"ar" | "en">(detectLang);
  const isRTL = lang === "ar";
  const t = useCallback((key: string) => (lang === "ar" ? ar[key] : en[key]) || key, [lang]);

  // State
  const [status, setStatus] = useState<"loading" | "invalid" | "form" | "success">("loading");
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Colors (always light theme for public form)
  const C = lightColors;

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_maintenance_tenant", {
          p_token: token,
        });
        if (rpcErr || !data) {
          setStatus("invalid");
          return;
        }
        setTenantInfo(data as TenantInfo);
        setStatus("form");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [token]);

  // Image picker (native)
  const pickImageNative = useCallback(async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      // Silently fail on web if expo-image-picker is not available
    }
  }, []);

  // Web file input handler
  const handleWebFileChange = useCallback((e: any) => {
    const file = e.target?.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUri(URL.createObjectURL(file));
    }
  }, []);

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImageUri(null);
    if (isWeb && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [isWeb]);

  // Upload image to Supabase Storage
  const uploadImage = useCallback(async (): Promise<string | null> => {
    if (!imageUri && !imageFile) return null;

    const path = `public/${token}/${Date.now()}.jpg`;

    try {
      if (isWeb && imageFile) {
        const { error: uploadErr } = await supabase.storage
          .from("maintenance-images")
          .upload(path, imageFile, { contentType: imageFile.type, upsert: true });
        if (uploadErr) throw uploadErr;
        return path;
      }

      if (!isWeb && imageUri) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const { error: uploadErr } = await supabase.storage
          .from("maintenance-images")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (uploadErr) throw uploadErr;
        return path;
      }
    } catch {
      return null;
    }

    return null;
  }, [imageUri, imageFile, token, isWeb]);

  // Submit
  const handleSubmit = useCallback(async () => {
    setError("");

    if (!category) {
      setError(t("categoryRequired"));
      return;
    }
    if (!description.trim()) {
      setError(t("descriptionRequired"));
      return;
    }
    if (description.trim().length < 10) {
      setError(t("descriptionMin"));
      return;
    }

    setSubmitting(true);

    let imagePath: string | null = null;
    if (imageUri || imageFile) {
      imagePath = await uploadImage();
    }

    try {
      const { data, error: rpcErr } = await supabase.rpc("submit_maintenance_request", {
        p_token: token,
        p_category: category,
        p_description: description.trim(),
        p_image_path: imagePath,
      });

      if (rpcErr) {
        setError(t("error"));
        setSubmitting(false);
        return;
      }

      setRequestId(typeof data === "number" ? data : data?.id ?? null);
      setStatus("success");
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }, [category, description, imageUri, imageFile, token, t, uploadImage]);

  // Reset for another request
  const handleReset = useCallback(() => {
    setCategory(null);
    setDescription("");
    setImageFile(null);
    setImageUri(null);
    setError("");
    setRequestId(null);
    setStatus("form");
  }, []);

  const S = useMemo(() => styles(C, isRTL), [C, isRTL]);

  // ---- RENDER ----

  // Loading
  if (status === "loading") {
    return (
      <View style={S.root}>
        <View style={S.centered}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={S.loadingText}>{t("loading")}</Text>
        </View>
      </View>
    );
  }

  // Invalid token
  if (status === "invalid") {
    return (
      <View style={S.root}>
        <ScrollView contentContainerStyle={S.scrollContent}>
          <View style={S.container}>
            <View style={S.header}>
              <Image
                source={require("../assets/images/splash-icon.png")}
                style={S.logo}
                resizeMode="contain"
              />
              <Text style={S.headerTitle}>{t("title")}</Text>
            </View>
            <View style={S.errorCard}>
              <Text style={S.errorIcon}>!</Text>
              <Text style={S.errorTitle}>{t("invalidToken")}</Text>
              <Text style={S.errorSub}>{t("invalidTokenSub")}</Text>
            </View>
            <Text style={S.footer}>{t("poweredBy")}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Success
  if (status === "success") {
    return (
      <View style={S.root}>
        <ScrollView contentContainerStyle={S.scrollContent}>
          <View style={S.container}>
            <View style={S.header}>
              <Image
                source={require("../assets/images/splash-icon.png")}
                style={S.logo}
                resizeMode="contain"
              />
              <Text style={S.headerTitle}>{t("title")}</Text>
            </View>
            <View style={S.successCard}>
              <View style={S.successCheckCircle}>
                <Text style={S.successCheck}>{"\u2713"}</Text>
              </View>
              <Text style={S.successTitle}>{t("successTitle")}</Text>
              {requestId && (
                <Text style={S.successId}>{t("requestNumber")}{requestId}</Text>
              )}
              <Text style={S.successSub}>{t("successSub")}</Text>
              <TouchableOpacity style={S.newRequestBtn} onPress={handleReset}>
                <Text style={S.newRequestText}>{t("newRequest")}</Text>
              </TouchableOpacity>
            </View>
            <Text style={S.footer}>{t("poweredBy")}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---- FORM ----
  return (
    <View style={S.root}>
      <ScrollView
        contentContainerStyle={S.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={S.container}>
          {/* Header */}
          <View style={S.header}>
            <Image
              source={require("../assets/images/splash-icon.png")}
              style={S.logo}
              resizeMode="contain"
            />
            <Text style={S.headerTitle}>{t("title")}</Text>
            <Text style={S.headerSub}>{t("subtitle")}</Text>
          </View>

          {/* Language toggle */}
          <TouchableOpacity
            style={S.langBtn}
            onPress={() => setLang((l) => (l === "ar" ? "en" : "ar"))}
            accessibilityRole="button"
            accessibilityLabel={lang === "ar" ? "Switch to English" : "Switch to Arabic"}
          >
            <Text style={S.langBtnText}>
              {lang === "ar" ? "\uD83C\uDDFA\uD83C\uDDF8 English" : "\uD83C\uDDF8\uD83C\uDDE6 \u0627\u0644\u0639\u0631\u0628\u064a\u0629"}
            </Text>
          </TouchableOpacity>

          {/* Info banner */}
          {tenantInfo && (
            <View style={S.infoBanner}>
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>{t("property")}:</Text>
                <Text style={S.infoValue}>{tenantInfo.property_name}</Text>
              </View>
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>{t("unit")}:</Text>
                <Text style={S.infoValue}>{tenantInfo.unit_label}</Text>
              </View>
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>{t("tenant")}:</Text>
                <Text style={S.infoValue}>{tenantInfo.tenant_name}</Text>
              </View>
            </View>
          )}

          {/* Card */}
          <View style={S.card}>
            {/* Error */}
            {!!error && (
              <View style={S.errorBox}>
                <Text style={S.errorBoxText}>{error}</Text>
              </View>
            )}

            {/* Category */}
            <Text style={S.label}>{t("category")}</Text>
            <View style={S.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const selected = category === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[S.categoryBtn, selected && S.categoryBtnSelected]}
                    onPress={() => setCategory(cat.key)}
                    accessibilityRole="button"
                    accessibilityLabel={t(cat.key)}
                    accessibilityState={{ selected }}
                  >
                    <Text style={S.categoryIcon}>{cat.icon}</Text>
                    <Text style={[S.categoryLabel, selected && S.categoryLabelSelected]}>
                      {t(cat.key)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description */}
            <Text style={S.label}>{t("description")}</Text>
            <TextInput
              style={[S.input, S.textArea, { textAlign: isRTL ? "right" : "left" }]}
              value={description}
              onChangeText={setDescription}
              placeholder={t("descriptionPlaceholder")}
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              accessibilityLabel={t("description")}
            />

            {/* Image */}
            <Text style={S.label}>{t("image")}</Text>
            {isWeb && (
              <View>
                <input
                  ref={fileInputRef as any}
                  type="file"
                  accept="image/*"
                  onChange={handleWebFileChange}
                  style={{ display: "none" }}
                />
                <TouchableOpacity
                  style={S.imageBtn}
                  onPress={() => fileInputRef.current?.click()}
                  accessibilityRole="button"
                  accessibilityLabel={imageUri ? t("changeImage") : t("chooseImage")}
                >
                  <Text style={S.imageBtnIcon}>{"\uD83D\uDCF7"}</Text>
                  <Text style={S.imageBtnText}>
                    {imageUri ? t("changeImage") : t("chooseImage")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {!isWeb && (
              <TouchableOpacity
                style={S.imageBtn}
                onPress={pickImageNative}
                accessibilityRole="button"
                accessibilityLabel={imageUri ? t("changeImage") : t("chooseImage")}
              >
                <Text style={S.imageBtnIcon}>{"\uD83D\uDCF7"}</Text>
                <Text style={S.imageBtnText}>
                  {imageUri ? t("changeImage") : t("chooseImage")}
                </Text>
              </TouchableOpacity>
            )}

            {/* Image preview */}
            {imageUri && (
              <View style={S.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={S.imagePreview} resizeMode="cover" />
                <TouchableOpacity style={S.imageRemoveBtn} onPress={removeImage}>
                  <Text style={S.imageRemoveText}>{t("removeImage")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[S.submitBtn, submitting && S.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={t("submit")}
              accessibilityState={{ disabled: submitting }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={S.submitText}>{t("submit")}</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={S.footer}>{t("poweredBy")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = (C: typeof lightColors, isRTL: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#F1F5F9",
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: C.textMuted,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
    },
    container: {
      maxWidth: 480,
      width: "100%" as any,
      alignSelf: "center" as any,
    },

    // Header
    header: {
      alignItems: "center",
      paddingTop: 40,
      paddingBottom: 20,
    },
    logo: {
      width: 64,
      height: 64,
      borderRadius: 16,
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: C.text,
      marginBottom: 4,
      textAlign: "center",
    },
    headerSub: {
      fontSize: 14,
      color: C.textMuted,
      textAlign: "center",
    },

    // Language toggle
    langBtn: {
      alignSelf: "center" as any,
      backgroundColor: C.surface,
      borderRadius: radii.md,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
    },
    langBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: C.primary,
    },

    // Info banner
    infoBanner: {
      backgroundColor: "rgba(14, 165, 233, 0.08)",
      borderRadius: radii.md,
      padding: spacing.lg,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "rgba(14, 165, 233, 0.2)",
    },
    infoRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      marginBottom: 6,
    },
    infoLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: C.primary,
      width: 70,
      textAlign: isRTL ? "right" : "left",
    },
    infoValue: {
      fontSize: 14,
      color: C.text,
      fontWeight: "500",
      flex: 1,
      textAlign: isRTL ? "right" : "left",
    },

    // Card
    card: {
      backgroundColor: C.surface,
      borderRadius: radii.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 3,
    },

    // Error box (inline form)
    errorBox: {
      backgroundColor: "rgba(220, 38, 38, 0.08)",
      borderRadius: radii.sm,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "rgba(220, 38, 38, 0.2)",
    },
    errorBoxText: {
      color: C.danger,
      fontSize: 13,
      textAlign: isRTL ? "right" : "left",
    },

    // Labels
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: C.text,
      marginBottom: 8,
      marginTop: 16,
      textAlign: isRTL ? "right" : "left",
    },

    // Category grid
    categoryGrid: {
      flexDirection: isRTL ? "row-reverse" : "row",
      flexWrap: "wrap",
      gap: 8,
    },
    categoryBtn: {
      flexBasis: "30%" as any,
      flexGrow: 1,
      backgroundColor: C.surfaceAlt,
      borderRadius: radii.md,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    categoryBtnSelected: {
      borderColor: C.primary,
      backgroundColor: "rgba(14, 165, 233, 0.08)",
    },
    categoryIcon: {
      fontSize: 24,
      marginBottom: 4,
    },
    categoryLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: C.textMuted,
    },
    categoryLabelSelected: {
      color: C.primary,
      fontWeight: "700",
    },

    // Input
    input: {
      backgroundColor: C.surfaceAlt,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: C.text,
      fontSize: 15,
    },
    textArea: {
      minHeight: 120,
      paddingTop: 12,
    },

    // Image
    imageBtn: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      backgroundColor: C.surfaceAlt,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: C.border,
      borderStyle: "dashed" as any,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 8,
    },
    imageBtnIcon: {
      fontSize: 20,
    },
    imageBtnText: {
      fontSize: 14,
      color: C.textMuted,
      fontWeight: "500",
    },
    imagePreviewWrap: {
      marginTop: 12,
      borderRadius: radii.sm,
      overflow: "hidden",
      position: "relative",
    },
    imagePreview: {
      width: "100%" as any,
      height: 200,
      borderRadius: radii.sm,
    },
    imageRemoveBtn: {
      position: "absolute",
      top: 8,
      ...(isRTL ? { left: 8 } : { right: 8 }),
      backgroundColor: "rgba(220, 38, 38, 0.9)",
      borderRadius: radii.sm,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    imageRemoveText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "600",
    },

    // Submit
    submitBtn: {
      backgroundColor: C.primary,
      borderRadius: radii.md,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 24,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 16,
    },

    // Footer
    footer: {
      textAlign: "center",
      color: C.textMuted,
      fontSize: 12,
      marginTop: 24,
      marginBottom: 16,
    },

    // Error screen
    errorCard: {
      backgroundColor: C.surface,
      borderRadius: radii.lg,
      padding: spacing["2xl"],
      alignItems: "center",
      borderWidth: 1,
      borderColor: C.border,
      marginTop: 16,
    },
    errorIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(220, 38, 38, 0.1)",
      color: C.danger,
      fontSize: 28,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 56,
      marginBottom: 16,
      overflow: "hidden",
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: C.text,
      textAlign: "center",
      marginBottom: 8,
    },
    errorSub: {
      fontSize: 14,
      color: C.textMuted,
      textAlign: "center",
    },

    // Success screen
    successCard: {
      backgroundColor: C.surface,
      borderRadius: radii.lg,
      padding: spacing["2xl"],
      alignItems: "center",
      borderWidth: 1,
      borderColor: C.border,
      marginTop: 16,
    },
    successCheckCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(13, 148, 136, 0.12)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    successCheck: {
      fontSize: 32,
      color: "#0D9488",
      fontWeight: "700",
    },
    successTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: C.text,
      textAlign: "center",
      marginBottom: 8,
    },
    successId: {
      fontSize: 16,
      fontWeight: "600",
      color: C.primary,
      marginBottom: 8,
    },
    successSub: {
      fontSize: 14,
      color: C.textMuted,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
    },
    newRequestBtn: {
      backgroundColor: C.surfaceAlt,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderWidth: 1,
      borderColor: C.border,
    },
    newRequestText: {
      fontSize: 14,
      fontWeight: "600",
      color: C.primary,
    },
  });
