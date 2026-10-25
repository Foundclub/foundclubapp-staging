// BH02 (BUGHUNT 24/10) — P2-07 : un échec d'écriture (sérialisation ratée ou trop grosse)
// ne doit pas effacer les sessions enregistrées. Échafaudage repris de FINITIONS6.
import renderer, { act } from 'react-test-renderer';

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
let AppProvider;
/** @type {any} */
let useAppContext;

/**
 * Sonde : garde l'etat et l'envoi du contexte a chaque rendu.
 * @returns {null}
 */
function Sonde() {
  useAppContext();
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

test('P2-07 : une sérialisation ratée garde les sessions enregistrées', () => {
  const { stringify } = JSON;
  const espion = jest.spyOn(JSON, 'stringify').mockImplementation((valeur, ...reste) => {
    if (Array.isArray(valeur)) throw new Error('echec simule');
    return stringify(valeur, ...reste);
  });
  const avant = mockStockage.get('authSessions');
  const arbre = monter();
  espion.mockRestore();
  expect(mockStockage.get('authSessions')).toBe(avant);
  act(() => arbre.unmount());
});
