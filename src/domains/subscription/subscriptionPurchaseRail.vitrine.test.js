import { Platform } from 'react-native';

import { purchaseSubscriptionViaRevenueCat } from '@/domains/subscription/subscriptionRevenueCat';

import {
  changeSubscriptionPlan,
  validateSubscriptionPurchase,
} from '@/services/subscription/subscriptionService';

import {
  performSubscriptionPlanChange,
  performSubscriptionPurchase,
} from './subscriptionPurchaseRail';

/**
 * VITRINE — LES DEUX SORTIES OU L APP NE DIT RIEN AU SERVEUR.
 *
 * Mesure de production du 2026-09-04 : achat « Club Illimite » a 14:22:44,
 * encaisse par Apple. ZERO requete de l app au serveur — ni
 * `/purchases/validate`, ni `/change-plan`. Seul le webhook est arrive, et il a
 * ete refuse. Les deux temoins ci-dessous decrivent les deux chemins par
 * lesquels le telephone se taisait.
 */

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn() },
  Platform: { OS: 'ios' },
}));

jest.mock('@/constants/runtimeFlags', () => ({ APP_RUNTIME_ENV: 'production' }));

jest.mock('@/domains/subscription/subscriptionRevenueCat', () => ({
  isRevenueCatEnabled: jest.fn(() => true),
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

jest.mock('@/utils/logger/logger', () => {
  const journal = {
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  };
  return { createLogger: () => journal };
});

/**
 * L offre du 2026-09-04 : « Club Illimite », annuelle.
 * @param {Record<string, any>} [surcharges]
 * @returns {any} L entree de catalogue.
 */
const offreClub = (surcharges = {}) => ({
  billingPeriod: 'yearly',
  planCode: 'fc_club_tier_4_yearly',
  providerProductId: 'fc_club_tier_4_yearly',
  scopeType: 'CLUB',
  ...surcharges,
});

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
  validateSubscriptionPurchase.mockResolvedValue({ subscription: { documentId: 'sub-9' } });
  changeSubscriptionPlan.mockResolvedValue({ subscription: { documentId: 'sub-9' } });
});

describe('T3 — le changement d offre PARLE au serveur', () => {
  it('un changement d offre store appelle la route, avec subscriptionDocumentId', async () => {
    purchaseSubscriptionViaRevenueCat.mockResolvedValue({
      customerInfo: null,
      productIdentifier: 'fc_club_tier_4_yearly',
      transactionIdentifier: 'GPA.4242',
    });

    await performSubscriptionPlanChange({
      catalogEntry: offreClub(),
      clubDocumentId: 'club-1',
      currentPlanCode: 'fc_team_1_yearly',
      payerUserDocumentId: 'user-1',
      subscriptionDocumentId: 'sub-1',
      teamDocumentIds: [],
    });

    // Le telephone a `subscriptionDocumentId` EN MAIN dans cette meme fonction :
    // le 04/09 il achetait puis rendait un objet sans jamais s en servir.
    expect(changeSubscriptionPlan).toHaveBeenCalledTimes(1);
    expect(changeSubscriptionPlan).toHaveBeenCalledWith(expect.objectContaining({
      nextPlanCode: 'fc_club_tier_4_yearly',
      subscriptionDocumentId: 'sub-1',
    }));
  });

  it('le refus du serveur sur un changement d offre remonte, en francais', async () => {
    purchaseSubscriptionViaRevenueCat.mockResolvedValue({
      customerInfo: null,
      productIdentifier: 'fc_club_tier_4_yearly',
      transactionIdentifier: 'GPA.4242',
    });
    changeSubscriptionPlan.mockRejectedValue({
      message: 'CLUB_ALREADY_COVERED',
      name: 'ApplicationError',
      status: 400,
    });

    const resultat = await performSubscriptionPlanChange({
      catalogEntry: offreClub(),
      clubDocumentId: 'club-1',
      currentPlanCode: 'fc_team_1_yearly',
      subscriptionDocumentId: 'sub-1',
    });

    expect(resultat.serverRefused).toBe(true);
    expect(resultat.validationErrorMessage)
      .toContain('Ce club est déjà couvert par une offre Club active');
  });
});

describe('W3 — poster meme sans identifiant de transaction', () => {
  it('sans transaction du SDK, le rail POSTE quand meme au lieu de se taire', async () => {
    purchaseSubscriptionViaRevenueCat.mockResolvedValue({
      customerInfo: null,
      productIdentifier: 'fc_club_tier_4_yearly',
      transactionIdentifier: '',
    });

    await performSubscriptionPurchase({
      catalogEntry: offreClub(),
      clubDocumentId: 'club-1',
    });

    // « Le serveur totalement aveugle » : c est cette absence d appel qui a
    // laisse l achat du 04/09 sans aucune trace cote FoundClub.
    expect(validateSubscriptionPurchase).toHaveBeenCalledTimes(1);
  });

  it('sans transaction mais AVEC customerInfo : on poste l identifiant du store', async () => {
    purchaseSubscriptionViaRevenueCat.mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            club: {
              expirationDate: '2027-09-04T10:00:00Z',
              latestPurchaseDate: '2026-09-04T10:00:00Z',
              originalPurchaseDate: '2026-09-04T10:00:00Z',
              productIdentifier: 'fc_club_tier_4_yearly',
              store: 'APP_STORE',
              willRenew: true,
            },
          },
        },
      },
      productIdentifier: 'fc_club_tier_4_yearly',
      transactionIdentifier: '',
    });

    await performSubscriptionPurchase({
      catalogEntry: offreClub(),
      clubDocumentId: 'club-1',
    });

    // Le meme identifiant deterministe que « Restaurer mes achats » (ABOFIX/A4) :
    // deux envois de suite visent la meme ligne en base, jamais deux.
    expect(validateSubscriptionPurchase).toHaveBeenCalledWith(expect.objectContaining({
      providerTransactionId: 'rc-restore-apple-fc_club_tier_4_yearly-2026-09-04T10:00:00.000Z',
    }));
  });
});

describe('W1 — un refus explicite n est pas un silence', () => {
  it('le serveur repond NON (400) : le rail le dit, avec le message francais', async () => {
    purchaseSubscriptionViaRevenueCat.mockResolvedValue({
      customerInfo: null,
      productIdentifier: 'fc_club_tier_4_yearly',
      transactionIdentifier: 'GPA.4242',
    });
    validateSubscriptionPurchase.mockRejectedValue({
      message: 'CLUB_ALREADY_COVERED',
      name: 'ApplicationError',
      status: 400,
    });

    const resultat = await performSubscriptionPurchase({
      catalogEntry: offreClub(),
      clubDocumentId: 'club-1',
    });

    expect(resultat.serverRefused).toBe(true);
    expect(resultat.validationErrorMessage)
      .toContain('Ce club est déjà couvert par une offre Club active');
  });

  it('le serveur NE REPOND PAS (reseau coupe) : ce n est PAS un refus', async () => {
    purchaseSubscriptionViaRevenueCat.mockResolvedValue({
      customerInfo: null,
      productIdentifier: 'fc_club_tier_4_yearly',
      transactionIdentifier: 'GPA.4242',
    });
    // L intercepteur HTTP rejette la CHAINE nue d axios quand il n y a pas de
    // reponse (client.native.js). Aucun status : on ne sait rien.
    validateSubscriptionPurchase.mockRejectedValue('Network Error');

    const resultat = await performSubscriptionPurchase({
      catalogEntry: offreClub(),
      clubDocumentId: 'club-1',
    });

    // Accuser quelqu un qui vient de payer parce que le wifi a coupe serait le
    // defaut inverse, et il coute aussi cher.
    expect(resultat.serverRefused).toBe(false);
    expect(resultat.pendingWebhook).toBe(true);
  });

  it('un abandon au bout de 15 s (status 0) n est pas un refus non plus', async () => {
    purchaseSubscriptionViaRevenueCat.mockResolvedValue({
      customerInfo: null,
      productIdentifier: 'fc_club_tier_4_yearly',
      transactionIdentifier: 'GPA.4242',
    });
    validateSubscriptionPurchase.mockRejectedValue({
      code: 'REQUEST_TIMEOUT_ABANDONED',
      message: 'Request timeout - please retry.',
      status: 0,
    });

    const resultat = await performSubscriptionPurchase({ catalogEntry: offreClub() });

    expect(resultat.serverRefused).toBe(false);
  });

  it('une panne serveur (500) n est pas un refus : le webhook peut encore agir', async () => {
    purchaseSubscriptionViaRevenueCat.mockResolvedValue({
      customerInfo: null,
      productIdentifier: 'fc_club_tier_4_yearly',
      transactionIdentifier: 'GPA.4242',
    });
    validateSubscriptionPurchase.mockRejectedValue({
      message: 'Internal Server Error',
      name: 'InternalServerError',
      status: 500,
    });

    const resultat = await performSubscriptionPurchase({ catalogEntry: offreClub() });

    expect(resultat.serverRefused).toBe(false);
  });
});
