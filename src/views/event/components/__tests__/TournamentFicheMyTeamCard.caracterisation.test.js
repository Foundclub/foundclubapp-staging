/* eslint-disable max-len -- les témoins se lisent en entier. */
import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentFicheMyTeamCard from '../TournamentFicheMyTeamCard';

// ==========================================================================
// TÉMOIN CARACTÉRISANT (18/11/2026) — la carte « Mon équipe » de la fiche du tournoi, au téléphone
// (T-PAGES-4). Il décrit le comportement ACTUEL, avant la modification qui va suivre :
//   · le surtitre du rôle (capitaine, membre, invité, demandeur), le nom de l'équipe et ses replis ;
//   · la page d'équipe lue par `useGetTournamentTeam(team.documentId)` : tant qu'elle n'est pas là,
//     ni progression (« 0 / 5 »), ni « Payer ma place », ni discussion ;
//   · « Payer ma place » seulement pour le capitaine ou le membre dont la place est due ET a un lien ;
//   · le geste du lecteur (`action`), puis la discussion de l'équipe ;
//   · l'ordre des blocs dans la carte.
// La progression est la VRAIE brique TournamentTeamProgress, les textes ceux de fr.js.
// ==========================================================================

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { disabled: props.disabled, onPress: props.onPress, testID: props.testID },
      react.createElement(rn.Text, null, props.title),
    );
  };
});

const mockOpenUrlHere = jest.fn();
jest.mock('@/platform/links', () => ({
  __esModule: true,
  default: { openUrlHere: (/** @type {string} */ url) => mockOpenUrlHere(url) },
}));

/** @type {any} */
let mockLecture;
const mockUseGetTournamentTeam = jest.fn();
jest.mock('@/services/tournamentTeam/tournamentTeamQueries', () => ({
  useGetTournamentTeam: (/** @type {any[]} */ ...args) => {
    mockUseGetTournamentTeam(...args);
    return { data: mockLecture };
  },
}));

const membre = (/** @type {string} */ id, /** @type {string} */ prenom, /** @type {any} */ extra = {}) => ({
  documentId: id, responseStatus: 'pending', role: 'member', user: { documentId: `u-${id}`, firstname: prenom }, ...extra,
});
const MEMBRES = [
  membre('m1', 'Dorian', { responseStatus: 'present', role: 'captain' }),
  membre('m2', 'Ado'),
  membre('m3', 'Michel'),
];
const URL_PAIEMENT = 'https://paiement.example/place-m1';
/**
 * Les places payées, la mienne en tête.
 * @param {any} [maPlace] - Ce qui change sur ma place.
 * @returns {any} Le `payment` de la page d'équipe.
 */
const paiement = (maPlace = {}) => ({
  entryFeeCents: 2000,
  members: [
    {
      isSelf: true, memberDocumentId: 'm1', paymentUrl: URL_PAIEMENT, status: 'due', ...maPlace,
    },
    { isSelf: false, memberDocumentId: 'm2', status: 'paid' },
    { isSelf: false, memberDocumentId: 'm3', status: 'due' },
  ],
  paidCount: 1,
  paidMembersToValidate: 5,
});
/**
 * La page d'équipe telle que `getTournamentTeamById` la rend.
 * @param {any} [extra] - Ce qui change.
 * @returns {any} L'équipe détaillée.
 */
const detail = (extra = {}) => ({
  documentId: 'team-1',
  members: MEMBRES,
  name: 'Les Lions (page)',
  payment: paiement(),
  status: 'pending',
  ...extra,
});
const EQUIPE = { documentId: 'team-1', name: 'Les Lions (fiche)' };

/** @type {any[]} */
const montes = [];
/**
 * Monte la carte avec des props par défaut (capitaine, sans geste).
 * @param {any} [props] - Les props qui changent.
 * @returns {any} L'arbre.
 */
const monter = (props = {}) => {
  /** @type {any} */
  let arbre = null;
  /** @type {any} */
  const p = {
    action: null, navigation: { navigate: jest.fn() }, role: 'captain', team: EQUIPE, ...props,
  };
  act(() => {
    arbre = renderer.create(
      <TournamentFicheMyTeamCard
        action={p.action}
        navigation={p.navigation}
        role={p.role}
        team={p.team}
        tournamentConfig={p.tournamentConfig}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text')
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const texte = (/** @type {any} */ arbre) => textes(arbre).join(' | ');
// IMPL-1 (9f) : la pastille d'état se range à côté du surtitre ; le nom est le texte qui suit
// les deux.
const nom = (/** @type {any} */ arbre) => textes(arbre).filter((t) => !/à payer$|^Validée$/.test(t))[1];
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.testID === id && typeof n.type === 'string',
);
/**
 * Le bouton (doublure) qui porte ce titre.
 * @param {any} arbre - L'arbre.
 * @param {string} titre - Le titre du bouton.
 * @returns {any[]} Les boutons trouvés.
 */
const boutons = (arbre, titre) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ n) => n.findAll((/** @type {any} */ e) => e.type === 'Text')
    .some((/** @type {any} */ e) => [].concat(e.props.children).join('') === titre));
const appuyer = (/** @type {any} */ bouton) => { act(() => { bouton.props.onPress(); }); };

beforeEach(() => {
  mockLecture = undefined;
  mockOpenUrlHere.mockClear();
  mockUseGetTournamentTeam.mockClear();
});
afterEach(() => { act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); }); });

describe('TournamentFicheMyTeamCard — la carte et son rôle', () => {
  test('affiche la carte sous le testID « tournament-fiche-my-team » quand la page d équipe n est pas encore là', () => {
    expect(parTestID(monter(), 'tournament-fiche-my-team')).toHaveLength(1);
  });

  test.each([
    ['captain', 'Mon équipe · Capitaine'],
    ['member', 'Mon équipe'],
    ['invited', 'Mon équipe · Invitation'],
    ['requested', 'Mon équipe · Demande envoyée'],
  ])('affiche le surtitre de fr.js quand le rôle est « %s »', (role, surtitre) => {
    expect(textes(monter({ role }))[0]).toBe(surtitre);
  });

  test('lit la page d équipe avec le documentId de l équipe reçue par la fiche', () => {
    monter();
    expect(mockUseGetTournamentTeam).toHaveBeenCalledWith('team-1');
  });

  test('appelle la lecture avec undefined quand la fiche ne donne pas d équipe, et affiche « Équipe tournoi »', () => {
    const arbre = monter({ team: undefined });
    expect(mockUseGetTournamentTeam).toHaveBeenCalledWith(undefined);
    expect(nom(arbre)).toBe('Équipe tournoi');
  });
});

describe('TournamentFicheMyTeamCard — le nom de l équipe', () => {
  test('affiche le nom de la page d équipe quand elle est lue (il passe avant celui de la fiche)', () => {
    mockLecture = { data: detail() };
    expect(nom(monter())).toBe('Les Lions (page)');
  });

  test('affiche le nom reçu par la fiche quand la page d équipe n est pas encore là', () => {
    expect(nom(monter())).toBe('Les Lions (fiche)');
  });

  test('affiche le nom de la fiche quand la page d équipe est lue mais sans nom', () => {
    mockLecture = { data: detail({ name: '' }) };
    expect(nom(monter())).toBe('Les Lions (fiche)');
  });
});

describe('TournamentFicheMyTeamCard — la page d équipe pas encore là', () => {
  test('n affiche ni progression, ni « 0 / 5 », ni « Payer ma place », ni discussion quand la lecture n a rien rendu', () => {
    const arbre = monter({ action: { onPress: jest.fn(), title: 'Voir mon équipe' } });
    expect(parTestID(arbre, 'tournament-fiche-my-team-progress')).toHaveLength(0);
    expect(texte(arbre)).not.toContain('/ 5');
    expect(parTestID(arbre, 'tournament-fiche-my-team-pay')).toHaveLength(0);
    expect(texte(arbre)).not.toContain('Discussion de l');
    expect(textes(arbre)).toEqual(['Mon équipe · Capitaine', 'Les Lions (fiche)', 'Voir mon équipe']);
  });

  test('ignore une réponse sans documentId (refus, réponse vide) : pas de progression, nom de la fiche', () => {
    mockLecture = { data: { name: 'Sans identifiant', payment: paiement() } };
    const arbre = monter();
    expect(parTestID(arbre, 'tournament-fiche-my-team-progress')).toHaveLength(0);
    expect(nom(arbre)).toBe('Les Lions (fiche)');
    expect(parTestID(arbre, 'tournament-fiche-my-team-pay')).toHaveLength(0);
  });

  test('accepte aussi la page d équipe rendue à plat (sans enveloppe { data })', () => {
    mockLecture = detail();
    const arbre = monter();
    expect(parTestID(arbre, 'tournament-fiche-my-team-progress')).toHaveLength(1);
    expect(nom(arbre)).toBe('Les Lions (page)');
  });
});

// IMPL-1-FICHE (18/11, pack T-DESIGN-TOURNOI, écran 9f) : la carte de la fiche devient compacte —
// « N places payées sur 5 », la barre, et la pastille d'état (« N places à payer » ou « Validée »).
// « Où en est l'équipe » et « Il te reste à faire » (TournamentTeamProgress) restent sur la page
// d'équipe, où « Voir mon équipe » mène.
describe('TournamentFicheMyTeamCard — la progression compacte (IMPL-1, 9f)', () => {
  test('🔴 affiche « 1 place payée sur 5 », la barre et « 4 places à payer » quand la page d équipe est lue', () => {
    mockLecture = { data: detail() };
    const arbre = monter();
    expect(parTestID(arbre, 'tournament-fiche-my-team-progress')).toHaveLength(1);
    expect(textes(arbre)).toContain('1 place payée sur 5');
    expect(textes(arbre)).toContain('4 places à payer');
    expect(texte(arbre)).not.toContain('Il te reste à faire');
  });

  test('🔴 affiche « Validée » (et plus de places à payer) quand le statut de la page d équipe est « accepted »', () => {
    mockLecture = { data: detail({ payment: { ...paiement({ status: 'paid' }), paidCount: 5 }, status: 'accepted' }) };
    const arbre = monter();
    expect(textes(arbre)).toContain('Validée');
    expect(texte(arbre)).not.toContain('à payer');
    expect(textes(arbre)).toContain('5 places payées sur 5');
  });

  test('🔴 compte sur le seuil du tournoi de la page d équipe quand il existe, avant celui de la fiche', () => {
    mockLecture = { data: detail({ event: { tournamentConfig: { paidMembersToValidate: 5 } }, payment: null }) };
    const arbre = monter({ tournamentConfig: { paidMembersToValidate: 4 } });
    expect(textes(arbre)).toContain('0 place payée sur 5');
  });

  test('🔴 compte sur le seuil reçu par la fiche quand la page d équipe n en a pas', () => {
    mockLecture = { data: detail({ payment: null }) };
    const arbre = monter({ tournamentConfig: { paidMembersToValidate: 4 } });
    expect(textes(arbre)).toContain('0 place payée sur 4');
  });

  test('ne casse pas quand la page d équipe n a ni membres ni paiement', () => {
    mockLecture = { data: { documentId: 'team-1', name: 'Vide' } };
    const arbre = monter();
    expect(parTestID(arbre, 'tournament-fiche-my-team-progress')).toHaveLength(1);
    expect(parTestID(arbre, 'tournament-fiche-my-team-pay')).toHaveLength(0);
  });
});

describe('TournamentFicheMyTeamCard — « Payer ma place »', () => {
  test('affiche « Payer ma place » sous le testID « tournament-fiche-my-team-pay » quand le capitaine a sa place due avec un lien', () => {
    mockLecture = { data: detail() };
    const arbre = monter({ role: 'captain' });
    expect(parTestID(arbre, 'tournament-fiche-my-team-pay')).toHaveLength(1);
    expect(boutons(arbre, 'Payer ma place')).toHaveLength(1);
    expect(parTestID(arbre, 'tournament-fiche-my-team-pay')[0].findAllByType(TouchableOpacity)).toHaveLength(1);
  });

  test('ouvre le lien de paiement de MA place dans l app (openUrlHere) quand on appuie sur « Payer ma place »', () => {
    mockLecture = { data: detail() };
    const arbre = monter({ role: 'captain' });
    appuyer(boutons(arbre, 'Payer ma place')[0]);
    expect(mockOpenUrlHere).toHaveBeenCalledTimes(1);
    expect(mockOpenUrlHere).toHaveBeenCalledWith(URL_PAIEMENT);
  });

  test('affiche « Payer ma place » quand le membre a sa place due avec un lien', () => {
    mockLecture = { data: detail() };
    expect(parTestID(monter({ role: 'member' }), 'tournament-fiche-my-team-pay')).toHaveLength(1);
  });

  test.each(['invited', 'requested'])('n affiche pas « Payer ma place » quand le rôle est « %s », même avec une place due et un lien', (role) => {
    mockLecture = { data: detail() };
    const arbre = monter({ role });
    expect(parTestID(arbre, 'tournament-fiche-my-team-pay')).toHaveLength(0);
    expect(texte(arbre)).not.toContain('Payer ma place');
  });

  test('n affiche pas « Payer ma place » quand ma place est déjà payée', () => {
    mockLecture = { data: detail({ payment: paiement({ status: 'paid' }) }) };
    expect(parTestID(monter(), 'tournament-fiche-my-team-pay')).toHaveLength(0);
  });

  test('n affiche pas « Payer ma place » quand ma place due n a pas de lien de paiement', () => {
    mockLecture = { data: detail({ payment: paiement({ paymentUrl: null }) }) };
    expect(parTestID(monter(), 'tournament-fiche-my-team-pay')).toHaveLength(0);
  });

  test('n affiche pas « Payer ma place » quand aucune place n est la mienne (isSelf)', () => {
    mockLecture = { data: detail({ payment: paiement({ isSelf: false }) }) };
    expect(parTestID(monter(), 'tournament-fiche-my-team-pay')).toHaveLength(0);
  });
});

describe('TournamentFicheMyTeamCard — le geste du lecteur (action)', () => {
  test('affiche le bouton au titre de l action et appelle son onPress quand on appuie', () => {
    const onPress = jest.fn();
    const arbre = monter({ action: { onPress, title: 'Inviter des joueurs' } });
    const [bouton] = boutons(arbre, 'Inviter des joueurs');
    expect(bouton).toBeTruthy();
    appuyer(bouton);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('n affiche aucun bouton de geste quand action vaut null', () => {
    const arbre = monter({ action: null });
    expect(arbre.root.findAllByType(TouchableOpacity)).toHaveLength(0);
    // Témoin du témoin : avec un geste, le même compte vaut 1.
    expect(monter({ action: { onPress: jest.fn(), title: 'Voir mon équipe' } }).root.findAllByType(TouchableOpacity)).toHaveLength(1);
  });
});

describe('TournamentFicheMyTeamCard — la discussion de l équipe', () => {
  test('affiche « Discussion de l équipe » et ouvre la conversation de l équipe quand la page d équipe porte un fil', () => {
    mockLecture = { data: detail({ discussion: { chat: 'chat-42', ecriture: true } }) };
    const navigation = { navigate: jest.fn() };
    const arbre = monter({ navigation });
    const discussion = boutons(arbre, "Discussion de l'équipe");
    expect(discussion).toHaveLength(1);
    appuyer(discussion[0]);
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', { chatId: 'chat-42' });
  });

  test('affiche la phrase du serveur quand la discussion est fermée au membre (règle des mineurs)', () => {
    mockLecture = { data: detail({ discussion: { ferme: true, message: 'Fil réservé aux majeurs.' } }) };
    const arbre = monter();
    expect(parTestID(arbre, 'tournament-team-discussion-closed')).toHaveLength(1);
    expect(texte(arbre)).not.toContain("Discussion de l'équipe");
  });

  test('n affiche pas de discussion quand la page d équipe n en porte pas', () => {
    mockLecture = { data: detail() };
    expect(texte(monter())).not.toContain('Discussion de l');
  });
});

describe('TournamentFicheMyTeamCard — l ordre des blocs', () => {
  test('range surtitre, nom, places payées, « Payer ma place », geste, discussion, dans cet ordre', () => {
    mockLecture = { data: detail({ discussion: { chat: 'chat-42', ecriture: true } }) };
    const arbre = monter({ action: { onPress: jest.fn(), title: 'Inviter des joueurs' } });
    const tous = textes(arbre);
    const rang = (/** @type {string} */ morceau) => tous.findIndex((t) => t.includes(morceau));
    const ordre = ['Mon équipe · Capitaine', 'Les Lions (page)', 'place payée sur', 'Payer ma place', 'Inviter des joueurs', 'Discussion de l'].map(rang);
    expect(ordre.every((r) => r >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });
});
