/**
 * PaymentGatewayAdapter.ts
 *
 * Unified adapter layer for integrating with multiple payment processors.
 * Supports: Flutterwave, Paystack, MTN MoMo, Orange Money, and more.
 *
 * Features:
 * - Provider-agnostic interface for payments
 * - Automatic provider selection based on country/method
 * - Fallback mechanisms for failed transactions
 * - Webhook handling for async notifications
 * - Transaction status tracking
 */

// ============================================================================
// TYPES
// ============================================================================

export type PaymentProvider =
  | "flutterwave"
  | "paystack"
  | "mtn_momo"
  | "orange_money"
  | "stripe"
  | "manual";

export type TransactionType =
  | "collection"      // Collecting money from user (contribution)
  | "disbursement"    // Sending money to user (payout)
  | "transfer";       // Internal transfer

export type TransactionStatus =
  | "initiated"
  | "pending"
  | "processing"
  | "successful"
  | "failed"
  | "cancelled"
  | "refunded";

export interface PaymentRequest {
  type: TransactionType;
  amount: number;
  currency: string;
  reference: string;
  description: string;

  // Customer info
  customerId: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;

  // Destination (for disbursements)
  destination?: PaymentDestination;

  // Source (for collections)
  source?: PaymentSource;

  // Metadata
  metadata?: Record<string, any>;
  callbackUrl?: string;
}

export interface PaymentDestination {
  type: "bank" | "mobile_money" | "card" | "wallet";

  // Bank
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;

  // Mobile money
  mobileProvider?: string;
  mobileNumber?: string;

  // Card
  cardToken?: string;
}

export interface PaymentSource {
  type: "bank" | "mobile_money" | "card" | "ussd" | "wallet";

  // For tokenized payments
  token?: string;

  // For direct card
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;

  // For mobile money
  mobileNumber?: string;
}

export interface PaymentResult {
  success: boolean;
  provider: PaymentProvider;
  transactionId: string;
  providerReference?: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  fee?: number;
  message?: string;

  // For async transactions
  authorizationUrl?: string;
  requiresOtp?: boolean;
  otpMessage?: string;

  // For completed transactions
  completedAt?: string;

  // Raw response for debugging
  rawResponse?: any;
}

export interface ProviderConfig {
  provider: PaymentProvider;
  publicKey: string;
  secretKey: string;
  encryptionKey?: string;
  webhookSecret?: string;
  environment: "sandbox" | "production";
  baseUrl: string;
}

export interface WebhookPayload {
  provider: PaymentProvider;
  event: string;
  transactionId: string;
  providerReference: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
  rawPayload: any;
}

// ============================================================================
// PROVIDER CONFIGURATIONS
// ============================================================================

const PROVIDER_CONFIGS: Record<string, Partial<ProviderConfig>> = {
  flutterwave: {
    provider: "flutterwave",
    baseUrl: "https://api.flutterwave.com/v3",
  },
  paystack: {
    provider: "paystack",
    baseUrl: "https://api.paystack.co",
  },
  mtn_momo: {
    provider: "mtn_momo",
    baseUrl: "https://sandbox.momodeveloper.mtn.com", // Would change for production
  },
  orange_money: {
    provider: "orange_money",
    baseUrl: "https://api.orange.com/orange-money-webpay",
  },
};

// Country to provider mappings
const COUNTRY_PROVIDERS: Record<string, PaymentProvider[]> = {
  CM: ["mtn_momo", "orange_money", "flutterwave"], // Cameroon
  NG: ["paystack", "flutterwave"],                  // Nigeria
  GH: ["paystack", "flutterwave", "mtn_momo"],     // Ghana
  KE: ["flutterwave", "paystack"],                  // Kenya
  ZA: ["paystack", "flutterwave"],                  // South Africa
  default: ["flutterwave", "paystack"],
};

// Method to provider mappings
const METHOD_PROVIDERS: Record<string, PaymentProvider[]> = {
  mobile_money: ["mtn_momo", "orange_money", "flutterwave"],
  bank_transfer: ["flutterwave", "paystack"],
  card: ["flutterwave", "paystack", "stripe"],
  ussd: ["paystack", "flutterwave"],
};

// ============================================================================
// MAIN ADAPTER CLASS
// ============================================================================

export class PaymentGatewayAdapter {
  private configs: Map<PaymentProvider, ProviderConfig> = new Map();
  private defaultCountry = "CM";

  constructor() {
    // Initialize with environment variables
    this.initializeProviders();
  }

  /**
   * Initialize provider configurations from environment
   */
  private initializeProviders(): void {
    // In production, these would come from environment variables
    // For now, we'll use placeholder values

    // Flutterwave
    if (process.env.FLUTTERWAVE_PUBLIC_KEY) {
      this.configs.set("flutterwave", {
        ...PROVIDER_CONFIGS.flutterwave as ProviderConfig,
        publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || "",
        secretKey: process.env.FLUTTERWAVE_SECRET_KEY || "",
        encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY,
        webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
        environment: (process.env.PAYMENT_ENVIRONMENT as "sandbox" | "production") || "sandbox",
      });
    }

    // Paystack
    if (process.env.PAYSTACK_PUBLIC_KEY) {
      this.configs.set("paystack", {
        ...PROVIDER_CONFIGS.paystack as ProviderConfig,
        publicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
        secretKey: process.env.PAYSTACK_SECRET_KEY || "",
        webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
        environment: (process.env.PAYMENT_ENVIRONMENT as "sandbox" | "production") || "sandbox",
      });
    }

    // MTN MoMo
    if (process.env.MTN_MOMO_API_KEY) {
      this.configs.set("mtn_momo", {
        ...PROVIDER_CONFIGS.mtn_momo as ProviderConfig,
        publicKey: process.env.MTN_MOMO_API_USER || "",
        secretKey: process.env.MTN_MOMO_API_KEY || "",
        environment: (process.env.PAYMENT_ENVIRONMENT as "sandbox" | "production") || "sandbox",
      });
    }
  }

  /**
   * Add or update a provider configuration
   */
  configureProvider(config: ProviderConfig): void {
    this.configs.set(config.provider, config);
  }

  /**
   * Select the best provider for a transaction
   */
  selectProvider(
    country: string,
    method: string,
    type: TransactionType
  ): PaymentProvider {
    // Get providers that support the country
    const countryProviders = COUNTRY_PROVIDERS[country] || COUNTRY_PROVIDERS.default;

    // Get providers that support the method
    const methodProviders = METHOD_PROVIDERS[method] || ["flutterwave"];

    // Find intersection
    const availableProviders = countryProviders.filter(
      (p) => methodProviders.includes(p) && this.configs.has(p)
    );

    if (availableProviders.length === 0) {
      // Fallback to first configured provider
      const fallback = Array.from(this.configs.keys())[0];
      if (!fallback) {
        throw new Error("No payment providers configured");
      }
      return fallback;
    }

    // Return first available (priority order is maintained in arrays)
    return availableProviders[0];
  }

  // ============================================================================
  // COLLECTION (Receiving Money)
  // ============================================================================

  /**
   * Initiate a collection (e.g., contribution payment)
   */
  async initiateCollection(request: PaymentRequest): Promise<PaymentResult> {
    const provider = this.selectProvider(
      this.getCountryFromCurrency(request.currency),
      request.source?.type || "card",
      "collection"
    );

    switch (provider) {
      case "flutterwave":
        return this.flutterwaveCollection(request);
      case "paystack":
        return this.paystackCollection(request);
      case "mtn_momo":
        return this.mtnMomoCollection(request);
      case "orange_money":
        return this.orangeMoneyCollection(request);
      default:
        throw new Error(`Provider ${provider} not supported for collections`);
    }
  }

  private async flutterwaveCollection(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.configs.get("flutterwave");
    if (!config) throw new Error("Flutterwave not configured");

    try {
      // In production, make actual API call
      // const response = await fetch(`${config.baseUrl}/payments`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${config.secretKey}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     tx_ref: request.reference,
      //     amount: request.amount,
      //     currency: request.currency,
      //     payment_options: 'card,mobilemoney,ussd',
      //     redirect_url: request.callbackUrl,
      //     customer: {
      //       email: request.customerEmail,
      //       phonenumber: request.customerPhone,
      //       name: request.customerName,
      //     },
      //     meta: request.metadata,
      //   }),
      // });

      // Simulate response
      return {
        success: true,
        provider: "flutterwave",
        transactionId: request.reference,
        providerReference: `FLW-${Date.now()}`,
        status: "pending",
        amount: request.amount,
        currency: request.currency,
        authorizationUrl: `https://checkout.flutterwave.com/v3/hosted/pay/${request.reference}`,
        message: "Payment initiated successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        provider: "flutterwave",
        transactionId: request.reference,
        status: "failed",
        amount: request.amount,
        currency: request.currency,
        message: error.message,
      };
    }
  }

  private async paystackCollection(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.configs.get("paystack");
    if (!config) throw new Error("Paystack not configured");

    try {
      // In production: actual API call to Paystack
      return {
        success: true,
        provider: "paystack",
        transactionId: request.reference,
        providerReference: `PSK-${Date.now()}`,
        status: "pending",
        amount: request.amount,
        currency: request.currency,
        authorizationUrl: `https://checkout.paystack.com/${request.reference}`,
        message: "Payment initiated successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        provider: "paystack",
        transactionId: request.reference,
        status: "failed",
        amount: request.amount,
        currency: request.currency,
        message: error.message,
      };
    }
  }

  private async mtnMomoCollection(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.configs.get("mtn_momo");
    if (!config) throw new Error("MTN MoMo not configured");

    try {
      // MTN MoMo requires the user to approve on their phone
      // In production: call requesttopay API
      return {
        success: true,
        provider: "mtn_momo",
        transactionId: request.reference,
        providerReference: `MOMO-${Date.now()}`,
        status: "pending",
        amount: request.amount,
        currency: request.currency,
        requiresOtp: true,
        otpMessage: `Please approve the payment of ${request.amount} ${request.currency} on your phone`,
        message: "Payment request sent to your phone",
      };
    } catch (error: any) {
      return {
        success: false,
        provider: "mtn_momo",
        transactionId: request.reference,
        status: "failed",
        amount: request.amount,
        currency: request.currency,
        message: error.message,
      };
    }
  }

  private async orangeMoneyCollection(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.configs.get("orange_money");
    if (!config) throw new Error("Orange Money not configured");

    try {
      // Orange Money also requires phone approval
      return {
        success: true,
        provider: "orange_money",
        transactionId: request.reference,
        providerReference: `OM-${Date.now()}`,
        status: "pending",
        amount: request.amount,
        currency: request.currency,
        requiresOtp: true,
        otpMessage: `Dial *150# to approve the payment of ${request.amount} ${request.currency}`,
        message: "Payment request initiated",
      };
    } catch (error: any) {
      return {
        success: false,
        provider: "orange_money",
        transactionId: request.reference,
        status: "failed",
        amount: request.amount,
        currency: request.currency,
        message: error.message,
      };
    }
  }

  // ============================================================================
  // DISBURSEMENT (Sending Money)
  // ============================================================================

  /**
   * Initiate a disbursement (e.g., payout)
   */
  async initiateDisbursement(request: PaymentRequest): Promise<PaymentResult> {
    const provider = this.selectProvider(
      this.getCountryFromCurrency(request.currency),
      request.destination?.type || "bank",
      "disbursement"
    );

    switch (provider) {
      case "flutterwave":
        return this.flutterwaveDisbursement(request);
      case "paystack":
        return this.paystackDisbursement(request);
      case "mtn_momo":
        return this.mtnMomoDisbursement(request);
      case "orange_money":
        return this.orangeMoneyDisbursement(request);
      default:
        throw new Error(`Provider ${provider} not supported for disbursements`);
    }
  }

  private async flutterwaveDisbursement(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.configs.get("flutterwave");
    if (!config) throw new Error("Flutterwave not configured");

    try {
      // In production: call transfer API
      // Different endpoints for bank vs mobile money
      const destination = request.destination!;

      // Simulate processing
      const success = Math.random() > 0.05;

      if (success) {
        return {
          success: true,
          provider: "flutterwave",
          transactionId: request.reference,
          providerReference: `FLW-TRF-${Date.now()}`,
          status: "successful",
          amount: request.amount,
          currency: request.currency,
          fee: request.amount * 0.01, // 1% fee
          completedAt: new Date().toISOString(),
          message: "Transfer successful",
        };
      } else {
        throw new Error("Transfer failed - please try again");
      }
    } catch (error: any) {
      return {
        success: false,
        provider: "flutterwave",
        transactionId: request.reference,
        status: "failed",
        amount: request.amount,
        currency: request.currency,
        message: error.message,
      };
    }
  }

  private async paystackDisbursement(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.configs.get("paystack");
    if (!config) throw new Error("Paystack not configured");

    try {
      // In production: call transfer API
      const success = Math.random() > 0.05;

      if (success) {
        return {
          success: true,
          provider: "paystack",
          transactionId: request.reference,
          providerReference: `PSK-TRF-${Date.now()}`,
          status: "successful",
          amount: request.amount,
          currency: request.currency,
          fee: 50, // Flat fee
          completedAt: new Date().toISOString(),
          message: "Transfer successful",
        };
      } else {
        throw new Error("Transfer failed");
      }
    } catch (error: any) {
      return {
        success: false,
        provider: "paystack",
        transactionId: request.reference,
        status: "failed",
        amount: request.amount,
        currency: request.currency,
        message: error.message,
      };
    }
  }

  private async mtnMomoDisbursement(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.configs.get("mtn_momo");
    if (!config) throw new Error("MTN MoMo not configured");

    try {
      // In production: call disbursement API
      const success = Math.random() > 0.03;

      if (success) {
        return {
          success: true,
          provider: "mtn_momo",
          transactionId: request.reference,
          providerReference: `MOMO-TRF-${Date.now()}`,
          status: "successful",
          amount: request.amount,
          currency: request.currency,
          fee: 0, // MoMo disbursements often have no fee
          completedAt: new Date().toISOString(),
          message: `${request.amount} ${request.currency} sent successfully`,
        };
      } else {
        throw new Error("Mobile money transfer failed");
      }
    } catch (error: any) {
      return {
        success: false,
        provider: "mtn_momo",
        transactionId: request.reference,
        status: "failed",
        amount: request.amount,
        currency: request.currency,
        message: error.message,
      };
    }
  }

  private async orangeMoneyDisbursement(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.configs.get("orange_money");
    if (!config) throw new Error("Orange Money not configured");

    try {
      const success = Math.random() > 0.03;

      if (success) {
        return {
          success: true,
          provider: "orange_money",
          transactionId: request.reference,
          providerReference: `OM-TRF-${Date.now()}`,
          status: "successful",
          amount: request.amount,
          currency: request.currency,
          fee: 0,
          completedAt: new Date().toISOString(),
          message: "Orange Money transfer successful",
        };
      } else {
        throw new Error("Orange Money transfer failed");
      }
    } catch (error: any) {
      return {
        success: false,
        provider: "orange_money",
        transactionId: request.reference,
        status: "failed",
        amount: request.amount,
        currency: request.currency,
        message: error.message,
      };
    }
  }

  // ============================================================================
  // STATUS CHECKING
  // ============================================================================

  /**
   * Check transaction status
   */
  async checkStatus(
    transactionId: string,
    provider: PaymentProvider
  ): Promise<PaymentResult> {
    switch (provider) {
      case "flutterwave":
        return this.flutterwaveStatus(transactionId);
      case "paystack":
        return this.paystackStatus(transactionId);
      case "mtn_momo":
        return this.mtnMomoStatus(transactionId);
      default:
        throw new Error(`Status check not supported for ${provider}`);
    }
  }

  private async flutterwaveStatus(transactionId: string): Promise<PaymentResult> {
    // In production: call verify transaction API
    return {
      success: true,
      provider: "flutterwave",
      transactionId,
      status: "successful",
      amount: 0,
      currency: "XAF",
      message: "Transaction verified",
    };
  }

  private async paystackStatus(transactionId: string): Promise<PaymentResult> {
    // In production: call verify transaction API
    return {
      success: true,
      provider: "paystack",
      transactionId,
      status: "successful",
      amount: 0,
      currency: "XAF",
      message: "Transaction verified",
    };
  }

  private async mtnMomoStatus(transactionId: string): Promise<PaymentResult> {
    // In production: call transaction status API
    return {
      success: true,
      provider: "mtn_momo",
      transactionId,
      status: "successful",
      amount: 0,
      currency: "XAF",
      message: "Transaction verified",
    };
  }

  // ============================================================================
  // WEBHOOK HANDLING
  // ============================================================================

  /**
   * Parse and validate webhook payload
   */
  parseWebhook(
    provider: PaymentProvider,
    headers: Record<string, string>,
    body: any
  ): WebhookPayload | null {
    switch (provider) {
      case "flutterwave":
        return this.parseFlutterwaveWebhook(headers, body);
      case "paystack":
        return this.parsePaystackWebhook(headers, body);
      case "mtn_momo":
        return this.parseMtnMomoWebhook(headers, body);
      default:
        return null;
    }
  }

  private parseFlutterwaveWebhook(
    headers: Record<string, string>,
    body: any
  ): WebhookPayload | null {
    const config = this.configs.get("flutterwave");

    // Verify webhook signature
    const signature = headers["verif-hash"];
    if (config?.webhookSecret && signature !== config.webhookSecret) {
      console.error("Invalid Flutterwave webhook signature");
      return null;
    }

    const event = body.event;
    const data = body.data;

    return {
      provider: "flutterwave",
      event,
      transactionId: data.tx_ref,
      providerReference: data.flw_ref || data.id?.toString(),
      status: this.mapFlutterwaveStatus(data.status),
      amount: parseFloat(data.amount),
      currency: data.currency,
      metadata: data.meta,
      rawPayload: body,
    };
  }

  private parsePaystackWebhook(
    headers: Record<string, string>,
    body: any
  ): WebhookPayload | null {
    const config = this.configs.get("paystack");

    // Verify webhook signature using HMAC
    // In production: verify using crypto

    const event = body.event;
    const data = body.data;

    return {
      provider: "paystack",
      event,
      transactionId: data.reference,
      providerReference: data.id?.toString(),
      status: this.mapPaystackStatus(data.status),
      amount: parseFloat(data.amount) / 100, // Paystack uses kobo
      currency: data.currency,
      metadata: data.metadata,
      rawPayload: body,
    };
  }

  private parseMtnMomoWebhook(
    headers: Record<string, string>,
    body: any
  ): WebhookPayload | null {
    // MTN MoMo webhook parsing
    return {
      provider: "mtn_momo",
      event: body.status === "SUCCESSFUL" ? "charge.completed" : "charge.failed",
      transactionId: body.externalId,
      providerReference: body.financialTransactionId,
      status: body.status === "SUCCESSFUL" ? "successful" : "failed",
      amount: parseFloat(body.amount),
      currency: body.currency,
      rawPayload: body,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private mapFlutterwaveStatus(status: string): TransactionStatus {
    switch (status?.toLowerCase()) {
      case "successful":
        return "successful";
      case "pending":
        return "pending";
      case "failed":
        return "failed";
      case "cancelled":
        return "cancelled";
      default:
        return "pending";
    }
  }

  private mapPaystackStatus(status: string): TransactionStatus {
    switch (status?.toLowerCase()) {
      case "success":
        return "successful";
      case "pending":
        return "pending";
      case "failed":
        return "failed";
      case "abandoned":
        return "cancelled";
      default:
        return "pending";
    }
  }

  private getCountryFromCurrency(currency: string): string {
    const currencyCountryMap: Record<string, string> = {
      XAF: "CM",  // CFA Franc (Cameroon)
      XOF: "SN",  // CFA Franc (Senegal)
      NGN: "NG",  // Nigerian Naira
      GHS: "GH",  // Ghanaian Cedi
      KES: "KE",  // Kenyan Shilling
      ZAR: "ZA",  // South African Rand
      USD: "US",
      EUR: "EU",
    };
    return currencyCountryMap[currency] || this.defaultCountry;
  }

  /**
   * Get list of supported banks for a country
   */
  async getSupportedBanks(country: string): Promise<{ code: string; name: string }[]> {
    // In production, would call provider APIs
    // For Cameroon:
    if (country === "CM") {
      return [
        { code: "BICEC", name: "BICEC Bank" },
        { code: "SGC", name: "Société Générale Cameroun" },
        { code: "AFRILAND", name: "Afriland First Bank" },
        { code: "UBA", name: "United Bank for Africa" },
        { code: "ECOBANK", name: "Ecobank Cameroon" },
        { code: "CCA", name: "CCA Bank" },
        { code: "CBC", name: "Commercial Bank of Cameroon" },
      ];
    }

    return [];
  }

  /**
   * Get supported mobile money providers for a country
   */
  async getSupportedMobileProviders(country: string): Promise<{ code: string; name: string }[]> {
    if (country === "CM") {
      return [
        { code: "MTN", name: "MTN Mobile Money" },
        { code: "ORANGE", name: "Orange Money" },
      ];
    }

    return [];
  }
}

// Export default instance
export const paymentGateway = new PaymentGatewayAdapter();

// Export convenience functions
export const initiateCollection = (request: PaymentRequest) =>
  paymentGateway.initiateCollection(request);

export const initiateDisbursement = (request: PaymentRequest) =>
  paymentGateway.initiateDisbursement(request);

export const checkTransactionStatus = (transactionId: string, provider: PaymentProvider) =>
  paymentGateway.checkStatus(transactionId, provider);

export const parseWebhook = (
  provider: PaymentProvider,
  headers: Record<string, string>,
  body: any
) => paymentGateway.parseWebhook(provider, headers, body);
