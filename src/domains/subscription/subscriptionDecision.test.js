import {
  extractSubscriptionDecisionFromError,
  formatSubscriptionPlanLabel,
  formatSubscriptionRequiredPlanText,
  getCoveredTeamCount,
  getSubscriptionAccessLevel,
  getSubscriptionPaywallContent,
  getSubscriptionPlanLabels,
  getSubscriptionQuotaItem,
  getSubscriptionQuotaItems,
  getSubscriptionRequiredPlanLabels,
  getSubscriptionStatusMeta,
  getSubscriptionTeamSlotSummary,
  mapSubscriptionDecisionToPaywall,
} from './subscriptionDecision';

describe('subscriptionDecision', () => {
  test('derives CLUB_UNVERIFIED from backend summaries without legacy flags', () => {
    expect(getSubscriptionAccessLevel({
      clubVerificationSummary: {
        clubPartner: true,
        clubVerified: false,
      },
      entitlementsSummary: [],
      subscriptionSummary: {
        hasClubPlan: true,
        hasTeamPlan: false,
        hasVerifiedClubPlan: false,
        requiresClubVerification: true,
      },
      userClub: {
        clubPartner: true,
        clubVerified: false,
      },
    })).toBe('CLUB_UNVERIFIED');
  });

  test('maps server refusal payloads to stable paywall metadata', () => {
    expect(mapSubscriptionDecisionToPaywall({
      allowed: false,
      paywall: 'EVENT_LIMIT',
      reason: 'FREE_QUOTA_EXHAUSTED',
      remainingFreeUses: 0,
      requiredPlan: ['TEAM', 'CLUB'],
    })).toEqual({
      allowed: false,
      message: 'Quota gratuit epuise',
      paywall: 'EVENT_LIMIT',
      paywallKey: 'event-limit',
      reason: 'FREE_QUOTA_EXHAUSTED',
      remainingFreeUses: 0,
      requiredPlan: ['TEAM', 'CLUB'],
    });
  });

  test('extracts subscription decisions from policy-style backend errors', () => {
    expect(extractSubscriptionDecisionFromError({
      details: {
        code: 'SUBSCRIPTION_PERMISSION_DENIED',
        decision: {
          allowed: false,
          paywall: 'TEAM_LIMIT',
          reason: 'FREE_QUOTA_EXHAUSTED',
          remainingFreeUses: 0,
          requiredPlan: ['TEAM', 'CLUB'],
        },
      },
      message: 'Cette fonctionnalite necessite une offre FoundClub active.',
      name: 'PolicyError',
      status: 403,
    })).toEqual({
      allowed: false,
      paywall: 'TEAM_LIMIT',
      reason: 'FREE_QUOTA_EXHAUSTED',
      remainingFreeUses: 0,
      requiredPlan: ['TEAM', 'CLUB'],
    });
  });

  test('formats plan requirements and paywall copy for reusable mobile sheets', () => {
    expect(getSubscriptionRequiredPlanLabels(['TEAM', 'CLUB', 'TEAM'])).toEqual(['Team', 'Club']);
    expect(formatSubscriptionRequiredPlanText(['TEAM', 'CLUB'])).toBe('Team ou Club');
    expect(getSubscriptionPaywallContent({
      allowed: false,
      paywall: 'EVENT_LIMIT',
      reason: 'FREE_QUOTA_EXHAUSTED',
      requiredPlan: ['TEAM', 'CLUB'],
    })).toEqual({
      ctaLabel: 'Voir mon abonnement',
      description: 'Tu as atteint la limite gratuite de publication d evenements. Offre conseillee: Team ou Club.',
      title: 'Publication d evenement limitee',
    });
  });

  test('formats plan labels and team coverage summaries for the profile UI', () => {
    expect(formatSubscriptionPlanLabel('fc_team_2_yearly')).toBe('Team 2 equipes / an');
    expect(getSubscriptionPlanLabels({
      activePlanCodes: ['fc_team_2_yearly', 'fc_club_tier_1_monthly'],
      teamSlotSummary: {
        assigned: 1,
        available: 1,
        coveredTeamDocumentIds: ['team-1'],
        total: 2,
      },
    })).toEqual(['Team 2 equipes / an', 'Club tier 1 / mois']);
    expect(getSubscriptionTeamSlotSummary({
      teamSlotSummary: {
        assigned: 1,
        available: 1,
        coveredTeamDocumentIds: ['team-1', 'team-1'],
        total: 2,
      },
    })).toEqual({
      assigned: 1,
      available: 1,
      coveredTeamDocumentIds: ['team-1'],
      total: 2,
    });
    expect(getCoveredTeamCount([
      {
        scopeTeamDocumentId: 'team-1',
        scopeType: 'TEAM',
      },
      {
        scopeTeamDocumentId: 'team-2',
        scopeType: 'TEAM',
      },
      {
        scopeType: 'CLUB',
      },
    ], {
      teamSlotSummary: {
        coveredTeamDocumentIds: ['team-2', 'team-3'],
      },
    })).toBe(3);
  });

  test('keeps free quota counters visible only for FREE and CLUB_UNVERIFIED states', () => {
    const freeUsageSummary = [
      {
        limit: 1,
        quotaType: 'EVENT_PUBLISH',
        remaining: 0,
        used: 1,
      },
      {
        limit: 2,
        quotaType: 'PROFILE_CONTACT',
        remaining: 1,
        used: 1,
      },
      {
        limit: 1,
        quotaType: 'PROFILE_CONTACT',
        remaining: 1,
        teamDocumentId: 'team-1',
        used: 0,
      },
    ];

    expect(getSubscriptionQuotaItems(freeUsageSummary, 'FREE')).toEqual([
      {
        label: 'Evenements',
        quotaType: 'EVENT_PUBLISH',
        remaining: 0,
        total: 1,
        used: 1,
      },
      {
        label: 'Contacts',
        quotaType: 'PROFILE_CONTACT',
        remaining: 2,
        total: 3,
        used: 1,
      },
    ]);
    expect(getSubscriptionQuotaItems(freeUsageSummary, 'CLUB_UNVERIFIED')).toHaveLength(2);
    expect(getSubscriptionQuotaItems(freeUsageSummary, 'TEAM')).toEqual([]);
    expect(getSubscriptionQuotaItems(freeUsageSummary, 'CLUB')).toEqual([]);
    expect(getSubscriptionQuotaItem(freeUsageSummary, 'EVENT_PUBLISH', 'FREE')).toEqual({
      label: 'Evenements',
      quotaType: 'EVENT_PUBLISH',
      remaining: 0,
      total: 1,
      used: 1,
    });
    expect(getSubscriptionQuotaItem(freeUsageSummary, 'EVENT_PUBLISH', 'TEAM')).toBeNull();
  });

  test('exposes stable subscription status copy for UI surfaces', () => {
    expect(getSubscriptionStatusMeta('FREE')).toEqual({
      description: 'Vous utilisez actuellement les quotas gratuits FoundClub.',
      label: 'Gratuit',
    });
    expect(getSubscriptionStatusMeta('CLUB_UNVERIFIED')).toEqual({
      description: 'Votre offre Club est active, mais les droits club restent bloques tant que la verification n est pas terminee.',
      label: 'Club a verifier',
    });
  });

  test('does not infer CLUB_UNVERIFIED from the commercial partner flag alone', () => {
    expect(getSubscriptionAccessLevel({
      entitlementsSummary: [],
      subscriptionSummary: {
        hasClubPlan: false,
        hasTeamPlan: false,
        hasVerifiedClubPlan: false,
        requiresClubVerification: false,
      },
    })).toBe('FREE');
  });
});
