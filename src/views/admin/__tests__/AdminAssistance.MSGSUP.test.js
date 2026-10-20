import fs from 'fs';
import path from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminAssistance from '../AdminAssistance';
import useAssistanceTile from '../components/useAssistanceTile';

// ==========================================================================
// MSG-SUPPORT (20/10/2026) — LA BOÎTE « ASSISTANCE » DE LA CONSOLE (super-admins).
//
// « Nous, en tant que super admin, on reçoit les messages » ; décision « A » : une boîte COMMUNE.
// Ce que le témoin tient :
//   1. la boîte montre chaque conversation écrite, dans l'ordre du serveur (non lues d'abord),
//      avec le nom du titulaire, son aperçu, la pastille des non-lus et « En attente de réponse » ;
//      un compte supprimé se lit « Compte supprimé » ; une réponse de l'équipe se préfixe
//      « Assistance : » ;
//   2. un appui ouvre la conversation ordinaire, en type `assistance`, titrée du titulaire ;
//   3. la tuile de l'accueil de la console dit les non-lus et les attentes (orange) ;
//   4. l'écran n'existe que dans la pile de la console (SuperAdmin), a son adresse sur le site,
//      et la tuile de l'accueil y mène.
// ==========================================================================

const mockNavigate = jest.fn();
/** @type {any} */
let mockBoite;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      const gabarit = String(repli?.defaultValue || cle);
      return gabarit.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(repli?.[nom] ?? ''));
    },
  }),
}));

jest.mock('@/services/chat/assistanceQueries', () => ({
  useBoiteAssistance: () => mockBoite,
}));
// Le VRAI thème (couleurs et polices du pack), sans fournisseur.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs), Images: {} }),
  };
});
jest.mock('@/views/admin/components/AdminStateView', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock('@/utils/errors/displayError', () => ({ getErrorMessage: () => 'erreur' }));
// La pastille des non-lus (la vraie, formatThreadUnreadBadge) vit dans useUnreadMessages,
// qui charge
// la liste des conversations et l'authentification : ces deux-là sont doublés, aucun réseau.
jest.mock('@/services/chat/chatQueriesCompat', () => ({ useGetChats: () => ({}) }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: null }),
}));

const BOITE = {
  conversations: [
    {
      dernierMessage: {
        apercu: 'Vous êtes là ?', createdAt: '2026-10-20T15:05:00.000Z', deLAssistance: false,
      },
      documentId: 'fil-lina',
      enAttente: true,
      nonLus: 2,
      titulaire: {
        avatar: null, firstname: 'Lina', lastname: 'Moreau', supprime: false,
      },
    },
    {
      dernierMessage: {
        apercu: 'C’est réglé.', createdAt: '2026-10-20T14:00:00.000Z', deLAssistance: true,
      },
      documentId: 'fil-marc',
      enAttente: false,
      nonLus: 0,
      titulaire: {
        avatar: null, firstname: 'Marc', lastname: 'Petit', supprime: false,
      },
    },
    {
      dernierMessage: {
        apercu: 'Merci', createdAt: '2026-10-19T09:00:00.000Z', deLAssistance: false,
      },
      documentId: 'fil-parti',
      enAttente: true,
      nonLus: 0,
      titulaire: {
        avatar: null, firstname: '', lastname: '', supprime: true,
      },
    },
  ],
  enAttenteTotal: 2,
  nonLusTotal: 2,
};

const lecture = (surcharge = {}) => ({
  data: BOITE, error: null, isFetching: false, isLoading: false, refetch: jest.fn(), ...surcharge,
});
const aplatir = (/** @type {any} */ enfants) => (
  Array.isArray(enfants) ? enfants.map(aplatir).join('') : String(enfants ?? '')
);
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ t) => aplatir(t.props.children));
const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => (
  arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id)[0] || null
);

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<AdminAssistance />); });
  return arbre;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockBoite = lecture();
});

describe('MSG-SUPPORT — la boîte commune de l\'assistance', () => {
  test('1. chaque conversation écrite, dans l’ordre du serveur', async () => {
    const arbre = await monter();
    const vus = textes(arbre);
    const ordre = ['Lina Moreau', 'Marc Petit', 'Compte supprimé'].map((nom) => vus.indexOf(nom));
    expect(ordre.every((i) => i >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(vus).toContain('Vous êtes là ?');
    expect(vus).toContain('Assistance : C’est réglé.');
    expect(parTestId(arbre, 'boite-assistance-non-lus-fil-lina')).not.toBeNull();
    expect(parTestId(arbre, 'boite-assistance-non-lus-fil-marc')).toBeNull();
    expect(parTestId(arbre, 'boite-assistance-en-attente-fil-lina')).not.toBeNull();
    expect(parTestId(arbre, 'boite-assistance-en-attente-fil-marc')).toBeNull();
    expect(vus).toContain('2 non lus · 2 en attente de réponse');
  });

  test('2. un appui ouvre la conversation (type assistance, titre du titulaire)', async () => {
    const arbre = await monter();
    await act(async () => { parTestId(arbre, 'boite-assistance-ligne-fil-lina').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'fil-lina', chatType: 'assistance', title: 'Lina Moreau',
    });
  });

  test('1 bis. boîte vide : une phrase le dit', async () => {
    mockBoite = lecture({ data: { conversations: [], enAttenteTotal: 0, nonLusTotal: 0 } });
    const arbre = await monter();
    expect(parTestId(arbre, 'boite-assistance-vide')).not.toBeNull();
  });
});

describe('MSG-SUPPORT — la tuile de l\'accueil de la console', () => {
  /** @type {any} */
  let tuile;
  /**
   * La sonde : relève ce que la tuile affiche.
   * @returns {null} Rien à dessiner.
   */
  function Sonde() {
    tuile = useAssistanceTile();
    return null;
  }
  const lire = async () => {
    await act(async () => { renderer.create(<Sonde />); });
    return tuile;
  };

  test('3. les non-lus en valeur, les attentes en orange', async () => {
    const vue = await lire();
    expect(vue.value).toBe('2');
    expect(vue.detail).toBe('2 en attente de réponse');
  });

  test('3 bis. rien en attente ; « … » en lecture ; « — » en échec (jamais 0)', async () => {
    mockBoite = lecture({ data: { conversations: [], enAttenteTotal: 0, nonLusTotal: 0 } });
    expect((await lire()).detail).toBe('Rien en attente');
    mockBoite = lecture({ data: undefined, isLoading: true });
    expect((await lire()).value).toBe('…');
    mockBoite = lecture({ data: undefined, error: new Error('403') });
    expect((await lire()).value).toBe('—');
  });
});

describe('MSG-SUPPORT — où vit l\'écran', () => {
  const SRC = path.join(__dirname, '..', '..', '..');
  const lireSource = (/** @type {string} */ relatif) => (
    fs.readFileSync(path.join(SRC, relatif), 'utf8')
  );

  test('4. pile de la console seulement, adresse sur le site, la tuile y mène', () => {
    expect(lireSource('navigation/private/stacks/AdminStack.js')).toMatch(/component=\{AdminAssistance\}\s+name=\{RouteNames\.AdminAssistance\}/);
    expect(lireSource('navigation/private/PrivateNavigator.js')).not.toMatch(/AdminAssistance/);
    expect(lireSource('navigation/webRoutes.js')).toMatch(/\[RouteNames\.AdminAssistance\]: '\/admin\/assistance'/);
    const tableau = lireSource('views/admin/AdminDashboard.js');
    expect(tableau).toMatch(/onPress=\{\(\) => navigation\.navigate\(RouteNames\.AdminAssistance\)\}\s+testID="admin-tuile-assistance"/);
  });
});
