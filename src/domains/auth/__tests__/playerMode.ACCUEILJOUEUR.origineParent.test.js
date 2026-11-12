/**
 * ACCUEIL-JOUEUR (09/11/2026, retour d'un vrai joueur relayé par Adel) — LA BASCULE PARENT NE
 * S'OFFRE QU'À QUI A CHOISI « PARENT » À L'INSCRIPTION.
 *
 * Un joueur lisait en tête de son accueil « Mode joueur … t'attend dans le mode parent.
 * [Revenir en mode parent] » sans comprendre. Règle d'Adel : le bandeau de bascule (dans les deux
 * sens) n'apparaît qu'aux comptes nés Parent ; un compte né Joueur ne le voit jamais, même avec
 * des enfants (pour lui, un bouton discret dans « Mon compte »). Un compte en mode parent garde
 * toujours un chemin pour revenir.
 *
 * Le serveur ne garde pas le choix de l'inscription : un Parent qui « pratique aussi » devient
 * Joueur (`FeuillePratiqueAussi`). L'ORIGINE se garde donc sur le téléphone, à côté du mode
 * d'affichage (`user.parent_origin.<compte>`), et se FIGE au premier changement de mode.
 * Un ancien compte sans origine écrite : « parent » s'il est en mode parent en ce moment (le
 * seul signe qu'il reste), sinon « joueur » — il garde alors le bouton de « Mon compte ».
 * Écrit ROUGE : `readParentOrigin`, `writeParentOrigin` et `offersParentSwitch` n'existaient pas.
 */

const mockStockage = new Map();

jest.mock('@/store/appContext', () => ({
  storage: {
    delete: jest.fn((cle) => mockStockage.delete(cle)),
    getString: jest.fn((cle) => mockStockage.get(cle)),
    set: jest.fn((cle, valeur) => mockStockage.set(cle, valeur)),
  },
}));

const {
  offersParentSwitch,
  readParentOrigin,
  writeDisplayModeRequest,
  writeParentOrigin,
} = require('@/domains/auth/playerMode');

beforeEach(() => {
  mockStockage.clear();
});

describe('qui voit la bascule parent', () => {
  test('joueur pur (né Joueur, sans enfant ni mode parent) : pas de bascule', () => {
    expect(readParentOrigin('j-1')).toBe('player');
    expect(offersParentSwitch({
      accountRoleKey: 'player', displayModeRequest: null, origin: 'player',
    })).toBe(false);
  });

  test('joueur avec enfant, né Joueur : pas de bascule sur l accueil', () => {
    expect(offersParentSwitch({
      accountRoleKey: 'player', displayModeRequest: null, origin: 'player',
    })).toBe(false);
  });

  test('joueur né Joueur passé en mode parent (par Mon compte) : le retour reste offert', () => {
    writeDisplayModeRequest('j-2', 'parent', 'player');
    expect(offersParentSwitch({
      accountRoleKey: 'player', displayModeRequest: 'parent', origin: 'player',
    })).toBe(true);
    // T9-RETOURS-B (12/11, M1207) : il a CHOISI le mode parent ; revenu en joueur, la bascule
    // reste (avant : « la bascule se tait de nouveau », le contrôle s'effaçait de lui-même).
    expect(readParentOrigin('j-2')).toBe('parent');
    writeDisplayModeRequest('j-2', null, 'player');
    expect(readParentOrigin('j-2')).toBe('parent');
  });

  test('parent pur (compte Parent) : son bandeau ne passe pas par ce réglage', () => {
    expect(offersParentSwitch({
      accountRoleKey: 'parent', displayModeRequest: null, origin: null,
    })).toBe(false);
  });

  test('parent qui joue aussi : l origine « parent » survit à la bascule en joueur', () => {
    writeParentOrigin('p-1', 'parent');
    writeDisplayModeRequest('p-1', 'parent', 'player');
    writeDisplayModeRequest('p-1', null, 'player');
    expect(readParentOrigin('p-1')).toBe('parent');
    expect(offersParentSwitch({
      accountRoleKey: 'player', displayModeRequest: null, origin: 'parent',
    })).toBe(true);
  });

  test('ancien compte sans origine, en mode parent : figé « parent » au premier geste', () => {
    mockStockage.set('user.player_mode.a-1', 'parent');
    expect(readParentOrigin('a-1')).toBe('parent');
    writeDisplayModeRequest('a-1', null, 'player');
    expect(mockStockage.get('user.parent_origin.a-1')).toBe('parent');
    expect(readParentOrigin('a-1')).toBe('parent');
  });

  test('ancien compte sans origine, en mode joueur : « joueur », et ça ne bouge plus', () => {
    expect(readParentOrigin('a-2')).toBe('player');
    writeDisplayModeRequest('a-2', null, 'player');
    expect(mockStockage.get('user.parent_origin.a-2')).toBe('player');
    // T9-RETOURS-B (12/11, M1207) : choisir le mode parent, lui, le fait « parent ».
    writeDisplayModeRequest('a-2', 'parent', 'player');
    expect(mockStockage.get('user.parent_origin.a-2')).toBe('parent');
  });

  test('dirigeant ou entraîneur : inchangé, la bascule reste offerte', () => {
    ['president', 'coach'].forEach((accountRoleKey) => {
      expect(offersParentSwitch({ accountRoleKey, displayModeRequest: null, origin: null }))
        .toBe(true);
    });
    // Le rôle n'est pas donné ou n'est pas Joueur : aucune origine écrite.
    writeDisplayModeRequest('d-1', 'player');
    writeDisplayModeRequest('d-2', 'parent', 'coach');
    expect([...mockStockage.keys()].filter((cle) => cle.startsWith('user.parent_origin.')))
      .toEqual([]);
  });
});
