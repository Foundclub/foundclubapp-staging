import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// FINITIONS6 · F6-1 — « CHANGER DE COMPTE » PERDU APRES UNE SORTIE PAR « RETOUR ».
//
// 🔍 Tournee 8, constate 3 fois : choisir Karim, quitter l'app par « retour »
// depuis la racine, rouvrir ⇒ l'app revient au compte actif au DEMARRAGE de
// l'app (Test Adel). Un redemarrage A FROID, lui, garde le bon compte.
//
// 🧭 DIAGNOSTIC (lecture du code) : sur Android, « retour » a la racine detruit
// l'ecran, mais le moteur JS reste vivant ; a la reouverture, l'arbre React se
// REMONTE sans que les modules soient relus. Or l'etat initial du contexte
// (`initStore`, appContext.js) etait une CONSTANTE calculee une fois, au
// chargement du module, depuis le stockage : le remontage repartait de cette
// photo du demarrage. Le stockage, lui, avait bien enregistre le nouveau compte
// — d'ou le bon compte a froid, quand le module est relu.
//
// Ce temoin rejoue exactement ce cycle : monter le fournisseur, changer de
// compte, le DEMONTER (sortie par « retour »), le REMONTER dans le MEME module
// (reouverture a chaud).
// ==========================================================================

const mockStockage = new Map();

jest.mock('@/platform/storage', () => {
  const dorsal = {
    addOnValueChangedListener: () => ({ remove: () => {} }),
    clearAll: () => mockStockage.clear(),
    contains: (cle) => mockStockage.has(cle),
    delete: (cle) => mockStockage.delete(cle),
    getAllKeys: () => [...mockStockage.keys()],
    getBoolean: (cle) => mockStockage.get(cle),
    getNumber: (cle) => mockStockage.get(cle),
    getString: (cle) => mockStockage.get(cle),
    set: (cle, valeur) => mockStockage.set(cle, valeur),
  };
  return {
    __esModule: true,
    default: dorsal,
    getStorageBackend: () => dorsal,
    storageBackend: dorsal,
  };
});

const session = (documentId, firstname) => ({
  idToken: `jeton-firebase-${documentId}`,
  token: `jeton-${documentId}`,
  user: { documentId, firstname, lastname: 'Recette' },
});
const TEST_ADEL = session('test-adel', 'Test');
const KARIM = session('karim-benali', 'Karim');

/** @type {any} */
let vu;
/** @type {any} */
let envoyer;

/** @type {any} */
let AppProvider;
/** @type {any} */
let useAppContext;

/**
 * Sonde : garde l'etat et l'envoi du contexte a chaque rendu.
 * @returns {null}
 */
function Sonde() {
  const [etat, dispatch] = useAppContext();
  vu = etat;
  envoyer = dispatch;
  return null;
}

const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<AppProvider><Sonde /></AppProvider>);
  });
  return arbre;
};

// Le telephone de la tournee : deux comptes enregistres, Test Adel actif au demarrage.
const remplirLeTelephone = () => {
  mockStockage.clear();
  mockStockage.set('authSessions', JSON.stringify([TEST_ADEL, KARIM]));
  mockStockage.set('activeSessionDocumentId', 'test-adel');
};

// Le module est lu UNE fois, telephone deja rempli : c'est le demarrage de l'app.
beforeAll(() => {
  remplirLeTelephone();
  // eslint-disable-next-line global-require
  ({ AppProvider, useAppContext } = require('@/store/appContext'));
});

beforeEach(remplirLeTelephone);

describe('FINITIONS6 · F6-1 — le compte choisi survit a une sortie par « retour »', () => {
  test('🚨 changer de compte, sortir par « retour », rouvrir : TOUJOURS Karim', () => {
    const premier = monter();
    expect(vu.auth.user.documentId).toBe('test-adel');

    act(() => {
      envoyer({ payload: 'karim-benali', type: 'SET_ACTIVE_SESSION' });
    });
    expect(vu.auth.user.documentId).toBe('karim-benali');
    expect(mockStockage.get('activeSessionDocumentId')).toBe('karim-benali');

    act(() => premier.unmount()); // « retour » depuis la racine
    const second = monter(); // reouverture a chaud : meme moteur JS, memes modules

    expect(vu.activeSessionDocumentId).toBe('karim-benali');
    expect(vu.auth.user.documentId).toBe('karim-benali');
    act(() => second.unmount());
  });

  test('🔒 la liste des comptes enregistres est intacte apres la reouverture', () => {
    const premier = monter();
    act(() => {
      envoyer({ payload: 'karim-benali', type: 'SET_ACTIVE_SESSION' });
    });
    act(() => premier.unmount());
    const second = monter();

    expect(vu.authSessions.map((/** @type {any} */ s) => s.user.documentId))
      .toEqual(['karim-benali', 'test-adel']);
    act(() => second.unmount());
  });

  test('🔒 premier montage (demarrage a froid) : le compte enregistre comme actif', () => {
    const arbre = monter();

    expect(vu.auth.user.documentId).toBe('test-adel');
    expect(vu.authSessions).toHaveLength(2);
    act(() => arbre.unmount());
  });
});
