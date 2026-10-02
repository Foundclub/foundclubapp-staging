import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubSlotRequests from '../ClubSlotRequests';

// 🏛️ COLL-C3B (02/10) — « TES DEMANDES À LA VILLE » (planches P8v2-demande, tel état 5, ordi C).
// Écran NEUF : ce témoin était rouge faute d'écran. Ce qu'il fige :
//   - la réponse et le mot de la mairie au même endroit : équipe · installation, le moment,
//     l'état (En attente / Acceptée / Refusée), « c'était complet à l'envoi », le mot en citation ;
//   - une série se lit « Chaque jeudi, … jusqu'au 30 juin » ;
//   - un refus propose « Demander une autre heure » (le formulaire, prérempli) ;
//   - vide : une phrase ; sur ordinateur : un tableau.

const mockGet = jest.fn();
const mockNavigate = jest.fn();
let mockDimensions = {
  fontScale: 1, height: 812, scale: 2, width: 375,
};

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args), post: jest.fn(), put: jest.fn() },
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { club: { documentId: 'club-A' } } }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        const valeurs = typeof repli === 'object' && repli ? repli : options;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
      },
    }),
  };
});
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const ligne = (/** @type {any} */ champs) => ({
  collectivite: { name: 'Ville de Montrivage' },
  decisionReason: null,
  facility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls' },
  isRecurring: false,
  maxSlots: 2,
  overlapCount: 2,
  requestedEnd: '2030-10-03T17:30:00.000Z',
  requestedStart: '2030-10-03T16:00:00.000Z',
  series: null,
  seriesCount: 1,
  status: 'pending',
  team: { documentId: 'u13', name: 'U13' },
  ...champs,
});
const EN_ATTENTE = ligne({ documentId: 'rq-1' });
const ACCEPTEE = ligne({
  decisionReason: 'Accord de la mairie, bon entraînement !',
  documentId: 'rq-2',
  status: 'approved',
  team: { documentId: 'u15', name: 'U15' },
});
const REFUSEE = ligne({
  decisionReason: 'Gymnase complet le 8 octobre',
  documentId: 'rq-3',
  status: 'refused',
  team: { documentId: 'u15', name: 'U15' },
});
const SERIE = ligne({
  documentId: 'rq-4',
  isRecurring: true,
  series: { until: '2031-06-30' },
  seriesCount: 30,
});
const heure = (/** @type {string} */ iso) => format(new Date(iso), 'HH:mm');
const JOUR = format(new Date(EN_ATTENTE.requestedStart), 'EEE d MMM', { locale: fr });
// eslint-disable-next-line max-len
const MOMENT = `${JOUR.charAt(0).toUpperCase()}${JOUR.slice(1)}, ${heure(EN_ATTENTE.requestedStart)} – ${heure(EN_ATTENTE.requestedEnd)}`;

let mockLignes = [EN_ATTENTE, ACCEPTEE, REFUSEE, SERIE];

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());

jest.setTimeout(20000);
const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let essai = 0; essai < 150 && !condition(); essai += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 20); }); });
  }
};
const monter = async (/** @type {(lus: string[]) => boolean} */ pret) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <ClubSlotRequests />
      </QueryClientProvider>,
    );
  });
  await attendre(() => pret(textes(arbre)));
  return arbre;
};

beforeEach(() => {
  mockDimensions = {
    fontScale: 1, height: 812, scale: 2, width: 375,
  };
  mockLignes = [EN_ATTENTE, ACCEPTEE, REFUSEE, SERIE];
  mockGet.mockReset();
  mockNavigate.mockReset();
  mockGet.mockImplementation(async (/** @type {string} */ url, /** @type {any} */ config) => {
    if (url === '/facility-override-requests/sent' && config?.params?.clubId === 'club-A') {
      return { data: { data: mockLignes } };
    }
    throw new Error(`GET inattendu ${url}`);
  });
});

describe('COLL-C3B — « Tes demandes à la Ville »', () => {
  it('la réponse et le mot de la mairie, au même endroit ; une série sur une ligne', async () => {
    const lus = textes(await monter((l) => l.includes('Acceptée')));
    expect(lus).toEqual(expect.arrayContaining([
      'Tes demandes à la Ville',
      'U13 · Gymnase des Tilleuls',
      'En attente',
      `${MOMENT} · c’était complet à l’envoi`,
      'Acceptée',
      '« Accord de la mairie, bon entraînement ! »',
      'Refusée',
      `${MOMENT} · l’entraînement est annulé`,
      '« Gymnase complet le 8 octobre »',
      // eslint-disable-next-line max-len
      `Chaque jeudi, ${heure(SERIE.requestedStart)} – ${heure(SERIE.requestedEnd)}, jusqu’au 30 juin · c’était complet à l’envoi`,
    ]));
  });

  it('un refus propose « Demander une autre heure » : le formulaire, prérempli', async () => {
    const arbre = await monter((l) => l.includes('Refusée'));
    // eslint-disable-next-line max-len
    const bouton = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'bouton-Demander une autre heure'
      && typeof n.props?.onPress === 'function')[0];
    await act(async () => { bouton.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ClubSlotRequest', {
      clubId: 'club-A', facilityId: 'gym-ville', teamId: 'u15',
    });
  });

  it('vide : une phrase, et « Demander un créneau »', async () => {
    mockLignes = [];
    // eslint-disable-next-line max-len
    const lus = textes(await monter((l) => l.includes('Aucune demande envoyée à une Ville pour l’instant.')));
    expect(lus).toContain('Demander un créneau');
  });

  // eslint-disable-next-line max-len
  it('sur ordinateur : un tableau — équipe, installation, moment, réponse, mot de la mairie', async () => {
    mockDimensions = {
      fontScale: 1, height: 900, scale: 1, width: 1280,
    };
    const arbre = await monter((l) => l.includes('Mot de la mairie'));
    // eslint-disable-next-line max-len
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'demandes-tableau').length).toBeGreaterThan(0);
    // eslint-disable-next-line max-len
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Équipe', 'Installation', 'Moment', 'Réponse', 'Mot de la mairie']));
  });
});
