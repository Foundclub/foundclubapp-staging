import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

/**
 * T-PARCOURS-2 (17/11/2026, point 2, R12) -- REVENIR AU TOURNOI APRES LA CONNEXION, AU TELEPHONE.
 *
 * Le visiteur appuie sur « Se connecter pour s'inscrire » (barre du bas de la fiche du tournoi) :
 * la connexion remonte toute la navigation et il arrivait sur l'Accueil ; il devait rouvrir le lien
 * (capture app-P1-10). La fiche pose un repere (retourAuTournoi.js) ; le crochet des liens en
 * attente (useLiensEnAttente, appele par PrivateNavigator une fois le compte charge ET l'accueil
 * d'un compte neuf fait) rouvre la fiche, une seule fois.
 * ROUGE avant le lot : ni le repere ni le retour n'existaient.
 */

const mockRangement = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRangement.get(cle),
  removeItem: (/** @type {string} */ cle) => { mockRangement.delete(cle); },
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRangement.set(cle, valeur);
  },
}));

const mockNaviguer = jest.fn(() => true);
const mockPilePrete = jest.fn(() => true);
jest.mock('@/navigation/navigationService', () => ({
  __esModule: true,
  navigate: (/** @type {any[]} */ ...args) => mockNaviguer(...args),
  navigationRef: {
    getCurrentRoute: () => ({ name: 'HomeTab' }),
    isReady: () => mockPilePrete(),
  },
}));

const mockLienDeLancement = jest.fn(() => false);
jest.mock('@/navigation/lienDeLancement', () => ({
  envoyerLeLienEnAttente: () => mockLienDeLancement(),
}));

const FICHE = ['EventStack', { params: { eventId: 'tournoi-1912' }, screen: 'EventDetails' }];

/**
 * Monte un composant qui appelle le crochet, puis laisse passer le temps.
 * @param {boolean} pret le compte est charge et aucune etape d accueil n attend
 * @returns {Promise<void>}
 */
const monterPuisAttendre = async (pret) => {
  // eslint-disable-next-line global-require
  const useLiensEnAttente = require('../useLiensEnAttente').default;
  /**
   * Un composant qui ne fait qu appeler le crochet.
   * @returns {null} rien a l ecran
   */
  function Sonde() {
    useLiensEnAttente(pret);
    return null;
  }
  await act(async () => { renderer.create(createElement(Sonde)); });
  await act(async () => { jest.advanceTimersByTime(2000); });
};

const repere = () => require('../retourAuTournoi'); // eslint-disable-line global-require

beforeEach(() => {
  jest.useFakeTimers();
  mockRangement.clear();
  mockNaviguer.mockClear();
  mockPilePrete.mockClear();
  mockLienDeLancement.mockReset();
  mockLienDeLancement.mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('T-PARCOURS-2 -- apres la connexion, l app revient sur la fiche du tournoi', () => {
  it('compte pret et repere pose : la fiche du tournoi se rouvre, dans sa pile', async () => {
    repere().retenirLeRetourAuTournoi('tournoi-1912');
    await monterPuisAttendre(true);
    expect(mockNaviguer).toHaveBeenCalledTimes(1);
    expect(mockNaviguer).toHaveBeenCalledWith(...FICHE);
  });

  it('une seule fois : le repere est efface des qu il a servi', async () => {
    repere().retenirLeRetourAuTournoi('tournoi-1912');
    await monterPuisAttendre(true);
    await monterPuisAttendre(true);
    expect(mockNaviguer).toHaveBeenCalledTimes(1);
  });

  it('une etape d accueil attend (compte neuf) : rien, et le repere reste pour apres', async () => {
    repere().retenirLeRetourAuTournoi('tournoi-1912');
    await monterPuisAttendre(false);
    expect(mockNaviguer).not.toHaveBeenCalled();
    await monterPuisAttendre(true);
    expect(mockNaviguer).toHaveBeenCalledWith(...FICHE);
  });

  it('sans repere, ou repere de plus d 1 h : rien', async () => {
    await monterPuisAttendre(true);
    repere().retenirLeRetourAuTournoi('tournoi-1912', Date.now() - 60 * 60 * 1000 - 1);
    await monterPuisAttendre(true);
    expect(mockNaviguer).not.toHaveBeenCalled();
  });

  it('le lien qui a lance l app passe devant : le repere est jete, pas rejoue', async () => {
    repere().retenirLeRetourAuTournoi('tournoi-1912');
    mockLienDeLancement.mockReturnValue(true);
    await monterPuisAttendre(true);
    expect(mockNaviguer).not.toHaveBeenCalled();
    expect(repere().prendreLeRetourAuTournoi()).toBeNull();
  });

  it('navigation pas encore prete : il reessaie, sans perdre le repere', async () => {
    repere().retenirLeRetourAuTournoi('tournoi-1912');
    mockPilePrete.mockImplementationOnce(() => false);
    await monterPuisAttendre(true);
    expect(mockNaviguer).toHaveBeenCalledWith(...FICHE);
  });
});
