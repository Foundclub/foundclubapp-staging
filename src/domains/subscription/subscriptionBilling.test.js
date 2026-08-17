import {
  buildSubscriptionChangePlanPayload,
  buildSubscriptionPurchasePayload,
  findSubscriptionMonthlySiblingEntry,
  formatSubscriptionYearlyDiscountLabel,
  getInitialTeamSelection,
  getSubscriptionBillingErrorMessage,
  getSubscriptionCatalogEntryMeta,
  getSubscriptionEntryTierRank,
  getSubscriptionTestProvider,
  isSubscriptionBillingTestModeEnabled,
  resolveSubscriptionCatalogPrices,
  sortSubscriptionCatalogEntries,
} from './subscriptionBilling';

describe('subscriptionBilling', () => {
  test('enables billing test mode in local and staging only', () => {
    expect(isSubscriptionBillingTestModeEnabled('local')).toBe(true);
    expect(isSubscriptionBillingTestModeEnabled('staging')).toBe(true);
    expect(isSubscriptionBillingTestModeEnabled('production')).toBe(false);
  });

  test('resolves test provider from platform', () => {
    expect(getSubscriptionTestProvider('ios')).toBe('apple');
    expect(getSubscriptionTestProvider('android')).toBe('google');
  });

  test('sorts Team offers before Club offers', () => {
    const sortedEntries = sortSubscriptionCatalogEntries([
      { billingPeriod: 'yearly', planCode: 'fc_club_tier_1_yearly', scopeType: 'CLUB' },
      {
        billingPeriod: 'monthly', planCode: 'fc_team_2_monthly', scopeType: 'TEAM', slotCount: 2,
      },
      {
        billingPeriod: 'monthly', planCode: 'fc_team_1_monthly', scopeType: 'TEAM', slotCount: 1,
      },
    ]);

    expect(sortedEntries.map((entry) => entry.planCode)).toEqual([
      'fc_team_1_monthly',
      'fc_team_2_monthly',
      'fc_club_tier_1_yearly',
    ]);
  });

  test('builds readable offer meta from the catalog', () => {
    expect(getSubscriptionCatalogEntryMeta({
      billingPeriod: 'monthly',
      planCode: 'fc_team_2_monthly',
      scopeType: 'TEAM',
      slotCount: 2,
    })).toEqual({
      description: 'Publie et gère les équipes couvertes par ton offre Équipe.',
      label: 'Équipe · 2 équipes / mois',
      priceLabel: '',
      secondaryLabel: '2 équipes couvertes - Mensuel',
    });
  });

  test('uses server displayName and reference price when the catalog provides them', () => {
    expect(getSubscriptionCatalogEntryMeta({
      billingPeriod: 'yearly',
      displayName: 'Équipe · 1 équipe',
      planCode: 'fc_team_1_yearly',
      referencePriceEurCents: 5999,
      scopeType: 'TEAM',
      slotCount: 1,
    })).toEqual({
      description: 'Publie et gère les équipes couvertes par ton offre Équipe.',
      label: 'Équipe · 1 équipe',
      priceLabel: '59,99 €/an',
      secondaryLabel: '1 équipe couverte - Annuel - 59,99 €/an',
    });
  });

  test('prefills currently covered teams first', () => {
    expect(getInitialTeamSelection({
      availableTeams: [
        { documentId: 'team-1', name: 'Alpha' },
        { documentId: 'team-2', name: 'Beta' },
      ],
      coveredTeamDocumentIds: ['team-2'],
      slotCount: 2,
    })).toEqual(['team-2']);
  });

  test('builds stable non-prod purchase payloads', () => {
    const now = new Date('2026-07-07T10:00:00.000Z');

    expect(buildSubscriptionPurchasePayload({
      catalogEntry: {
        billingPeriod: 'monthly',
        planCode: 'fc_team_1_monthly',
        providerProductId: 'fc_team_1_monthly',
      },
      now,
      provider: 'google',
      teamDocumentIds: ['team-1'],
      trustedValidation: true,
    })).toMatchObject({
      autoRenew: true,
      billingPeriod: 'monthly',
      planCode: 'fc_team_1_monthly',
      provider: 'google',
      providerEventId: 'fc-test-purchase-fc_team_1_monthly-1783418400000',
      providerProductId: 'fc_team_1_monthly',
      providerTransactionId: 'fc-test-transaction-fc_team_1_monthly-1783418400000',
      status: 'active',
      teamDocumentIds: ['team-1'],
      trustedValidation: true,
    });
  });

  test('builds stable change-plan payloads', () => {
    const now = new Date('2026-07-07T10:00:00.000Z');

    expect(buildSubscriptionChangePlanPayload({
      catalogEntry: {
        billingPeriod: 'yearly',
        planCode: 'fc_club_tier_1_yearly',
        providerProductId: 'fc_club_tier_1_yearly',
      },
      clubDocumentId: 'club-1',
      now,
      provider: 'apple',
      subscriptionDocumentId: 'subscription-1',
      trustedValidation: true,
    })).toMatchObject({
      autoRenew: true,
      billingPeriod: 'yearly',
      clubDocumentId: 'club-1',
      nextPlanCode: 'fc_club_tier_1_yearly',
      nextProviderProductId: 'fc_club_tier_1_yearly',
      provider: 'apple',
      providerEventId: 'fc-test-change-fc_club_tier_1_yearly-1783418400000',
      status: 'active',
      subscriptionDocumentId: 'subscription-1',
      trustedValidation: true,
    });
  });

  test('maps Team slot errors to actionable copy', () => {
    expect(getSubscriptionBillingErrorMessage({ message: 'TEAM_SLOT_COUNT_EXCEEDED' }))
      .toBe('Cette offre n a pas assez de places pour couvrir autant d équipes. Ajuste la sélection avant de continuer.');
  });

  test('reads the tier rank from slot count (Team) or plan code (Club)', () => {
    expect(getSubscriptionEntryTierRank({ scopeType: 'TEAM', slotCount: 3 })).toBe(3);
    expect(getSubscriptionEntryTierRank({ planCode: 'fc_club_tier_2_yearly', scopeType: 'CLUB' })).toBe(2);
    expect(getSubscriptionEntryTierRank(null)).toBe(0);
  });

  // L33 — les six paliers du catalogue serveur portent DEUX grilles de remise.
  // Un tag global « 2 mois offerts » (= 17 %) est faux pour la moitie d'entre
  // eux : c'est pour ca que le badge est calcule par carte.
  test('computes the real yearly discount, which differs between Team and Club', () => {
    expect(formatSubscriptionYearlyDiscountLabel(799, 5999)).toBe('−37 %');
    expect(formatSubscriptionYearlyDiscountLabel(1299, 9999)).toBe('−36 %');
    expect(formatSubscriptionYearlyDiscountLabel(1699, 12999)).toBe('−36 %');
    expect(formatSubscriptionYearlyDiscountLabel(1999, 19999)).toBe('−17 %');
    expect(formatSubscriptionYearlyDiscountLabel(3499, 34999)).toBe('−17 %');
    expect(formatSubscriptionYearlyDiscountLabel(5499, 54999)).toBe('−17 %');
  });

  test('never invents a discount when a price is missing or the yearly is not cheaper', () => {
    expect(formatSubscriptionYearlyDiscountLabel(null, 5999)).toBe('');
    expect(formatSubscriptionYearlyDiscountLabel(799, null)).toBe('');
    expect(formatSubscriptionYearlyDiscountLabel(0, 5999)).toBe('');
    expect(formatSubscriptionYearlyDiscountLabel(799, 9588)).toBe('');
    expect(formatSubscriptionYearlyDiscountLabel(799, 12000)).toBe('');
  });

  // L38 — les TROIS surfaces de vente ont besoin des deux prix d'un meme palier
  // pour calculer sa remise. La recherche de la jumelle vit ici, une seule fois.
  test('finds the monthly twin of a yearly entry, by scope AND tier', () => {
    const catalog = [
      {
        billingPeriod: 'monthly',
        planCode: 'fc_team_1_monthly',
        scopeType: 'TEAM',
        slotCount: 1,
      },
      {
        billingPeriod: 'monthly',
        planCode: 'fc_team_2_monthly',
        scopeType: 'TEAM',
        slotCount: 2,
      },
      {
        billingPeriod: 'monthly',
        planCode: 'fc_club_tier_1_monthly',
        scopeType: 'CLUB',
      },
      {
        billingPeriod: 'yearly',
        planCode: 'fc_team_2_yearly',
        scopeType: 'TEAM',
        slotCount: 2,
      },
    ];

    // Le palier 2 d'Équipe ne doit JAMAIS retomber sur le palier 1, ni sur Club :
    // ce sont deux grilles differentes, la remise en dependrait entierement.
    expect(findSubscriptionMonthlySiblingEntry(catalog, catalog[3]).planCode)
      .toBe('fc_team_2_monthly');
    expect(findSubscriptionMonthlySiblingEntry(catalog, {
      billingPeriod: 'yearly', planCode: 'fc_club_tier_1_yearly', scopeType: 'CLUB',
    }).planCode).toBe('fc_club_tier_1_monthly');
  });

  test('returns null rather than a wrong twin when the catalogue is partial', () => {
    // Palier absent du catalogue mensuel : aucune remise ne pourra etre calculee,
    // et c'est voulu — mieux vaut ne rien annoncer qu'annoncer un chiffre faux.
    expect(findSubscriptionMonthlySiblingEntry([], {
      billingPeriod: 'yearly', scopeType: 'TEAM', slotCount: 1,
    })).toBeNull();
    expect(findSubscriptionMonthlySiblingEntry(null, {
      billingPeriod: 'yearly', scopeType: 'TEAM', slotCount: 1,
    })).toBeNull();
    const monthlyOnly = [{ billingPeriod: 'monthly', scopeType: 'TEAM', slotCount: 1 }];
    expect(findSubscriptionMonthlySiblingEntry(monthlyOnly, null)).toBeNull();
  });
});

/* L39 — le prix AFFICHE devient celui du STORE (c'est le seul que le client
   paiera), le catalogue serveur reste le repli, et tout desaccord est mesure. */
describe('resolveSubscriptionCatalogPrices', () => {
  const SERVER_ENTRIES = [
    {
      billingPeriod: 'monthly',
      planCode: 'fc_team_1_monthly',
      referencePriceEurCents: 799,
      scopeType: 'TEAM',
      slotCount: 1,
    },
    {
      billingPeriod: 'yearly',
      planCode: 'fc_team_1_yearly',
      referencePriceEurCents: 5999,
      scopeType: 'TEAM',
      slotCount: 1,
    },
    {
      billingPeriod: 'monthly',
      planCode: 'fc_club_tier_1_monthly',
      referencePriceEurCents: 1999,
      scopeType: 'CLUB',
    },
    {
      billingPeriod: 'yearly',
      planCode: 'fc_club_tier_1_yearly',
      referencePriceEurCents: 19999,
      scopeType: 'CLUB',
    },
  ];

  /**
   * Prix de chaque entree, indexes par code de plan.
   * @param {any[]} entries
   * @returns {Record<string, number>}
   */
  const pricesByPlanCode = (entries) => Object.fromEntries(
    entries.map((entry) => [entry.planCode, entry.referencePriceEurCents]),
  );

  test('sans prix du store, le catalogue serveur est rendu tel quel', () => {
    [null, undefined, {}].forEach((storePricesEurCents) => {
      const resolved = resolveSubscriptionCatalogPrices({
        serverEntries: SERVER_ENTRIES,
        storePricesEurCents,
      });

      expect(resolved.entries).toBe(SERVER_ENTRIES);
      expect(resolved.mismatches).toEqual([]);
      expect(resolved.missingFromStorePlanCodes).toEqual([]);
    });
  });

  test('le prix du store remplace celui du serveur', () => {
    const resolved = resolveSubscriptionCatalogPrices({
      serverEntries: SERVER_ENTRIES,
      storePricesEurCents: {
        fc_club_tier_1_monthly: 1999,
        fc_club_tier_1_yearly: 19999,
        fc_team_1_monthly: 199,
        fc_team_1_yearly: 1299,
      },
    });

    expect(pricesByPlanCode(resolved.entries)).toEqual({
      fc_club_tier_1_monthly: 1999,
      fc_club_tier_1_yearly: 19999,
      fc_team_1_monthly: 199,
      fc_team_1_yearly: 1299,
    });
  });

  // Le garde-fou central : `formatSubscriptionYearlyDiscountLabel` divise
  // l'annuel par douze mensualites. Un annuel store face a un mensuel serveur
  // donnerait ici 1 − 1299 / (799 × 12) = 86 % de remise — une remise inventee.
  test('un palier a moitie present dans le store reste ENTIEREMENT au serveur', () => {
    const resolved = resolveSubscriptionCatalogPrices({
      serverEntries: SERVER_ENTRIES,
      storePricesEurCents: { fc_team_1_yearly: 1299 },
    });

    expect(pricesByPlanCode(resolved.entries)).toEqual({
      fc_club_tier_1_monthly: 1999,
      fc_club_tier_1_yearly: 19999,
      fc_team_1_monthly: 799,
      fc_team_1_yearly: 5999,
    });
    // L'ecart est quand meme remonte, en disant que c'est le serveur qu'on affiche.
    expect(resolved.mismatches).toEqual([{
      planCode: 'fc_team_1_yearly',
      retainedSource: 'server',
      serverPriceEurCents: 5999,
      storePriceEurCents: 1299,
    }]);
  });

  test('un ecart d UN centime suffit : c est une configuration desaccordee, pas un arrondi', () => {
    const resolved = resolveSubscriptionCatalogPrices({
      serverEntries: SERVER_ENTRIES,
      storePricesEurCents: {
        ...pricesByPlanCode(SERVER_ENTRIES),
        fc_club_tier_1_yearly: 20000,
      },
    });

    expect(resolved.mismatches).toEqual([{
      planCode: 'fc_club_tier_1_yearly',
      retainedSource: 'store',
      serverPriceEurCents: 19999,
      storePriceEurCents: 20000,
    }]);
  });

  test('TEMOIN NEGATIF — store et serveur d accord : aucun ecart, aucun manquant', () => {
    const resolved = resolveSubscriptionCatalogPrices({
      serverEntries: SERVER_ENTRIES,
      storePricesEurCents: pricesByPlanCode(SERVER_ENTRIES),
    });

    expect(resolved.mismatches).toEqual([]);
    expect(resolved.missingFromStorePlanCodes).toEqual([]);
  });

  // `fc_trial_team` (essai 30 j, prix 0) partage EXACTEMENT la famille de
  // `fc_team_1`. Sans garde, l'activer un jour bloquerait en silence les prix du
  // store sur le palier le plus vendu — le genre de panne muette que ce lot
  // existe pour supprimer.
  test('une ligne sans prix vendable n empeche pas sa famille de basculer', () => {
    const resolved = resolveSubscriptionCatalogPrices({
      serverEntries: [
        ...SERVER_ENTRIES,
        {
          billingPeriod: 'manual',
          planCode: 'fc_trial_team',
          referencePriceEurCents: 0,
          scopeType: 'TEAM',
          slotCount: 1,
        },
      ],
      storePricesEurCents: { fc_team_1_monthly: 199, fc_team_1_yearly: 1299 },
    });

    expect(pricesByPlanCode(resolved.entries).fc_team_1_yearly).toBe(1299);
    expect(resolved.missingFromStorePlanCodes).not.toContain('fc_trial_team');
  });

  // Reglage de boutique, pas un defaut de code : le palier absent garde le prix
  // du serveur et reste vendable, mais quelqu'un doit le configurer.
  test('un palier absent du store est NOMME, jamais invente ni masque', () => {
    const resolved = resolveSubscriptionCatalogPrices({
      serverEntries: SERVER_ENTRIES,
      storePricesEurCents: { fc_team_1_monthly: 799, fc_team_1_yearly: 5999 },
    });

    expect(resolved.missingFromStorePlanCodes).toEqual([
      'fc_club_tier_1_monthly',
      'fc_club_tier_1_yearly',
    ]);
    expect(pricesByPlanCode(resolved.entries).fc_club_tier_1_yearly).toBe(19999);
  });
});
