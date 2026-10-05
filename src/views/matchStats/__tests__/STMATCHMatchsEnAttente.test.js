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

// T9 — les réglages que l'écran demande à la requête sont relevés (relire à l'ouverture).
/** @type {any[]} */
const mockReglagesRequete = [];
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPendingMatchStatsPrompts: (/** @type {any} */ reglages) => {
    mockReglagesRequete.push(reglages);
    return mockRequete;
  },
}));
// FINITIONS14 (point 4) — l'écran lit le compte (le club de ses équipes, camp de gauche du titre).
// `useAuth` charge le client HTTP, absent d'une copie de travail : doublé. Compte vide = titres d'avant.
/** @type {any} */
let mockUtilisateur = null;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUtilisateur }),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockReglagesRequete.length = 0;
});
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

// ---------------------------------------------------------------------------
// 🎯 ST-MONMATCH (écran 6, design validé le 02/10) — LA COLONNE « RÉPONSES » ET LA LIGNE
// « … EST COMPLET ». Le compte vient du serveur (`responses`, lecture des rappels) : N = les
// CONVOQUÉS (« c oui ») ; la feuille, elle, garde tout l'effectif (« feuille convoqués A ») —
// les deux règles sont écrites et vérifiées côté serveur (ST-MONMATCH-matchs-en-attente-reponses).
// ---------------------------------------------------------------------------
describe('ST-MONMATCH écran 6 — « 7 sur 11 » et « … est complet »', () => {
  const PUBLIEE = '2026-10-01T20:39:00.000Z';
  const COMPLET = {
    eventId: 'match-19h',
    finalizedAt: PUBLIEE,
    label: 'AS Montrivage — Test-COMPO',
    responses: { count: 1, total: 1 },
  };
  const le = (/** @type {string} */ iso) => ({
    date: new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    heure: new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  });

  test('🔴 téléphone — la carte de l entraîneur dit combien ont répondu', () => {
    const racine = monter({ data: { items: [entraineur({ responses: { count: 7, total: 11 } })] } });

    expect(textes(racine)).toContain('Puis la feuille de match · 7 sur 11 ont répondu');
  });

  test('🔴 ordinateur — le tableau a sa colonne « Réponses »', () => {
    const racine = monter({ data: { items: [entraineur({ responses: { count: 0, total: 1 } })] } }, 1280);

    expect(textes(racine)).toEqual(expect.arrayContaining(['Réponses', '0 sur 1']));
  });

  test('🔴 téléphone — « … est complet : feuille publiée, 1 sur 1 a répondu. »', () => {
    const racine = monter({ data: { items: [entraineur()], lastCompleted: COMPLET } });

    expect(textes(racine)).toContain('AS Montrivage — Test-COMPO est complet : feuille publiée, 1 sur 1 a répondu.');
    expect(parId(racine, 'st-match-attente-complet')).toBeTruthy();
  });

  test('🔴 ordinateur — la ligne « complet » dit QUAND la feuille a été publiée', () => {
    const racine = monter({ data: { items: [entraineur()], lastCompleted: COMPLET } }, 1280);
    const { date, heure } = le(PUBLIEE);

    expect(textes(racine)).toContain(`AS Montrivage — Test-COMPO est complet : feuille publiée le ${date} à ${heure}, 1 sur 1 a répondu.`);
  });

  test('le dernier match devenu complet vidait la liste : l état vide reste, et la ligne le dit dessous', () => {
    const racine = monter({ data: { emptyReason: 'nothing_pending', items: [], lastCompleted: COMPLET } });

    expect(textes(racine)).toEqual(expect.arrayContaining([
      'Aucune action en attente',
      'AS Montrivage — Test-COMPO est complet : feuille publiée, 1 sur 1 a répondu.',
    ]));
  });

  test('🔒 serveur ancien (sans compte) : rien d inventé — ni « 0 sur 0 », ni ligne « complet »', () => {
    const tel = textes(monter({ data: { items: [entraineur(), joueur()] } }));
    expect(tel.join(' | ')).not.toMatch(/ sur \d+|est complet/);

    const ordi = textes(monter({ data: { items: [entraineur()] } }, 1280));
    expect(ordi).toContain('—');
  });

  test('🔒 un rappel de JOUEUR ne porte jamais de compte', () => {
    const racine = monter({ data: { items: [joueur({ responses: { count: 3, total: 9 } })] } });

    expect(textes(racine).join(' | ')).not.toMatch(/3 sur 9/);
  });
});

// ---------------------------------------------------------------------------
// 🐞 T9 (02/10, captures T9_S06_1 / T9_S06_2) — OUVERT DEPUIS LE RAPPEL, L'ÉCRAN
// S'AFFICHAIT VIDE ; « tirer pour rafraîchir » faisait apparaître 7 actions.
// ---------------------------------------------------------------------------
// Cause mesurée : l'amorçage (app-bootstrap.ts, buildBootstrapMatchStatsSummary) envoie un
// RÉSUMÉ (`items: []`, `totalPending: 7`) que useAuth range sous la même clé que la liste
// complète ; la requête ne relit pas à l'ouverture (`refetchOnMount: false`, FINITIONS6).
describe('T9 · Matchs en attente ouvert depuis le rappel', () => {
  const RESUME_DU_DEMARRAGE = { items: [], nextPrompt: { eventId: 'e1' }, totalPending: 7 };

  test('🐞 le cache ne tient que le résumé : squelette de chargement, jamais « aucune action »', () => {
    const racine = monter({ data: RESUME_DU_DEMARRAGE, isFetching: true });

    expect(parId(racine, 'st-match-attente-chargement')).toBeTruthy();
    expect(parId(racine, 'st-match-attente-vide')).toBeUndefined();
    expect(textes(racine)).not.toContain('Aucune action en attente');
  });

  test('🐞 l écran relit la liste à CHAQUE ouverture (le rappel la montre déjà)', () => {
    monter({ data: RESUME_DU_DEMARRAGE, isFetching: true });

    expect(mockReglagesRequete[0]).toEqual(expect.objectContaining({ refetchOnMount: 'always' }));
  });

  test('la relecture échoue sur un résumé : l erreur se dit, avec « Réessayer »', () => {
    const racine = monter({ data: RESUME_DU_DEMARRAGE, error: new Error('réseau') });

    expect(parId(racine, 'st-match-attente-erreur')).toBeTruthy();
    expect(parId(racine, 'st-match-attente-chargement')).toBeUndefined();
  });

  test('un vrai « rien en attente » (0 en attente) reste vide, sans squelette', () => {
    const racine = monter({ data: { emptyReason: 'nothing_pending', items: [], totalPending: 0 } });

    expect(parId(racine, 'st-match-attente-vide')).toBeTruthy();
    expect(parId(racine, 'st-match-attente-chargement')).toBeUndefined();
  });
});

// ==========================================================================
// FINITIONS14 · point 4 (FINITIONS13-STATS 6c/6d) — LES TITRES « AS Montrivage — <adversaire> ».
// T13-bis : les cartes disaient « Match », « Match de championnat U15 », « Match vs Test-COMPO »
// (le `label` du serveur). La planche : « AS Montrivage — adversaire à confirmer » et
// « AS Montrivage — Test-COMPO », dans « Pour moi » ET « Pour mon équipe ». Le serveur nomme
// l'adversaire (`opponentName`, `null` inconnu) ; le club vient des équipes du compte.
// ==========================================================================
describe('FINITIONS14 · point 4 — les cartes titrent « club — adversaire »', () => {
  const COMPTE = {
    documentId: 'hugo',
    myTeams: [{ club: { name: 'AS Montrivage' }, documentId: 'u15', name: 'U15' }],
    trainedTeams: [{ club: { name: 'AS Montrivage' }, documentId: 'u15', name: 'U15' }],
  };
  afterEach(() => { mockUtilisateur = null; });

  test('🔴 « Pour moi » : « AS Montrivage — Test-COMPO », plus « Match vs Test-COMPO »', () => {
    mockUtilisateur = COMPTE;
    const racine = monter({ data: { items: [joueur({ label: 'Match vs Test-COMPO', opponentName: 'Test-COMPO' })] } });
    const vus = textes(racine);

    expect(vus).toContain('AS Montrivage — Test-COMPO');
    expect(vus).not.toContain('Match vs Test-COMPO');
    const carte = parId(racine, 'st-match-attente-carte-event:match-19h:u15:self');
    expect(carte.props.accessibilityLabel).toBe('AS Montrivage — Test-COMPO, À répondre');
  });

  test('🔴 « Pour mon équipe », adversaire inconnu : « AS Montrivage — adversaire à confirmer »', () => {
    mockUtilisateur = COMPTE;
    const racine = monter({ data: { items: [entraineur({ label: 'Match de championnat U15', opponentName: null })] } });

    expect(textes(racine)).toContain('AS Montrivage — adversaire à confirmer');
    expect(textes(racine)).not.toContain('Match de championnat U15');
  });

  // 🎨 FINITIONS15 point 9g — planche P2-attente, état 3 : « AS Montrivage — Test-COMPO est
  // complet : … ». La ligne lisait `lastCompleted.label` (« Match vs Test-COMPO ») ; le serveur y
  // nomme désormais l'adversaire : même titre que les cartes. Et une carte ouvre l'écran de réponse
  // avec CE titre (serveur d'avant compris). ROUGES avant le lot.
  test('🔴 FIN15 9g — « … est complet » porte le titre des cartes', () => {
    mockUtilisateur = COMPTE;
    const racine = monter({
      data: {
        emptyReason: 'nothing_pending',
        items: [],
        lastCompleted: {
          eventId: 'match-19h',
          finalizedAt: '2026-10-01T20:39:00.000Z',
          label: 'Match vs Test-COMPO',
          opponentName: 'Test-COMPO',
          responses: { count: 1, total: 1 },
          sourceType: 'event',
          team: { documentId: 'u15', name: 'U15' },
        },
      },
    });

    expect(textes(racine))
      .toContain('AS Montrivage — Test-COMPO est complet : feuille publiée, 1 sur 1 a répondu.');
  });

  test('🔴 FIN15 9g — la carte ouvre l écran de réponse avec SON titre', () => {
    mockUtilisateur = COMPTE;
    const racine = monter({ data: { items: [joueur({ label: 'Match vs Test-COMPO', opponentName: 'Test-COMPO' })] } });
    act(() => { parId(racine, 'st-match-attente-carte-event:match-19h:u15:self').props.onPress(); });

    expect(mockNaviguer).toHaveBeenCalledWith('PlayerMatchResponse', expect.objectContaining({
      matchLabel: 'AS Montrivage — Test-COMPO',
    }));
  });

  test('🔴 le tableau du site porte le même titre', () => {
    mockUtilisateur = COMPTE;
    // Le site met en tableau la famille « Pour mon équipe » quand elle est seule.
    const racine = monter({ data: { items: [entraineur({ label: 'Match', opponentName: 'Test-COMPO' })] } }, 1280);

    expect(textes(parId(racine, 'st-match-attente-tableau'))).toContain('AS Montrivage — Test-COMPO');
  });

  test('🔒 serveur d AVANT (pas de champ `opponentName`) : le titre d avant', () => {
    mockUtilisateur = COMPTE;
    const racine = monter({ data: { items: [joueur({ label: 'Match vs Test-COMPO' })] } });

    expect(textes(racine)).toContain('Match vs Test-COMPO');
  });
});
