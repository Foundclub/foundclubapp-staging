/* eslint-disable max-len -- des phrases entieres */
import { resolveManageClubTarget } from '@/domains/home/manageClubTarget';

import { RouteNames } from '@/navigation/routeNames';

// RWDIRIG3 (30/10/2026, chef « Q1 = A », BLOQUANT) — UN DIRIGEANT SANS CLUB QUI TOUCHE « GÉRER MON
// CLUB » ARRIVE SUR LA CRÉATION DE SON CLUB. Avant : un bandeau « Contexte manquant », et aucun
// bouton du site ni de l'app ne menait à « Créer mon club » (recette, 688, inscription fermée par
// un rechargement). Même écran au téléphone et sur le site : la pile du club, toujours déclarée.

it('🔴 dirigeant sans club : la création du club (étape 1, « on vérifie qu il n existe pas déjà »)', () => {
  expect(resolveManageClubTarget({ clubId: null, cmId: null, isPresident: true })).toEqual({
    name: RouteNames.ClubStack,
    params: { params: { entry: 'search' }, screen: RouteNames.ClubWizardName },
  });
});

it('protégé : avec un club, sa fiche', () => {
  expect(resolveManageClubTarget({ clubId: 'club-1', cmId: null, isPresident: true })).toEqual({
    name: RouteNames.ClubStack,
    params: { params: { clubId: 'club-1' }, screen: RouteNames.Club },
  });
});

it('protégé : un club multisport, son tableau de bord', () => {
  expect(resolveManageClubTarget({ clubId: null, cmId: 'cm-1', isPresident: true })).toEqual({
    name: RouteNames.CMDashboard,
    params: { cmId: 'cm-1' },
  });
});

it('protégé : un entraîneur sans club garde le bandeau (rien à ouvrir)', () => {
  expect(resolveManageClubTarget({ clubId: null, cmId: null, isPresident: false })).toBeNull();
});
