/**
 * T9-RETOURS-B (12/11/2026, recette du train 9, ligne 18, M1207) — « Le bouton apparaît uniquement
 * en mode parent, pas en mode joueur » (Adel).
 *
 * Règle d'Adel du 12/11 (réponse 284 : « si en mode parent il a déclaré des enfants, là il voit la
 * bascule en mode joueur ») : la bascule « Ton mode : Parent | Joueur » s'affiche dès que le
 * compte a AU MOINS UN enfant déclaré ou relié, dans les deux modes ; sans enfant, aucune. On ne
 * mémorise plus d'où vient le compte (« né Parent », « a choisi Parent une fois »).
 * Le nombre d'enfants : `useMesEnfantsEnBref` (fiches déclarées + liens parent), déjà lu par
 * l'accueil et par `useTonMode` ; `offersParentSwitch` ne dit que si le RÔLE y a droit.
 * Écrit ROUGE sur 1a3f49d5d : le premier cas (né Joueur avec enfant, jamais passé en parent).
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
 * La bascule de l'accueil, telle que l'accueil la calcule (useAuth + HomeHub).
 * @param {string} compte - Le compte.
 * @param {number} enfants - Le nombre d'enfants déclarés ou reliés.
 * @returns {boolean} Vrai si elle s'affiche.
 */
const basculeOfferte = (compte, enfants) => offersParentSwitch({
  accountRoleKey: 'player',
  displayModeRequest: readDisplayModeRequest(compte),
  origin: readParentOrigin(compte),
}) && enfants > 0;

beforeEach(() => {
  mockStockage.clear();
});

test('né Joueur avec un enfant, jamais passé en parent : la bascule est là (284)', () => {
  mockStockage.set('user.parent_origin.j-1', 'player');
  expect(basculeOfferte('j-1', 1)).toBe(true);
});

test('né Joueur avec un enfant : Parent puis Joueur, la bascule reste (M1207)', () => {
  writeDisplayModeRequest('j-2', 'parent', 'player');
  expect(basculeOfferte('j-2', 1)).toBe(true);
  writeDisplayModeRequest('j-2', null, 'player');
  expect(basculeOfferte('j-2', 1)).toBe(true);
});

test('sans enfant : aucune bascule, quelle que soit l’origine', () => {
  expect(basculeOfferte('j-3', 0)).toBe(false);
  mockStockage.set('user.parent_origin.j-3', 'parent');
  expect(basculeOfferte('j-3', 0)).toBe(false);
});

test('dirigeant, entraîneur : le rôle y a droit ; compte Parent : pas par ce réglage', () => {
  expect(offersParentSwitch({ accountRoleKey: 'coach' })).toBe(true);
  expect(offersParentSwitch({ accountRoleKey: 'president' })).toBe(true);
  expect(offersParentSwitch({ accountRoleKey: 'parent' })).toBe(false);
});
