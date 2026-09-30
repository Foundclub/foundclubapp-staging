import renderer, { act } from 'react-test-renderer';

// 📌 PREMIER FILET de `AppModeContext.js` (AUCUN témoin : les 12 suites qui le
// croisent le DOUBLENT). Posé par le lot ACCUEIL (audit V1, A02), en
// application de E6 : le mode « League » est MÉMORISÉ d'un lancement à
// l'autre, et c'est lui qui choisit l'écran d'arrivée (`PrivateNavigator.js`,
// `useAuth.js`).

const mockMemoire = new Map();
const mockInterrupteurs = { LEAGUE_SUR_ACCUEIL: true };
jest.mock('@/config/fonctionsMasquees', () => mockInterrupteurs);

jest.mock('@/platform/storage', () => ({
  storageBackend: {
    getString: (/** @type {string} */ clef) => mockMemoire.get(clef),
    set: (/** @type {string} */ clef, /** @type {string} */ valeur) => {
      mockMemoire.set(clef, valeur);
    },
  },
}));

jest.mock('@/theme/themeContext', () => {
  const theme = { changeTheme: () => {} };
  return { __esModule: true, default: () => theme };
});

const { AppModeProvider, useAppMode } = require('../AppModeContext');

/** @type {renderer.ReactTestRenderer[]} */
const arbres = [];
afterEach(() => {
  arbres.splice(0).forEach((arbre) => act(() => { arbre.unmount(); }));
  mockMemoire.clear();
});

/**
 * Monte le fournisseur et rend ce que voit un écran.
 * @returns {{ vu: any }}
 */
const monter = () => {
  const vu = { valeur: /** @type {any} */ (null) };
  /**
   * Note ce que voit un écran à chaque rendu.
   * @returns {null}
   */
  function Sonde() {
    vu.valeur = useAppMode();
    return null;
  }
  act(() => {
    arbres.push(renderer.create(<AppModeProvider><Sonde /></AppModeProvider>));
  });
  return { vu };
};

describe('E6 — le mode de l application AUJOURD HUI (League sur l accueil)', () => {
  beforeEach(() => { mockInterrupteurs.LEAGUE_SUR_ACCUEIL = true; });

  it('sans rien de mémorisé, on démarre en mode FoundClub', () => {
    const { vu } = monter();

    expect(vu.valeur.isGold).toBe(false);
    expect(vu.valeur.mode).toBe('classic');
  });

  it('un mode League mémorisé fait redémarrer en League', () => {
    mockMemoire.set('user.app_mode', 'gold');
    const { vu } = monter();

    expect(vu.valeur.isGold).toBe(true);
  });

  it('basculer mémorise le mode pour le prochain lancement', () => {
    const { vu } = monter();

    act(() => { vu.valeur.toggleMode(); });

    expect(vu.valeur.isGold).toBe(true);
    expect(mockMemoire.get('user.app_mode')).toBe('gold');
  });
});

// A02 (décision d'Adel du 30/09, option A) : la League disparaît COMPLÈTEMENT de
// l'accueil. Or un mode League mémorisé choisit l'écran d'arrivée : sans ce
// garde, quiconque avait touché le logo une fois (l'auditeur, justement)
// redémarrerait DANS la League, sans plus aucune porte pour en sortir.
describe('A02 — League masquée : un mode League mémorisé est ignoré au lancement', () => {
  beforeEach(() => { mockInterrupteurs.LEAGUE_SUR_ACCUEIL = false; });

  it('LE TEMOIN : on redémarre en mode FoundClub', () => {
    mockMemoire.set('user.app_mode', 'gold');
    const { vu } = monter();

    expect(vu.valeur.isGold).toBe(false);
    expect(vu.valeur.mode).toBe('classic');
  });

  it('le choix mémorisé n est PAS effacé : rallumer l interrupteur le rend', () => {
    mockMemoire.set('user.app_mode', 'gold');
    monter();

    expect(mockMemoire.get('user.app_mode')).toBe('gold');
  });
});
