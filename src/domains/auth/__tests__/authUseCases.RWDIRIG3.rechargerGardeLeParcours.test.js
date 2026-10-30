/* eslint-disable max-len -- des phrases entieres */
import { RouteNames } from '@/navigation/routeNames';

// RWDIRIG3 (30/10/2026, chef « Q2 ») — SUR LE SITE, RECHARGER LA PAGE AU MILIEU DE L'INSCRIPTION GARDE
// LE PARCOURS OUVERT. TUNNELREPRISE (decision d'Adel « 1- A ») clot le parcours a la REOUVERTURE de
// l'app ; mais le « lancement » vivait en memoire, et sur le site un rechargement d'onglet l'effacait :
// un dirigeant qui recharge sur « Trouve ton club » arrivait a l'accueil, sans club (recette, 688).
// Un onglet neuf (sessionStorage vide) reste une reouverture. Le telephone n'a pas de sessionStorage.

jest.mock('../../../store/appContext', () => ({
  storage: { getBoolean: jest.fn((cle) => String(cle).startsWith('onboardingStarted_')), getString: jest.fn(), set: jest.fn() },
}));

/** @type {Record<string, string>} */
let onglet = {};
const sessionStorageDuSite = {
  getItem: (/** @type {string} */ cle) => (cle in onglet ? onglet[cle] : null),
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => { onglet[cle] = String(valeur); },
};

/**
 * Un chargement de page : le module repart de zero, l'onglet (sessionStorage) reste.
 * @returns {any} Le module tel qu'un nouveau chargement le voit.
 */
const chargerLaPage = () => {
  /** @type {any} */
  let module = null;
  // eslint-disable-next-line global-require -- un nouveau chargement de page
  jest.isolateModules(() => { module = require('@/domains/auth/authUseCases'); });
  return module;
};

const DIRIGEANT_SANS_CLUB = {
  birthdate: '1985-03-12',
  documentId: 'dirigeant-neuf',
  firstname: 'Fin',
  lastname: 'Trois',
  role: { name: 'president' },
};

const etapes = (/** @type {any} */ resultat) => (resultat.views || [])
  .filter((/** @type {any} */ vue) => vue.canShow).map((/** @type {any} */ vue) => vue.route);

beforeEach(() => {
  onglet = {};
  /** @type {any} */ (global).window = global.window || {};
  /** @type {any} */ (global).window.sessionStorage = sessionStorageDuSite;
});

afterAll(() => {
  delete (/** @type {any} */ (global).window).sessionStorage;
});

it('🔴 recharger sur « Trouve ton club » : le parcours reste ouvert (meme onglet)', () => {
  chargerLaPage().markOnboardingStarted(DIRIGEANT_SANS_CLUB.documentId);
  const resultat = chargerLaPage().getOnboardingViews(DIRIGEANT_SANS_CLUB);
  expect(etapes(resultat)).toContain(RouteNames.UserAffiliationGuide);
  expect(resultat.finieALaReouverture).toBeUndefined();
});

it('protégé : un onglet neuf reste une reouverture (regle « 1- A ») : l accueil, inscription finie', () => {
  chargerLaPage().markOnboardingStarted(DIRIGEANT_SANS_CLUB.documentId);
  onglet = {};
  const resultat = chargerLaPage().getOnboardingViews(DIRIGEANT_SANS_CLUB);
  expect(etapes(resultat)).toEqual([]);
  expect(resultat.finieALaReouverture).toBe(true);
});
