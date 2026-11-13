// FINITIONS16 « 🔒 le parcours de paiement ne bouge pas », RE-POINTÉ (13/11/2026, décision du chef,
// option A, récolte du train 10). Jusqu'au train 9, le site achetait depuis « Mon abonnement »
// (web/src/views/profile/SubscriptionOverview.tsx), derrière la garde
// `canPurchaseFromWeb = isBillingTestModeEnabled || isStripeWebRail`. ABONNEMENT-MODELE (D89) y pose
// le carrousel de l'inscription : l'achat passe désormais par CE rail partagé. Le verrou le suit.
//
// Ce que le témoin tient, sur le SITE, pour chaque environnement et chaque valeur de
// FC_FORCE_REVENUECAT_RAIL :
//   1. le rail actif est TRUSTED_TEST ou STRIPE_WEB, jamais un autre ;
//   2. il vaut exactement l'ancienne garde (achat permis ⇔ mode test OU rail Stripe) ;
//   3. un achat et un changement d'offre ne partent QUE par ce rail : validation de confiance
//      (`trustedValidation: true`) en mode test, caisse Stripe sinon ; jamais RevenueCat.
import '@/theme/strings';

const ENVIRONNEMENTS = ['local', 'staging', 'production', 'development', 'preview', '', undefined];
const FORCAGES = ['', 'true'];
const CLUB_100_AN = { billingPeriod: 'yearly', planCode: 'fc_club_tier_1_yearly', scopeType: 'CLUB' };

/**
 * Le rail chargé pour un environnement, avec ses doublures.
 * @param {string | undefined} runtimeEnv - L'environnement de l'app.
 * @returns {Record<string, any>} Le module et ses doublures.
 */
const chargerLeRail = (runtimeEnv) => {
  /** @type {Record<string, any>} */
  let charge = {};
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Linking: { openURL: jest.fn() }, Platform: { OS: 'web' } }));
    jest.doMock('@/constants/runtimeFlags', () => ({ APP_RUNTIME_ENV: runtimeEnv }));
    jest.doMock('@/domains/subscription/subscriptionRevenueCat', () => ({
      isRevenueCatEnabled: jest.fn(() => true),
      purchaseSubscriptionViaRevenueCat: jest.fn(),
      restoreRevenueCatPurchases: jest.fn(),
    }));
    jest.doMock('@/services/subscription/subscriptionService', () => ({
      changeSubscriptionPlan: jest.fn(async () => ({})),
      createStripeWebCheckoutSession: jest.fn(async () => ({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' })),
      increaseSubscriptionLicenseeCount: jest.fn(),
      openSubscriptionBillingPortal: jest.fn(),
      restoreSubscriptionPurchases: jest.fn(),
      validateSubscriptionPurchase: jest.fn(async () => ({})),
    }));
    charge = {
      billing: require('@/domains/subscription/subscriptionBilling'),
      rail: require('./subscriptionPurchaseRail'),
      revenueCat: require('@/domains/subscription/subscriptionRevenueCat'),
      rn: require('react-native'),
      service: require('@/services/subscription/subscriptionService'),
    };
  });
  return charge;
};

const CAS = ENVIRONNEMENTS.flatMap((runtimeEnv) => FORCAGES.map((force) => [String(runtimeEnv), runtimeEnv, force]));

describe('FINITIONS16 (re-pointé) — un achat sur le site ne part que par TRUSTED_TEST ou STRIPE_WEB', () => {
  const forcageAvant = process.env.FC_FORCE_REVENUECAT_RAIL;

  beforeEach(() => {
    global.window = /** @type {any} */ ({ location: { assign: jest.fn(), origin: 'https://staging.foundclub.app' } });
  });

  afterEach(() => {
    Reflect.deleteProperty(global, 'window');
    if (forcageAvant === undefined) Reflect.deleteProperty(process.env, 'FC_FORCE_REVENUECAT_RAIL');
    else process.env.FC_FORCE_REVENUECAT_RAIL = forcageAvant;
  });

  it.each(CAS)('environnement %s, forçage « %s »', async (_nom, runtimeEnv, force) => {
    process.env.FC_FORCE_REVENUECAT_RAIL = force;
    const { billing, rail, revenueCat, rn, service } = chargerLeRail(runtimeEnv);
    const { STRIPE_WEB, TRUSTED_TEST } = rail.SUBSCRIPTION_PURCHASE_RAILS;

    // 1. Deux rails, et seulement deux, sur le site.
    const actif = rail.getActiveSubscriptionPurchaseRail(runtimeEnv);
    expect([TRUSTED_TEST, STRIPE_WEB]).toContain(actif);

    // 2. L'ancienne garde du site (train 9) : vraie exactement quand le rail est l'un des deux.
    const ancienneGarde = billing.isSubscriptionBillingTestModeEnabled(runtimeEnv) || actif === STRIPE_WEB;
    expect(ancienneGarde).toBe([TRUSTED_TEST, STRIPE_WEB].includes(actif));
    expect(rail.isSubscriptionPurchaseAvailable()).toBe(ancienneGarde);

    // 3. L'achat, puis le changement d'offre : par ce rail seulement.
    await rail.performSubscriptionPurchase({ catalogEntry: CLUB_100_AN, clubDocumentId: 'club-1' });
    let changement = null;
    try {
      await rail.performSubscriptionPlanChange({
        catalogEntry: CLUB_100_AN, clubDocumentId: 'club-1', subscriptionDocumentId: 'abo-1',
      });
    } catch (erreur) {
      changement = erreur;
    }
    if (actif === TRUSTED_TEST) {
      expect(service.validateSubscriptionPurchase).toHaveBeenCalledTimes(1);
      expect(service.validateSubscriptionPurchase.mock.calls[0][0]).toEqual(
        expect.objectContaining({ trustedValidation: true }),
      );
      expect(service.changeSubscriptionPlan.mock.calls[0][0]).toEqual(
        expect.objectContaining({ trustedValidation: true }),
      );
      expect(service.createStripeWebCheckoutSession).not.toHaveBeenCalled();
    } else {
      expect(service.createStripeWebCheckoutSession).toHaveBeenCalledTimes(1);
      expect(service.validateSubscriptionPurchase).not.toHaveBeenCalled();
      expect(service.changeSubscriptionPlan).not.toHaveBeenCalled();
      expect(changement).not.toBeNull(); // le changement d'offre Stripe reste au téléphone (V1 web)
    }
    expect(revenueCat.purchaseSubscriptionViaRevenueCat).not.toHaveBeenCalled();
    expect(rn.Linking.openURL).not.toHaveBeenCalled();
  });
});
