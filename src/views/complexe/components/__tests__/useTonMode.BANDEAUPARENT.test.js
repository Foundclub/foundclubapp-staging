import renderer, { act } from 'react-test-renderer';

import useTonMode from '../useTonMode';

// BANDEAU-PARENT (10/11/2026, « useTonMode A » du chef) — LA POSITION PARENT SUIT LA MÊME RÈGLE
// PARTOUT. Depuis ACCUEIL-JOUEUR (règle d'Adel du 09/11), l'accueil n'offre « Parent » qu'à un
// compte Joueur né Parent (`offersParentSwitch`), ou en mode parent pour revenir ; un compte né
// Joueur passe par « Mon compte ». L'espace du complexe et le menu du site (`useTonMode`)
// lisaient encore la règle d'avant (`canUseParentMode`, le rôle seul) : un Joueur né Joueur qui
// gère un complexe et a un enfant y voyait « Parent ». Dirigeant et entraîneur : inchangés.
// ROUGE sur 24cfc3758 : le premier cas.

const mockStockage = new Map();

jest.mock('@/store/appContext', () => ({
  storage: {
    delete: jest.fn((cle) => mockStockage.delete(cle)),
    getString: jest.fn((cle) => mockStockage.get(cle)),
    set: jest.fn((cle, valeur) => mockStockage.set(cle, valeur)),
  },
}));

jest.mock('@/services/complexe/complexeQueries', () => ({
  useMesComplexes: () => ({ data: [{ documentId: 'cx-1', name: 'Le Five' }] }),
}));

jest.mock('@/domains/complexe/complexeGerant', () => ({
  complexeChoisi: (/** @type {any[]} */ liste) => liste[0] || null,
  complexesOuvrables: (/** @type {any} */ data) => data || [],
}));

jest.mock('@/domains/complexe/modeComplexe', () => ({ ecrireModeComplexe: jest.fn() }));

jest.mock('@/views/profile/parent/useMesEnfantsEnBref', () => () => ({
  lignes: [{ prenom: 'Léa' }],
  total: 1,
}));

/** @type {any[]} */
const montes = [];

/**
 * Les positions que l'espace du complexe montre à ce compte.
 * @param {any} compte - Le profil.
 * @returns {string[]} - Les clés des positions.
 */
const positionsDe = (compte) => {
  /** @type {any} */
  let lu = null;
  /**
   * Lit le crochet.
   * @returns {null} - Rien à l'écran.
   */
  function Sonde() {
    lu = useTonMode({ compte, dansLeComplexe: true });
    return null;
  }
  act(() => {
    montes.push(renderer.create(<Sonde />));
  });
  return lu.positions.map((/** @type {any} */ p) => p.cle);
};

const JOUEUR = { documentId: 'j-1', myTeams: [{ id: 1 }], role: { type: 'joueur' } };

beforeEach(() => mockStockage.clear());
afterEach(() => {
  while (montes.length) {
    const arbre = montes.pop();
    act(() => arbre.unmount());
  }
});

describe('BANDEAU-PARENT — la position Parent dans l’espace du complexe', () => {
  // T9-RETOURS-B (12/11/2026, Adel « 284 ») : « Parent » dès qu'il y a un enfant, d'où que vienne
  // le compte (avant : pas de Parent pour un né Joueur).
  it('Joueur né Joueur avec un enfant : Parent', () => {
    mockStockage.set('user.parent_origin.j-1', 'player');
    expect(positionsDe(JOUEUR)).toContain('parent');
  });

  it('Joueur né Parent avec un enfant : Parent', () => {
    mockStockage.set('user.parent_origin.j-1', 'parent');
    expect(positionsDe(JOUEUR)).toContain('parent');
  });

  it('Joueur né Joueur en mode parent (par « Mon compte ») : Parent reste, pour revenir', () => {
    mockStockage.set('user.parent_origin.j-1', 'player');
    mockStockage.set('user.player_mode.j-1', 'parent');
    expect(positionsDe(JOUEUR)).toContain('parent');
  });

  it('dirigeant avec un enfant : Parent, comme avant', () => {
    expect(positionsDe({ documentId: 'd-1', myTeams: [], role: { type: 'president' } }))
      .toContain('parent');
  });
});
