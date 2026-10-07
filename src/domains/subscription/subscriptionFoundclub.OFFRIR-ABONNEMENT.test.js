import { formatSubscriptionPlanLabel, getActiveClubOfferPayer } from './subscriptionDecision';

// 🎁 OFFRIR-ABONNEMENT (07/10/2026) — l offre Club OFFERTE PAR FOUNDCLUB depuis la console
// SuperAdmin (plan `fc_foundclub_club`, admin subscription-catalog.ts). Ce qu un membre du club
// lit ensuite dans l app, et qui était faux avant le lot (ROUGE) :
//   - « Mon abonnement » nommait l offre « Fc Foundclub Club » (repli du nom de code) ;
//   - Mon compte disait « Payé par ton club » : c est FoundClub qui offre, le club ne paie rien.
// Le VRAI i18next (fr.js) écrit les phrases.

const CLUB = 'as-offerte';
const droitClub = (/** @type {Record<string, any>} */ champs = {}) => ({
  scopeClubDocumentId: CLUB,
  scopeType: 'CLUB',
  status: 'active',
  ...champs,
});

describe('OFFRIR-ABONNEMENT — ce qu un membre lit d une offre de FoundClub', () => {
  it('« Mon abonnement » la nomme « Club · offert par FoundClub »', () => {
    expect(formatSubscriptionPlanLabel('fc_foundclub_club')).toBe('Club · offert par FoundClub');
  });

  it('Mon compte : FoundClub l offre (et non « payé par ton club »)', () => {
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [droitClub({ subscriptionPlanCode: 'fc_foundclub_club' })],
    })).toEqual({ kind: 'foundclub' });
  });

  it('offerte ET payée par le club : c est le paiement qui se dit', () => {
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [
        droitClub({ subscriptionPlanCode: 'fc_foundclub_club' }),
        droitClub({ subscriptionPlanCode: 'fc_club_tier_1_yearly' }),
      ],
    })).toEqual({ kind: 'paid' });
  });

  it('offerte pendant un essai : FoundClub l offre', () => {
    expect(getActiveClubOfferPayer({
      clubDocumentId: CLUB,
      entitlementsSummary: [
        droitClub({ subscriptionPlanCode: 'fc_trial_club' }),
        droitClub({ subscriptionPlanCode: 'fc_foundclub_club' }),
      ],
    })).toEqual({ kind: 'foundclub' });
  });
});
