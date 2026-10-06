import fs from 'fs';
import path from 'path';

import { RouteNames } from '../routeNames';
import { buildWebPath, getWebRoutePattern, WEB_STACK_INITIAL_ROUTES } from '../webRoutes';

// FINITIONS16 · POINT 13 (tournee T15, Test Adel, SUR LE SITE) — « Recruter » ne s'ouvrait pas
// depuis l'accueil (2 appuis, rien). L'accueil appelle `navigate(AdWizardStack)` : sur le
// telephone, la PILE s'ouvre sur son premier ecran ; sur le site, `buildWebPath` cherchait une
// adresse a la pile elle-meme, n'en trouvait pas (un conteneur n'a pas d'URL,
// webRouteExemptions.js) et rendait « / » — l'accueil, ou l'on etait deja. Meme defaut pour les
// 5 `navigate(ProfileStack)` (fiche de club, conversation, annonce, demandes, equipe).
// Une pile sans ecran ouvre, sur le site, le MEME premier ecran que sur le telephone. ROUGE avant.

const PILES = path.join(__dirname, '..', 'private', 'stacks');

describe('FINITIONS16 13 — une pile sans ecran ouvre son premier ecran sur le site', () => {
  test('🔴 « Recruter » (AdWizardStack) ouvre le premier ecran de l assistant', () => {
    expect(buildWebPath(RouteNames.AdWizardStack))
      .toBe(getWebRoutePattern(RouteNames.AdWizardAudienceType));
    expect(buildWebPath(RouteNames.AdWizardStack)).not.toBe('/');
  });

  test('🔴 ProfileStack ouvre « Mon profil »', () => {
    expect(buildWebPath(RouteNames.ProfileStack)).toBe(getWebRoutePattern(RouteNames.Profile));
  });

  test('🔴 la table dit, pile par pile, le premier ecran du telephone (initialRouteName)', () => {
    const piles = Object.entries(WEB_STACK_INITIAL_ROUTES);
    expect(piles.length).toBeGreaterThan(0);
    piles.forEach(([pile, premierEcran]) => {
      const source = fs.readFileSync(path.join(PILES, `${pile}.js`), 'utf8');
      const lu = /initialRouteName=\{RouteNames\.([A-Za-z0-9]+)\}/.exec(source);
      expect([pile, lu && lu[1]]).toEqual([pile, premierEcran]);
    });
  });

  test('🔒 chaque premier ecran a une adresse sans parametre a remplir', () => {
    Object.values(WEB_STACK_INITIAL_ROUTES).forEach((premierEcran) => {
      const adresse = getWebRoutePattern(premierEcran);
      expect(adresse).not.toBe('/');
      expect(adresse).not.toContain(':');
    });
  });

  test('🔒 un ecran nomme dans la pile garde la main (screen / params)', () => {
    expect(buildWebPath(RouteNames.EventStack, {
      params: { eventId: 'match-1' },
      screen: RouteNames.EventDetails,
    })).toBe(buildWebPath(RouteNames.EventDetails, { eventId: 'match-1' }));
  });
});
