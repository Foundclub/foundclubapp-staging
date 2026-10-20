import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverComplexe from '@/views/reserverTerrain/ReserverComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { complexePublic, terrainPublic } from '@/testSupport/temoinReserver';

// RESA-L6B-2 (20/10/2026) — E-P02, la communauté du complexe côté joueur (serveur RESA-L4 ;
// planches EP02 états 1 à 4 et 10, RA2 ; plan E-P02 ; A-G06, A-G08, A-G12, A-G25, RC-G10, RC-G16,
// Q5, AT-11 A, AT-15 A) :
//   · le cœur : « Ajouter aux favoris » / « Dans tes favoris » ; ajouté : « Ajouté à tes
//     favoris. Tu reçois maintenant les nouvelles du complexe. » ; retirer : la feuille (le canal
//     gardé, la case « Quitter aussi le canal ») ;
//   · le bandeau d'arrivée par l'affiche (`depuis: 'affiche'`) : « Ajoute … à tes favoris » ;
//   · « … » ⇒ « Signaler ce complexe » ⇒ le motif ⇒ « Merci, FoundClub va regarder. » ;
//   · « Ta fidélité ici 8/10 » et ce qui reste (ou la récompense) ;
//   · « Canal du complexe · 214 membres » ⇒ le canal (E-P12), sinon « Mets le complexe en
//     favori… » ;
//   · « Nos partenaires » (Infos) : une rangée par partenaire, son site s'il en a un.

// Un écran entier monté : sous charge (suite complète, PC occupé), le premier cas paie le
// chargement des modules et dépassait les 5 s par défaut (motif de COLL-CONSOLE, 02/10).
jest.setTimeout(30000);

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({ slug: 'le-five-de-montrivage' });
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockRelation = /** @type {any} */ ({});
const mockLireLaRelation = jest.fn().mockImplementation(() => mockRelation);
let mockUtilisateur = /** @type {any} */ (null);
let mockPartenaires = /** @type {any} */ ({});
const mockAjouter = jest.fn();
const mockRetirer = jest.fn();
const mockSignaler = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAjouterAuxFavoris: () => ({ isPending: false, mutateAsync: mockAjouter }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic(),
  }),
  useCreneauxDuJour: () => ({ data: { slots: [] } }),
  useMaRelationAuComplexe: (/** @type {any[]} */ ...args) => mockLireLaRelation(...args),
  usePartenairesPublics: () => mockPartenaires,
  useRetirerDesFavoris: () => ({ isPending: false, mutateAsync: mockRetirer }),
  useSignalerUnComplexe: () => ({ isPending: false, mutateAsync: mockSignaler }),
  useTerrainsPublics: () => ({
    data: [jest.requireActual('@/testSupport/temoinReserver').terrainPublic()],
  }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUtilisateur }),
}));
jest.mock('@/platform/maps/externalMap', () => ({ openExternalMap: jest.fn() }));
jest.mock('@/views/search/searchRouteHelpers', () => ({ navigateToSearchHub: jest.fn() }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => (
  function FauxSegments(/** @type {any} */ { onChange, options, value }) {
    const { Text: Texte, TouchableOpacity: Touche, View: Vue } = jest.requireActual('react-native');
    return (
      <Vue>
        {options.map((/** @type {any} */ option) => (
          <Touche
            accessibilityState={{ selected: option.value === value }}
            key={option.value}
            onPress={() => onChange(option.value)}
          >
            <Texte>{option.label}</Texte>
          </Touche>
        ))}
      </Vue>
    );
  }
));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverComplexe />);
  });
  return arbre;
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    await noeud.props.onPress();
  });
};

/**
 * Le segment « Infos ».
 * @param {any} arbre - L'arbre.
 * @returns {Promise<void>} Fini.
 */
const versLesInfos = async (arbre) => {
  await toucher(pressable(arbre, 'Infos'));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { slug: 'le-five-de-montrivage' };
  mockUtilisateur = { birthdate: '1990-05-02', documentId: 'u-1' };
  mockRelation = {
    data: {
      canal: { chatId: null, membre: false, membres: 214 },
      complexe: { name: 'Le Five de Montrivage', slug: 'le-five-de-montrivage' },
      favori: null,
      fidelite: null,
    },
  };
  mockPartenaires = { data: [] };
  mockAjouter.mockResolvedValue({ canal: { membre: true }, created: true, favori: true });
  mockRetirer.mockResolvedValue({ favori: false });
  mockSignaler.mockResolvedValue({ created: true, message: 'Merci, FoundClub va regarder.' });
});

describe('E-P02 — le favori (A-G06, A-G08, AT-15 A)', () => {
  it('« Ajouter aux favoris » ⇒ le serveur ; « Ajouté à tes favoris… »', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'complexe-favori'));
    expect(mockAjouter).toHaveBeenCalledWith({ origin: 'bouton', slug: 'le-five-de-montrivage' });
    expect(lisibles(arbre)).toContain(
      'Ajouté à tes favoris. Tu reçois maintenant les nouvelles du complexe.',
    );
  });

  it('déjà favori : « Dans tes favoris » ⇒ la feuille, canal gardé, la case', async () => {
    mockRelation = {
      data: {
        ...mockRelation.data,
        canal: { chatId: 'chat-canal', membre: true, membres: 214 },
        favori: { origin: 'bouton', since: '2026-10-10T10:00:00.000Z' },
      },
    };
    const arbre = await monter();
    expect(parRepere(arbre, 'complexe-favori').props.accessibilityLabel).toBe('Dans tes favoris');
    await toucher(parRepere(arbre, 'complexe-favori'));
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Retirer des favoris ?',
      'Tu resteras dans le canal (tu peux le quitter depuis le canal).',
      'Quitter aussi le canal',
    ]));
    await toucher(parRepere(arbre, 'favori-retirer-confirme'));
    expect(mockRetirer).toHaveBeenCalledWith({
      quitterCanal: false, slug: 'le-five-de-montrivage',
    });
  });

  it('arrivé par l’affiche (A-G12) : le bandeau, et le favori part avec son origine', async () => {
    mockParams = { depuis: 'affiche', slug: 'le-five-de-montrivage' };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Ajoute Le Five de Montrivage à tes favoris');
    await toucher(parRepere(arbre, 'complexe-bandeau-affiche'));
    expect(mockAjouter).toHaveBeenCalledWith({ origin: 'affiche', slug: 'le-five-de-montrivage' });
  });
});

describe('E-P02 — « … » ⇒ « Signaler ce complexe » (RC-G16, N-09)', () => {
  it('le motif, « Envoyer », puis « Merci, FoundClub va regarder. »', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'complexe-plus'));
    await toucher(pressable(arbre, 'Signaler ce complexe'));
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Dis-nous ce qui ne va pas. Le complexe ne sait pas qui l’a signalé.',
      'Ce complexe n’existe pas',
      'Informations fausses',
      'Comportement abusif',
      'Autre',
    ]));
    await toucher(parRepere(arbre, 'signaler-motif-informations-fausses'));
    await toucher(parRepere(arbre, 'signaler-envoyer'));
    expect(mockSignaler).toHaveBeenCalledWith({
      complexe: 'le-five-de-montrivage', motif: 'informations-fausses',
    });
    expect(lisibles(arbre)).toContain('Merci, FoundClub va regarder.');
  });
});

describe('E-P02 — la fidélité et le canal', () => {
  it('« Ta fidélité ici 8/10 », ce qui reste ; non membre du canal', async () => {
    mockRelation = {
      data: {
        ...mockRelation.data,
        fidelite: {
          count: 8, disponible: false, restant: 2, reward: '1 partie offerte', threshold: 10,
        },
      },
    };
    expect(lisibles(await monter())).toEqual(expect.arrayContaining([
      'Ta fidélité ici',
      '8/10',
      'Encore 2 réservations avant « 1 partie offerte »',
      'Mets le complexe en favori pour recevoir ses nouvelles.',
    ]));
  });

  it('membre du canal : « Canal du complexe · 214 membres » ⇒ le canal (E-P12)', async () => {
    mockRelation = {
      data: { ...mockRelation.data, canal: { chatId: 'chat-canal', membre: true, membres: 214 } },
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('214 membres');
    await toucher(pressable(arbre, 'Canal du complexe'));
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'chat-canal' });
  });
});

describe('E-P02 — « Nos partenaires » (A-G25, planche RA2)', () => {
  it('une rangée par partenaire ; son site s’ouvre ; aucun : pas de section', async () => {
    mockPartenaires = {
      data: [
        { link: 'https://sport-montrivage.fr', logo: null, title: 'Sport Montrivage' },
        { link: null, logo: null, title: 'Boulangerie Roux' },
      ],
    };
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const arbre = await monter();
    await versLesInfos(arbre);
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Nos partenaires', 'Sport Montrivage', 'Boulangerie Roux',
    ]));
    await toucher(pressable(arbre, 'Sport Montrivage'));
    expect(ouvrir).toHaveBeenCalledWith('https://sport-montrivage.fr');
    mockPartenaires = { data: [] };
    const sans = await monter();
    await versLesInfos(sans);
    expect(lisibles(sans)).not.toContain('Nos partenaires');
  });
});

it('l’aperçu du gérant : ni cœur, ni « … », ni fidélité', async () => {
  mockParams = { apercu: true, slug: 'le-five-de-montrivage' };
  const arbre = await monter();
  expect(parRepere(arbre, 'complexe-favori')).toBeNull();
  expect(parRepere(arbre, 'complexe-plus')).toBeNull();
  expect(complexePublic().name).toBe('Le Five de Montrivage');
  expect(terrainPublic().name).toBe('Terrain 1');
});

// La page publique du site (RESA-L7-1) monte cet écran SANS compte : rien de ce qui me concerne
// (favori, fidélité, canal, signalement) n'est montré ni demandé au serveur.
it('sans compte (la page publique du site) : ni cœur, ni « … », rien de lu sur moi', async () => {
  mockUtilisateur = null;
  const arbre = await monter();
  expect(parRepere(arbre, 'complexe-favori')).toBeNull();
  expect(parRepere(arbre, 'complexe-plus')).toBeNull();
  expect(mockLireLaRelation).toHaveBeenCalledWith('le-five-de-montrivage', { enabled: false });
});
