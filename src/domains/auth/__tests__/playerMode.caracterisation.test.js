import renderer, { act } from 'react-test-renderer';

/**
 * PAR-L12 (13/10) — TÉMOIN CARACTÉRISANT DE `playerMode.js`, écrit AVANT d'y toucher (E6).
 *
 * Le module n'avait AUCUN test propre : son comportement n'était mesuré que de loin, par le vrai
 * `useAuth` (`useAuth.ROLES.modeJoueur.test.js`). Ce fichier décrit ce qu'il fait au 13/10
 * (`origin/staging` app `8f862825`), fonction par fonction, pour que l'élargissement au « mode
 * parent » (L12, décision D6 A d'Adel) ne casse rien en silence.
 */

const mockStockage = new Map();
const mockPanne = { active: false };

jest.mock('@/store/appContext', () => {
  /**
   * Une opération du stockage, qui lève si la panne est active.
   * @param {(...args: any[]) => any} faire - L'opération.
   * @returns {jest.Mock} - La doublure.
   */
  const operation = (faire) => jest.fn((...args) => {
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
  canUsePlayerMode,
  PLAYER_MODE_ACCOUNT_ROLES,
  readPlayerModeRequest,
  resolveDisplayRoleKey,
  usePlayerModeRequest,
  writePlayerModeRequest,
} = require('@/domains/auth/playerMode');
const { storage } = require('@/store/appContext');

beforeEach(() => {
  mockStockage.clear();
  mockPanne.active = false;
  jest.clearAllMocks();
});

describe('la demande est gardée sur le téléphone, une clé par compte', () => {
  test('« on » sous `user.player_mode.<compte>` ; le retrait EFFACE la clé', () => {
    writePlayerModeRequest('dir-1', true);
    expect(mockStockage.get('user.player_mode.dir-1')).toBe('on');
    expect(readPlayerModeRequest('dir-1')).toBe(true);

    writePlayerModeRequest('dir-1', false);
    expect(mockStockage.has('user.player_mode.dir-1')).toBe(false);
    expect(readPlayerModeRequest('dir-1')).toBe(false);
  });

  test('un autre compte du téléphone n en hérite pas', () => {
    writePlayerModeRequest('dir-1', true);
    expect(readPlayerModeRequest('dir-2')).toBe(false);
  });

  test('toute autre valeur que « on » vaut « pas demandé »', () => {
    mockStockage.set('user.player_mode.dir-1', 'oui');
    expect(readPlayerModeRequest('dir-1')).toBe(false);
  });

  test('sans compte, rien n est lu ni écrit', () => {
    writePlayerModeRequest('', true);
    writePlayerModeRequest(undefined, true);
    expect(storage.set).not.toHaveBeenCalled();
    expect(readPlayerModeRequest(null)).toBe(false);
  });

  test('stockage en panne : on lit « pas demandé », et l écriture ne casse rien', () => {
    mockPanne.active = true;
    expect(readPlayerModeRequest('dir-1')).toBe(false);
    expect(() => writePlayerModeRequest('dir-1', true)).not.toThrow();
  });
});

describe('les écrans qui lisent le mode basculent ensemble', () => {
  test('`usePlayerModeRequest` se redessine quand la demande change', () => {
    /** @type {boolean[]} */
    const vus = [];
    /**
     * La sonde : elle note chaque valeur lue.
     * @returns {null} - Rien à l'écran.
     */
    function Sonde() {
      vus.push(usePlayerModeRequest('dir-1'));
      return null;
    }
    /** @type {any} */
    let arbre;
    act(() => { arbre = renderer.create(<Sonde />); });
    act(() => writePlayerModeRequest('dir-1', true));
    act(() => writePlayerModeRequest('dir-1', false));
    act(() => arbre.unmount());

    expect(vus).toEqual([false, true, false]);
  });
});

describe('qui peut voir l app en joueur', () => {
  test('les rôles qui ont quelque chose à « quitter » : dirigeant et entraîneur', () => {
    expect(PLAYER_MODE_ACCOUNT_ROLES).toEqual(['president', 'coach']);
  });

  test('il faut encadrer ET jouer dans au moins une équipe', () => {
    const joue = { myTeams: [{ documentId: 'u15' }] };
    expect(canUsePlayerMode('president', joue)).toBe(true);
    expect(canUsePlayerMode('coach', joue)).toBe(true);
    expect(canUsePlayerMode('president', { myTeams: [] })).toBe(false);
    expect(canUsePlayerMode('president', null)).toBe(false);
    expect(canUsePlayerMode('player', joue)).toBe(false);
    expect(canUsePlayerMode('parent', joue)).toBe(false);
  });

  test('le rôle d affichage : « player » si demandé ET possible, sinon le rôle du compte', () => {
    const joue = { myTeams: [{ documentId: 'u15' }] };
    expect(resolveDisplayRoleKey({
      accountRoleKey: 'president', isPlayerModeRequested: true, userData: joue,
    })).toBe('player');
    expect(resolveDisplayRoleKey({
      accountRoleKey: 'president', isPlayerModeRequested: false, userData: joue,
    })).toBe('president');
    expect(resolveDisplayRoleKey({
      accountRoleKey: 'president', isPlayerModeRequested: true, userData: { myTeams: [] },
    })).toBe('president');
    expect(resolveDisplayRoleKey({
      accountRoleKey: 'parent', isPlayerModeRequested: true, userData: joue,
    })).toBe('parent');
  });
});
