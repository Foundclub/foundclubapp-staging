import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverComplexe from '@/views/reserverTerrain/ReserverComplexe';

import { lisibles, pressable } from '@/testSupport/temoinComplexe';
import { complexePublic } from '@/testSupport/temoinReserver';

// FC-4 PAGE (20/11/2026, planches FICHES-COMPLEXES 1 et 2, validées par Adel) — LA PAGE D'UN COMPLEXE
// CRÉÉE PAR FOUNDCLUB (`pageFoundclub: true`, calculé par le serveur FC-1 : aucun gérant).
// Avant : la page promettait une réservation sur FoundClub (« Complexe de réservation », onglet
// « Réserver » vide, « n'ouvre pas encore ses terrains », règles de réservation, canal) et cachait
// le téléphone derrière « Infos ».
// Après : le bandeau « Page créée par FoundClub… », la pastille « Complexe », une carte « Réserver »
// (« Réserver sur le site du complexe » et « Appeler », ou « Appeler » seul), une seule page sans
// onglets, les horaires (ou leur texte, ou « appelle le complexe »), « Le mot du complexe » gardé,
// « Une info est fausse ? Signale-le ». Un complexe réservable ne change pas.

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({ slug: 'le-five-de-montrivage' });
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockComplexe = /** @type {any} */ ({});
let mockRelation = /** @type {any} */ (null);
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAjouterAuxFavoris: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useAnnoncesOuvertes: () => ({ data: [] }),
  useComplexePublic: () => mockComplexe,
  useCreneauxDuJour: () => ({ data: { slots: [] } }),
  useEvenementsPublics: () => ({ data: [] }),
  useMaRelationAuComplexe: () => ({ data: mockRelation }),
  usePartenairesPublics: () => ({ data: [] }),
  useRetirerDesFavoris: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useSignalerUnComplexe: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useTerrainsPublics: () => ({ data: [], isLoading: false }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: '1990-05-02', documentId: 'u-1' } }),
}));
jest.mock('@/platform/maps/externalMap', () => ({ openExternalMap: jest.fn() }));
jest.mock('@/views/search/searchRouteHelpers', () => ({ navigateToSearchHub: jest.fn() }));

let mockOrdinateur = false;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => (
  function FauxSegments(/** @type {any} */ { options }) {
    const { Text: Texte, View: Vue } = jest.requireActual('react-native');
    return (
      <Vue testID="segments">
        {options.map((/** @type {any} */ option) => <Texte key={option.value}>{option.label}</Texte>)}
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

const RESERVATION = 'https://lefive-montrivage.fr/reserver';
const BANDEAU = 'Page créée par FoundClub. Vous êtes le gérant ? Prenez-en le contrôle';

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
 * La page FoundClub du témoin, telle que `useComplexePublic` la rend.
 * @param {object} [autres] - Les champs qui changent.
 * @returns {any} La lecture.
 */
const pageFoundclub = (autres = {}) => ({
  data: complexePublic({ externalBookingUrl: RESERVATION, pageFoundclub: true, ...autres }),
  isLoading: false,
});

/**
 * La carte « Réserver » de la page.
 * @param {any} arbre - L'arbre.
 * @returns {any[]} Les cartes (0 ou 1).
 */
const cartesReserver = (arbre) => arbre.root.findAll((/** @type {any} */ n) => (
  typeof n.type === 'string' && n.props?.testID === 'complexe-carte-reserver'));

/**
 * Les segments « Réserver » · « Infos » (vue native du faux contrôle).
 * @param {any} arbre - L'arbre.
 * @returns {any[]} 0 ou 1.
 */
const segments = (arbre) => arbre.root.findAll((/** @type {any} */ n) => (
  typeof n.type === 'string' && n.props?.testID === 'segments'));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  mockParams = { slug: 'le-five-de-montrivage' };
  mockOrdinateur = false;
  mockRelation = null;
  mockComplexe = pageFoundclub();
});

describe('FC-4 — la page d’un complexe créée par FoundClub (planches 1 et 2)', () => {
  it('1a — le bandeau, la pastille « Complexe », la carte « Réserver » et son grand bouton', async () => {
    const arbre = await monter();
    const textes = lisibles(arbre);
    expect(textes).toEqual(expect.arrayContaining([
      BANDEAU,
      'Complexe',
      'Tu réserves directement auprès du complexe, pas sur FoundClub.',
    ]));
    expect(textes).not.toContain('Complexe de réservation');
    expect(cartesReserver(arbre)).toHaveLength(1);
    const reserver = pressable(arbre, 'Réserver sur le site du complexe');
    expect(reserver.props.variant).toBe('Primary');
    await act(async () => { reserver.props.onPress(); });
    expect(Linking.openURL).toHaveBeenCalledWith(RESERVATION);
  });

  it('1a/1b — une seule page : ni onglets, ni « n’ouvre pas encore », ni règles, ni canal', async () => {
    mockRelation = { canal: null, favori: false };
    const arbre = await monter();
    const textes = lisibles(arbre);
    expect(segments(arbre)).toHaveLength(0);
    [
      'Infos',
      'Règles',
      'Paiement sur place',
      'Ce complexe n’ouvre pas encore ses terrains à la réservation.',
      'Mets le complexe en favori pour recevoir ses nouvelles.',
    ].forEach((absent) => expect(textes).not.toContain(absent));
    expect(textes.some((texte) => /Réservation à partir de/.test(texte))).toBe(false);
    // Les infos, sans toucher d'onglet.
    expect(textes).toEqual(expect.arrayContaining([
      'Horaires d’accueil', 'Adresse', 'Téléphone du complexe', 'lefive-montrivage.fr',
    ]));
  });

  it('rien ne disparaît sans être déplacé : « Le mot du complexe » reste, hors des règles', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Le mot du complexe', 'Arrive 10 minutes avant, chasubles à l’accueil.',
    ]));
  });

  it('1c — sans lien de réservation : « Appeler » devient le bouton principal', async () => {
    mockComplexe = pageFoundclub({ externalBookingUrl: null });
    const arbre = await monter();
    expect(lisibles(arbre)).not.toContain('Réserver sur le site du complexe');
    const [carte] = cartesReserver(arbre);
    const appeler = carte.findAll((/** @type {any} */ n) => n.props?.title === 'Appeler'
      && typeof n.props?.onPress === 'function');
    expect(appeler[0].props.variant).toBe('Primary');
    await act(async () => { appeler[0].props.onPress(); });
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+33639981234');
  });

  it('ni lien ni téléphone : pas de carte « Réserver »', async () => {
    mockComplexe = pageFoundclub({ externalBookingUrl: null, phoneNumber: null });
    const arbre = await monter();
    expect(cartesReserver(arbre)).toHaveLength(0);
  });

  it('horaires : leur texte, sinon « Horaires : appelle le complexe »', async () => {
    mockComplexe = pageFoundclub({ openingHours: null, openingHoursNote: 'Tous les jours de 10 h à 23 h.' });
    let arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Horaires d’accueil', 'Tous les jours de 10 h à 23 h.',
    ]));
    mockComplexe = pageFoundclub({ openingHours: [], openingHoursNote: null });
    arbre = await monter();
    expect(lisibles(arbre)).toContain('Horaires : appelle le complexe');
  });

  it('« Une info est fausse ? Signale-le » ouvre la feuille du signalement', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Une info est fausse ?');
    await act(async () => { pressable(arbre, 'Signale-le').props.onPress(); });
    expect(lisibles(arbre)).toContain('Signaler ce complexe');
  });

  it('1d — ordinateur : la carte « Réserver » à droite, plus de « Réserver · aujourd’hui »', async () => {
    mockOrdinateur = true;
    const arbre = await monter();
    expect(lisibles(arbre)).not.toContain('Réserver · aujourd’hui');
    expect(lisibles(arbre)).toContain(BANDEAU);
    expect(cartesReserver(arbre)).toHaveLength(1);
  });

  it('E6 — un complexe réservable (`pageFoundclub` absent) garde la page d’aujourd’hui', async () => {
    mockComplexe = { data: complexePublic(), isLoading: false };
    const arbre = await monter();
    const textes = lisibles(arbre);
    expect(segments(arbre)).toHaveLength(1);
    expect(textes).toContain('Complexe de réservation');
    expect(textes).not.toContain(BANDEAU);
    expect(cartesReserver(arbre)).toHaveLength(0);
  });
});
