import { getActiveClubOfferPayer } from './subscriptionDecision';

// 🏷️ TEXTES-COLLECTIVITES (points 6 et 7 du chef, 01/10/2026) — QUI PAIE L'OFFRE CLUB DU CLUB
// ACTIF. La carte « Mon abonnement » de Mon compte disait mot pour mot « Club · actif — Tes
// droits Club sont actifs. Ton club est en cours de certification », que le club soit en
// ESSAI, payé par lui-même ou OFFERT par la Ville (constaté chez « Si mon » et chez Karim).
// Ce juge lit ce que le serveur rend déjà (`entitlementsSummary`, `subscriptionSummary`) :
// rien n'est deviné. Sans réponse sûre : `null`, et la carte garde sa phrase d'avant.

const CLUB = 'as-montrivage';
const droitClub = (/** @type {Record<string, any>} */ champs = {}) => ({
  scopeClubDocumentId: CLUB,
  scopeType: 'CLUB',
  status: 'active',
  subscriptionPlanCode: 'fc_club_tier_1_yearly',
  ...champs,
});

describe('TEXTES-COLLECTIVITES — getActiveClubOfferPayer : qui paie l offre du club actif', () => {
  it('la Ville l offre : la collectivité, nommée par le serveur', () => {
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [droitClub({
        offeredBy: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
        subscriptionPlanCode: 'fc_collectivite_club',
      })],
    })).toEqual({ kind: 'collectivite', name: 'Ville de Montrivage' });
  });

  it('un ESSAI : sa date de fin, lue dans l abonnement d essai', () => {
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [droitClub({ subscriptionPlanCode: 'fc_trial_club' })],
      subscriptionSummary: {
        payerSubscriptionsSummary: [{
          // eslint-disable-next-line max-len
          currentPeriodEnd: '2026-10-08T10:00:00.000Z', isTrial: true, planCode: 'fc_trial_club', status: 'active',
        }],
      },
    })).toEqual({ endsAt: '2026-10-08T10:00:00.000Z', kind: 'trial' });
  });

  it('un essai sans date lisible : un essai quand même, sans date inventée', () => {
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [droitClub({ subscriptionPlanCode: 'fc_trial_club' })],
    })).toEqual({ endsAt: null, kind: 'trial' });
  });

  it('une offre PAYÉE (magasin, site) : payée par le club', () => {
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [droitClub()],
    })).toEqual({ kind: 'paid' });
  });

  it('payée ET un essai sur le même club : on nomme celle qui est payée', () => {
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [droitClub({ subscriptionPlanCode: 'fc_trial_club' }), droitClub()],
    })).toEqual({ kind: 'paid' });
  });

  it('sans réponse sûre : null (la carte garde sa phrase d avant)', () => {
    // Offre de la Ville rendue par un serveur d avant le lot 1d (sans `offeredBy`) : on ne
    // dira pas « payé par ton club » quand c est la Ville qui paie.
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [droitClub({ subscriptionPlanCode: 'fc_collectivite_club' })],
    })).toBeNull();
    // Un droit d un AUTRE club, un droit d équipe, pas de club, rien du tout.
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [droitClub({ scopeClubDocumentId: 'autre-club' })],
    })).toBeNull();
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [droitClub({ scopeType: 'TEAM' })],
    })).toBeNull();
    // eslint-disable-next-line max-len
    expect(getActiveClubOfferPayer({ clubDocumentId: '', entitlementsSummary: [droitClub()] })).toBeNull();
    expect(getActiveClubOfferPayer()).toBeNull();
  });
});
