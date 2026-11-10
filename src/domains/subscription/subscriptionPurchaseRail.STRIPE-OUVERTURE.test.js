// STRIPE-OUVERTURE (10/11) — ce que le rail web envoie et ouvre.
// L1 : le site envoie son origine, pour que Stripe renvoie l'acheteur sur LE MEME
//      site (recette sur la recette, prod sur la prod, poste local sur le poste).
// L4 : sur le site, le portail de resiliation s'ouvre dans la page, pas dans une
//      fenetre que le navigateur bloquerait apres un appel au serveur.
import '@/theme/strings';

import { Linking, Platform } from 'react-native';

import {
  createStripeWebCheckoutSession,
  openSubscriptionBillingPortal,
} from '@/services/subscription/subscriptionService';

import {
  openSubscriptionManagementPortal,
  performSubscriptionPurchase,
} from './subscriptionPurchaseRail';

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn() },
  Platform: { OS: 'web' },
}));

jest.mock('@/constants/runtimeFlags', () => ({ APP_RUNTIME_ENV: 'production' }));

jest.mock('@/domains/subscription/subscriptionRevenueCat', () => ({
  isRevenueCatEnabled: jest.fn(),
  purchaseSubscriptionViaRevenueCat: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  changeSubscriptionPlan: jest.fn(),
  createStripeWebCheckoutSession: jest.fn(),
  increaseSubscriptionLicenseeCount: jest.fn(),
  openSubscriptionBillingPortal: jest.fn(),
  restoreSubscriptionPurchases: jest.fn(),
  validateSubscriptionPurchase: jest.fn(),
}));

const CLUB_100_AN = {
  billingPeriod: 'yearly', planCode: 'fc_club_tier_1_yearly', scopeType: 'CLUB',
};

describe('STRIPE-OUVERTURE — rail web', () => {
  let assign;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'web';
    assign = jest.fn();
    global.window = { location: { assign, origin: 'https://staging.foundclub.app' } };
    createStripeWebCheckoutSession.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' });
    openSubscriptionBillingPortal.mockResolvedValue({
      available: true, reason: 'ok', url: 'https://billing.stripe.test/p_1',
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(global, 'window');
  });

  it('L1 — la caisse recoit l origine du site qui l ouvre', async () => {
    await performSubscriptionPurchase({ catalogEntry: CLUB_100_AN, clubDocumentId: 'club-1' });
    expect(createStripeWebCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ returnOrigin: 'https://staging.foundclub.app' }),
    );
  });

  it('L4 — le portail recoit l origine du site et s ouvre DANS la page', async () => {
    const verdict = await openSubscriptionManagementPortal();
    expect(openSubscriptionBillingPortal).toHaveBeenCalledWith({ returnOrigin: 'https://staging.foundclub.app' });
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.test/p_1');
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(verdict).toEqual({ opened: true, reason: 'ok' });
  });

  it('L4 — portail indisponible : rien ne s ouvre, le verdict le dit', async () => {
    openSubscriptionBillingPortal.mockResolvedValue({
      available: false, reason: 'stripe-not-configured', url: null,
    });
    const verdict = await openSubscriptionManagementPortal();
    expect(assign).not.toHaveBeenCalled();
    expect(verdict).toEqual({ opened: false, reason: 'stripe-not-configured' });
  });

  it('sur le TELEPHONE, rien ne change : pas d origine, ouverture par le navigateur', async () => {
    Platform.OS = 'android';
    Reflect.deleteProperty(global, 'window');
    await openSubscriptionManagementPortal();
    expect(openSubscriptionBillingPortal).toHaveBeenCalledWith({});
    expect(Linking.openURL).toHaveBeenCalledWith('https://billing.stripe.test/p_1');
  });
});
