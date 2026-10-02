/* eslint-disable max-len -- titres et attendus en francais, lus tels quels (ST-MATCH) */
import { Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PendingMatchStatsScreen from '../PendingMatchStatsScreen';

// ==========================================================================
// 📋 ST-MATCH (écran 6, design des statistiques validé le 02/10) — « MATCHS EN
// ATTENTE » : deux vraies sections avec leur nombre, une ligne d'état par
// carte, la carte entière se touche ; l'en-tête et le retour restent pendant le
// chargement et l'erreur ; sur grand écran, un tableau ou deux colonnes.
// Retirés (le témoin les cherche) : « Suivi post-match », « Mon action »,
// « Action d'équipe », le bouton plein de chaque carte.
// ==========================================================================

const mockRequete = {
  data: /** @type {any} */ (null),
  error: /** @type {any} */ (null),
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
};

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPendingMatchStatsPrompts: () => mockRequete,
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    fontScale: 1, height: 800, scale: 2, width: 390,
  })),
}));
jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function RetourDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, { onPress: props.onPress, testID: 'retour' });
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { accessibilityRole: 'button', onPress: props.onPress },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});
/**
 * Le repli de t(), interpolé, avec la règle française des pluriels.
 * @param {string} cle - La clé.
 * @param {any} a - Le repli, ou les options.
 * @param {any} b - Les options, quand un repli est donné.
 * @returns {string} Le texte rendu.
 */
const mockTraduire = (/** @type {string} */ cle, /** @type {any} */ a, /** @type {any} */ b) => {
  const options = typeof a === 'string' ? b : a;
  let modele = typeof a === 'string' ? a : cle;
  if (options && typeof options.count === 'number' && options.defaultValue_one) {
    modele = options.count <= 1 ? options.defaultValue_one : options.defaultValue_other;
  }
  return String(modele).replace(/\{\{(\w+)\}\}/g, (tout, nom) => (
    options && nom in options ? String(options[nom]) : tout
  ));
};
jest.mock('i18next', () => ({ __esModule: true, default: { t: (...args) => mockTraduire(...args) } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => mockTraduire(...args) }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

// Premier montage à froid, machine chargée : au-delà des 5 s par défaut.
jest.setTimeout(30000);

const FIN_19H = '2026-09-05T18:00:00.000Z';
const FIN_22H = '2026-09-05T20:00:00.000Z';
const U15 = { documentId: 'u15', name: 'U15' };
const joueur = (/** @type {any} */ champs = {}) => ({
  actionType: 'player_self_report',
  endedAt: FIN_19H,
  eventId: 'match-19h',
  key: 'event:match-19h:u15:self',
  label: 'AS Montrivage — Test-COMPO',
  score: { available: true, scoreAgainst: 1, scoreFor: 2 },
  sourceType: 'event',
  state: 'todo',
  team: U15,
  ...champs,
});
const entraineur = (/** @type {any} */ champs = {}) => ({
  actionType: 'score_entry',
  endedAt: FIN_22H,
  eventId: 'match-21h',
  key: 'event:match-21h:u15:score',
  label: 'AS Montrivage — adversaire à confirmer',
  score: { available: false },
  sourceType: 'event',
  state: 'score_required',
  team: U15,
  ...champs,
});

const mockNaviguer = jest.fn();
/** @type {any} */
let arbre;
const monter = (/** @type {any} */ requete, largeur = 390) => {
  Object.assign(mockRequete, {
    data: null, error: null, isFetching: false, isLoading: false, ...requete,
  });
  /** @type {any} */ (useWindowDimensions).mockReturnValue({
    fontScale: 1, height: 800, scale: 2, width: largeur,
  });
  act(() => {
    arbre = renderer.create(
      <PendingMatchStatsScreen navigation={/** @type {any} */ ({ goBack: jest.fn(), navigate: mockNaviguer })} />,
    );
  });
  return arbre.root;
};
const textes = (/** @type {any} */ racine) => racine.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).filter((c) => typeof c === 'string').join(''))
  .filter(Boolean);
const parId = (/** @type {any} */ racine, /** @type {string} */ id) => racine
  .findAll((/** @type {any} */ n) => n.props?.testID === id)[0];
const jour = (/** @type {string} */ iso) => {
  const texte = new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', weekday: 'short' });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('ST-MATCH écran 6 — Matchs en attente (téléphone)', () => {
  test('🚨 état 1 — deux sections avec leur nombre, une ligne d état par carte, rien de répété', () => {
    const racine = monter({ data: { items: [joueur(), entraineur()] } });
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining(['Pour moi', 'Pour mon équipe', 'À répondre', 'Score à saisir']));
    expect(vus).toContain('Ta participation, tes chiffres, ta note');
    expect(vus).toContain('Puis la feuille de match');
    expect(vus).toContain(`U15 · ${jour(FIN_19H)} · 2 - 1`);
    expect(vus.join(' ')).not.toMatch(/Suivi post-match|Mon action|Action d'équipe|actions à traiter/);
    // La carte ENTIÈRE se touche, sans bouton qui refait la même chose.
    const carte = parId(racine, 'st-match-attente-carte-event:match-19h:u15:self');
    expect(carte.findAllByType(TouchableOpacity)).toHaveLength(1);
    act(() => { carte.props.onPress(); });
    expect(mockNaviguer).toHaveBeenCalledWith('PlayerMatchResponse', expect.objectContaining({ eventId: 'match-19h' }));
  });

  test('état 2 — brouillon du joueur : ce qui reste, en une ligne', () => {
    const racine = monter({ data: { items: [joueur({ personalResponse: { selfRating: 7 }, state: 'draft' })] } });

    expect(textes(racine)).toEqual(expect.arrayContaining(['Brouillon', 'Il te reste la note de l\'équipe.']));
  });

  test('état 3 — l entraîneur : « Score à saisir », et l heure de fin à la place du score', () => {
    const racine = monter({ data: { items: [entraineur()] } });
    const heure = new Date(FIN_22H).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    expect(textes(racine)).toContain(`U15 · ${jour(FIN_22H)} · fin à ${heure}`);
    expect(textes(racine)).not.toContain('Pour moi');
  });

  test('état 4 — vide : la cause est dite (inchangée)', () => {
    const racine = monter({ data: { emptyReason: 'nothing_pending', items: [] } });

    expect(textes(racine)).toContain('Aucune action en attente');
    expect(parId(racine, 'st-match-attente-vide')).toBeTruthy();
  });

  test('🚨 état 5 — chargement : l en-tête et le retour RESTENT', () => {
    const racine = monter({ isLoading: true });

    expect(parId(racine, 'retour')).toBeTruthy();
    expect(textes(racine)).toContain('Matchs en attente');
    expect(parId(racine, 'st-match-attente-chargement')).toBeTruthy();
  });

  test('🚨 état 6 — erreur : on peut revenir en arrière, et réessayer', () => {
    const racine = monter({ error: new Error('réseau') });

    expect(parId(racine, 'retour')).toBeTruthy();
    expect(textes(racine)).toContain('Les matchs en attente n\'ont pas pu être lus.');
    const reessayer = racine.findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'button'
      && n.findAllByType(Text).some((/** @type {any} */ x) => x.props.children === 'Réessayer'))[0];
    act(() => { reessayer.props.onPress(); });
    expect(mockRequete.refetch).toHaveBeenCalled();
  });
});

describe('ST-MATCH écran 6 — Matchs en attente (ordinateur)', () => {
  test('🖥️ une seule famille : un TABLEAU, une ligne par match, le geste au bout', () => {
    const racine = monter({ data: { items: [entraineur()] } }, 1280);

    expect(parId(racine, 'st-match-attente-tableau')).toBeTruthy();
    expect(textes(racine)).toEqual(expect.arrayContaining(['Match', 'Équipe', 'Fin du match', 'Ce qui reste', 'Saisir le score']));
  });

  test('🖥️ les deux familles : deux colonnes côte à côte, « Pour moi » à gauche', () => {
    const racine = monter({ data: { items: [entraineur(), joueur()] } }, 1280);
    const moi = parId(racine, 'st-match-attente-pour-moi');
    const equipe = parId(racine, 'st-match-attente-pour-mon-equipe');

    expect(moi).toBeTruthy();
    expect(equipe).toBeTruthy();
    expect(parId(racine, 'st-match-attente-tableau')).toBeUndefined();
    const sections = parId(racine, 'st-match-attente-sections');
    expect([].concat(sections.props.style).filter(Boolean).some((s) => s.flexDirection === 'row')).toBe(true);
  });
});
