import CryptoJS from "crypto-js";

const SEC_KEY = process.env.EXPO_PUBLIC_SEC_KEY!;
const SEC_API = process.env.EXPO_PUBLIC_SEC_API!;

export interface SECBillResult {
  totalAmount: number;
  dueAmount: number;
  invoiceAmount: number;
  vatAmount: number;
  consumption: string;
  tarifType: string;
  currency: string;
  contractAccount: string;
}

function encryptAccount(account: string): string {
  const key = CryptoJS.enc.Utf8.parse(SEC_KEY);
  const iv = CryptoJS.enc.Utf8.parse(SEC_KEY);
  const encrypted = CryptoJS.AES.encrypt(
    CryptoJS.enc.Utf8.parse(account),
    key,
    { keySize: 16, iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );
  return encrypted.toString(); // Base64
}

export async function fetchSECBill(accountNumber: string): Promise<SECBillResult> {
  const encrypted = encryptAccount(accountNumber.trim());
  const url = `${SEC_API}?contractAccount=${encodeURIComponent(encrypted)}&isEncrypt=true`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://www.se.com.sa/ar-SA/GuestViewBill",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();

  if (json?.Error?.ErrorMessage) throw new Error(json.Error.ErrorMessage);
  if (!json?.d) throw new Error("No data returned from SEC");

  const d = json.d;

  return {
    totalAmount: parseFloat(d.TotalAmt ?? "0"),
    dueAmount: parseFloat(d.CurrentDueAmt ?? "0"),
    invoiceAmount: parseFloat(d.InvAmt ?? "0"),
    vatAmount: parseFloat(d.Vat15Amt ?? "0"),
    consumption: d.TotalConsumption ?? "0",
    tarifType: d.TarifType ?? "",
    currency: d.Currency ?? "SAR",
    contractAccount: accountNumber,
  };
}
