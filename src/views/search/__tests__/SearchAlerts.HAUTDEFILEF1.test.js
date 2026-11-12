import { FlatList, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// HAUT-DEFILE-F1 (12/11/2026, décision d'Adel « 245 B » : « le haut défile ») — Rechercher › « Mes
// alertes ». Le titre « Mes Alertes » et le lien « Comment créer une alerte ? » restaient FIGÉS
// au-dessus de la liste (~130 px sur 844, relevé RELEVE-DEFILEMENT n° 2) : ils passent en tête de
// ce qui défile. Le bouton « Créer une alerte » reste posé en bas (barre d'action, exception).
// Rien ne disparaît : ni pendant le chargement, ni sans alerte (le titre reste en haut, l'état
// vide se centre dessous). Doublures reprises de SearchAlerts.ALERTES.test.js.

jest.setTimeout(30000);

const mockDispatch = jest.fn();
const mockContexte = [{}, mockDispatch];
const mockAuth = { userData: { documentId: 'u-1', role: { name: 'Joueur' } } };
const mockAlertes = { valeur: /** @type {any[]} */ ([]) };

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  const theme = {
    Alignments,
    ApplicationStyle: generateApplicationStyle(Colors),
    Colors,
    Fonts: generateFonts(Colors),
    Images: new Proxy({}, { get: () => 1 }),
    scheme: 'dark',
    Spaces,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => mockContexte,
}));

jest.mock('@/services/searchAlert/searchAlertService', () => ({
  deleteSearchAlert: jest.fn(() => Promise.resolve({})),
  getSearchAlerts: jest.fn(() => Promise.resolve({ data: mockAlertes.valeur })),
  updateSearchAlert: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      children, footerComponent, headerComponent, isVisible,
    }) => (
      isVisible ? (
        <View>
          {headerComponent}
          {children}
          {footerComponent}
        </View>
      ) : null
    ),
  };
});

const SearchAlerts = require('../SearchAlerts').default;

const ALERTE_FOOT = {
  documentId: 'al-1',
  filters: {
    activityIds: ['a-foot'],
    city: { label: 'Montrivage', value: '5.37|43.29' },
    radius: 20,
  },
  isActive: true,
  label: 'Football · Montrivage',
  type: 'event',
};

/**
 * Ramasse les chaînes d'un arbre rendu (sortie de `toJSON`).
 * @param {any} node Le noeud.
 * @returns {string[]} Ses chaînes.
 */
const collecterTexte = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collecterTexte);
  return collecterTexte(node.children);
};

const laisserFiler = async () => {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};

/** @type {any} */
let monte = null;
const navigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };

const monter = async (/** @type {any[]} */ alertes) => {
  mockAlertes.valeur = alertes;
  await act(async () => {
    monte = renderer.create(<SearchAlerts navigation={navigation} />);
  });
  await laisserFiler();
  return monte;
};

afterEach(async () => {
  if (monte) await act(async () => { monte.unmount(); });
  monte = null;
});

/**
 * Les textes posés DANS la liste qui défile.
 * @param {any} arbre
 * @returns {string[]} Les textes, dans l'ordre.
 */
const textesDeLaListe = (arbre) => arbre.root.findByType(FlatList).findAllByType(Text)
  .map((/** @type {any} */ n) => collecterTexte(n.props.children).join(''));

describe('HAUT-DEFILE-F1 — Mes alertes : le haut défile', () => {
  it('le titre et le lien du guide sont DANS la liste, avant la première alerte', async () => {
    const lus = textesDeLaListe(await monter([ALERTE_FOOT]));
    expect(lus.indexOf('Mes Alertes')).toBe(0);
    expect(lus.indexOf('Comment créer une alerte ?')).toBe(1);
    expect(lus.indexOf('Football · Montrivage')).toBeGreaterThan(1);
  });

  it('sans alerte : le titre reste en tête de la liste, l état vide dessous', async () => {
    const arbre = await monter([]);
    const lus = textesDeLaListe(arbre);
    expect(lus[0]).toBe('Mes Alertes');
    expect(lus.join(' ')).toContain('Crée une alerte depuis les filtres de recherche.');
    // Le contenu ne se centre plus en bloc : le titre resterait au milieu de l'écran.
    const style = Object.assign({}, ...[arbre.root.findByType(FlatList).props.contentContainerStyle]
      .flat(Infinity).filter(Boolean));
    expect(style.justifyContent).not.toBe('center');
  });

  it('« Créer une alerte » reste hors de la liste (barre d action posée en bas)', async () => {
    const arbre = await monter([ALERTE_FOOT]);
    expect(textesDeLaListe(arbre)).not.toContain('Créer une alerte');
    const partout = arbre.root.findAllByType(Text)
      .map((/** @type {any} */ n) => collecterTexte(n.props.children).join(''));
    expect(partout).toContain('Créer une alerte');
  });
});
