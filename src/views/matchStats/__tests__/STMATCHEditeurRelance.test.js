/* eslint-disable max-len -- les libellés se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

// ==========================================================================
// 🧭 MatchStatsEditor — TÉMOIN CARACTÉRISANT (E6 : le fichier n'en avait aucun).
//
// Ce qu'il décrit : la relance des retours (le bouton « Relancer les N », ce qu'il
// envoie, ce que l'écran dit après) et le bouton de publication d'une feuille
// déjà publiée. C'est le filet des points T9 (« Rapport finalise ») et ST-VUES2 (« Déjà
// relancés aujourd'hui »).
//
// 📐 ST-MATCH10 (écran 10 du design des statistiques validé le 02/10, planches
// P3-editeur-tel et P3-editeur-ordi) — ÉTENDU, pas remplacé : la feuille en trois
// onglets au téléphone, en trois colonnes sur ordinateur, et les 11 états du contrôle
// de la planche, un test par état (« État n · … »).
// ==========================================================================

const mockRemind = jest.fn();
const mockSaveDraft = jest.fn();
const mockSubmit = jest.fn();
const mockSaveResult = jest.fn();
const mockSubmitLeague = jest.fn();
const mockStatsQuery = {
  data: /** @type {any} */ (null), error: /** @type {any} */ (null), isFetching: false, isLoading: false, refetch: jest.fn(),
};
let mockDesktop = false;

// La doublure INTERPOLE les {{…}} et sait les pluriels de i18next (0 et 1 au singulier).
jest.mock('react-i18next', () => {
  const remplir = (/** @type {string} */ modele, /** @type {any} */ valeurs) => modele.replace(
    /\{\{(\w+)\}\}/g,
    (/** @type {string} */ tout, /** @type {string} */ nom) => (
      valeurs && nom in valeurs ? String(valeurs[nom]) : tout
    ),
  );
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        if (typeof repli === 'string') return remplir(repli, options);
        if (repli && repli.defaultValue_one) {
          return remplir(Number(repli.count) <= 1 ? repli.defaultValue_one : repli.defaultValue_other, repli);
        }
        return cle;
      },
    }),
  };
});
jest.mock('i18next', () => ({
  __esModule: true,
  default: { language: 'fr', t: (/** @type {string} */ _cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : _cle) },
}));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => mockStatsQuery,
  // L'écran ne lit que la requête de SA source (événement ou ligue) : la même doublure sert.
  useGetLeagueMatchStats: () => mockStatsQuery,
}));
jest.mock('@/services/matchStats/matchStatsService', () => ({
  remindEventMatchResponses: (/** @type {any[]} */ ...args) => mockRemind(...args),
  saveEventMatchResult: (/** @type {any[]} */ ...args) => mockSaveResult(...args),
  saveEventMatchStatsDraft: (/** @type {any[]} */ ...args) => mockSaveDraft(...args),
  saveLeagueMatchStatsDraft: jest.fn(),
  submitEventMatchStats: (/** @type {any[]} */ ...args) => mockSubmit(...args),
  submitLeagueMatchStats: (/** @type {any[]} */ ...args) => mockSubmitLeague(...args),
}));
jest.mock('@/domains/refresh/afterAction', () => ({ invalidateAfterAction: jest.fn() }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'coach-1', firstname: 'Karim' } }),
}));
jest.mock('@/responsive', () => ({
  ...jest.requireActual('@/responsive'),
  useIsDesktop: () => mockDesktop,
}));
jest.mock('@/navigation/useBottomDockLayout', () => ({ __esModule: true, default: () => ({ sceneBottomInset: 0 }) }));
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (/** @type {any} */ { children }) => jest.requireActual('react').createElement(View, null, children) };
});
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return { __esModule: true, default: () => jest.requireActual('react').createElement(Texte, null, 'RETOUR') };
});
jest.mock('@/components/molecules/memberAvatar/MemberAvatar', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => jest.requireActual('react').createElement(View) };
});
jest.mock('@/components/atoms/button/Button', () => {
  const rn = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => jest.requireActual('react').createElement(
      rn.TouchableOpacity,
      { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
      jest.requireActual('react').createElement(rn.Text, null, props.title || ''),
    ),
  };
});
// Le sélecteur segmenté tire `gesture-handler` : sa doublure garde ses libellés et son
// `onChange` (motif de `PlayerMatchResponseScreen.STREPONSE.test.js`).
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const { Pressable: Appui, Text: Texte, View: Vue } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChange, options }) => creer(
      Vue,
      { testID: 'feuille-onglets' },
      options.map((/** @type {any} */ option) => creer(
        Appui,
        { key: option.value, onPress: () => onChange(option.value) },
        creer(Texte, null, option.label),
      )),
    ),
  };
});
// La feuille du bas tire `@gorhom/bottom-sheet` : sa doublure rend l'en-tête, le corps et
// le pied quand elle est ouverte, rien sinon.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: Vue } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (props.isVisible
      ? creer(Vue, null, props.headerComponent || null, props.children, props.footerComponent || null)
      : null),
  };
});
// Le squelette passe par `masked-view`, que jest ne transforme pas.
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => {
  const { View: Vue } = jest.requireActual('react-native');
  return { __esModule: true, default: (/** @type {any} */ { children }) => jest.requireActual('react').createElement(Vue, { testID: 'squelette' }, children) };
});
jest.mock('@/components/atoms/glyphIcon/GlyphIcon', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ __esModule: true, default: () => null, SvgIcon: () => null }));

// eslint-disable-next-line import/first
import MatchStatsEditor from '../MatchStatsEditor';

/** @type {any} */
let arbre = null;
/** @type {any} */
let navigation = null;

const feuille = (/** @type {any} */ rapport = {}) => ({
  availablePlayers: [],
  permissions: { canManage: true, canView: true },
  playerResponses: [
    { label: 'Hugo Lemaire', status: 'submitted', userDocumentId: 'u1' },
    { label: 'Léo Durand', status: 'pending', userDocumentId: 'u2' },
    { label: 'Nina Roux', status: 'pending', userDocumentId: 'u3' },
  ],
  report: {
    needsReview: false, playerLines: [], status: 'draft', ...rapport,
  },
  score: {
    available: true, locked: false, scoreAgainst: 1, scoreFor: 2, source: 'manual', waitingOfficial: false,
  },
  sport: 'football',
  team: { documentId: 'team-1', name: 'U15' },
});

// ── La vraie feuille de l'U15, celle de la planche (2 - 1, 8/10, Hugo : 90 min, 1 but). ──
const HUGO = {
  documentId: 'u1', firstname: 'Hugo', label: 'Hugo Lemaire', lastname: 'Lemaire',
};
const REPONSE_HUGO = {
  documentId: 'u1',
  label: 'Hugo Lemaire',
  participation: 'played',
  quantitativeState: 'completed',
  selfComment: 'Bon match, j’ai marqué sur corner.',
  selfRating: 8,
  stateLabel: 'Envoye',
  status: 'submitted',
  submittedAt: '2026-10-01T20:28:00.000Z',
  teamRating: 7,
  userDocumentId: 'u1',
};
const CHIFFRES_HUGO = {
  manualPlayerName: null,
  minutesPlayed: 90,
  sportPayload: {
    assists: 0, cleanSheet: false, goals: 1, goalsConceded: 0,
  },
  userDocumentId: 'u1',
};
const LIGNE_VIDE_HUGO = {
  minutesPlayed: 0,
  sportPayload: {
    assists: 0, cleanSheet: false, goals: 0, goalsConceded: 0,
  },
  userDocumentId: 'u1',
};

const feuilleU15 = (/** @type {any} */ rapport = {}, /** @type {any} */ autres = {}) => ({
  availablePlayers: [{ ...HUGO, playerResponse: REPONSE_HUGO, suggestedStats: CHIFFRES_HUGO }],
  event: { date: '2026-09-05T15:00:00.000Z', documentId: 'event-1', name: 'AS Montrivage — Test-COMPO' },
  excludedNoShowPlayers: [],
  permissions: { canManage: true, canView: true },
  playerCollectiveRating: { average: 7, count: 1, eligibleCount: 1 },
  playerResponses: [REPONSE_HUGO],
  report: {
    coachPlayerReviews: [],
    collectiveComment: 'Bon bloc en première mi-temps.',
    collectiveRating: 8,
    needsReview: false,
    // 🧨 Défaut 19 : un brouillon enregistré AVANT la réponse de Hugo porte une ligne vide.
    playerLines: [LIGNE_VIDE_HUGO],
    responseCompletionCount: 1,
    responseEligibleCount: 1,
    scoreAgainst: 1,
    scoreFor: 2,
    status: 'draft',
    ...rapport,
  },
  score: {
    available: true,
    locked: false,
    recordedAt: '2026-10-01T20:35:00.000Z',
    recordedBy: { documentId: 'coach-1', firstname: 'Karim' },
    scoreAgainst: 1,
    scoreFor: 2,
    source: 'manual',
    waitingOfficial: false,
  },
  sourceType: 'event',
  sport: 'football',
  team: { documentId: 'team-1', name: 'U15' },
  ...autres,
});

// Onze joueurs, deux réponses : l'effectif complet de l'état 3.
const feuilleEffectifComplet = () => {
  const noms = ['Léo Diallo', 'Hugo Roux', 'Enzo Petit', 'Nino Garcia', 'Théo Nguyen', 'Sami Martin', 'Yanis Bernard', 'Malo Robert', 'Liam Richard', 'Noah Durand', 'Adam Moreau'];
  const joueurs = noms.map((nom, i) => ({
    documentId: `j${i}`, firstname: nom.split(' ')[0], label: nom, lastname: nom.split(' ')[1],
  }));
  const reponses = joueurs.map((joueur, i) => ({
    documentId: joueur.documentId,
    label: joueur.label,
    participation: i < 2 ? 'played' : null,
    quantitativeState: i < 2 ? 'completed' : null,
    status: i < 2 ? 'submitted' : null,
    userDocumentId: joueur.documentId,
  }));
  return feuilleU15({ playerLines: [], responseCompletionCount: 2, responseEligibleCount: 11 }, {
    availablePlayers: joueurs,
    playerResponses: reponses,
  });
};

const monter = async (/** @type {any} */ donnees, /** @type {{ desktop?: boolean, erreur?: any, chargement?: boolean, params?: any }} */ options = {}) => {
  mockDesktop = Boolean(options.desktop);
  mockStatsQuery.data = donnees;
  mockStatsQuery.error = options.erreur || null;
  mockStatsQuery.isLoading = Boolean(options.chargement);
  navigation = {
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn(),
  };
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  await act(async () => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(MatchStatsEditor, {
        navigation,
        route: { params: options.params || { eventId: 'event-1', sourceType: 'event', teamId: 'team-1' } },
      }),
    ));
  });
  return arbre.root;
};

const textes = (/** @type {any} */ racine) => racine.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''))
  .filter(Boolean);

const attendre = async () => {
  await act(async () => { await new Promise((fin) => { setTimeout(fin, 0); }); });
};

// Les appuis dont un texte vaut exactement `libelle` (le plus profond d'abord).
const appuis = (/** @type {any} */ racine, /** @type {string} */ libelle) => racine.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
  && n.findAllByType(Text).some((/** @type {any} */ x) => [].concat(x.props.children).join('') === libelle));

const appuyerSur = async (/** @type {any} */ racine, /** @type {string} */ libelle) => {
  const trouves = appuis(racine, libelle);
  const cible = trouves[trouves.length - 1];
  if (!cible) throw new Error(`Aucun bouton « ${libelle} ». Vu : ${textes(racine).join(' | ')}`);
  await act(async () => { cible.props.onPress(); });
  await attendre();
};

// Un appui désigné par sa description d'accessibilité.
const parDescription = (/** @type {any} */ racine, /** @type {string} */ description) => racine.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === description
  && typeof n.props?.onPress === 'function');

const appuyerSurDescription = async (/** @type {any} */ racine, /** @type {string} */ description) => {
  const [cible] = parDescription(racine, description);
  if (!cible) throw new Error(`Aucun appui décrit « ${description} ».`);
  await act(async () => { cible.props.onPress(); });
  await attendre();
};

// Le bouton (doublure de `Button`) qui porte ce titre.
const bouton = (/** @type {any} */ racine, /** @type {string} */ titre) => racine.findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'button'
  && typeof n.props?.onPress === 'function'
  && n.findAllByType(Text).some((/** @type {any} */ x) => x.props.children === titre))[0];

const hotes = (/** @type {any} */ racine, /** @type {(n: any) => boolean} */ filtre) => racine.findAll((/** @type {any} */ n) => typeof n.type === 'string' && filtre(n));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockSaveDraft.mockResolvedValue({});
  mockSubmit.mockResolvedValue({});
  mockSaveResult.mockResolvedValue({});
  mockSubmitLeague.mockResolvedValue({});
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

jest.setTimeout(30000);

describe('MatchStatsEditor — la relance des retours (caractérisation)', () => {
  test('le bouton nomme combien manquent, et relance CETTE équipe de CET événement', async () => {
    mockRemind.mockResolvedValue({ missingCount: 2, remindedCount: 2 });
    const racine = await monter(feuille());

    // 📐 ST-MATCH10 — ADAPTÉ : la relance vit dans l'onglet « Retours » (état 5), et le
    // bouton dit « Relancer les 2 », le mot de la carte « Après le match ».
    await appuyerSur(racine, 'Retours');
    await appuyerSur(racine, 'Relancer les 2');

    expect(mockRemind).toHaveBeenCalledWith('event-1', 'team-1');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Relance envoyée',
      '2 joueur·se·s relancé·e·s pour leur retour post-match.',
    );
  });

  test('personne à relancer : l écran le dit', async () => {
    mockRemind.mockResolvedValue({ alreadyRemindedCount: 0, missingCount: 0, remindedCount: 0 });
    const racine = await monter(feuille());

    await appuyerSur(racine, 'Retours');
    await appuyerSur(racine, 'Relancer les 2');

    expect(Alert.alert).toHaveBeenCalledWith('Relance envoyée', 'Aucune relance nécessaire pour ce match.');
  });
});

describe('MatchStatsEditor — une feuille déjà publiée (caractérisation)', () => {
  test('rien ne s y publie plus : la feuille dit sa date et propose « Modifier »', async () => {
    const racine = await monter(feuille({ finalizedAt: '2026-10-01T20:39:00.000Z', status: 'final' }));

    // 🎯 T9 (02/10) — « Rapport finalise » était devenu un bouton éteint « Feuille publiée ».
    // 📐 ST-MATCH10 — ADAPTÉ (état 8 de la planche, défaut 29) : plus de bouton éteint ni de
    // puce « Editable » sur une feuille en lecture. La date dit l'état, « Modifier » la rouvre.
    expect(textes(racine).some((texte) => /^Publiée le .+ à \d{2}:\d{2}$/.test(texte))).toBe(true);
    expect(bouton(racine, 'Modifier')).toBeTruthy();
    expect(bouton(racine, 'Publier')).toBeUndefined();
    expect(bouton(racine, 'Feuille publiée')).toBeUndefined();
    expect(textes(racine)).not.toContain('Editable');
    // 📐 ADAPTÉ (état 5 de la planche) : une feuille publiée se relance encore, les
    // réponses qui manquent comptent toujours.
    await appuyerSur(racine, 'Retours');
    expect(bouton(racine, 'Relancer les 2')).toBeTruthy();
  });
});

// 🔁 ST-VUES2 (relance idempotente par jour, côté serveur) : au 2e appui le même jour, personne
// n'est relancé et le serveur le dit (`alreadyRemindedCount`). « Aucune relance nécessaire »
// serait FAUX : il en manque toujours deux.
describe('MatchStatsEditor — déjà relancés aujourd hui', () => {
  test('2e appui le même jour : « Déjà relancés aujourd’hui », jamais « aucune relance nécessaire »', async () => {
    mockRemind.mockResolvedValue({ alreadyRemindedCount: 2, missingCount: 2, remindedCount: 0 });
    const racine = await monter(feuille());

    await appuyerSur(racine, 'Retours');
    await appuyerSur(racine, 'Relancer les 2');

    expect(Alert.alert).toHaveBeenCalledWith('Déjà relancés aujourd’hui');
    expect(jest.mocked(Alert.alert).mock.calls.flat()).not.toContain('Aucune relance nécessaire pour ce match.');
  });
});

// ==========================================================================
// 📐 ST-MATCH10 — LES 11 ÉTATS DU CONTRÔLE DE LA PLANCHE, UN PAR UN.
// ==========================================================================
describe('ST-MATCH10 — la feuille de match en trois onglets (téléphone)', () => {
  test('État 1 · Score et bilan : l en-tête de la feuille, 3 onglets, le score, ta note, ton mot', async () => {
    const racine = await monter(feuilleU15());
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining([
      'Feuille de match',
      'AS Montrivage — Test-COMPO',
      'Brouillon',
      'U15 · 1 sur 1 a répondu',
      'Score et bilan',
      'Joueurs · 1',
      'Retours',
      'Ta note de l’équipe',
      'Ton mot à l’équipe',
      'Lu par les joueurs de l’équipe U15.',
    ]));
    // Qui a saisi le score, et quand (le mot de l'encart, écran 1).
    expect(vus.some((texte) => /^Saisi par toi le .+ à \d{2}:\d{2}$/.test(texte))).toBe(true);
    // Les deux compteurs du score, et ta note de l'équipe : 10 choix, le 8 coché.
    expect(parDescription(racine, 'Un but de plus pour U15')).not.toHaveLength(0);
    const notes = hotes(racine, (n) => n.props.accessibilityRole === 'radio'
      && String(n.props.accessibilityLabel || '').startsWith('Ta note de l’équipe'));
    expect(notes).toHaveLength(10);
    expect(notes.filter((n) => n.props.accessibilityState?.checked).map((n) => n.props.accessibilityLabel))
      .toEqual(['Ta note de l’équipe : 8 sur 10']);
    // Ce que la planche RETIRE : la carte de tête et ses 4 puces, « Editable », les blocs empilés.
    ['Bilan équipe', 'Editable', 'Retours individuels optionnels', 'Buteur·se·s', 'Joueur FoundClub', 'Stats joueurs', 'Actions']
      .forEach((retire) => expect(vus).not.toContain(retire));
    expect(vus.some((texte) => /joueurs completes/.test(texte))).toBe(false);
    // La barre d'action : « Brouillon » et « Publier ».
    expect(bouton(racine, 'Brouillon')).toBeTruthy();
    expect(bouton(racine, 'Publier')).toBeTruthy();
  });

  test('Barre collante : « Brouillon » et « Publier » restent hors du défilement', async () => {
    const racine = await monter(feuilleU15());
    const [defilement] = racine.findAllByType(ScrollView);
    const dansLeDefilement = textes(defilement);

    expect(dansLeDefilement).not.toContain('Publier');
    expect(dansLeDefilement).not.toContain('Brouillon');
    const barre = racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-barre')[0];
    expect(textes(barre)).toEqual(['Brouillon', 'Publier']);
  });

  test('État 2 · Joueurs : la ligne de Hugo reprend SA réponse (90 min, 1 but) — défaut 19', async () => {
    const racine = await monter(feuilleU15());
    await appuyerSur(racine, 'Joueurs · 1');
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining([
      'Joueur', 'Min', 'Buts', 'Pas.',
      'Hugo Lemaire', 'A répondu · repris de sa réponse',
      'Touche un joueur pour ses chiffres et ton retour individuel.',
      '1 but sur 2 a un buteur. 1 but restera « sans buteur ».',
    ]));
    expect(parDescription(racine, 'Hugo Lemaire : 90 minutes, 1 but, 0 passe. A répondu.')).not.toHaveLength(0);

    // 🧨 Plus de ligne vide qui écrase sa réponse : le brouillon envoie ses chiffres.
    await appuyerSur(racine, 'Brouillon');
    expect(mockSaveDraft).toHaveBeenCalledTimes(1);
    expect(mockSaveDraft.mock.calls[0][1].playerLines).toEqual([{
      assists: 0, cleanSheet: false, goals: 1, goalsConceded: 0, manualPlayerName: undefined, minutesPlayed: 90, userDocumentId: 'u1',
    }]);
  });

  test('État 3 · Joueurs : l effectif complet tient en une ligne par joueur, rien n est coupé', async () => {
    const racine = await monter(feuilleEffectifComplet());
    await appuyerSur(racine, 'Joueurs · 11');

    const lignes = racine.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
      && /^.+ : \d+ minutes?, \d+ buts?, \d+ passes?\. .+\.$/.test(String(n.props?.accessibilityLabel || '')));
    expect(lignes).toHaveLength(11);
    expect(textes(racine).filter((texte) => texte === 'Pas encore répondu')).toHaveLength(9);
    expect(textes(racine).filter((texte) => texte === 'A répondu')).toHaveLength(2);
  });

  test('État 4 · Un joueur : sa réponse, ses chiffres, et ton retour dit privé ; tout part au brouillon', async () => {
    const racine = await monter(feuilleU15());
    await appuyerSur(racine, 'Joueurs · 1');
    await appuyerSurDescription(racine, 'Hugo Lemaire : 90 minutes, 1 but, 0 passe. A répondu.');
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining([
      '8/10', 'sa note', '7/10', 'l’équipe', 'min', 'but',
      '« Bon match, j’ai marqué sur corner. »',
      'Minutes', 'Buts', 'Passes', 'Buts encaissés', 'Clean sheet',
      'Ton retour à Hugo',
      'Lu par Hugo et, s’il est mineur, ses parents. Jamais par ses coéquipiers.',
    ]));
    expect(vus.some((texte) => /^A répondu le .+ à \d{2}:\d{2}$/.test(texte))).toBe(true);
    expect(bouton(racine, 'Valider')).toBeTruthy();

    await appuyerSurDescription(racine, 'Un but de plus');
    await appuyerSurDescription(racine, 'Ta note pour Hugo : 7 sur 10');
    const [commentaire] = hotes(racine, (n) => n.props.placeholder === 'Commentaire privé pour ce joueur');
    await act(async () => { commentaire.props.onChangeText('Bon pressing.'); });
    await appuyerSur(racine, 'Valider');
    expect(bouton(racine, 'Valider')).toBeUndefined();

    await appuyerSur(racine, 'Brouillon');
    const envoi = mockSaveDraft.mock.calls[0][1];
    expect(envoi.playerLines[0]).toMatchObject({ goals: 2, minutesPlayed: 90 });
    expect(envoi.coachPlayerReviews).toEqual([{ comment: 'Bon pressing.', rating: 7, userDocumentId: 'u1' }]);
  });

  test('État 5 · Retours : le compte, qui manque, « Relancer les 2 », et qui a répondu', async () => {
    mockRemind.mockResolvedValue({ missingCount: 2, remindedCount: 2 });
    const donnees = feuilleU15({ responseCompletionCount: 1, responseEligibleCount: 3 }, {
      playerResponses: [
        REPONSE_HUGO,
        { label: 'Léo Durand', status: null, userDocumentId: 'u2' },
        { label: 'Nina Roux', status: 'draft', userDocumentId: 'u3' },
      ],
    });
    const racine = await monter(donnees);
    await appuyerSur(racine, 'Retours');
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining([
      '1 sur 3 a répondu',
      'Manquent · 2',
      'Léo Durand, Nina Roux',
      'Ont répondu · 1',
      'Lui', 'Éq.',
      'Hugo Lemaire', 'A joué · avec un mot',
      '« Lui » : sa note ; « Éq. » : sa note de l’équipe.',
    ]));
    expect(hotes(racine, (n) => n.props.accessibilityRole === 'progressbar')).not.toHaveLength(0);
    await appuyerSur(racine, 'Relancer les 2');
    expect(mockRemind).toHaveBeenCalledWith('event-1', 'team-1');
  });

  test('État 6 · Une correction : UNE alerte, en haut, qui nomme le joueur ; « Publier » attend', async () => {
    const donnees = feuilleU15({
      playerLines: [{ ...LIGNE_VIDE_HUGO, minutesPlayed: 90, sportPayload: { ...LIGNE_VIDE_HUGO.sportPayload, goals: 3 } }],
    }, { availablePlayers: [HUGO] });
    const racine = await monter(donnees);
    await appuyerSur(racine, 'Joueurs · 1');
    const vus = textes(racine);

    expect(hotes(racine, (n) => n.props.accessibilityRole === 'alert')).toHaveLength(1);
    expect(vus).toEqual(expect.arrayContaining([
      '1 correction',
      '3 buts saisis pour un score de 2. Vérifie Hugo Lemaire.',
      'À vérifier',
    ]));
    // Elle n'est plus dite trois fois (bandeau, aide, alerte au moment d'enregistrer).
    expect(vus).not.toContain('Corrections requises');
    expect(bouton(racine, 'Publier').props.disabled).toBe(true);
    expect(bouton(racine, 'Brouillon').props.disabled).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('État 7 · Publier : une fenêtre à deux boutons dit qui recevra quoi', async () => {
    const donnees = feuilleU15({ coachPlayerReviews: [{ comment: 'Bon pressing.', rating: 7, userDocumentId: 'u1' }] });
    const racine = await monter(donnees);

    await appuyerSur(racine, 'Publier');
    const [fenetre] = racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-confirmation');
    expect(fenetre).toBeTruthy();
    // 📐 ADAPTÉ (ST-MATCH10-BIS, point 2) : la fenêtre dit aussi que les parents d'un mineur
    // reçoivent son retour (le serveur les prévient : `sendCoachFeedbackToParents`).
    expect(textes(fenetre)).toEqual([
      'Publier la feuille ?',
      'Hugo et, s’il est mineur, ses parents recevront ton retour individuel. Les joueurs de l’équipe U15 verront le score, ta note de l’équipe et ton mot. Tu pourras la modifier et la republier.',
      'Annuler',
      'Publier',
    ]);
    // Plus de fenêtre du système : sur le site, elle devenait un `window.confirm`.
    expect(Alert.alert).not.toHaveBeenCalled();

    await appuyerSur(fenetre, 'Annuler');
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-confirmation')).toHaveLength(0);

    await appuyerSur(racine, 'Publier');
    const [fenetre2] = racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-confirmation');
    await appuyerSur(fenetre2, 'Publier');
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockSubmit.mock.calls[0][0]).toBe('event-1');
  });

  test('État 8 · Publiée : la date en mots, le bilan, « Modifier » rouvre la feuille', async () => {
    const donnees = feuilleU15({
      coachPlayerReviews: [{ comment: 'Bon pressing.', rating: 7, userDocumentId: 'u1' }],
      finalizedAt: '2026-10-01T20:39:00.000Z',
      status: 'final',
    });
    const racine = await monter(donnees);
    const vus = textes(racine);

    expect(vus.some((texte) => /^Publiée le .+ à \d{2}:\d{2}$/.test(texte))).toBe(true);
    expect(vus).toEqual(expect.arrayContaining([
      '2 - 1', 'Score saisi',
      '8/10', 'Ta note de l’équipe',
      // 🔒 « moyenne B » : une seule réponse, la moyenne des joueurs reste cachée.
      '—', 'Les joueurs : dès 3 réponses',
      'Bon bloc en première mi-temps.',
      'Hugo a reçu ton retour. 1 sur 1 a répondu.',
    ]));
    expect(vus).not.toContain('Editable');
    expect(bouton(racine, 'Brouillon')).toBeUndefined();
    expect(bouton(racine, 'Publier')).toBeUndefined();

    await appuyerSur(racine, 'Modifier');
    expect(bouton(racine, 'Republier')).toBeTruthy();
    expect(bouton(racine, 'Annuler')).toBeTruthy();
    expect(parDescription(racine, 'Un but de plus pour U15')[0].props.disabled).toBeFalsy();
  });

  test('État 9 · Vérification requise : ce qui a changé, le score officiel verrouillé, « Republier »', async () => {
    const donnees = feuilleU15({ needsReview: true, status: 'final' }, {
      score: {
        available: true, locked: true, scoreAgainst: 2, scoreFor: 2, source: 'external_sync', waitingOfficial: false,
      },
    });
    const racine = await monter(donnees);
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining([
      'À vérifier',
      'Le score officiel a changé',
      '2 - 2 au lieu de 2 - 1. Vérifie les buts de chaque joueur, puis republie.',
      'Score officiel de la fédération',
    ]));
    expect(parDescription(racine, 'Un but de plus pour U15')[0].props.disabled).toBe(true);
    expect(textes(racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-barre')[0])).toEqual(['Republier']);
  });

  test('État 10 · Aucun joueur : l onglet dit pourquoi et ouvre la convocation, sans texte technique', async () => {
    const donnees = feuilleU15({ playerLines: [], responseCompletionCount: 0, responseEligibleCount: 0 }, {
      availablePlayers: [], playerResponses: [],
    });
    const racine = await monter(donnees);
    await appuyerSur(racine, 'Joueurs · 0');
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining([
      'Aucun joueur sur cette feuille',
      'Les joueurs viennent de la convocation du match. Publie-la, ou ajoute l’équipe au match.',
    ]));
    expect(vus.some((texte) => /roster|Publie d abord/.test(texte))).toBe(false);
    // 📐 ADAPTÉ (ST-MATCH10-BIS, point 5) : le bouton de la planche, « Ouvrir la convocation ».
    // La feuille ne sait pas bâtir une convocation : elle rend la main à la page du match,
    // qui ouvre SA porte de convocation (témoins EventDetails*ConvocationDepuisLaFeuille).
    expect(vus).not.toContain('Ouvrir la page du match');
    await appuyerSur(racine, 'Ouvrir la convocation');
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.EventDetails, { eventId: 'event-1', focusSection: 'convocation' });
  });

  test('État 11 · Erreur : l en-tête reste, la phrase est humaine, « Réessayer » relit', async () => {
    const racine = await monter(null, { erreur: new Error('Request failed with status code 500') });
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining([
      'Feuille de match',
      'La feuille n’a pas pu être lue.',
      'Vérifie ta connexion, puis réessaie. Ton brouillon est gardé.',
    ]));
    expect(vus.some((texte) => /status code/.test(texte))).toBe(false);
    await appuyerSur(racine, 'Réessayer');
    expect(mockStatsQuery.refetch).toHaveBeenCalled();
  });

  test('État 11 · Chargement : les mêmes onglets, des blocs en squelette', async () => {
    const racine = await monter(null, { chargement: true });

    expect(textes(racine)).toEqual(expect.arrayContaining(['Feuille de match', 'Score et bilan', 'Retours']));
    expect(racine.findAll((/** @type {any} */ n) => n.props?.testID === 'squelette')).not.toHaveLength(0);
  });

  test('Le score corrigé dans la feuille est ENREGISTRÉ avant le brouillon (le serveur gardait l ancien)', async () => {
    const racine = await monter(feuilleU15());

    await appuyerSurDescription(racine, 'Un but de plus pour U15');
    await appuyerSur(racine, 'Brouillon');

    expect(mockSaveResult).toHaveBeenCalledWith('event-1', { scoreAgainst: 1, scoreFor: 3, teamId: 'team-1' });
    expect(mockSaveDraft).toHaveBeenCalledTimes(1);
    expect(mockSaveResult.mock.invocationCallOrder[0]).toBeLessThan(mockSaveDraft.mock.invocationCallOrder[0]);
  });

  test('Match de ligue : le score de la ligue est verrouillé, pas de relance, la publication part à la ligue', async () => {
    const donnees = feuilleU15({}, {
      score: {
        available: true, locked: true, scoreAgainst: 1, scoreFor: 2, source: 'league_validated', waitingOfficial: false,
      },
      sourceType: 'league',
    });
    const racine = await monter(donnees, {
      params: {
        matchId: 'match-1', matchLabel: 'Montrivage FC — FC Bonneveine', sourceType: 'league', teamId: 'team-1',
      },
    });

    expect(textes(racine)).toEqual(expect.arrayContaining(['Montrivage FC — FC Bonneveine', 'Score validé par la ligue']));
    expect(parDescription(racine, 'Un but de plus pour U15')[0].props.disabled).toBe(true);
    await appuyerSur(racine, 'Retours');
    expect(textes(racine).some((texte) => texte.startsWith('Relancer'))).toBe(false);

    await appuyerSur(racine, 'Publier');
    const [fenetre] = racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-confirmation');
    await appuyerSur(fenetre, 'Publier');
    expect(mockSubmitLeague).toHaveBeenCalledTimes(1);
    expect(mockSubmitLeague.mock.calls[0][0]).toBe('match-1');
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockSaveResult).not.toHaveBeenCalled();
  });

  test('Score inchangé : on ne réécrit pas le score', async () => {
    const racine = await monter(feuilleU15());

    await appuyerSur(racine, 'Brouillon');

    expect(mockSaveResult).not.toHaveBeenCalled();
    expect(mockSaveDraft).toHaveBeenCalledTimes(1);
  });
});

describe('ST-MATCH10 — la feuille de match sur ordinateur (3 colonnes)', () => {
  test('État 1 (ordinateur) · les trois onglets côte à côte, la barre d action en bas', async () => {
    const racine = await monter(feuilleU15(), { desktop: true });
    const colonne = (/** @type {string} */ id) => racine.findAll((/** @type {any} */ n) => n.props?.testID === id);

    expect(colonne('feuille-colonne-score')).not.toHaveLength(0);
    expect(colonne('feuille-colonne-joueurs')).not.toHaveLength(0);
    expect(colonne('feuille-colonne-retours')).not.toHaveLength(0);
    // Pas d'onglets : tout se voit d'un écran.
    expect(racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-onglets')).toHaveLength(0);
    expect(textes(racine)).toEqual(expect.arrayContaining([
      'Hugo Lemaire', 'Clique une ligne pour ses chiffres et ton retour.', '1 sur 1 a répondu',
    ]));
    // Sous le titre : le match, l'équipe, le jour (planche P3-editeur-ordi).
    expect(textes(racine).some((texte) => /^AS Montrivage — Test-COMPO · U15 · .*5.*$/.test(texte))).toBe(true);
    expect(bouton(racine, 'Enregistrer le brouillon')).toBeTruthy();
    expect(bouton(racine, 'Publier la feuille')).toBeTruthy();
  });

  test('État 2 (ordinateur) · un joueur ouvert : le tableau à gauche, son panneau à droite', async () => {
    const racine = await monter(feuilleU15(), { desktop: true });
    await appuyerSurDescription(racine, 'Hugo Lemaire : 90 minutes, 1 but, 0 passe. A répondu.');
    const [panneau] = racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-panneau-joueur');

    expect(panneau).toBeTruthy();
    expect(textes(panneau)).toEqual(expect.arrayContaining(['Hugo Lemaire', 'Ton retour à Hugo']));
    expect(racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-colonne-score')).toHaveLength(0);
    expect(racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-colonne-joueurs')).not.toHaveLength(0);
  });

  test('État 3 (ordinateur) · publiée : la date et « Modifier », seuls', async () => {
    const racine = await monter(feuilleU15({ finalizedAt: '2026-10-01T20:39:00.000Z', status: 'final' }), { desktop: true });

    expect(textes(racine).some((texte) => /^Publiée le .+ à \d{2}:\d{2}$/.test(texte))).toBe(true);
    expect(textes(racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-barre')[0])).toEqual(['Modifier']);
  });
});

// ==========================================================================
// 📐 ST-MATCH10-BIS (03/10) — LES 7 MANQUES DE L'ÉCRAN 10, un par un.
// ==========================================================================
describe('ST-MATCH10-BIS · 1 — l adversaire nommé (le serveur le rend avec la feuille)', () => {
  // Le vrai nom d'un match en base : « Match vs Test-COMPO » (event-display-name.js).
  const nommee = (/** @type {any} */ adversaire = 'Test-COMPO', /** @type {any} */ rapport = {}) => feuilleU15(rapport, {
    event: {
      date: '2026-09-05T15:00:00.000Z', documentId: 'event-1', name: 'Match vs Test-COMPO', opponentName: adversaire,
    },
    team: { clubName: 'AS Montrivage', documentId: 'team-1', name: 'U15' },
  });

  test('Téléphone : « AS Montrivage — Test-COMPO », et chaque compteur porte le nom de son camp', async () => {
    const racine = await monter(nommee());
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining(['AS Montrivage — Test-COMPO', 'AS Montrivage', 'Test-COMPO', 'U15 · 1 sur 1 a répondu']));
    expect(vus).not.toContain('Adversaire');
    expect(parDescription(racine, 'Un but de plus pour Test-COMPO')).not.toHaveLength(0);
    expect(parDescription(racine, 'Un but de plus pour AS Montrivage')).not.toHaveLength(0);
  });

  test('Ordinateur : le sous-titre dit le match, l équipe et le jour', async () => {
    const racine = await monter(nommee(), { desktop: true });
    expect(textes(racine).some((texte) => /^AS Montrivage — Test-COMPO · U15 · .*5.*$/.test(texte))).toBe(true);
  });

  test('Adversaire inconnu : « adversaire à confirmer » (planche, état 10), jamais un nom vide', async () => {
    const racine = await monter(nommee(null));
    const vus = textes(racine);

    expect(vus).toContain('AS Montrivage — adversaire à confirmer');
    expect(vus).toContain('Adversaire');
  });

  test('Publiée : le bilan nomme les deux camps', async () => {
    const racine = await monter(nommee('Test-COMPO', { finalizedAt: '2026-10-01T20:39:00.000Z', status: 'final' }));
    expect(textes(racine)).toEqual(expect.arrayContaining(['AS Montrivage', '2 - 1', 'Test-COMPO']));
  });

  test('Serveur d avant (pas de champ) : le nom de l événement reste', async () => {
    const racine = await monter(feuilleU15());
    expect(textes(racine)).toContain('AS Montrivage — Test-COMPO');
  });
});

describe('ST-MATCH10-BIS · 2 — « s il est mineur, ses parents » : qui est prévenu de quoi', () => {
  test('Plusieurs retours : la fenêtre les nomme, et dit que les parents d un mineur les reçoivent aussi', async () => {
    const donnees = feuilleEffectifComplet();
    donnees.report.coachPlayerReviews = [
      { comment: 'Bon pressing.', rating: 7, userDocumentId: 'j0' },
      { comment: 'Belle passe.', rating: 8, userDocumentId: 'j1' },
    ];
    const racine = await monter(donnees);

    await appuyerSur(racine, 'Publier');
    const [fenetre] = racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-confirmation');
    expect(textes(fenetre)[1]).toBe('Léo et Hugo recevront leur retour individuel ; pour un mineur, ses parents aussi. Les joueurs de l’équipe U15 verront le score, ta note de l’équipe et ton mot. Tu pourras la modifier et la republier.');
  });

  test('La fiche du joueur garde la même règle (décision du chef, phrase A)', async () => {
    const racine = await monter(feuilleU15());
    await appuyerSur(racine, 'Joueurs · 1');
    await appuyerSurDescription(racine, 'Hugo Lemaire : 90 minutes, 1 but, 0 passe. A répondu.');
    expect(textes(racine)).toContain('Lu par Hugo et, s’il est mineur, ses parents. Jamais par ses coéquipiers.');
  });
});

describe('ST-MATCH10-BIS · 3 — « feuille convoqués A » : tout l effectif compte, seuls les convoqués sont relancés', () => {
  // L'effectif de 11, une convocation publiée de 7 (dont Hugo et Léo, qui ont répondu) ;
  // Nino et Théo ont été ajoutés hors convocation.
  const avecConvocation = () => {
    const donnees = feuilleEffectifComplet();
    const horsConvocation = new Set(['Nino Garcia', 'Sami Martin', 'Théo Nguyen', 'Yanis Bernard']);
    donnees.playerResponses = donnees.playerResponses.map((/** @type {any} */ item) => ({
      ...item, convoked: !horsConvocation.has(item.label),
    }));
    return donnees;
  };

  test('Retours : « 2 sur 11 ont répondu », mais « Relancer » ne compte que les convoqués, et le dit', async () => {
    const racine = await monter(avecConvocation());
    await appuyerSur(racine, 'Retours');
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining([
      '2 sur 11 ont répondu',
      'Manquent · 9',
      'Relancer les 5',
      'Nino Garcia, Théo Nguyen et 2 autres ne sont pas convoqués : la relance ne part qu’aux convoqués.',
    ]));
    expect(bouton(racine, 'Relancer les 9')).toBeUndefined();
  });

  test('Retours : aucun convoqué ne manque ⇒ pas de bouton, la phrase dit pourquoi', async () => {
    const donnees = feuilleU15({ responseCompletionCount: 1, responseEligibleCount: 2 }, {
      playerResponses: [
        { ...REPONSE_HUGO, convoked: true },
        {
          convoked: false, label: 'Nino Garcia', status: null, userDocumentId: 'u9',
        },
      ],
    });
    const racine = await monter(donnees);
    await appuyerSur(racine, 'Retours');

    expect(textes(racine)).toContain('Nino Garcia n’est pas convoqué : la relance ne part qu’aux convoqués.');
    expect(textes(racine).some((texte) => texte.startsWith('Relancer'))).toBe(false);
  });

  test('Joueurs : un joueur ajouté hors convocation est dit tel, et garde ses minutes', async () => {
    const donnees = avecConvocation();
    donnees.report.playerLines = [{
      minutesPlayed: 30, sportPayload: { assists: 0, goals: 0, goalsConceded: 0 }, userDocumentId: 'j3',
    }];
    const racine = await monter(donnees);
    await appuyerSur(racine, 'Joueurs · 11');

    expect(parDescription(racine, 'Nino Garcia : 30 minutes, 0 but, 0 passe. Hors convocation.')).not.toHaveLength(0);
    expect(textes(racine).filter((texte) => texte === 'Hors convocation')).toHaveLength(4);
    await appuyerSur(racine, 'Brouillon');
    expect(mockSaveDraft.mock.calls[0][1].playerLines.find((/** @type {any} */ ligne) => ligne.userDocumentId === 'j3'))
      .toMatchObject({ minutesPlayed: 30 });
  });

  test('Serveur d avant (pas de champ) : tous les manquants restent relançables', async () => {
    const racine = await monter(feuilleEffectifComplet());
    await appuyerSur(racine, 'Retours');
    expect(bouton(racine, 'Relancer les 9')).toBeTruthy();
  });
});

describe('ST-MATCH10-BIS · 4 — « brouillon A » : « Brouillon » éteint pendant une incohérence, et l alerte le dit', () => {
  test('L alerte unique dit que les deux boutons attendent la correction ; aucun appui ne part', async () => {
    const donnees = feuilleU15({
      playerLines: [{ ...LIGNE_VIDE_HUGO, minutesPlayed: 90, sportPayload: { ...LIGNE_VIDE_HUGO.sportPayload, goals: 3 } }],
    }, { availablePlayers: [HUGO] });
    const racine = await monter(donnees);
    const [alerte] = hotes(racine, (n) => n.props.accessibilityRole === 'alert');

    expect(textes(alerte)).toEqual([
      '1 correction',
      '3 buts saisis pour un score de 2. Vérifie Hugo Lemaire.',
      '« Brouillon » et « Publier » attendent la correction.',
    ]);
    expect(bouton(racine, 'Brouillon').props.disabled).toBe(true);
    expect(bouton(racine, 'Publier').props.disabled).toBe(true);
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  test('Une feuille cohérente : la phrase n apparaît pas', async () => {
    const racine = await monter(feuilleU15());
    expect(textes(racine)).not.toContain('« Brouillon » et « Publier » attendent la correction.');
  });
});

describe('ST-MATCH10-BIS · 6 — le fil d Ariane du site (planche P3-editeur-ordi)', () => {
  const fil = (/** @type {any} */ racine) => racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-fil')[0];

  test('Ordinateur : « Planning › Match › Feuille de match », au-dessus du titre', async () => {
    const racine = await monter(feuilleU15(), { desktop: true });

    expect(fil(racine)).toBeTruthy();
    expect(textes(fil(racine))).toEqual(['Planning', '›', 'Match', '›', 'Feuille de match']);
  });

  test('« Planning » mène au planning, « Match » à la page du match', async () => {
    const racine = await monter(feuilleU15(), { desktop: true });

    await appuyerSur(fil(racine), 'Planning');
    expect(navigation.navigate).toHaveBeenLastCalledWith(RouteNames.MyEventList);
    await appuyerSur(fil(racine), 'Match');
    expect(navigation.navigate).toHaveBeenLastCalledWith(RouteNames.EventDetails, { eventId: 'event-1' });
    // Des liens, pour un lecteur d'écran ; la page en cours n'en est pas un.
    const liens = hotes(fil(racine), (n) => n.props.accessibilityRole === 'link');
    expect(liens).toHaveLength(2);
  });

  test('Téléphone : pas de fil (le retour de l en-tête suffit)', async () => {
    const racine = await monter(feuilleU15());
    expect(fil(racine)).toBeUndefined();
  });
});

describe('ST-MATCH10-BIS · 7 — la colonne « Réponse » sur ordinateur (planche O2)', () => {
  const colonneJoueurs = (/** @type {any} */ racine) => racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-colonne-joueurs')[0];

  test('Un joueur ouvert : « Joueur · Réponse · Min · Buts · Pas. », la réponse dans SA colonne', async () => {
    const donnees = feuilleEffectifComplet();
    const racine = await monter(donnees, { desktop: true });
    await appuyerSurDescription(racine, 'Hugo Roux : 0 minute, 0 but, 0 passe. A répondu.');
    const vus = textes(colonneJoueurs(racine));

    expect(vus.slice(1, 6)).toEqual(['Joueur', 'Réponse', 'Min', 'Buts', 'Pas.']);
    expect(vus).not.toContain('Ta note');
    // Deux ont répondu, neuf non (« — », comme la planche) ; plus de 2e ligne sous le nom.
    expect(vus.filter((texte) => texte === 'A répondu')).toHaveLength(2);
    expect(vus.filter((texte) => texte === '—')).toHaveLength(9);
    expect(vus).not.toContain('Pas encore répondu');
  });

  test('Aucun joueur ouvert (planche O1) : « Ta note » reste, la réponse sous le nom', async () => {
    const racine = await monter(feuilleU15(), { desktop: true });
    const vus = textes(colonneJoueurs(racine));

    expect(vus).toEqual(expect.arrayContaining(['Ta note', 'A répondu · repris de sa réponse']));
    expect(vus).not.toContain('Réponse');
  });

  test('Téléphone : pas de colonne « Réponse » (la ligne la dit sous le nom)', async () => {
    const racine = await monter(feuilleU15());
    await appuyerSur(racine, 'Joueurs · 1');
    expect(textes(racine)).not.toContain('Réponse');
  });
});
