import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';

import EventAnswerButtons from '../EventAnswerButtons';

// LOT MATCHRSVP (E6) — MESURE D ABORD : « ou disparaissent Present / Absent
// sur un MATCH ? »
//
// Constat d Adel au banc d essai du 2026-09-05 (defaut n° 16) :
// « sur un MATCH, les boutons Present·e / Absent·e n existent pas ; ils sont la
// sur l entrainement ». Decision d Adel du 2026-09-10 : ce n est PAS voulu.
//
// ⚠️ CE FICHIER NE CORRIGE RIEN. Il compare, a payload IDENTIQUE, un
// entrainement et un match, et fait dire au code OU la rangee de reponse se
// perd. Les temoins ROUGES qu il produit nomment la cause ; ils deviennent le
// filet du correctif ensuite.
//
// ⛔ Y07 n est PAS remis en cause : seuls les JOUEURS repondent. Ces temoins ne
// montent que des joueurs, sauf le dernier qui verrouille l encadrant.

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: makeRamp(),
    }),
  };
});

// `t` rend la CLE : les assertions ne dependent pas de la copie de fr.js.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (key) => key }),
}));

const mockUserData = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData() }),
}));

// ⚠️ COPIE FIDELE de `canEventBeJoined` (`eventUseCases.js`), comme le fait le
// banc Y07 : c est elle qui fabrique le « bouton gris ». La doubler par un
// `true` de confort masquerait exactement le defaut qu on mesure.
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: ({
      capacity, participations, userId, userRole,
    }) => {
      if (!capacity) return true;
      return userRole?.name === 'Joueur'
        && (participations || []).length < capacity
        && !(participations || []).some((p) => p.documentId === userId);
    },
    haveIAlreadyAnsweredNo: ({ missings, userId }) => (missings || [])
      .some((m) => m.documentId === userId),
    haveIAlreadyJoined: ({ participations, userId }) => (participations || [])
      .some((p) => p.documentId === userId),
  }),
}));

const PLAYER_ID = 'user-player';
const COACH_ID = 'user-coach';
const TEAM_ID = 'team-1';

const playerUser = {
  documentId: PLAYER_ID,
  myTeams: [{ documentId: TEAM_ID }],
  role: { name: USER_ROLES.player },
};
const coachUser = {
  documentId: COACH_ID,
  role: { name: USER_ROLES.coach },
  trainedTeams: [{ documentId: TEAM_ID }],
};

/**
 * L equipe conviee telle que le serveur la rend : le joueur dans `players`,
 * l encadrant dans `trainers`.
 * @returns {any} L equipe.
 */
const convenedTeam = () => ({
  documentId: TEAM_ID,
  name: 'Senior A',
  players: [{ documentId: PLAYER_ID }],
  trainers: [{ documentId: COACH_ID }],
});

/**
 * Le socle commun aux deux evenements compares. TOUT y est identique sauf ce
 * que l appelant surcharge : c est la condition pour que la comparaison
 * entrainement / match ait une valeur de preuve.
 * @param {object} [overrides] Ce qui distingue le cas mesure.
 * @returns {any} L evenement de test.
 */
const buildEvent = (overrides = {}) => ({
  capacity: 0,
  date: '2027-05-12T18:00:00.000Z',
  documentId: 'event-1',
  missings: [],
  participationRequests: [],
  participations: [],
  team: convenedTeam(),
  ...overrides,
});

/**
 * L ENTRAINEMENT tel que l app le cree : `sessionStatus` a `closed` (seance
 * privee, le choix par defaut du tunnel de creation).
 * @param {object} [overrides] Surcharges.
 * @returns {any} L entrainement.
 */
const entrainement = (overrides = {}) => buildEvent({
  sessionStatus: 'closed',
  type: { name: 'Entrainement' },
  ...overrides,
});

/**
 * LE MATCH tel que la base le stocke : `sessionStatus` vaut `open`, qui est le
 * DEFAUT DU SCHEMA (`admin/src/api/event/content-types/event/schema.json`,
 * `"default": "open"`, champ `required`). Le tunnel de creation d un match ne
 * propose nulle part de le fermer : ce champ ne concerne que les seances.
 * @param {object} [overrides] Surcharges.
 * @returns {any} Le match.
 */
const match = (overrides = {}) => buildEvent({
  sessionStatus: 'open',
  type: { name: 'Match' },
  ...overrides,
});

const render = (props) => {
  let tree = null;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<EventAnswerButtons {...props} />);
  });
  return tree;
};

const titlesOf = (tree) => tree.root.findAllByType(Button).map((button) => button.props.title);
const textsOf = (tree) => tree.root.findAllByType(Text)
  .map((node) => node.props.children)
  .filter((child) => typeof child === 'string');

/**
 * La rangee de reponse, telle qu un joueur la voit : les DEUX libelles.
 * @param {any} tree L arbre rendu.
 * @returns {boolean} Vrai si Present ET Absent sont proposes.
 */
const aLaRangeeDeReponse = (tree) => {
  const titles = titlesOf(tree);
  return titles.includes('eventList.actions.present')
    && titles.includes('eventList.actions.absent');
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1 — LE TEMOIN DE CONTROLE : l entrainement, celui qui marche aujourd hui
// ---------------------------------------------------------------------------

test('MATCHRSVP/1 (controle) — ENTRAINEMENT : un joueur convie a bien Present et Absent', () => {
  mockUserData.mockReturnValue(playerUser);

  const tree = render({ event: entrainement() });

  expect(aLaRangeeDeReponse(tree)).toBe(true);
});

// ---------------------------------------------------------------------------
// 2 — LE MEME JOUEUR, LA MEME EQUIPE, UN MATCH
// ---------------------------------------------------------------------------

test('MATCHRSVP/2 — MATCH : le meme joueur convie doit avoir Present et Absent', () => {
  mockUserData.mockReturnValue(playerUser);

  const tree = render({ event: match() });

  expect(aLaRangeeDeReponse(tree)).toBe(true);
});

// ---------------------------------------------------------------------------
// 3 — LE MATCH TEL QUE LE SERVEUR LE REND VRAIMENT : effectifs non peuples
//
// Sur la fiche, les identites des participants peuvent etre masquees, et les
// listes / le planning ne portent PAS les effectifs. Le repli de l app est
// `user.myTeams` (`resolveClientSourceTeamForUser`). On mesure ce chemin-la a
// part : c est celui du telephone d Adel.
// ---------------------------------------------------------------------------

test('MATCHRSVP/3 — MATCH sans effectif peuple : le repli par `myTeams` doit tenir', () => {
  mockUserData.mockReturnValue(playerUser);

  const tree = render({ event: match({ team: { documentId: TEAM_ID, name: 'Senior A' } }) });

  expect(aLaRangeeDeReponse(tree)).toBe(true);
});

// ---------------------------------------------------------------------------
// 4 — LE MATCH AVEC LE DRAPEAU DU SERVEUR (piste A du prompt)
//
// `viewerCanRespond` est pose par `event.findOne` (`event.ts:1860`). Quand il
// vaut `true`, la rangee doit etre la ; quand il vaut `false`, c est un
// encadrant et Y07 s applique.
// ---------------------------------------------------------------------------

test('MATCHRSVP/4 — MATCH, serveur qui dit `viewerCanRespond: true` : rangee presente', () => {
  mockUserData.mockReturnValue(playerUser);

  const tree = render({ event: match({ viewerCanRespond: true }) });

  expect(aLaRangeeDeReponse(tree)).toBe(true);
});

// ---------------------------------------------------------------------------
// 5 — LE MATCH AMICAL ET LE MATCH DE LIGUE : les deux autres intitules reels
// ---------------------------------------------------------------------------

test('MATCHRSVP/5 — MATCH AMICAL : un joueur convie doit avoir Present et Absent', () => {
  mockUserData.mockReturnValue(playerUser);

  const tree = render({ event: match({ type: { name: 'Match amical' } }) });

  expect(aLaRangeeDeReponse(tree)).toBe(true);
});

// ---------------------------------------------------------------------------
// 6 🔒 — Y07 NE BOUGE PAS : l encadrant lit sa phrase, sur un match aussi
// ---------------------------------------------------------------------------

test('MATCHRSVP/6 🔒 — MATCH : un encadrant membre lit sa phrase, jamais un bouton', () => {
  mockUserData.mockReturnValue(coachUser);

  const tree = render({ event: match() });

  expect(titlesOf(tree)).not.toContain('eventList.actions.present');
  expect(titlesOf(tree)).not.toContain('eventList.actions.absent');
  expect(textsOf(tree)).toContain('eventList.info.staffDoesNotRsvp');
});

// ---------------------------------------------------------------------------
// 7 & 8 🔒 — CE QUE LA MESURE A TROUVE EN CHERCHANT LA DISSYMETRIE, et qui la
//            REFUTE : quand l equipe d origine ne se resout pas, NI l un NI
//            l autre n ouvre la rangee de reponse.
//
// L hypothese testee etait : `EventAnswerButtons.js:283` ouvre la rangee sur
// `isClosedSession || canAnswerAsMember` ; un entrainement (`sessionStatus:
// 'closed'`) serait donc RATTRAPE la ou un match (`'open'`, defaut du schema)
// tomberait. ⇒ FAUX, et les deux temoins ci-dessous le figent : le
// rattrapage n existe pas, parce que `resolveParticipationFlow` refuse AVANT
// (`participationFlow.js:278`, « evenement ferme reserve aux equipes
// concernees »).
//
// 🎯 CE QUI RESTE VRAI ET QU IL FAUT GARDER : les DEUX refusent, mais ils ne
// disent PAS la meme chose. L entrainement ferme nomme son motif ; le match
// ouvert propose « Participer », qui est le chemin des gens EXTERIEURS. Ce
// n est pas le defaut d Adel — le joueur d une equipe conviee, lui, est
// resolu (temoins 1 a 5) — mais c est la seule difference match / entrainement
// qui existe sur ce chemin, et elle est desormais sous temoin.
// ---------------------------------------------------------------------------

const joueurSansEquipeResolue = {
  documentId: PLAYER_ID,
  role: { name: USER_ROLES.player },
};

test('MATCHRSVP/7 🔒 — ENTRAINEMENT ferme, non-membre : refus NOMME, jamais la rangee', () => {
  mockUserData.mockReturnValue(joueurSansEquipeResolue);

  const tree = render({ event: entrainement({ team: { documentId: TEAM_ID, name: 'Senior A' } }) });

  expect(aLaRangeeDeReponse(tree)).toBe(false);
  expect(textsOf(tree)).toContain('Cet événement fermé est réservé aux équipes concernées.');
});

test('MATCHRSVP/8 🔒 — MATCH, non-membre : le chemin des exterieurs, jamais la rangee', () => {
  mockUserData.mockReturnValue(joueurSansEquipeResolue);

  const tree = render({ event: match({ team: { documentId: TEAM_ID, name: 'Senior A' } }) });

  expect(aLaRangeeDeReponse(tree)).toBe(false);
  expect(titlesOf(tree)).toContain('Participer');
});

// ---------------------------------------------------------------------------
// 9 & 10 🎯 — LA CAUSE, ENFIN NOMMEE : le client ne lit que DEUX registres
//             d equipes conviees, le serveur en lit TROIS.
//
// 🧨 LE MECANISME, et il est asymetrique par construction :
//   · Serveur — `event-audience.ts:433-435` empile `event.team`,
//     `event.invitedTeams` ET `event.teamAudiences[].team`. Son propre
//     commentaire (l.414-416) dit pourquoi la 3e ligne existe : « une equipe
//     que seul le nouveau registre convie est ajoutee — sans quoi ses membres
//     repondaient dans le vide ».
//   · Client — `participationFlow.js:22` empile `event.team` et
//     `event.invitedTeams`. ⛔ PAS `teamAudiences`.
//
// ⇒ Pour une equipe conviee par le SEUL nouveau registre, le serveur repond
//   `viewerCanRespond: true` (il l a resolue) pendant que l app, elle, ne
//   trouve aucune equipe d origine : `canAnswerAsMember` vaut faux, la rangee
//   de reponse ne s ouvre pas, et le joueur tombe sur « Participer » — le
//   chemin des gens EXTERIEURS a l evenement.
//
// 🎯 POURQUOI CA SE VOIT SUR UN MATCH ET PAS SUR UN ENTRAINEMENT : c est le
// tunnel du match qui convie des equipes par audiences (`teamAudiences` porte
// l equipe d en face et les convocations) ; un entrainement, lui, porte son
// equipe dans `event.team`, que le client sait lire. Le type d evenement n est
// donc PAS la cause — c est le REGISTRE utilise, et les matchs sont les seuls
// a s en servir.
//
// ⚠️ `event.teamAudiences` ARRIVE BIEN DANS L APP : trois ecrans le lisent
// deja (`EventTasksSection.js:68`, `EventTeamAudiencesSection.js:63`,
// `EventDetails.js:5736`). La donnee etait la ; c est la regle qui l ignorait.
// ---------------------------------------------------------------------------

/**
 * L audience qui convie l equipe du joueur — le NOUVEAU registre, seul.
 * `event.team` designe l equipe d en face : le client n y trouve rien.
 * @param {object} [audienceOverrides] Ce qui distingue le cas.
 * @returns {any} Le match.
 */
const matchConvieParAudienceSeule = (audienceOverrides = {}) => match({
  invitedTeams: [],
  team: { documentId: 'team-adverse', name: 'US Adverse' },
  teamAudiences: [{
    audienceKind: 'home_team',
    documentId: 'audience-1',
    selectionMode: 'ALL_MEMBERS',
    status: 'ACCEPTED',
    team: convenedTeam(),
    ...audienceOverrides,
  }],
  // Le serveur, LUI, a resolu l equipe : c est ce qu il envoie sur la fiche
  // (`event.ts:1860`). L app recevait donc « tu peux repondre » et n affichait
  // pas de quoi repondre.
  viewerCanRespond: true,
});

test('MATCHRSVP/9 🎯 — MATCH convie par `teamAudiences` seul : le joueur repond', () => {
  mockUserData.mockReturnValue({ documentId: PLAYER_ID, role: { name: USER_ROLES.player } });

  const tree = render({ event: matchConvieParAudienceSeule() });

  expect(aLaRangeeDeReponse(tree)).toBe(true);
});

test('MATCHRSVP/10 🔒 — la convocation NOMINATIVE ne convie que les convoques', () => {
  // Le serveur reduit l effectif aux personnes citees quand l audience vaut
  // `SELECTED_MEMBERS` (`event-audience.ts:216-222`). Le client doit appliquer
  // la MEME reduction, sinon il ouvrirait la rangee a un joueur que le serveur
  // refuserait ensuite — un bouton qui echoue est pire qu un bouton absent.
  mockUserData.mockReturnValue({ documentId: PLAYER_ID, role: { name: USER_ROLES.player } });

  const tree = render({
    event: matchConvieParAudienceSeule({
      selectedMembers: [{ documentId: 'un-autre-joueur' }],
      selectionMode: 'SELECTED_MEMBERS',
    }),
  });

  expect(aLaRangeeDeReponse(tree)).toBe(false);
});

test('MATCHRSVP/11 🔒 — une audience NON ACCEPTEE ne convie personne', () => {
  // `isConveningAudience` (`event-audience.ts:255`) : une invitation PENDING,
  // REFUSED ou CANCELLED n ajoute personne. L invite en attente VOIT la fiche
  // (S10-A/D4) — il ne repond pas pour autant.
  mockUserData.mockReturnValue({ documentId: PLAYER_ID, role: { name: USER_ROLES.player } });

  const tree = render({ event: matchConvieParAudienceSeule({ status: 'PENDING' }) });

  expect(aLaRangeeDeReponse(tree)).toBe(false);
});

test('MATCHRSVP/12 🔒 — Y07 tient sur ce chemin aussi : l encadrant lit sa phrase', () => {
  mockUserData.mockReturnValue({ documentId: COACH_ID, role: { name: USER_ROLES.coach } });

  // Sans le drapeau du serveur, la regle est recalculee par l app : c est le
  // chemin des listes et du planning, celui que Y07 doit tenir seul.
  const event = matchConvieParAudienceSeule();
  delete event.viewerCanRespond;

  const tree = render({ event });

  expect(titlesOf(tree)).not.toContain('eventList.actions.present');
  expect(textsOf(tree)).toContain('eventList.info.staffDoesNotRsvp');
});
