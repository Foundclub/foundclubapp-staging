import fr from '@/theme/strings/translations/fr';

import { getSubscriptionCatalogEntryMeta } from './subscriptionBilling';
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
  it('l etat « club non certifie » annonce des droits actifs', () => {
    const meta = getSubscriptionStatusMeta('CLUB_UNVERIFIED');

    expect(meta.description).toContain('actifs');
    // Le mot est banni, pas seulement la phrase : c'est la promesse de blocage
    // qui etait fausse, quelle que soit sa tournure.
    expect(meta.description).not.toContain('bloqu');
  });

  it('les autres etats sont inchanges', () => {
    expect(getSubscriptionStatusMeta('TEAM').label).toBe('Team');
    expect(getSubscriptionStatusMeta('FREE').label).toBe('Gratuit');
    expect(getSubscriptionStatusMeta(undefined).label).toBe('Gratuit');
  });
});

// R10 — L'ECRAN NE DEMANDE PLUS UN GESTE IMPOSSIBLE.
// `verifyClub` est une action de la console SuperAdmin (declaree dans
// admin/src/bootstrap/permission-sync.js:173, declenchee par le bouton
// « Vérifier le club » de src/views/admin/AdminClubDetail.js:539). AUCUNE route
// ne permet a un dirigeant de certifier son propre club. Toute copie qui lui
// reclamait ce geste lui demandait donc l'impossible.
//
// Deuxieme mensonge corrige ici : l'argumentaire de vente posait la
// certification en condition, ce qui est FAUX depuis la decision du 2026-07-17.
//
// Ce balayage couvre LES DEUX SENS — club certifie et club non certifie — parce
// qu'un seul des deux aurait pu rester juste par hasard.
describe('R10 — le vocabulaire vu par l utilisateur ne reclame plus rien a personne', () => {
  /** Ce qu'aucun texte affiche ne doit plus contenir. */
  const MOTS_INTERDITS = [/dirigeant/i, /vérifi/i, /verifi/i, /reste obligatoire/i];

  it.each(['CLUB', 'CLUB_UNVERIFIED'])(
    'l etat %s porte la meme etiquette et ne reclame aucun geste',
    (accessLevel) => {
      const meta = getSubscriptionStatusMeta(/** @type {any} */ (accessLevel));

      // Les deux etats disent LA MEME CHOSE : l'abonnement est identique de part
      // et d'autre. Un badge plus rassurant d'un cote serait un second mensonge.
      expect(meta.label).toBe('Club · actif');
      expect(meta.description).toContain('actif');
      MOTS_INTERDITS.forEach((mot) => expect(meta.label).not.toMatch(mot));
      MOTS_INTERDITS.forEach((mot) => expect(meta.description).not.toMatch(mot));
    },
  );

  it('les deux etats Club sont rigoureusement indiscernables a l ecran', () => {
    expect(getSubscriptionStatusMeta('CLUB').label)
      .toBe(getSubscriptionStatusMeta('CLUB_UNVERIFIED').label);
  });

  it('l argumentaire de vente de l offre Club ne pose plus de condition', () => {
    const meta = getSubscriptionCatalogEntryMeta({
      billingPeriod: 'monthly',
      displayName: 'Club',
      referencePriceEurCents: 4900,
      scopeType: 'CLUB',
    });

    expect(meta.description).toBe('Débloque les droits club sur tout ton club.');
    MOTS_INTERDITS.forEach((mot) => expect(meta.description).not.toMatch(mot));
  });

  it.each(['club', 'clubUnverified'])(
    'la copie fr.js de l etat %s est propre dans les deux sens',
    (cle) => {
      const { states, status } = fr.profile.subscription;

      expect(states[cle]).toBe('Club · actif');
      MOTS_INTERDITS.forEach((mot) => expect(states[cle]).not.toMatch(mot));
      MOTS_INTERDITS.forEach((mot) => expect(status[cle]).not.toMatch(mot));
      expect(status[cle]).toContain('actif');
    },
  );
});
