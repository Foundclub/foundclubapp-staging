import {
  getRevenueCatOfferingIdForPlanCode,
  isRevenueCatEnabled,
  mapRevenueCatStorePricesInCents,
  purchaseSubscriptionViaRevenueCat,
  readRevenueCatStorePricesInCents,
  resetRevenueCatStateForTests,
  resolveRevenueCatPackageForCatalogEntry,
  restoreRevenueCatPurchases,
  REVENUECAT_PURCHASE_ERROR_CODES,
  setRevenueCatApiKeyForTests,
  syncRevenueCatIdentity,
} from './subscriptionRevenueCat';

jest.mock('react-native-purchases', () => {
  const mockPurchases = {
    configure: jest.fn(),
    getOfferings: jest.fn(),
    logIn: jest.fn(async () => ({ created: false })),
    logOut: jest.fn(async () => ({})),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(async () => ({ entitlements: {} })),
    setAttributes: jest.fn(async () => undefined),
  };
  return {
    __esModule: true,
    default: mockPurchases,
    PURCHASES_ERROR_CODE: {
      PAYMENT_PENDING_ERROR: '10',
      PURCHASE_CANCELLED_ERROR: '1',
    },
  };
});

// eslint-disable-next-line global-require
const getMockPurchases = () => require('react-native-purchases').default;

const buildOfferings = () => {
  const buildPackage = (identifier, productIdentifier) => ({
    identifier,
    product: { identifier: productIdentifier },
  });
  return {
    all: {
      fc_club_tier_2: {
        annual: buildPackage('$rc_annual', 'fc_club_tier_2:yearly'),
        availablePackages: [buildPackage('$rc_annual', 'fc_club_tier_2:yearly')],
        monthly: null,
      },
      fc_team_1: {
        annual: buildPackage('$rc_annual', 'fc_team_1_yearly'),
        availablePackages: [
          buildPackage('$rc_monthly', 'fc_team_1:monthly'),
          buildPackage('$rc_annual', 'fc_team_1_yearly'),
        ],
        monthly: buildPackage('$rc_monthly', 'fc_team_1:monthly'),
      },
    },
  };
};

describe('subscriptionRevenueCat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRevenueCatStateForTests();
  });

  it('derive la famille d offering du planCode', () => {
    expect(getRevenueCatOfferingIdForPlanCode('fc_team_1_monthly')).toBe('fc_team_1');
    expect(getRevenueCatOfferingIdForPlanCode('fc_club_tier_3_yearly')).toBe('fc_club_tier_3');
    expect(getRevenueCatOfferingIdForPlanCode('')).toBe('');
  });

  it('resout le package prefere de l offering (mensuel/annuel)', () => {
    const offerings = buildOfferings();
    const monthlyPackage = resolveRevenueCatPackageForCatalogEntry(offerings, {
      billingPeriod: 'monthly',
      planCode: 'fc_team_1_monthly',
    });
    expect(monthlyPackage.product.identifier).toBe('fc_team_1:monthly');

    const yearlyPackage = resolveRevenueCatPackageForCatalogEntry(offerings, {
      billingPeriod: 'yearly',
      planCode: 'fc_club_tier_2_yearly',
    });
    expect(yearlyPackage.product.identifier).toBe('fc_club_tier_2:yearly');
  });

  it('retombe sur la recherche par identifiant produit normalise (Google base plan)', () => {
    const offerings = buildOfferings();
    // Offering absent pour ce planCode : la recherche globale normalisee doit matcher
    // fc_team_1:monthly ≡ fc_team_1_monthly.
    delete offerings.all.fc_team_1.monthly;
    const resolved = resolveRevenueCatPackageForCatalogEntry(offerings, {
      billingPeriod: 'monthly',
      planCode: 'fc_team_1_monthly',
    });
    expect(resolved.product.identifier).toBe('fc_team_1:monthly');

    expect(resolveRevenueCatPackageForCatalogEntry(offerings, {
      billingPeriod: 'monthly',
      planCode: 'fc_inconnu_monthly',
    })).toBeNull();
  });

  it('reste inerte sans cle SDK', async () => {
    expect(isRevenueCatEnabled()).toBe(false);
    await expect(purchaseSubscriptionViaRevenueCat({
      catalogEntry: { billingPeriod: 'monthly', planCode: 'fc_team_1_monthly' },
      payerUserDocumentId: 'user-1',
    })).rejects.toThrow('Checkout indisponible');
    expect(await restoreRevenueCatPurchases()).toBeNull();
    expect(getMockPurchases().configure).not.toHaveBeenCalled();
  });

  it('achat complet : identite, attributs, package, transaction', async () => {
    setRevenueCatApiKeyForTests('appl_test');
    const Purchases = getMockPurchases();
    Purchases.getOfferings.mockResolvedValue(buildOfferings());
    Purchases.purchasePackage.mockResolvedValue({
      customerInfo: { originalAppUserId: 'user-1' },
      productIdentifier: 'fc_team_1:monthly',
      transaction: { transactionIdentifier: 'GPA.1234' },
    });

    const result = await purchaseSubscriptionViaRevenueCat({
      catalogEntry: { billingPeriod: 'monthly', planCode: 'fc_team_1_monthly' },
      payerUserDocumentId: 'user-1',
      platform: 'ios',
      teamDocumentIds: ['team-a', ''],
    });

    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'appl_test' });
    expect(Purchases.logIn).toHaveBeenCalledWith('user-1');
    expect(Purchases.setAttributes).toHaveBeenCalledWith({
      clubDocumentId: null,
      teamDocumentIds: JSON.stringify(['team-a']),
    });
    const [purchasedPackage, upgradeInfo, changeInfo] = Purchases.purchasePackage.mock.calls[0];
    expect(purchasedPackage.product.identifier).toBe('fc_team_1:monthly');
    expect(upgradeInfo).toBeNull();
    expect(changeInfo).toBeNull();
    expect(result.transactionIdentifier).toBe('GPA.1234');
    expect(result.productIdentifier).toBe('fc_team_1:monthly');
  });

  it('changement de plan Android : googleProductChangeInfo avec la famille du plan actif', async () => {
    setRevenueCatApiKeyForTests('goog_test');
    const Purchases = getMockPurchases();
    Purchases.getOfferings.mockResolvedValue(buildOfferings());
    Purchases.purchasePackage.mockResolvedValue({
      customerInfo: {},
      productIdentifier: 'fc_club_tier_2:yearly',
      transaction: { transactionIdentifier: 'GPA.5678' },
    });

    await purchaseSubscriptionViaRevenueCat({
      catalogEntry: { billingPeriod: 'yearly', planCode: 'fc_club_tier_2_yearly' },
      currentPlanCode: 'fc_team_1_monthly',
      payerUserDocumentId: 'user-1',
      platform: 'android',
    });

    const [, , changeInfo] = Purchases.purchasePackage.mock.calls[0];
    expect(changeInfo).toEqual({ oldProductIdentifier: 'fc_team_1' });
  });

  it('mappe l annulation et le paiement en attente sur des erreurs typees', async () => {
    setRevenueCatApiKeyForTests('appl_test');
    const Purchases = getMockPurchases();
    Purchases.getOfferings.mockResolvedValue(buildOfferings());

    Purchases.purchasePackage.mockRejectedValueOnce({ code: '1', userCancelled: true });
    await expect(purchaseSubscriptionViaRevenueCat({
      catalogEntry: { billingPeriod: 'monthly', planCode: 'fc_team_1_monthly' },
      payerUserDocumentId: 'user-1',
      platform: 'ios',
    })).rejects.toMatchObject({
      code: REVENUECAT_PURCHASE_ERROR_CODES.CANCELLED,
      message: 'Achat annulé. Ton brouillon est toujours là.',
    });

    Purchases.purchasePackage.mockRejectedValueOnce({ code: '10', userCancelled: false });
    await expect(purchaseSubscriptionViaRevenueCat({
      catalogEntry: { billingPeriod: 'monthly', planCode: 'fc_team_1_monthly' },
      payerUserDocumentId: 'user-1',
      platform: 'ios',
    })).rejects.toMatchObject({ code: REVENUECAT_PURCHASE_ERROR_CODES.PENDING });
  });

  it('synchronise l identite sans doublon et gere la deconnexion', async () => {
    setRevenueCatApiKeyForTests('appl_test');
    const Purchases = getMockPurchases();

    await syncRevenueCatIdentity('user-1');
    await syncRevenueCatIdentity('user-1');
    expect(Purchases.logIn).toHaveBeenCalledTimes(1);

    await syncRevenueCatIdentity('');
    expect(Purchases.logOut).toHaveBeenCalledTimes(1);

    // Deconnexion repetee : pas de second logOut (deja anonyme).
    await syncRevenueCatIdentity(null);
    expect(Purchases.logOut).toHaveBeenCalledTimes(1);
  });

  it('restore : aligne l identite connue puis restaure via le SDK', async () => {
    setRevenueCatApiKeyForTests('appl_test');
    const Purchases = getMockPurchases();
    await syncRevenueCatIdentity('user-1');
    Purchases.logIn.mockClear();

    await restoreRevenueCatPurchases();
    expect(Purchases.logIn).not.toHaveBeenCalled();
    expect(Purchases.restorePurchases).toHaveBeenCalledTimes(1);
  });
});

/* L39 — le prix affiche doit etre celui du store. Il est lu sur LE MEME package
   que celui qui sera achete : c'est ce qui garantit qu'afficher et facturer ne
   peuvent pas diverger. */
describe('subscriptionRevenueCat — prix du store', () => {
  const CATALOG_ENTRIES = [
    { billingPeriod: 'monthly', planCode: 'fc_team_1_monthly', scopeType: 'TEAM' },
    { billingPeriod: 'yearly', planCode: 'fc_team_1_yearly', scopeType: 'TEAM' },
  ];

  /**
   * Package store portant un identifiant produit et un prix.
   * @param {string} productIdentifier
   * @param {any} product
   * @returns {any}
   */
  const buildPricedPackage = (productIdentifier, product) => ({
    identifier: '$rc_package',
    product: { currencyCode: 'EUR', identifier: productIdentifier, ...product },
  });

  /**
   * Offerings RevenueCat de la famille `fc_team_1`, prix compris.
   * @param {any} [surcharges]
   * @returns {any}
   */
  const buildPricedOfferings = (surcharges = {}) => ({
    all: {
      fc_team_1: {
        // Identifiant Google (`famille:basePlan`) cote mensuel, Apple cote annuel :
        // les deux conventions coexistent vraiment dans ce projet.
        annual: buildPricedPackage('fc_team_1_yearly', { price: 59.99 }),
        availablePackages: [
          buildPricedPackage('fc_team_1:monthly', { price: 7.99 }),
          buildPricedPackage('fc_team_1_yearly', { price: 59.99 }),
        ],
        monthly: buildPricedPackage('fc_team_1:monthly', { price: 7.99 }),
        ...surcharges,
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetRevenueCatStateForTests();
  });

  it('lit le prix du package qui sera ACHETE, les deux conventions d identifiant comprises', () => {
    expect(mapRevenueCatStorePricesInCents(buildPricedOfferings(), CATALOG_ENTRIES)).toEqual({
      fc_team_1_monthly: 799,
      fc_team_1_yearly: 5999,
    });
  });

  it('un palier sans package n est PAS invente : il manque, tout simplement', () => {
    const offerings = buildPricedOfferings();
    offerings.all.fc_team_1.annual = null;
    offerings.all.fc_team_1.availablePackages = [
      buildPricedPackage('fc_team_1:monthly', { price: 7.99 }),
    ];

    expect(mapRevenueCatStorePricesInCents(offerings, CATALOG_ENTRIES))
      .toEqual({ fc_team_1_monthly: 799 });
  });

  // Toute la mise en forme de l'app est en euros (« 7,99 €/mois »). Afficher un
  // prix en dollars avec ce suffixe serait un faux prix, pas une approximation.
  it('un prix rendu dans une autre devise est ecarte, jamais affiche avec un €', () => {
    const offerings = buildPricedOfferings();
    offerings.all.fc_team_1.monthly = buildPricedPackage('fc_team_1:monthly', {
      currencyCode: 'USD',
      price: 8.99,
    });
    offerings.all.fc_team_1.availablePackages = [offerings.all.fc_team_1.monthly];

    expect(mapRevenueCatStorePricesInCents(offerings, CATALOG_ENTRIES))
      .toEqual({ fc_team_1_yearly: 5999 });
  });

  // C'est aussi le cas du WEB, ou Purchases n'existe pas : la vente y passe par
  // Stripe et le prix doit rester celui du serveur.
  it('sans SDK store, la lecture rend null sans rien appeler', async () => {
    expect(await readRevenueCatStorePricesInCents(CATALOG_ENTRIES)).toBeNull();
    expect(getMockPurchases().getOfferings).not.toHaveBeenCalled();
  });

  it('store injoignable : la lecture rend null au lieu de propager', async () => {
    setRevenueCatApiKeyForTests('appl_test');
    getMockPurchases().getOfferings.mockRejectedValueOnce(new Error('offline'));

    expect(await readRevenueCatStorePricesInCents(CATALOG_ENTRIES)).toBeNull();
  });

  it('store joignable : la lecture rend les prix en centimes', async () => {
    setRevenueCatApiKeyForTests('appl_test');
    getMockPurchases().getOfferings.mockResolvedValueOnce(buildPricedOfferings());

    expect(await readRevenueCatStorePricesInCents(CATALOG_ENTRIES)).toEqual({
      fc_team_1_monthly: 799,
      fc_team_1_yearly: 5999,
    });
  });
});
