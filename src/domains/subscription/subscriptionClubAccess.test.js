import {
  getSubscriptionAccessLevel,
  getSubscriptionStatusMeta,
  hasActiveClubOffer,
} from './subscriptionDecision';

// Fichier SEPARE de subscriptionDecision.test.js a dessein : la branche
// feat/L10-C-griser-avant ajoute au meme endroit de ce fichier-la (fin du
// describe + bloc d'import). Un fichier neuf rend les deux branches fusionnables
// sans conflit.
//
// Ce qui est verrouille ici : la verification du club est un SIGNAL D'AFFICHAGE,
// pas une porte. Decision produit du 2026-07-17, ecrite dans
// admin/src/api/subscription/services/subscription-permission.ts:751-756 —
// « un entitlement actif et correctement scope ouvre l'acces, meme si le club
// n'est pas encore verifie […] aucun club n'etant verifie en production, elle
// refusait le premier client payant ».

describe('hasActiveClubOffer — la verification du club ne ferme aucune porte', () => {
  it.each([
    ['CLUB', true],
    ['CLUB_UNVERIFIED', true],
    ['TEAM', false],
    ['FREE', false],
    [undefined, false],
  ])('%s -> %s', (accessLevel, expected) => {
    expect(hasActiveClubOffer(/** @type {any} */ (accessLevel))).toBe(expected);
  });

  it('un abonne Club sans club verifie a les memes droits qu un club verifie', () => {
    const unverified = getSubscriptionAccessLevel({
      subscriptionSummary: { hasClubPlan: true, requiresClubVerification: true },
    });
    const verified = getSubscriptionAccessLevel({
      subscriptionSummary: { hasClubPlan: true, hasVerifiedClubPlan: true },
    });

    expect(unverified).toBe('CLUB_UNVERIFIED');
    expect(verified).toBe('CLUB');
    // Le niveau reste distinct — c'est une etiquette utile — mais l'acces, lui,
    // ne l'est pas. C'est exactement ce que les ecrans lisaient de travers :
    // Installations et Sponsors etaient cadenasses pour un client deja payant,
    // qui se voyait alors revendre l'offre Club qu'il possede.
    expect(hasActiveClubOffer(unverified)).toBe(hasActiveClubOffer(verified));
  });
});

describe('getSubscriptionStatusMeta — ne promet plus un blocage qui n existe pas', () => {
  it('l etat « Club a verifier » annonce des droits actifs', () => {
    const meta = getSubscriptionStatusMeta('CLUB_UNVERIFIED');

    expect(meta.label).toBe('Club à vérifier');
    expect(meta.description).toContain('actifs');
    // Le mot est banni, pas seulement la phrase : c'est la promesse de blocage
    // qui etait fausse, quelle que soit sa tournure.
    expect(meta.description).not.toContain('bloqu');
  });

  it('les autres etats sont inchanges', () => {
    expect(getSubscriptionStatusMeta('CLUB').label).toBe('Club');
    expect(getSubscriptionStatusMeta('TEAM').label).toBe('Team');
    expect(getSubscriptionStatusMeta('FREE').label).toBe('Gratuit');
    expect(getSubscriptionStatusMeta(undefined).label).toBe('Gratuit');
  });
});
