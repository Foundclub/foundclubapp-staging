import { Platform } from 'react-native';

import {
  isRevenueCatEnabled,
  purchaseSubscriptionViaRevenueCat,
  restoreRevenueCatPurchases,
} from '@/domains/subscription/subscriptionRevenueCat';

import {
  changeSubscriptionPlan,
  createStripeWebCheckoutSession,
  restoreSubscriptionPurchases,
  validateSubscriptionPurchase,
} from '@/services/subscription/subscriptionService';

import {
  getActiveSubscriptionPurchaseRail,
  isSubscriptionPurchaseAvailable,
  performSubscriptionPlanChange,
  performSubscriptionPurchase,
  restoreAllSubscriptionPurchases,
  SUBSCRIPTION_PURCHASE_RAILS,
} from './subscriptionPurchaseRail';

// Platform.OS est mute test par test : le rail depend d'abord de la plateforme.
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

let mockRuntimeEnv = 'production';

// APP_RUNTIME_ENV est fige au chargement du module reel : un getter permet de
// couvrir le parametre par defaut de getActiveSubscriptionPurchaseRail.
jest.mock('@/constants/runtimeFlags', () => ({
  get APP_RUNTIME_ENV() {
    return mockRuntimeEnv;
  },
}));

jest.mock('@/domains/subscription/subscriptionRevenueCat', () => ({
  isRevenueCatEnabled: jest.fn(),
  purchaseSubscriptionViaRevenueCat: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  changeSubscriptionPlan: jest.fn(),
  createStripeWebCheckoutSession: jest.fn(),
  restoreSubscriptionPurchases: jest.fn(),
  validateSubscriptionPurchase: jest.fn(),
}));

const FORCE_RAIL_ENV_KEY = 'FC_FORCE_REVENUECAT_RAIL';
const ORIGINAL_FORCE_RAIL_VALUE = process.env[FORCE_RAIL_ENV_KEY];

// Cle env lue via un index calcule : babel-plugin-inline-dotenv n'inline que les
// acces litteraux, la mutation runtime reste donc effective dans les tests.
const setForcedRailFlag = (rawValue) => {
  if (rawValue === undefined) {
    Reflect.deleteProperty(process.env, FORCE_RAIL_ENV_KEY);
    return;
  }
  process.env[FORCE_RAIL_ENV_KEY] = rawValue;
};

const stubWindowLocation = () => {
  const assign = jest.fn();
  global.window = { location: { assign } };
  return assign;
};

const buildCatalogEntry = (overrides = {}) => ({
  billingPeriod: 'monthly',
  planCode: 'fc_team_1_monthly',
  providerProductId: 'fc_team_1:monthly',
  ...overrides,
});

describe('subscriptionPurchaseRail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mockRuntimeEnv = 'production';
    setForcedRailFlag(undefined);

    isRevenueCatEnabled.mockReturnValue(true);
    purchaseSubscriptionViaRevenueCat.mockResolvedValue({
      productIdentifier: 'fc_team_1:monthly',
      transactionIdentifier: 'GPA.1234',
    });
    restoreRevenueCatPurchases.mockResolvedValue({ entitlements: {} });

    changeSubscriptionPlan.mockResolvedValue({ changed: true });
    createStripeWebCheckoutSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    });
    restoreSubscriptionPurchases.mockResolvedValue({ restored: true });
    validateSubscriptionPurchase.mockResolvedValue({ validated: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(global, 'window');
  });

  afterAll(() => {
    setForcedRailFlag(ORIGINAL_FORCE_RAIL_VALUE);
  });

  describe('getActiveSubscriptionPurchaseRail', () => {
    it('mobile hors mode test : rail RevenueCat sur iOS et Android', () => {
      Platform.OS = 'ios';
      expect(getActiveSubscriptionPurchaseRail('production'))
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT);

      Platform.OS = 'android';
      expect(getActiveSubscriptionPurchaseRail('production'))
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT);
    });

    it('mobile en mode test facturation : rail trusted-test (local et staging)', () => {
      ['android', 'ios'].forEach((osValue) => {
        Platform.OS = osValue;
        ['local', 'staging'].forEach((runtimeEnv) => {
          expect(getActiveSubscriptionPurchaseRail(runtimeEnv))
            .toBe(SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST);
        });
      });
    });

    it('web : stripe-web en prod, trusted-test en local/staging', () => {
      Platform.OS = 'web';
      expect(getActiveSubscriptionPurchaseRail('production'))
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.STRIPE_WEB);
      expect(getActiveSubscriptionPurchaseRail('local'))
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST);
      expect(getActiveSubscriptionPurchaseRail('staging'))
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST);
    });

    it('override : force le rail RevenueCat sur mobile meme en mode test', () => {
      setForcedRailFlag('1');
      ['android', 'ios'].forEach((osValue) => {
        Platform.OS = osValue;
        ['local', 'production', 'staging'].forEach((runtimeEnv) => {
          expect(getActiveSubscriptionPurchaseRail(runtimeEnv))
            .toBe(SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT);
        });
      });
    });

    it('override sur le web : jamais RevenueCat, toujours stripe-web', () => {
      setForcedRailFlag('1');
      Platform.OS = 'web';
      ['local', 'production', 'staging'].forEach((runtimeEnv) => {
        expect(getActiveSubscriptionPurchaseRail(runtimeEnv))
          .toBe(SUBSCRIPTION_PURCHASE_RAILS.STRIPE_WEB);
      });
    });

    it('override : accepte 1/on/true/yes, insensible a la casse et aux espaces', () => {
      Platform.OS = 'ios';
      ['1', 'on', 'true', 'yes', 'TRUE', ' Yes ', '  ON'].forEach((rawValue) => {
        setForcedRailFlag(rawValue);
        expect(getActiveSubscriptionPurchaseRail('local'))
          .toBe(SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT);
      });
    });

    it('override absent ou malforme : ignore, le mode test garde la main', () => {
      Platform.OS = 'ios';
      [undefined, '', '   ', '0', 'false', 'no', 'off', 'oui', '11', 'true1', 'enabled']
        .forEach((rawValue) => {
          setForcedRailFlag(rawValue);
          expect(getActiveSubscriptionPurchaseRail('local'))
            .toBe(SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST);
        });
    });

    it('plateforme inconnue : traitee comme un mobile (pas de rail web)', () => {
      ['macos', 'windows', undefined].forEach((osValue) => {
        Platform.OS = osValue;
        expect(getActiveSubscriptionPurchaseRail('production'))
          .toBe(SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT);
        expect(getActiveSubscriptionPurchaseRail('local'))
          .toBe(SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST);
      });
    });

    it('runtimeEnv : normalise la casse et les espaces, sinon rail reel', () => {
      Platform.OS = 'ios';
      expect(getActiveSubscriptionPurchaseRail('LOCAL'))
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST);
      expect(getActiveSubscriptionPurchaseRail(' Staging '))
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST);

      [null, '', '   ', 'prod', 'unknown'].forEach((runtimeEnv) => {
        expect(getActiveSubscriptionPurchaseRail(runtimeEnv))
          .toBe(SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT);
      });
    });

    it('sans argument : retombe sur APP_RUNTIME_ENV, l argument explicite prime', () => {
      Platform.OS = 'ios';

      mockRuntimeEnv = 'staging';
      expect(getActiveSubscriptionPurchaseRail())
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST);
      expect(getActiveSubscriptionPurchaseRail('production'))
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT);

      mockRuntimeEnv = 'production';
      expect(getActiveSubscriptionPurchaseRail())
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT);
      expect(getActiveSubscriptionPurchaseRail('local'))
        .toBe(SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST);
    });
  });

  describe('isSubscriptionPurchaseAvailable', () => {
    it('rails trusted-test et stripe-web : toujours disponibles sans SDK store', () => {
      isRevenueCatEnabled.mockReturnValue(false);

      mockRuntimeEnv = 'local';
      Platform.OS = 'ios';
      expect(isSubscriptionPurchaseAvailable()).toBe(true);

      mockRuntimeEnv = 'production';
      Platform.OS = 'web';
      expect(isSubscriptionPurchaseAvailable()).toBe(true);
      expect(isRevenueCatEnabled).not.toHaveBeenCalled();
    });

    it('rail RevenueCat : suit la disponibilite du SDK', () => {
      Platform.OS = 'ios';
      mockRuntimeEnv = 'production';

      isRevenueCatEnabled.mockReturnValue(true);
      expect(isSubscriptionPurchaseAvailable()).toBe(true);

      isRevenueCatEnabled.mockReturnValue(false);
      expect(isSubscriptionPurchaseAvailable()).toBe(false);
    });
  });

  describe('performSubscriptionPurchase', () => {
    it('rail trusted-test : valide en backend avec le provider de la plateforme', async () => {
      mockRuntimeEnv = 'local';
      Platform.OS = 'ios';

      const result = await performSubscriptionPurchase({
        catalogEntry: buildCatalogEntry(),
        clubDocumentId: 'club-1',
        teamDocumentIds: ['team-1'],
      });

      expect(purchaseSubscriptionViaRevenueCat).not.toHaveBeenCalled();
      expect(validateSubscriptionPurchase).toHaveBeenCalledTimes(1);
      expect(validateSubscriptionPurchase).toHaveBeenCalledWith(expect.objectContaining({
        autoRenew: true,
        billingPeriod: 'monthly',
        clubDocumentId: 'club-1',
        planCode: 'fc_team_1_monthly',
        provider: 'apple',
        status: 'active',
        teamDocumentIds: ['team-1'],
        trustedValidation: true,
      }));
      expect(result).toEqual({ validated: true });

      Platform.OS = 'android';
      await performSubscriptionPurchase({ catalogEntry: buildCatalogEntry() });
      expect(validateSubscriptionPurchase).toHaveBeenLastCalledWith(expect.objectContaining({
        provider: 'google',
        teamDocumentIds: [],
      }));
    });

    it('rail stripe-web : cree la session Checkout puis redirige la page', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'web';
      const assign = stubWindowLocation();

      const result = await performSubscriptionPurchase({
        catalogEntry: buildCatalogEntry({ planCode: '  fc_club_tier_2_yearly  ' }),
        clubDocumentId: '  club-1  ',
        teamDocumentIds: ['team-1'],
      });

      expect(createStripeWebCheckoutSession).toHaveBeenCalledWith({
        clubDocumentId: 'club-1',
        planCode: 'fc_club_tier_2_yearly',
        teamDocumentIds: ['team-1'],
      });
      expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1');
      expect(result).toEqual({ checkoutRedirect: true, sessionId: 'cs_test_1' });
      expect(validateSubscriptionPurchase).not.toHaveBeenCalled();
    });

    it('rail stripe-web : clubDocumentId vide envoye en undefined', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'web';
      stubWindowLocation();

      await performSubscriptionPurchase({
        catalogEntry: buildCatalogEntry(),
        clubDocumentId: '   ',
      });

      expect(createStripeWebCheckoutSession).toHaveBeenCalledWith({
        clubDocumentId: undefined,
        planCode: 'fc_team_1_monthly',
        teamDocumentIds: [],
      });
    });

    it('rail stripe-web : session sans url = erreur explicite', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'web';
      stubWindowLocation();
      createStripeWebCheckoutSession.mockResolvedValue({ id: 'cs_test_2' });

      await expect(performSubscriptionPurchase({ catalogEntry: buildCatalogEntry() }))
        .rejects.toThrow('Paiement web indisponible pour le moment.');
    });

    it('rail stripe-web : sans objet window, pas de crash', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'web';

      await expect(performSubscriptionPurchase({ catalogEntry: buildCatalogEntry() }))
        .resolves.toEqual({ checkoutRedirect: true, sessionId: 'cs_test_1' });
    });

    it('rail RevenueCat : confirme la transaction store cote client', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';

      const result = await performSubscriptionPurchase({
        catalogEntry: buildCatalogEntry({ billingPeriod: 'YEARLY' }),
        clubDocumentId: 'club-1',
        payerUserDocumentId: 'user-1',
        teamDocumentIds: ['team-1'],
      });

      expect(purchaseSubscriptionViaRevenueCat).toHaveBeenCalledWith({
        catalogEntry: expect.objectContaining({ planCode: 'fc_team_1_monthly' }),
        clubDocumentId: 'club-1',
        payerUserDocumentId: 'user-1',
        teamDocumentIds: ['team-1'],
      });
      expect(validateSubscriptionPurchase).toHaveBeenCalledWith(expect.objectContaining({
        autoRenew: true,
        billingPeriod: 'yearly',
        clubDocumentId: 'club-1',
        planCode: 'fc_team_1_monthly',
        provider: 'apple',
        providerEventId: 'rc-client-GPA.1234',
        providerProductId: 'fc_team_1:monthly',
        providerTransactionId: 'GPA.1234',
        status: 'active',
        teamDocumentIds: ['team-1'],
      }));

      const [payload] = validateSubscriptionPurchase.mock.calls[0];
      expect(typeof payload.currentPeriodStart).toBe('string');
      expect(typeof payload.currentPeriodEnd).toBe('string');
      expect(payload.trustedValidation).toBeUndefined();
      expect(result).toEqual({ validated: true });
    });

    it('rail RevenueCat : provider google sur Android, fallback produit du catalogue', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'android';
      purchaseSubscriptionViaRevenueCat.mockResolvedValue({
        productIdentifier: '',
        transactionIdentifier: 'GPA.9999',
      });

      await performSubscriptionPurchase({
        catalogEntry: buildCatalogEntry({ providerProductId: '  fc_team_1_monthly  ' }),
      });

      expect(validateSubscriptionPurchase).toHaveBeenCalledWith(expect.objectContaining({
        clubDocumentId: undefined,
        provider: 'google',
        providerProductId: 'fc_team_1_monthly',
        providerTransactionId: 'GPA.9999',
      }));
    });

    it('rail RevenueCat : catalogEntry absent = payload minimal, aucun crash', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';
      purchaseSubscriptionViaRevenueCat.mockResolvedValue({
        productIdentifier: '',
        transactionIdentifier: 'GPA.1234',
      });

      await performSubscriptionPurchase({ catalogEntry: null, clubDocumentId: null });

      expect(validateSubscriptionPurchase).toHaveBeenCalledWith(expect.objectContaining({
        billingPeriod: '',
        clubDocumentId: undefined,
        planCode: '',
        providerProductId: '',
        providerTransactionId: 'GPA.1234',
      }));
    });

    it('rail stripe-web : catalogEntry absent = planCode vide transmis au backend', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'web';
      stubWindowLocation();

      await performSubscriptionPurchase({ catalogEntry: undefined });

      expect(createStripeWebCheckoutSession).toHaveBeenCalledWith({
        clubDocumentId: undefined,
        planCode: '',
        teamDocumentIds: [],
      });
    });

    it('rail RevenueCat : transaction inconnue = attente du webhook', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';
      const purchase = { productIdentifier: 'fc_team_1:monthly', transactionIdentifier: '' };
      purchaseSubscriptionViaRevenueCat.mockResolvedValue(purchase);

      const result = await performSubscriptionPurchase({ catalogEntry: buildCatalogEntry() });

      expect(validateSubscriptionPurchase).not.toHaveBeenCalled();
      expect(result).toEqual({ pendingWebhook: true, purchase });
    });

    it('rail RevenueCat : achat store reussi mais backend KO = jamais un echec', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';
      validateSubscriptionPurchase.mockRejectedValue(new Error('backend down'));

      const result = await performSubscriptionPurchase({ catalogEntry: buildCatalogEntry() });

      expect(result).toEqual({
        pendingWebhook: true,
        purchase: { productIdentifier: 'fc_team_1:monthly', transactionIdentifier: 'GPA.1234' },
        validationError: true,
      });
    });

    it('rail RevenueCat : une erreur d achat store remonte telle quelle', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';
      purchaseSubscriptionViaRevenueCat.mockRejectedValue(new Error('Achat annulé.'));

      await expect(performSubscriptionPurchase({ catalogEntry: buildCatalogEntry() }))
        .rejects.toThrow('Achat annulé.');
      expect(validateSubscriptionPurchase).not.toHaveBeenCalled();
    });
  });

  describe('performSubscriptionPlanChange', () => {
    it('rail stripe-web : changement d offre refuse et renvoye vers l app mobile', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'web';

      await expect(performSubscriptionPlanChange({ catalogEntry: buildCatalogEntry() }))
        .rejects.toThrow('Le changement d offre se fait depuis l app mobile pour le moment.');
      expect(changeSubscriptionPlan).not.toHaveBeenCalled();
      expect(purchaseSubscriptionViaRevenueCat).not.toHaveBeenCalled();
    });

    it('rail trusted-test : change le plan en backend sans passage store', async () => {
      mockRuntimeEnv = 'staging';
      Platform.OS = 'android';

      const result = await performSubscriptionPlanChange({
        catalogEntry: buildCatalogEntry({ planCode: 'fc_club_tier_1_yearly' }),
        clubDocumentId: 'club-1',
        currentPlanCode: 'fc_team_1_monthly',
        subscriptionDocumentId: 'subscription-1',
        teamDocumentIds: ['team-1'],
      });

      expect(purchaseSubscriptionViaRevenueCat).not.toHaveBeenCalled();
      expect(changeSubscriptionPlan).toHaveBeenCalledWith(expect.objectContaining({
        clubDocumentId: 'club-1',
        nextPlanCode: 'fc_club_tier_1_yearly',
        provider: 'google',
        status: 'active',
        subscriptionDocumentId: 'subscription-1',
        teamDocumentIds: ['team-1'],
        trustedValidation: true,
      }));
      expect(result).toEqual({ changed: true });
    });

    it('rail trusted-test : sans club ni catalogue, payload neutre sans crash', async () => {
      mockRuntimeEnv = 'local';
      Platform.OS = 'ios';

      await performSubscriptionPlanChange({
        catalogEntry: null,
        clubDocumentId: null,
        subscriptionDocumentId: 'subscription-1',
      });

      expect(changeSubscriptionPlan).toHaveBeenCalledWith(expect.objectContaining({
        billingPeriod: '',
        clubDocumentId: undefined,
        nextPlanCode: '',
        provider: 'apple',
        trustedValidation: true,
      }));
    });

    it('rail RevenueCat, meme plan : reassignation de slots sans achat store', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';

      const result = await performSubscriptionPlanChange({
        catalogEntry: buildCatalogEntry({ billingPeriod: 'Monthly' }),
        clubDocumentId: '  club-1 ',
        currentPlanCode: '  fc_team_1_monthly  ',
        subscriptionDocumentId: 'subscription-1',
        teamDocumentIds: ['team-2'],
      });

      expect(purchaseSubscriptionViaRevenueCat).not.toHaveBeenCalled();
      expect(changeSubscriptionPlan).toHaveBeenCalledWith({
        autoRenew: true,
        billingPeriod: 'monthly',
        clubDocumentId: 'club-1',
        nextPlanCode: 'fc_team_1_monthly',
        nextProviderProductId: 'fc_team_1:monthly',
        planCode: 'fc_team_1_monthly',
        provider: 'apple',
        providerProductId: 'fc_team_1:monthly',
        status: 'active',
        subscriptionDocumentId: 'subscription-1',
        teamDocumentIds: ['team-2'],
      });
      expect(result).toEqual({ changed: true });
    });

    it('rail RevenueCat, meme plan sans produit catalogue : retombe sur le planCode', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'android';

      await performSubscriptionPlanChange({
        catalogEntry: { planCode: 'fc_team_1_monthly' },
        currentPlanCode: 'fc_team_1_monthly',
      });

      expect(changeSubscriptionPlan).toHaveBeenCalledWith(expect.objectContaining({
        billingPeriod: '',
        clubDocumentId: undefined,
        nextProviderProductId: 'fc_team_1_monthly',
        provider: 'google',
        providerProductId: 'fc_team_1_monthly',
        teamDocumentIds: [],
      }));
    });

    it('rail RevenueCat : catalogEntry absent = achat store, pas de reassignation', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';

      await performSubscriptionPlanChange({ catalogEntry: null, currentPlanCode: null });

      expect(changeSubscriptionPlan).not.toHaveBeenCalled();
      expect(purchaseSubscriptionViaRevenueCat).toHaveBeenCalledTimes(1);
    });

    it('rail RevenueCat, plan different : achat store et attente du webhook', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';

      const result = await performSubscriptionPlanChange({
        catalogEntry: buildCatalogEntry({ planCode: 'fc_club_tier_2_yearly' }),
        clubDocumentId: 'club-1',
        currentPlanCode: 'fc_team_1_monthly',
        payerUserDocumentId: 'user-1',
        teamDocumentIds: ['team-1'],
      });

      expect(changeSubscriptionPlan).not.toHaveBeenCalled();
      expect(purchaseSubscriptionViaRevenueCat).toHaveBeenCalledWith({
        catalogEntry: expect.objectContaining({ planCode: 'fc_club_tier_2_yearly' }),
        clubDocumentId: 'club-1',
        currentPlanCode: 'fc_team_1_monthly',
        payerUserDocumentId: 'user-1',
        teamDocumentIds: ['team-1'],
      });
      expect(result).toEqual({
        pendingWebhook: true,
        purchase: { productIdentifier: 'fc_team_1:monthly', transactionIdentifier: 'GPA.1234' },
      });
    });

    it('rail RevenueCat, planCode vide des deux cotes : passe par l achat store', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';

      await performSubscriptionPlanChange({
        catalogEntry: buildCatalogEntry({ planCode: '   ' }),
        currentPlanCode: '',
      });

      expect(changeSubscriptionPlan).not.toHaveBeenCalled();
      expect(purchaseSubscriptionViaRevenueCat).toHaveBeenCalledTimes(1);
    });
  });

  describe('restoreAllSubscriptionPurchases', () => {
    it('rail RevenueCat : restore SDK puis restore backend', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';

      const result = await restoreAllSubscriptionPurchases();

      expect(restoreRevenueCatPurchases).toHaveBeenCalledTimes(1);
      expect(restoreSubscriptionPurchases).toHaveBeenCalledWith({});
      expect(result).toEqual({ restored: true });
    });

    it('rail RevenueCat : un echec SDK ne bloque pas le restore backend', async () => {
      mockRuntimeEnv = 'production';
      Platform.OS = 'ios';
      restoreRevenueCatPurchases.mockRejectedValue(new Error('offline'));

      await expect(restoreAllSubscriptionPurchases()).resolves.toEqual({ restored: true });
      expect(restoreSubscriptionPurchases).toHaveBeenCalledWith({});
    });

    it('rails trusted-test et stripe-web : aucun appel au SDK store', async () => {
      mockRuntimeEnv = 'local';
      Platform.OS = 'ios';
      await restoreAllSubscriptionPurchases();

      mockRuntimeEnv = 'production';
      Platform.OS = 'web';
      await restoreAllSubscriptionPurchases();

      expect(restoreRevenueCatPurchases).not.toHaveBeenCalled();
      expect(restoreSubscriptionPurchases).toHaveBeenCalledTimes(2);
    });
  });
});
