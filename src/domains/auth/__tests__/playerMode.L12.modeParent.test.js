import renderer, { act } from 'react-test-renderer';

/**
 * PAR-L12 (13/10, design parent §2 bis / E25, décision D6 A d'Adel du 12/10) — LE MODE PARENT.
 *
 * Le mode joueur devient un mode d'AFFICHAGE à trois positions : le rôle du compte (rien de
 * demandé), « joueur », « parent ». Toujours un choix d'affichage, jamais un droit : il vit sur
 * le téléphone, une clé par compte, et ne part jamais au serveur.
 * - « parent » s'offre aux rôles qui ont un rôle SPORTIF à quitter (joueur, entraîneur,
 *   dirigeant) ; le compte Parent est déjà en mode parent.
 * - La clé reste `user.player_mode.<compte>` : « on » garde son sens (le mode joueur des
 *   versions installées), « parent » s'y ajoute. Aucune migration.
 */

const mockStockage = new Map();
const mockPanne = { active: false };

jest.mock('@/store/appContext', () => {
  const operation = (/** @type {(...args: any[]) => any} */ faire) => jest.fn((...args) => {
    if (mockPanne.active) throw new Error('stockage indisponible');
    return faire(...args);
  });
  return {
    storage: {
      delete: operation((cle) => mockStockage.delete(cle)),
      getString: operation((cle) => mockStockage.get(cle)),
      set: operation((cle, valeur) => mockStockage.set(cle, valeur)),
    },
  };
});

const {
  canUseParentMode,
  readDisplayModeRequest,
  readPlayerModeRequest,
  resolveDisplayRoleKey,
  useDisplayModeRequest,
  writeDisplayModeRequest,
  writePlayerModeRequest,
} = require('@/domains/auth/playerMode');

beforeEach(() => {
  mockStockage.clear();
  mockPanne.active = false;
});

describe('la demande d affichage : rien, « joueur » ou « parent »', () => {
  test('« parent » se garde sous la MÊME clé que le mode joueur', () => {
    writeDisplayModeRequest('joueur-1', 'parent');
    expect(mockStockage.get('user.player_mode.joueur-1')).toBe('parent');
    expect(readDisplayModeRequest('joueur-1')).toBe('parent');
    // Le mode joueur n'est PAS demandé pour autant.
    expect(readPlayerModeRequest('joueur-1')).toBe(false);
  });

  test('« joueur » s écrit « on », comme avant : les versions installées s y retrouvent', () => {
    writeDisplayModeRequest('dir-1', 'player');
    expect(mockStockage.get('user.player_mode.dir-1')).toBe('on');
    expect(readDisplayModeRequest('dir-1')).toBe('player');

    mockStockage.clear();
    writePlayerModeRequest('dir-1', true);
    expect(readDisplayModeRequest('dir-1')).toBe('player');
  });

  test('revenir au rôle du compte EFFACE la clé ; une valeur inconnue ne vaut rien', () => {
    writeDisplayModeRequest('joueur-1', 'parent');
    writeDisplayModeRequest('joueur-1', null);
    expect(mockStockage.has('user.player_mode.joueur-1')).toBe(false);
    expect(readDisplayModeRequest('joueur-1')).toBeNull();

    mockStockage.set('user.player_mode.joueur-1', 'grand-parent');
    expect(readDisplayModeRequest('joueur-1')).toBeNull();
  });

  test('stockage en panne : on reste sur le rôle du compte, rien ne casse', () => {
    mockPanne.active = true;
    expect(readDisplayModeRequest('joueur-1')).toBeNull();
    expect(() => writeDisplayModeRequest('joueur-1', 'parent')).not.toThrow();
  });

  test('les écrans qui le lisent basculent ensemble (le choix d un geste se voit partout)', () => {
    /** @type {Array<string | null>} */
    const vus = [];
    /**
     * La sonde : elle note chaque valeur lue.
     * @returns {null} - Rien à l'écran.
     */
    function Sonde() {
      vus.push(useDisplayModeRequest('joueur-1'));
      return null;
    }
    /** @type {any} */
    let arbre;
    act(() => { arbre = renderer.create(<Sonde />); });
    act(() => writeDisplayModeRequest('joueur-1', 'parent'));
    act(() => writeDisplayModeRequest('joueur-1', null));
    act(() => arbre.unmount());

    expect(vus).toEqual([null, 'parent', null]);
  });
});

describe('à qui le mode parent s offre', () => {
  test('aux rôles sportifs ; ni au parent (il y est), ni au super admin', () => {
    expect(['player', 'coach', 'president'].map(canUseParentMode)).toEqual([true, true, true]);
    expect(['parent', 'superAdmin', 'new'].map(canUseParentMode)).toEqual([false, false, false]);
  });
});

describe('le rôle d AFFICHAGE', () => {
  const joue = { myTeams: [{ documentId: 'u15' }] };

  test.each([
    ['joueur en mode parent', 'parent', 'player', 'parent', joue],
    ['dirigeant en mode parent', 'parent', 'president', 'parent', joue],
    ['entraîneur qui ne joue pas, en mode parent', 'parent', 'coach', 'parent', { myTeams: [] }],
    ['dirigeant qui joue, en mode joueur', 'player', 'president', 'player', joue],
    ['joueur sans demande', 'player', 'player', null, joue],
    ['compte Parent (déjà parent)', 'parent', 'parent', null, null],
    ['compte Parent qui demanderait « joueur »', 'parent', 'parent', 'player', joue],
    ['super admin qui demanderait « parent »', 'superAdmin', 'superAdmin', 'parent', joue],
  ])('%s → %s', (_, attendu, accountRoleKey, displayModeRequest, userData) => {
    expect(resolveDisplayRoleKey({
      accountRoleKey,
      displayModeRequest,
      userData,
    })).toBe(attendu);
  });
});
