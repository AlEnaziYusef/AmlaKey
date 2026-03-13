import CryptoJS from "crypto-js";

const NWC_API = process.env.EXPO_PUBLIC_NWC_API!;

export interface NWCBillResult {
  dueAmount: number;
  lastBillAmount: number;
  accountNumber: string;
  accountClassification: string;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function generateXToken(): string {
  const uid = generateUUID();
  const data = `vgnw%XO3=pR[jji,F/>L>6%YHDv@m]${uid}`;
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
}

export async function fetchNWCBill(
  accountNumber: string
): Promise<NWCBillResult> {
  const xToken = generateXToken();
  const xTimestamp = generateUUID();
  const xRequestId = generateUUID();

  const res = await fetch(NWC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json",
      "Accept-Language": "ar-SA",
      "X-Source-Application": "RES",
      "X-Timestamp": xTimestamp,
      "X-Request-ID": xRequestId,
      "X-App-Version": "5.1.6",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Token": xToken,
      Origin: "https://ebranch.nwc.com.sa",
      Referer: "https://ebranch.nwc.com.sa/",
    },
    body: JSON.stringify({
      acctCharType: "DPACCNUM",
      acctCharValue: accountNumber.trim(),
      premGeoNb: "",
      premGeoType: "",
    }),
  });

  const json = await res.json();

  // Error response format: [{ ErrorCode: "...", ErrorDescription: "...", Result: null }]
  if (!res.ok) {
    const err = Array.isArray(json) ? json[0] : json;
    const code = err?.ErrorCode ?? "Error";
    const desc = err?.ErrorDescription ?? `HTTP ${res.status}`;
    throw new Error(`${code}: ${desc}`);
  }

  // Success response: { accountsList: [...] } or { Result: { accountsList: [...] } }
  const accountsList: any[] =
    json?.accountsList ??
    json?.Result?.accountsList ??
    (Array.isArray(json) ? json : []);

  const account = Array.isArray(accountsList) ? accountsList[0] : null;

  if (!account) {
    throw new Error("No account data returned from NWC");
  }

  const params: Array<{ parameterName: string; parameterValue: string }> =
    account.parameters ?? [];

  const dueAmountStr =
    params.find((p) => p.parameterName === "DUEAMOUNT")?.parameterValue ?? "0";
  const lastBillStr =
    params.find((p) => p.parameterName === "LASTBILLAMOUNT")?.parameterValue ??
    params.find((p) => p.parameterName === "TOTALBILLAMOUNT")?.parameterValue ?? "0";

  return {
    dueAmount: parseFloat(dueAmountStr) || 0,
    lastBillAmount: parseFloat(lastBillStr) || 0,
    accountNumber: accountNumber.trim(),
    accountClassification: account.accountClassification ?? "RES",
  };
}
