/**
 * TandaXn Transfer Configuration
 * Shared data for all send-money / remittance / cross-border screens
 *
 * Single source of truth for:
 * - Supported countries & currencies
 * - Exchange rates (mock, replace with API later)
 * - Fee structure by delivery speed
 * - Phone code / format validation
 */

// ─── Country & Currency Definitions ───────────────────────────────────

export interface Country {
  code: string;          // ISO 3166-1 alpha-2
  name: string;
  flag: string;
  currency: string;      // ISO 4217
  currencySymbol: string;
  currencyName: string;
  phoneCode: string;
  phoneFormat: string;   // Placeholder hint
  phoneMinDigits: number;
  phoneMaxDigits: number;
  decimals: number;      // Currency decimal places (0 for XOF/XAF, 2 for USD)
  mobileProviders: MobileProvider[];
}

export interface MobileProvider {
  id: string;
  name: string;
  icon: string;
}

export const SUPPORTED_COUNTRIES: Country[] = [
  {
    code: "SN", name: "Senegal", flag: "\u{1F1F8}\u{1F1F3}",
    currency: "XOF", currencySymbol: "CFA", currencyName: "CFA Franc (BCEAO)",
    phoneCode: "+221", phoneFormat: "7X XXX XX XX", phoneMinDigits: 9, phoneMaxDigits: 9, decimals: 0,
    mobileProviders: [
      { id: "wave", name: "Wave", icon: "\u{1F30A}" },
      { id: "orange", name: "Orange Money", icon: "\u{1F34A}" },
      { id: "free", name: "Free Money", icon: "\u{1F4F1}" },
    ],
  },
  {
    code: "CM", name: "Cameroon", flag: "\u{1F1E8}\u{1F1F2}",
    currency: "XAF", currencySymbol: "FCFA", currencyName: "CFA Franc (BEAC)",
    phoneCode: "+237", phoneFormat: "6XX XXX XXX", phoneMinDigits: 9, phoneMaxDigits: 9, decimals: 0,
    mobileProviders: [
      { id: "mtn", name: "MTN Mobile Money", icon: "\u{1F4F2}" },
      { id: "orange", name: "Orange Money", icon: "\u{1F34A}" },
    ],
  },
  {
    code: "NG", name: "Nigeria", flag: "\u{1F1F3}\u{1F1EC}",
    currency: "NGN", currencySymbol: "\u20A6", currencyName: "Nigerian Naira",
    phoneCode: "+234", phoneFormat: "8XX XXX XXXX", phoneMinDigits: 10, phoneMaxDigits: 11, decimals: 2,
    mobileProviders: [
      { id: "opay", name: "OPay", icon: "\u{1F7E2}" },
      { id: "palmpay", name: "PalmPay", icon: "\u{1F334}" },
    ],
  },
  {
    code: "KE", name: "Kenya", flag: "\u{1F1F0}\u{1F1EA}",
    currency: "KES", currencySymbol: "KSh", currencyName: "Kenyan Shilling",
    phoneCode: "+254", phoneFormat: "7XX XXX XXX", phoneMinDigits: 9, phoneMaxDigits: 10, decimals: 2,
    mobileProviders: [
      { id: "mpesa", name: "M-Pesa", icon: "\u{1F4B0}" },
      { id: "airtel", name: "Airtel Money", icon: "\u{1F534}" },
    ],
  },
  {
    code: "GH", name: "Ghana", flag: "\u{1F1EC}\u{1F1ED}",
    currency: "GHS", currencySymbol: "GH\u{20B5}", currencyName: "Ghanaian Cedi",
    phoneCode: "+233", phoneFormat: "XX XXX XXXX", phoneMinDigits: 9, phoneMaxDigits: 10, decimals: 2,
    mobileProviders: [
      { id: "mtn", name: "MTN Mobile Money", icon: "\u{1F4F2}" },
      { id: "vodafone", name: "Vodafone Cash", icon: "\u{1F534}" },
    ],
  },
  {
    code: "CI", name: "C\u00F4te d'Ivoire", flag: "\u{1F1E8}\u{1F1EE}",
    currency: "XOF", currencySymbol: "CFA", currencyName: "CFA Franc (BCEAO)",
    phoneCode: "+225", phoneFormat: "XX XX XX XX XX", phoneMinDigits: 10, phoneMaxDigits: 10, decimals: 0,
    mobileProviders: [
      { id: "wave", name: "Wave", icon: "\u{1F30A}" },
      { id: "mtn", name: "MTN Mobile Money", icon: "\u{1F4F2}" },
      { id: "orange", name: "Orange Money", icon: "\u{1F34A}" },
    ],
  },
  {
    code: "ML", name: "Mali", flag: "\u{1F1F2}\u{1F1F1}",
    currency: "XOF", currencySymbol: "CFA", currencyName: "CFA Franc (BCEAO)",
    phoneCode: "+223", phoneFormat: "XX XX XX XX", phoneMinDigits: 8, phoneMaxDigits: 8, decimals: 0,
    mobileProviders: [
      { id: "orange", name: "Orange Money", icon: "\u{1F34A}" },
      { id: "moov", name: "Moov Money", icon: "\u{1F4F1}" },
    ],
  },
  {
    code: "BF", name: "Burkina Faso", flag: "\u{1F1E7}\u{1F1EB}",
    currency: "XOF", currencySymbol: "CFA", currencyName: "CFA Franc (BCEAO)",
    phoneCode: "+226", phoneFormat: "XX XX XX XX", phoneMinDigits: 8, phoneMaxDigits: 8, decimals: 0,
    mobileProviders: [
      { id: "orange", name: "Orange Money", icon: "\u{1F34A}" },
      { id: "moov", name: "Moov Money", icon: "\u{1F4F1}" },
    ],
  },
];

// ─── Exchange Rates (Mock - replace with API) ─────────────────────────

// Rates: 1 USD = X local currency
export const EXCHANGE_RATES: Record<string, number> = {
  XOF: 605.50,   // CFA Franc BCEAO (Senegal, Cote d'Ivoire, Mali, Burkina)
  XAF: 605.50,   // CFA Franc BEAC (Cameroon)
  NGN: 1580.00,  // Nigerian Naira
  KES: 153.50,   // Kenyan Shilling
  GHS: 15.80,    // Ghanaian Cedi
  USD: 1.00,
  EUR: 0.92,
  GBP: 0.79,
};

export function getExchangeRate(fromCurrency: string, toCurrency: string): number {
  const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
  const toRate = EXCHANGE_RATES[toCurrency] || 1;
  return toRate / fromRate;
}

// ─── Delivery Speed & Fee Structure ───────────────────────────────────

export interface DeliveryOption {
  id: string;
  label: string;
  description: string;
  daysMin: number;
  daysMax: number;
  daysLabel: string;
  flatFee: number;       // USD flat fee
  percentFee: number;    // Percentage of send amount
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Best value",
    daysMin: 3, daysMax: 5,
    daysLabel: "3-5 days",
    flatFee: 1.99,
    percentFee: 0.5,
  },
  {
    id: "express",
    label: "Express",
    description: "Faster delivery",
    daysMin: 1, daysMax: 2,
    daysLabel: "1-2 days",
    flatFee: 3.99,
    percentFee: 0.5,
  },
  {
    id: "instant",
    label: "Instant",
    description: "Minutes",
    daysMin: 0, daysMax: 0,
    daysLabel: "Minutes",
    flatFee: 6.99,
    percentFee: 0.5,
  },
];

// ─── Fee Calculation ──────────────────────────────────────────────────

export interface FeeBreakdown {
  sendAmount: number;
  flatFee: number;
  percentFee: number;
  totalFee: number;
  totalToPay: number;
  receiveAmount: number;
  exchangeRate: number;
  deliveryOption: DeliveryOption;
}

/**
 * Calculate complete fee breakdown.
 * Model: User pays sendAmount + fee. Recipient gets sendAmount * rate.
 * Fee is NOT deducted from the send amount.
 */
export function calculateFees(
  sendAmount: number,
  deliveryOption: DeliveryOption,
  exchangeRate: number,
  targetDecimals: number = 0
): FeeBreakdown {
  const flatFee = deliveryOption.flatFee;
  const percentFee = (sendAmount * deliveryOption.percentFee) / 100;
  const totalFee = flatFee + percentFee;
  const totalToPay = sendAmount + totalFee;
  const rawReceive = sendAmount * exchangeRate;
  const receiveAmount = targetDecimals === 0 ? Math.round(rawReceive) : parseFloat(rawReceive.toFixed(targetDecimals));

  return {
    sendAmount,
    flatFee,
    percentFee,
    totalFee,
    totalToPay,
    receiveAmount,
    exchangeRate,
    deliveryOption,
  };
}

// ─── Currency Formatting ──────────────────────────────────────────────

export function formatCurrency(amount: number, currency: string, decimals?: number): string {
  const dec = decimals ?? (EXCHANGE_RATES[currency] && currency !== "USD" && currency !== "EUR" && currency !== "GBP" ? 0 : 2);

  // For currencies with 0 decimals, show whole numbers with separators
  if (dec === 0) {
    return Math.round(amount).toLocaleString("en-US");
  }
  return amount.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Popular Routes ───────────────────────────────────────────────────

export interface TransferRoute {
  from: string;
  fromFlag: string;
  to: string;
  toFlag: string;
  label: string;
}

export const POPULAR_ROUTES: TransferRoute[] = [
  { from: "US", fromFlag: "\u{1F1FA}\u{1F1F8}", to: "SN", toFlag: "\u{1F1F8}\u{1F1F3}", label: "USA to Senegal" },
  { from: "FR", fromFlag: "\u{1F1EB}\u{1F1F7}", to: "SN", toFlag: "\u{1F1F8}\u{1F1F3}", label: "France to Senegal" },
  { from: "US", fromFlag: "\u{1F1FA}\u{1F1F8}", to: "NG", toFlag: "\u{1F1F3}\u{1F1EC}", label: "USA to Nigeria" },
  { from: "UK", fromFlag: "\u{1F1EC}\u{1F1E7}", to: "GH", toFlag: "\u{1F1EC}\u{1F1ED}", label: "UK to Ghana" },
  { from: "US", fromFlag: "\u{1F1FA}\u{1F1F8}", to: "CM", toFlag: "\u{1F1E8}\u{1F1F2}", label: "USA to Cameroon" },
  { from: "FR", fromFlag: "\u{1F1EB}\u{1F1F7}", to: "CI", toFlag: "\u{1F1E8}\u{1F1EE}", label: "France to C\u00F4te d'Ivoire" },
];

// ─── Phone Validation ─────────────────────────────────────────────────

export function validatePhone(phone: string, country: Country): { valid: boolean; message: string } {
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length < country.phoneMinDigits) {
    return { valid: false, message: `Phone number must be at least ${country.phoneMinDigits} digits` };
  }
  if (digitsOnly.length > country.phoneMaxDigits) {
    return { valid: false, message: `Phone number must be at most ${country.phoneMaxDigits} digits` };
  }
  return { valid: true, message: "" };
}

// ─── Saved Recipients (Mock) ──────────────────────────────────────────

export interface SavedRecipient {
  id: string;
  name: string;
  countryCode: string;
  phone: string;
  deliveryMethod: "mobile" | "bank" | "cash";
  provider?: string;
  lastSent?: string;
  favorite?: boolean;
}

export const MOCK_RECIPIENTS: SavedRecipient[] = [
  { id: "r1", name: "Mama Diallo", countryCode: "SN", phone: "77 XXX XX42", deliveryMethod: "mobile", provider: "wave", lastSent: "Feb 10", favorite: true },
  { id: "r2", name: "Amadou Diallo", countryCode: "SN", phone: "76 XX XX 85", deliveryMethod: "mobile", provider: "orange", lastSent: "Jan 25" },
  { id: "r3", name: "Fatou Ndiaye", countryCode: "SN", phone: "78 XXX XX91", deliveryMethod: "mobile", provider: "wave", lastSent: "Jan 15" },
  { id: "r4", name: "Uncle Paul", countryCode: "NG", phone: "8XX XXX XXXX", deliveryMethod: "bank", lastSent: "Dec 20" },
  { id: "r5", name: "Auntie Grace", countryCode: "KE", phone: "7XX XXX XXX", deliveryMethod: "mobile", provider: "mpesa", lastSent: "Dec 1" },
];

// ─── Helper: Get country by code ──────────────────────────────────────

export function getCountryByCode(code: string): Country | undefined {
  return SUPPORTED_COUNTRIES.find(c => c.code === code);
}
