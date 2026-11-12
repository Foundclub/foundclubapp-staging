/**
 * T9-RETOURS-B (12/11/2026, recette du train 9, ligne 18, M1207) — « Le bouton apparaît uniquement
 * en mode parent, pas en mode joueur » (Adel).
 *
 * Un joueur né Joueur, avec un enfant, passe en mode parent par « Mon compte » (ACCUEIL-JOUEUR).
 * L'accueil lui montre alors « Ton mode : Parent | Joueur ». Il touche « Joueur » : la bascule
 * disparaissait, car l'origine figée au premier geste restait « joueur » — le contrôle s'effaçait
 * de lui-même. Règle corrigée : un compte Joueur qui a CHOISI le mode parent garde la bascule
 * dans les deux sens. Un né Joueur qui ne l'a jamais choisi n'a toujours aucun bandeau (D19).
 * Écrit ROUGE sur la base (fix/INVITE-REFUS-app 8143e6ce2).
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
  readDisplayModeRequest,
  readParentOrigin,
  writeDisplayModeRequest,
} = require('@/domains/auth/playerMode');

/**
 * La bascule de l'accueil, telle que l'accueil la calcule (useAuth).
 * @param {string} compte - Le compte.
 * @returns {boolean} Vrai si elle s'affiche.
 */
const basculeOfferte = (compte) => offersParentSwitch({
  accountRoleKey: 'player',
  displayModeRequest: readDisplayModeRequest(compte),
  origin: readParentOrigin(compte),
});

beforeEach(() => {
  mockStockage.clear();
});

test('né Joueur : Mon compte → Parent → Joueur, la bascule reste (M1207)', () => {
  expect(basculeOfferte('j-1')).toBe(false);
  // « Basculer en mode parent » (Mon compte).
  writeDisplayModeRequest('j-1', 'parent', 'player');
  expect(basculeOfferte('j-1')).toBe(true);
  // « Joueur » dans « Ton mode » : le chemin vers Parent reste au même endroit.
  writeDisplayModeRequest('j-1', null, 'player');
  expect(basculeOfferte('j-1')).toBe(true);
});

test('né Joueur qui n’a jamais choisi Parent : toujours aucune bascule (D19)', () => {
  writeDisplayModeRequest('j-2', null, 'player');
  expect(basculeOfferte('j-2')).toBe(false);
});

test('dirigeant ou entraîneur : aucune origine écrite (inchangé)', () => {
  writeDisplayModeRequest('d-1', 'parent', 'coach');
  writeDisplayModeRequest('d-2', 'parent', 'president');
  expect([...mockStockage.keys()].filter((cle) => cle.startsWith('user.parent_origin.')))
    .toEqual([]);
});
