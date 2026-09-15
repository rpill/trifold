export interface RewardedAdGateway {
  readonly available: boolean;
  showRewarded(): Promise<boolean>;
}

export interface PurchaseReceipt {
  readonly purchaseToken: string;
  readonly productId: string;
}

export interface PaymentsGateway {
  readonly available: boolean;
  purchase(productId: string): Promise<PurchaseReceipt>;
  getUnconsumedPurchases(): Promise<readonly PurchaseReceipt[]>;
  consume(purchaseToken: string): Promise<void>;
}

export class MonetizationUnavailableError extends Error {
  constructor(message = 'Monetization service is unavailable.') {
    super(message);
    this.name = 'MonetizationUnavailableError';
  }
}

export class UnavailableRewardedAdGateway implements RewardedAdGateway {
  readonly available = false;

  async showRewarded(): Promise<boolean> {
    return false;
  }
}

export class UnavailablePaymentsGateway implements PaymentsGateway {
  readonly available = false;

  async purchase(_productId: string): Promise<PurchaseReceipt> {
    throw new MonetizationUnavailableError('Payments are unavailable.');
  }

  async getUnconsumedPurchases(): Promise<readonly PurchaseReceipt[]> {
    return [];
  }

  async consume(_purchaseToken: string): Promise<void> {
    throw new MonetizationUnavailableError('Payments are unavailable.');
  }
}
