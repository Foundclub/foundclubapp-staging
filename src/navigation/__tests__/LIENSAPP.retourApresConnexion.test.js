import fs from 'fs';
import path from 'path';

import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

/**
 * LIENS-APP (07/10/2026, registre TEST_PROD_2_6_70 ligne 5a) -- REVENIR AU LIEN DE LA VILLE
 * APRES LA CONNEXION.
 *
 * Le lien de la Ville s ouvre desormais dans l app. Sans compte, sa page (CollectiviteJoin,
 * publique) mene a la connexion et pose un repere de retour (lienDeLaVille.js). La connexion
 * remonte toute la navigation (appNavigator.js, cle du NavigationContainer) : la pile publique
 * disparait. Ce crochet, appele par PrivateNavigator une fois le compte charge ET aucune etape
 * d accueil en attente (un compte neuf passe d abord le controle d age), rouvre la page du lien.
 * ROUGE avant le lot : le crochet n existait pas.
 */

const mockRangement = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRangement.get(cle),
  removeItem: (/** @type {string} */ cle) => { mockRangement.delete(cle); },
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRangement.set(cle, valeur);
  },
}));

let mockPret = true;
let mockRouteCourante = /** @type {string | null} */ ('HomeTab');
const mockNaviguer = jest.fn(() => mockPret);
jest.mock('@/navigation/navigationService', () => ({
  __esModule: true,
  navigate: (/** @type {any[]} */ ...args) => mockNaviguer(...args),
  navigationRef: { getCurrentRoute: () => (mockRouteCourante ? { name: mockRouteCourante } : null) },
}));

const LIEN = 'CodeDeLaVille0123456789ab';

/**
 * Pose le repere de retour, comme la page du lien sans compte.
 * @param {number} [age] son age, en millisecondes
 * @returns {void}
 */
const poserLeRetour = (age = 0) => {
  mockRangement.set('coll-invitation-ville-retour', JSON.stringify({ at: Date.now() - age, token: LIEN }));
};

/**
 * Monte un composant qui appelle le crochet, puis laisse passer le temps.
 * @param {boolean} pret le compte est charge et aucune etape d accueil n attend
 * @returns {Promise<void>}
 */
const monterPuisAttendre = async (pret) => {
  // eslint-disable-next-line global-require
  const useRetourAuLienDeLaVille = require('../useRetourAuLienDeLaVille').default;
  const Sonde = () => {
    useRetourAuLienDeLaVille(pret);
    return null;
  };
  await act(async () => { renderer.create(createElement(Sonde)); });
  await act(async () => { jest.advanceTimersByTime(2000); });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockRangement.clear();
  mockNaviguer.mockClear();
  mockPret = true;
  mockRouteCourante = 'HomeTab';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('LIENS-APP -- apres la connexion, l app revient a la page du lien de la Ville', () => {
  it('compte pret et repere pose : la page du lien se rouvre, avec son jeton', async () => {
    poserLeRetour();
    await monterPuisAttendre(true);
    expect(mockNaviguer).toHaveBeenCalledWith('CollectiviteJoin', { token: LIEN });
  });

  it('une etape d accueil attend (compte neuf) : rien tant qu elle n est pas faite', async () => {
    poserLeRetour();
    await monterPuisAttendre(false);
    expect(mockNaviguer).not.toHaveBeenCalled();
  });

  it('deja sur la page du lien (lien de lancement rejoue) : on ne l empile pas une 2e fois', async () => {
    poserLeRetour();
    mockRouteCourante = 'CollectiviteJoin';
    await monterPuisAttendre(true);
    expect(mockNaviguer).not.toHaveBeenCalled();
  });

  it('sans repere, ou repere de plus d 1 h : rien', async () => {
    await monterPuisAttendre(true);
    poserLeRetour(60 * 60 * 1000 + 1);
    await monterPuisAttendre(true);
    expect(mockNaviguer).not.toHaveBeenCalled();
  });

  it('navigation pas encore prete : il reessaie', async () => {
    poserLeRetour();
    mockNaviguer.mockImplementationOnce(() => false);
    await monterPuisAttendre(true);
    expect(mockNaviguer).toHaveBeenCalledTimes(2);
    expect(mockNaviguer).toHaveBeenLastCalledWith('CollectiviteJoin', { token: LIEN });
  });
});

describe('LIENS-APP -- PrivateNavigator branche le crochet APRES l accueil', () => {
  it('l appel attend le compte charge et AUCUNE etape d accueil en attente', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'private', 'PrivateNavigator.js'), 'utf8');
    const appel = source.match(/useRetourAuLienDeLaVille\(([\s\S]*?)\);/)?.[1] || '';

    expect({
      accueil: appel.includes('!firstPendingOnboardingRoute'),
      compte: appel.includes('userData?.documentId'),
      erreur: appel.includes('!userDataError'),
      lecture: appel.includes('!userDataLoading'),
    }).toEqual({
      accueil: true, compte: true, erreur: true, lecture: true,
    });
  });
});
