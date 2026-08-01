import {
  extractSubscriptionDecisionFromError,
  formatSubscriptionPlanLabel,
  formatSubscriptionRequiredPlanText,
  getCoveredTeamCount,
  getSubscriptionAccessLevel,
  getSubscriptionPaywallBenefits,
  getSubscriptionPaywallContent,
  getSubscriptionPlanLabels,
  getSubscriptionQuotaItem,
  getSubscriptionQuotaItems,
  getSubscriptionQuotaSheetContent,
  getSubscriptionRecommendedPlanCode,
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
      message: 'Quota gratuit épuisé',
      paywall: 'EVENT_LIMIT',
      paywallKey: 'event-limit',
      reason: 'FREE_QUOTA_EXHAUSTED',
      remainingFreeUses: 0,
      requiredPlan: ['TEAM', 'CLUB'],
    });
  });

  test('maps the composition plan-only refusal to its dedicated paywall and sheet', () => {
    const decision = {
      allowed: false,
      paywall: 'COMPOSITION_MANAGE_REQUIRED',
      reason: 'SUBSCRIPTION_REQUIRED',
      remainingFreeUses: 0,
      requiredPlan: ['TEAM', 'CLUB'],
    };

    expect(mapSubscriptionDecisionToPaywall(decision).paywallKey).toBe('composition-required');
    expect(getSubscriptionPaywallContent(decision)).toEqual({
      ctaLabel: 'Voir mon abonnement',
      description: 'La composition d équipe est réservée a l offre Équipe. Offre conseillée: Team ou Club.',
      title: 'Composition réservée',
    });
    expect(getSubscriptionQuotaSheetContent(decision)).toMatchObject({
      kicker: 'Offre Équipe',
      preselectedSlotCount: 1,
      title: "La composition d'équipe est réservée à l'offre Équipe",
    });
    expect(getSubscriptionPaywallBenefits(decision)).toHaveLength(3);
  });

  test('routes the club action paywall keys emitted by the server to their dedicated copy', () => {
    // Le serveur derive la cle de l'action refusee :
    // `facility.manage` -> `FACILITY_MANAGE_REQUIRED`.
    expect(getSubscriptionPaywallContent({
      allowed: false,
      paywall: 'DUES_CAMPAIGN_CREATE_REQUIRED',
      reason: 'SUBSCRIPTION_REQUIRED',
      requiredPlan: ['TEAM', 'CLUB'],
    })).toEqual({
      ctaLabel: 'Voir mon abonnement',
      description: 'La création de campagnes de cotisation demande une offre active.'
        + ' Offre conseillée: Team ou Club.',
      title: 'Cotisations réservées',
    });
    expect(getSubscriptionPaywallContent({
      allowed: false,
      paywall: 'FACILITY_MANAGE_REQUIRED',
      reason: 'SUBSCRIPTION_REQUIRED',
      requiredPlan: ['CLUB'],
    })).toEqual({
      ctaLabel: 'Voir mon abonnement',
      description: 'La gestion des installations du club est réservée a l offre Club.'
        + ' Offre conseillée: Club.',
      title: 'Installations réservées',
    });
    expect(getSubscriptionPaywallContent({
      allowed: false,
      paywall: 'CLUB_UPDATE_REQUIRED',
      reason: 'SUBSCRIPTION_REQUIRED',
      requiredPlan: ['CLUB'],
    })).toEqual({
      ctaLabel: 'Voir mon abonnement',
      description: 'La modification de la fiche du club est réservée a l offre Club.'
        + ' Offre conseillée: Club.',
      title: 'Fiche club réservée',
    });
    expect(getSubscriptionPaywallContent({
      allowed: false,
      paywall: 'SPONSOR_MANAGE_REQUIRED',
      reason: 'SUBSCRIPTION_REQUIRED',
      requiredPlan: ['CLUB'],
    })).toEqual({
      ctaLabel: 'Voir mon abonnement',
      description: 'La gestion des sponsors du club est réservée a l offre Club.'
        + ' Offre conseillée: Club.',
      title: 'Sponsors reserves',
    });
    expect(getSubscriptionPaywallContent({
      allowed: false,
      paywall: 'CLUB_ROLES_MANAGE_REQUIRED',
      reason: 'SUBSCRIPTION_REQUIRED',
      requiredPlan: ['CLUB'],
    })).toEqual({
      ctaLabel: 'Voir mon abonnement',
      description: 'La gestion des rôles et des droits du club est réservée a l offre Club.'
        + ' Offre conseillée: Club.',
      title: 'Rôles club reserves',
    });
  });

  test('recommends the club plan for the club-only action paywalls', () => {
    expect(mapSubscriptionDecisionToPaywall({ paywall: 'DUES_CAMPAIGN_CREATE_REQUIRED' })
      .paywallKey).toBe('dues-limit');
    expect(mapSubscriptionDecisionToPaywall({ paywall: 'FACILITY_MANAGE_REQUIRED' }).paywallKey)
      .toBe('facility-manage-required');
    expect(mapSubscriptionDecisionToPaywall({ paywall: 'CLUB_UPDATE_REQUIRED' }).paywallKey)
      .toBe('club-update-required');
    expect(mapSubscriptionDecisionToPaywall({ paywall: 'SPONSOR_MANAGE_REQUIRED' }).paywallKey)
      .toBe('sponsor-manage-required');
    expect(mapSubscriptionDecisionToPaywall({ paywall: 'CLUB_ROLES_MANAGE_REQUIRED' }).paywallKey)
      .toBe('club-roles-manage-required');
    expect(getSubscriptionRecommendedPlanCode({
      paywall: 'FACILITY_MANAGE_REQUIRED',
      requiredPlan: ['CLUB'],
    })).toBe('fc_club_tier_1_yearly');
    expect(getSubscriptionPaywallBenefits({ paywall: 'SPONSOR_MANAGE_REQUIRED' })).toEqual([
      'Toutes les équipes du club couvertes',
      'Droits club et gestion centralisée',
      'Cotisations et recrutement illimités',
    ]);
  });

  test('falls back to the generic paywall copy for an unknown server key', () => {
    expect(mapSubscriptionDecisionToPaywall({ paywall: 'SOME_FUTURE_ACTION_REQUIRED' }).paywallKey)
      .toBe('subscription-required');
    expect(getSubscriptionPaywallContent({
      allowed: false,
      paywall: 'SOME_FUTURE_ACTION_REQUIRED',
      reason: 'SUBSCRIPTION_REQUIRED',
      requiredPlan: ['CLUB'],
    })).toEqual({
      ctaLabel: 'Voir mon abonnement',
      description: 'Cette action demande une offre FoundClub active. Offre conseillée: Club.',
      title: 'Abonnement FoundClub requis',
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
      description: 'Tu as atteint la limite gratuite de publication d événements. Offre conseillée: Team ou Club.',
      title: 'Publication d événement limitée',
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

    // PROFILE_CONTACT est retire de la matrice (contact 100 % libre) : d'anciennes
    // lignes renvoyees par un serveur pas a jour ne doivent jamais s'afficher.
    expect(getSubscriptionQuotaItems(freeUsageSummary, 'FREE')).toEqual([
      {
        label: 'Evenements',
        quotaType: 'EVENT_PUBLISH',
        remaining: 0,
        total: 1,
        used: 1,
      },
    ]);
    expect(getSubscriptionQuotaItems(freeUsageSummary, 'CLUB_UNVERIFIED')).toHaveLength(1);
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

  test('derives three paywall benefits per paywall key for the paywall sheet', () => {
    expect(getSubscriptionPaywallBenefits({
      allowed: false,
      paywall: 'EVENT_LIMIT',
      reason: 'FREE_QUOTA_EXHAUSTED',
    })).toEqual([
      'Événements et matchs illimités',
      'Composition et convocations',
      'Toute l équipe en profite',
    ]);
    expect(getSubscriptionPaywallBenefits({ paywall: 'TEAM_LIMIT' })).toEqual([
      'Ajoute autant d équipes que besoin',
      'Événements et matchs illimités',
      'Gestion complète de chaque équipe',
    ]);
    expect(getSubscriptionPaywallBenefits({ paywall: 'MATCH_LIMIT' })).toHaveLength(3);
    expect(getSubscriptionPaywallBenefits({ paywall: 'RECRUITMENT_AD_LIMIT' })).toHaveLength(3);
    expect(getSubscriptionPaywallBenefits({ paywall: 'DUES_LIMIT' })).toHaveLength(3);
    expect(getSubscriptionPaywallBenefits({ paywall: 'CLUB_TIER_TEAM_LIMIT' })).toEqual([
      'Toutes les équipes du club couvertes',
      'Droits club et gestion centralisée',
      'Cotisations et recrutement illimités',
    ]);
    expect(getSubscriptionPaywallBenefits({ paywall: 'CLUB_VERIFICATION_REQUIRED' }))
      .toEqual(getSubscriptionPaywallBenefits({ paywall: 'CLUB_TIER_TEAM_LIMIT' }));
    expect(getSubscriptionPaywallBenefits({}))
      .toEqual(getSubscriptionPaywallBenefits({ paywall: 'CLUB_TIER_TEAM_LIMIT' }));
  });

  test('recommends a yearly catalog entry from the decision required plans', () => {
    expect(getSubscriptionRecommendedPlanCode({ requiredPlan: ['TEAM'] })).toBe('fc_team_1_yearly');
    expect(getSubscriptionRecommendedPlanCode({ requiredPlan: ['CLUB'] })).toBe('fc_club_tier_1_yearly');
    expect(getSubscriptionRecommendedPlanCode({ requiredPlan: ['TEAM', 'CLUB'] })).toBe('fc_team_1_yearly');
    expect(getSubscriptionRecommendedPlanCode({ requiredPlan: ['CLUB', 'TEAM'] })).toBe('fc_team_1_yearly');
    expect(getSubscriptionRecommendedPlanCode({ requiredPlan: [] })).toBe('fc_team_1_yearly');
    expect(getSubscriptionRecommendedPlanCode(null)).toBe('fc_team_1_yearly');
  });

  test('exposes stable subscription status copy for UI surfaces', () => {
    expect(getSubscriptionStatusMeta('FREE')).toEqual({
      description: 'Tu utilises actuellement les quotas gratuits FoundClub.',
      label: 'Gratuit',
    });
    expect(getSubscriptionStatusMeta('CLUB_UNVERIFIED')).toEqual({
      description: 'Tes droits Club sont actifs. Il reste à faire vérifier ton club — sans effet sur ton offre.',
      label: 'Club à vérifier',
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
