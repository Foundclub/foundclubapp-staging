import {
  buildSubscriptionChangePlanPayload,
  buildSubscriptionPurchasePayload,
  formatSubscriptionYearlyDiscountLabel,
  getInitialTeamSelection,
  getSubscriptionBillingErrorMessage,
  getSubscriptionCatalogEntryMeta,
  getSubscriptionEntryTierRank,
  getSubscriptionTestProvider,
  isSubscriptionBillingTestModeEnabled,
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
      description: 'Publie et gère les équipes couvertes par tes slots Team.',
      label: 'Team 2 equipes / mois',
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
      description: 'Publie et gère les équipes couvertes par tes slots Team.',
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
      .toBe('Cette offre n a pas assez de slots pour couvrir autant d équipes. Ajuste la sélection avant de continuer.');
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
});
