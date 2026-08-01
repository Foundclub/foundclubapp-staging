import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';

import { buildPreservedApiError } from './apiError';

// Forme réelle de ce qui arrive dans le `catch` d'un service : l'intercepteur HTTP
// (client.native.js:93) rejette la charge Strapi DÉBALLÉE, pas l'erreur axios.
const unwrappedStrapiError = (details) => ({
  details,
  message: 'Cette fonctionnalite necessite une offre FoundClub active.',
  name: 'ForbiddenError',
  status: 403,
});

const SUBSCRIPTION_DENIAL = {
  code: 'SUBSCRIPTION_PERMISSION_DENIED',
  decision: {
    allowed: false,
    paywall: 'CLUB_ROLES_MANAGE_REQUIRED',
    reason: 'SUBSCRIPTION_REQUIRED',
    requiredPlan: ['CLUB'],
  },
};

describe('buildPreservedApiError', () => {
  test('conserve la décision d\'abonnement que `new Error(texte)` détruisait', () => {
    const preserved = buildPreservedApiError(
      unwrappedStrapiError(SUBSCRIPTION_DENIAL),
      'Failed to create trainer',
    );

    expect(preserved.code).toBe('SUBSCRIPTION_PERMISSION_DENIED');
    expect(preserved.status).toBe(403);
    expect(preserved.details).toEqual(SUBSCRIPTION_DENIAL);
    expect(preserved.decision).toEqual(SUBSCRIPTION_DENIAL.decision);
  });

  test('la décision reste lisible par l\'extracteur que les 15 écrans utilisent', () => {
    const preserved = buildPreservedApiError(
      unwrappedStrapiError(SUBSCRIPTION_DENIAL),
      'Failed to update club',
    );

    expect(extractSubscriptionDecisionFromError(preserved))
      .toEqual(SUBSCRIPTION_DENIAL.decision);
  });

  test('un `new Error(texte)` nu, lui, ne transporte rien — c\'est le bug corrigé', () => {
    const flattened = new Error(`Failed to create trainer: ${unwrappedStrapiError(SUBSCRIPTION_DENIAL).message}`);

    expect(extractSubscriptionDecisionFromError(flattened)).toBeNull();
  });

  test('préfixe le message et survit à une erreur sans détail', () => {
    const preserved = buildPreservedApiError(
      { message: 'Network Error' },
      'Failed to add manager to my club',
    );

    expect(preserved.message).toBe('Failed to add manager to my club: Network Error');
    expect(preserved.code).toBeNull();
    expect(preserved.details).toBeNull();
    expect(preserved.status).toBeNull();
    expect(preserved.decision).toBeUndefined();
  });

  test('lit aussi la forme axios brute, au cas où un appel court-circuite l\'intercepteur', () => {
    const preserved = buildPreservedApiError(
      {
        response: {
          data: { error: { details: SUBSCRIPTION_DENIAL, message: 'Forbidden', status: 403 } },
          status: 403,
        },
      },
      'Failed to update club',
    );

    expect(preserved.decision).toEqual(SUBSCRIPTION_DENIAL.decision);
    expect(preserved.status).toBe(403);
  });
});
