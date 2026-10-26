import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { saveEventCompositionDraft } from '@/services/event/eventService';

import ConvocationWizard from '../ConvocationWizard';

const brouillon = /** @type {any} */ (saveEventCompositionDraft);

// 📋 CONVLISTE (26/10) — CONVOQUER « EN LISTE », SANS TERRAIN (demande d'Adel, planche
// SadoTSP5SJfA7h2qRAxPHv, « 1- A 2- A »). Meme banc que `ConvocationWizard.test.js` : le TEXTE
// VISIBLE, les boutons et ce que le serveur recoit ; services doubles, vraies traductions.

const TEAM = 'equipe-seniors';

/** @type {any} */
const mockState = {
  composition: {},
  events: [],
  messages: [],
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ cle) => String(cle || '').split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        let valeur = lire(cle);
        // Regle du francais (CLDR) : 0 et 1 sont au singulier.
        if (typeof valeur !== 'string' && options && options.count !== undefined) {
          valeur = lire(`${cle}_${Math.abs(options.count) < 2 ? 'one' : 'other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_tout, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'coach-1', firstname: 'Coach' } }),
}));

const mockSendMessage = jest.fn(() => 'temp-1');
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendMessage: mockSendMessage }),
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: (/** @type {any} */ erreur) => erreur?.decision || null,
}));

jest.mock('@/domains/refresh/afterAction', () => ({
  invalidateAfterAction: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({
  __esModule: true,
  default: () => null,
  SvgIcon: () => null,
}));

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { isVisible }) => (
      isVisible ? <TexteRN>MUR PAYANT</TexteRN> : null
    ),
  };
});

jest.mock('@/components/molecules/eventCard/EventCardNew', () => {
  const { Text: TexteRN, TouchableOpacity: Touche } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { item, onPress }) => (
      <Touche onPress={onPress} testID={`carte-${item.documentId}`}>
        <TexteRN>{`CARTE ${item.name}`}</TexteRN>
      </Touche>
    ),
  };
});

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatMessages: () => ({ data: { pages: [{ data: mockState.messages }] } }),
}));

jest.mock('@/services/chat/chatService', () => ({
  createChatMessage: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvents: (/** @type {any} */ params, /** @type {any} */ options) => ({
    data: options?.enabled ? { pages: [{ data: mockState.events }] } : undefined,
    isFetching: false,
  }),
  useGetEventTeamComposition: (
    /** @type {string} */ eventId,
    /** @type {string} */ _teamId,
    /** @type {any} */ options,
  ) => ({
    data: options?.enabled ? mockState.composition[eventId] : undefined,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/event/eventService', () => ({
  publishEventConvocation: jest.fn(() => Promise.resolve({})),
  saveEventCompositionDraft: jest.fn(() => Promise.resolve({})),
}));

const player = (documentId, firstname, lastname) => ({ documentId, firstname, lastname });

const matchSamedi = {
  date: '2026-10-10T13:00:00.000Z',
  documentId: 'match-samedi',
  name: 'Match vs US Pelican',
  team: { activities: [{ name: 'Football' }], documentId: TEAM },
  type: { name: 'Match' },
};
const entrainement = {
  date: '2026-10-08T17:00:00.000Z',
  documentId: 'entrainement-mercredi',
  name: 'Entraînement',
  team: { documentId: TEAM },
  type: { name: 'Entraînement' },
};
const autreEquipe = {
  date: '2026-10-09T10:00:00.000Z',
  documentId: 'match-u15',
  name: 'Match U15',
  team: { documentId: 'equipe-u15' },
  type: { name: 'Match' },
};
const detection = {
  date: '2026-10-11T10:00:00.000Z',
  documentId: 'detection',
  name: 'Journée détection',
  team: { documentId: TEAM },
  type: { name: 'Détection' },
};

const effectif = [
  player('hugo', 'Hugo', 'Martin'),
  player('sami', 'Sami', 'Diallo'),
  player('theo', 'Théo', 'Garcia'),
];

beforeEach(() => {
  jest.clearAllMocks();
  mockState.events = [matchSamedi, entrainement, autreEquipe, detection];
  mockState.messages = [];
  mockState.composition = {
    [entrainement.documentId]: {
      eligiblePlayers: effectif, published: null, responses: null, rsvpEnabled: true,
    },
    [matchSamedi.documentId]: {
      eligiblePlayers: effectif, published: null, responses: null, rsvpEnabled: true,
    },
  };
});

/**
 * Ouvre l'assistant, en creation par defaut.
 * @param {any} [props] `mode`, `initialEventId`, `startStep`, `eventSummary`.
 * @returns {{ arbre: any, onClose: jest.Mock }}
 */
const ouvrir = (props = {}) => {
  const onClose = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ConvocationWizard
        chatId="fil-equipe"
        eventSummary={props.eventSummary}
        initialEventId={props.initialEventId}
        mode={props.mode}
        onClose={onClose}
        startStep={props.startStep}
        teamId={TEAM}
        teamName="Seniors"
        visible
      />,
    );
  });
  return { arbre, onClose };
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props.testID === id
    && noeud.type === TouchableOpacity);

const appuyer = (/** @type {any} */ arbre, /** @type {string} */ id) => {
  const [bouton] = parTestId(arbre, id);
  if (!bouton) throw new Error(`bouton introuvable : ${id}`);
  act(() => { bouton.props.onPress(); });
};

const estActif = (/** @type {any} */ arbre, /** @type {string} */ id) => !parTestId(arbre, id)[0]
  .props.disabled;

const estCoche = (/** @type {any} */ arbre, /** @type {string} */ id) => parTestId(
  arbre,
  `convocation-check-${id}`,
)[0].props.accessibilityState.checked;

const contient = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props.testID === id).length > 0;

/**
 * Ouvre une NOUVELLE convocation, choisit le mode, puis le match du samedi.
 * @param {'list' | 'pitch'} format
 * @returns {{ arbre: any, onClose: jest.Mock }}
 */
const ouvrirEn = (format) => {
  const ouvert = ouvrir();
  appuyer(ouvert.arbre, `convocation-mode-${format}`);
  appuyer(ouvert.arbre, 'carte-match-samedi');
  return ouvert;
};

/** Une convocation EN LISTE deja publiee : deux convoques, aucun placement. */
const publieeEnListe = () => {
  mockState.composition[matchSamedi.documentId] = {
    eligiblePlayers: effectif,
    published: {
      requireResponse: true,
      reservePlayerIds: ['hugo', 'sami'],
      reserveSnapshotPlayers: [effectif[0], effectif[1]],
      snapshotPlayers: [],
      sportContext: 'Football',
      teams: [{ placements: [] }],
      version: 1,
    },
    responses: { byPlayerId: { hugo: 'present' } },
    rsvpEnabled: true,
  };
};

describe('CONVLISTE · A1 — le mode se choisit juste apres « Convocation »', () => {
  test('la feuille demande « Comment veux-tu convoquer ? » : En liste, puis En composition', () => {
    const { arbre } = ouvrir();
    const vus = textes(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      'Comment veux-tu convoquer ?', 'En liste', 'En composition',
    ]));
    expect(vus.indexOf('En liste')).toBeLessThan(vus.indexOf('En composition'));
    // Rien du tunnel tant que le mode n est pas choisi.
    expect(vus).not.toContain('POUR QUEL ÉVÉNEMENT ?');
  });

  test('fermer la feuille ferme l assistant', () => {
    const { arbre, onClose } = ouvrir();
    appuyer(arbre, 'convocation-mode-close');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('« DERNIER CHOIX » : la derniere convocation de l equipe dans le fil etait en liste', () => {
    mockState.messages = [{
      composition: {
        eventId: 'match-precedent',
        placements: [],
        publishedAt: '2026-10-01T10:00:00.000Z',
        publishedVersion: 1,
        reservePlayers: [effectif[0]],
        schemaVersion: 3,
        snapshotPlayers: [],
        teamId: TEAM,
        teams: [{ placements: [] }],
        type: 'lineup_share',
      },
    }];
    const { arbre } = ouvrir();
    const liste = arbre.root.findByProps({ testID: 'convocation-mode-list' });
    const textesListe = liste.findAllByType(Text)
      .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
    expect(textesListe).toContain('DERNIER CHOIX');
    const compo = arbre.root.findByProps({ testID: 'convocation-mode-pitch' });
    expect(compo.findAllByType(Text)
      .map((/** @type {any} */ n) => [].concat(n.props.children).join('')))
      .not.toContain('DERNIER CHOIX');
  });
});

describe('CONVLISTE · B1-B3 — le tunnel en liste a 3 etapes', () => {
  test('« Etape 1 sur 3 », puis « Etape 2 sur 3 » sans Terrain / Banc, puis « 3 sur 3 »', () => {
    const { arbre } = ouvrirEn('list');
    expect(textes(arbre)).toContain('Étape 1 sur 3 · Événement');
    appuyer(arbre, 'convocation-wizard-next');
    expect(textes(arbre)).toContain('Étape 2 sur 3 · Joueurs');
    expect(textes(arbre)).toContain('0 CONVOQUÉ');

    // Etat vide : personne de coche, « Suivant » grise.
    expect(estActif(arbre, 'convocation-wizard-next')).toBe(false);

    appuyer(arbre, 'convocation-whole-squad');
    expect(textes(arbre)).toContain('3 CONVOQUÉS');
    expect(textes(arbre)).not.toContain('3 TERRAIN · 0 BANC');
    expect(contient(arbre, 'convocation-side-pitch')).toBe(false);
    expect(contient(arbre, 'convocation-side-bench')).toBe(false);

    appuyer(arbre, 'convocation-wizard-next');
    const vus = textes(arbre);
    expect(vus).toContain('Étape 3 sur 3 · Détails');
    expect(vus).toContain('3 convoqués');
    expect(vus.some((texte) => texte.includes('sur le terrain'))).toBe(false);
    expect(vus).toContain('Envoyer la convocation');
  });

  test('« Envoyer » : aucun placement, les convoques partent tous dans la liste', async () => {
    const { arbre } = ouvrirEn('list');
    appuyer(arbre, 'convocation-wizard-next');
    appuyer(arbre, 'convocation-check-hugo');
    appuyer(arbre, 'convocation-check-theo');
    appuyer(arbre, 'convocation-wizard-next');
    const [bouton] = parTestId(arbre, 'convocation-wizard-next');
    await act(async () => { await bouton.props.onPress(); });

    const [, { draft }] = brouillon.mock.calls[0];
    expect(draft.teams[0].placements).toEqual([]);
    expect(draft.reservePlayerIds).toEqual(['hugo', 'theo']);
  });

  test('en composition, le tunnel garde ses 4 etapes (inchange)', () => {
    const { arbre } = ouvrirEn('pitch');
    expect(textes(arbre)).toContain('Étape 1 sur 4 · Événement');
    appuyer(arbre, 'convocation-wizard-next');
    expect(textes(arbre)).toContain('Étape 2 sur 4 · Joueurs');
    expect(textes(arbre)).toContain('0 TERRAIN · 0 BANC');
  });
});

describe('CONVLISTE · C1-C3 — passer d un mode a l autre', () => {
  test('une convocation en liste se rouvre en liste ; « Passer en composition » garde tout', () => {
    publieeEnListe();
    const { arbre } = ouvrir({
      initialEventId: matchSamedi.documentId, mode: 'edit', startStep: 2,
    });
    expect(textes(arbre)).toContain('Étape 2 sur 3 · Joueurs');
    expect(textes(arbre)).toContain('2 CONVOQUÉS');
    expect(textes(arbre)).toContain('A dit présent');

    appuyer(arbre, 'convocation-mode-switch');
    const vus = textes(arbre);
    expect(vus).toContain('Étape 2 sur 4 · Joueurs');
    // Les deux convoques restent coches, tous sur le terrain ; la reponse de Hugo reste.
    expect(vus).toContain('2 TERRAIN · 0 BANC');
    expect(estCoche(arbre, 'hugo')).toBe(true);
    expect(estCoche(arbre, 'sami')).toBe(true);
    expect(vus).toContain('A dit présent');
    expect(vus.some((texte) => texte.startsWith('Tes 2 joueurs sont gardés'))).toBe(true);
  });

  // CONVLISTE-FIN (chef 26/10, planche C3) — la confirmation est la FEUILLE dessinee de la
  // planche, plus la fenetre systeme (Alert, `window.confirm` au site).
  test('composition → liste : la feuille de la planche, placement efface', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { arbre } = ouvrirEn('pitch');
    appuyer(arbre, 'convocation-wizard-next');
    appuyer(arbre, 'convocation-check-hugo');
    appuyer(arbre, 'convocation-mode-switch');

    expect(alerte).not.toHaveBeenCalled();
    const feuille = arbre.root.findByProps({ testID: 'convocation-tolist-sheet' });
    expect(feuille.findAllByType(Text)
      .map((/** @type {any} */ n) => [].concat(n.props.children).join(''))).toEqual(
      expect.arrayContaining([
        'Passer en liste ?', 'Passer en liste', 'Garder la composition',
      ]),
    );
    // « Garder la composition » referme la feuille, rien ne bouge.
    appuyer(arbre, 'convocation-tolist-keep');
    expect(contient(arbre, 'convocation-tolist-sheet')).toBe(false);
    expect(textes(arbre)).toContain('Étape 2 sur 4 · Joueurs');

    appuyer(arbre, 'convocation-mode-switch');
    appuyer(arbre, 'convocation-tolist-confirm');
    expect(contient(arbre, 'convocation-tolist-sheet')).toBe(false);
    expect(textes(arbre)).toContain('Étape 2 sur 3 · Joueurs');
    expect(estCoche(arbre, 'hugo')).toBe(true);
    expect(textes(arbre)).toContain('1 CONVOQUÉ');

    appuyer(arbre, 'convocation-wizard-next');
    const [bouton] = parTestId(arbre, 'convocation-wizard-next');
    await act(async () => { await bouton.props.onPress(); });
    const [, { draft }] = brouillon.mock.calls[0];
    expect(draft.teams[0].placements).toEqual([]);
    expect(draft.reservePlayerIds).toEqual(['hugo']);
    alerte.mockRestore();
  });
});
