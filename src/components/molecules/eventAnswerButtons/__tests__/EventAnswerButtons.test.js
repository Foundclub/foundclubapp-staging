import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';

import EventAnswerButtons from '../EventAnswerButtons';

// AUDIT L19 (E6) — filet de caracterisation sur EventAnswerButtons, le SEUL
// endroit ou un joueur repond « present » ou « absent ». Ce composant n avait
// aucun test alors qu il est monte a la fois par la carte (EventCardNew) et par
// l ecran de detail (EventDetails) — avec des props DIFFERENTES.
//
// Ces tests decrivent le comportement ACTUEL, y compris ce qui parait faux :
// un test qui fige un defaut est utile, il devient rouge le jour ou on corrige.
//
// Reference : docs/AUDIT_PARTICIPATION_2026_08_02.md, maillons M1, M2 et M6.

// Jetons opaques : le contrat de theme interdit les litteraux hex, et un mock
// n a pas besoin de vraies couleurs. Les assertions portent sur les props des
// boutons, jamais sur le style — les echecs restent donc lisibles.
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

// Copies fideles de eventUseCases : la comparaison se fait sur documentId.
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: ({ missings, userId }) => (missings || [])
      .some((m) => m.documentId === userId),
    haveIAlreadyJoined: ({ participations, userId }) => (participations || [])
      .some((p) => p.documentId === userId),
  }),
}));

const ME = 'user-me';
const player = { documentId: ME, role: { name: USER_ROLES.player } };

// Forme REELLE d une demande refusee : le serveur laisse la ligne ACTIVE et y
// range le motif saisi par le staff (event-participation.ts:798-802).
const declinedRequest = {
  documentId: 'request-declined',
  isActive: true,
  participationStatus: 'declined',
  reason: 'Effectif complet pour ce match.',
  updatedAt: '2026-08-03T10:00:00.000Z',
  user: { documentId: ME },
};

// Date FUTURE : le flux de participation bloque un evenement passe.
const buildEvent = (overrides = {}) => ({
  capacity: 0,
  date: '2027-05-12T18:00:00.000Z',
  documentId: 'event-1',
  missings: [],
  participationRequests: [],
  participations: [],
  sessionStatus: 'closed', // « Prive » cote produit : l evenement d une equipe
  team: { documentId: 'team-1', name: 'Senior A', players: [{ documentId: ME }] },
  type: { name: 'Entrainement' },
  ...overrides,
});

const render = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<EventAnswerButtons {...props} />);
  });
  return tree;
};

const buttonTitles = (tree) => tree.root.findAllByType(Button).map((node) => node.props.title);
const tagTexts = (tree) => tree.root.findAllByType(Tag).map((node) => node.props.text);
const textContents = (tree) => tree.root.findAllByType(Text).map((node) => node.props.children);

beforeEach(() => {
  mockUserData.mockReturnValue(player);
});

describe('EventAnswerButtons — repondre present ou absent (caracterisation)', () => {
  it('evenement PRIVE sans reponse : deux boutons distincts, present et absent', () => {
    const tree = render({ event: buildEvent(), onDecline: jest.fn(), onParticipate: jest.fn() });

    expect(buttonTitles(tree)).toEqual([
      'eventList.actions.present',
      'eventList.actions.absent',
    ]);
  });

  it('les deux boutons appellent des handlers DIFFERENTS (present et absent)', () => {
    const onDecline = jest.fn();
    const onParticipate = jest.fn();
    const tree = render({ event: buildEvent(), onDecline, onParticipate });

    const [present, absent] = tree.root.findAllByType(Button);
    act(() => { present.props.onPress(); });
    act(() => { absent.props.onPress(); });

    expect(onParticipate).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('TROU fige — evenement PUBLIC : aucun bouton « absent », seulement « participer »', () => {
    // sessionStatus « open » = « Public » cote produit. Un joueur de l equipe
    // conviee n a alors AUCUN moyen de se declarer absent, ni sur la carte ni
    // sur le detail : la branche a deux boutons est reservee au prive.
    const tree = render({
      event: buildEvent({ sessionStatus: 'open' }),
      onDecline: jest.fn(),
      onJoin: jest.fn(),
      onParticipate: jest.fn(),
    });

    // Le libelle vient de resolveParticipationFlow (texte en dur, pas une cle).
    expect(buttonTitles(tree)).toEqual(['Participer']);
  });
});

describe('EventAnswerButtons — changer d avis (caracterisation)', () => {
  it('TROU fige — depuis la CARTE (sans onDeleteParticipation) : aucun retour en arriere', () => {
    // EventCardNew ne passe jamais `onDeleteParticipation`. Une fois la reponse
    // donnee, la carte n affiche qu une etiquette : il FAUT ouvrir le detail.
    const tree = render({ event: buildEvent({ missings: [{ documentId: ME }] }) });

    expect(tagTexts(tree)).toEqual(['eventList.info.alreadyMissing']);
    expect(buttonTitles(tree)).toEqual([]);
  });

  it('depuis le DETAIL (avec onDeleteParticipation) : un retour en arriere apparait', () => {
    const tree = render({
      event: buildEvent({ missings: [{ documentId: ME }] }),
      onDeleteParticipation: jest.fn(),
    });

    expect(tagTexts(tree)).toEqual(['eventList.info.alreadyMissing']);
    expect(buttonTitles(tree)).toEqual(['eventDetails.actions.editResponse']);
  });

  it('deja present : etiquette « je participe » + annulation de la participation', () => {
    const tree = render({
      event: buildEvent({ participations: [{ documentId: ME }] }),
      onDeleteParticipation: jest.fn(),
    });

    expect(tagTexts(tree)).toEqual(['eventList.info.alreadyJoined']);
    // AA01 (2026-08-20) — « Je serai absent·e » s ajoute ici. Le sujet de ce
    // temoin est l ETIQUETTE (ligne au-dessus) ; la liste des boutons decrit
    // l etat, et cet etat a change volontairement : un membre deja present
    // pouvait seulement ANNULER sa reponse, donc se declarer absent lui
    // demandait DEUX gestes et effacait sa reponse entre les deux.
    // Verrouille par `EventAnswerButtonsBasculeAA01.test.js`.
    expect(buttonTitles(tree)).toEqual([
      'eventDetails.actions.cancelResponse',
      'eventList.actions.absent',
    ]);
  });
});

describe('EventAnswerButtons — validation manuelle (caracterisation)', () => {
  it('demande en attente : le joueur voit « demande en attente », pas « je participe »', () => {
    const tree = render({
      event: buildEvent(),
      hasPendingRequest: true,
      onDeleteParticipation: jest.fn(),
    });

    expect(tagTexts(tree)).toEqual(['eventList.info.pendingRequest']);
    // AA01 — meme raison qu au temoin precedent : un membre dont la demande est
    // en attente peut desormais se declarer absent en un geste.
    expect(buttonTitles(tree)).toEqual([
      'eventDetails.actions.cancelResponse',
      'eventList.actions.absent',
    ]);
  });

  it('demande REFUSEE : le joueur VOIT le refus, et il voit le MOTIF', () => {
    // Un refus met la demande en `declined` : ni acceptee, ni en attente, ni
    // absente. Le composant retombait donc sur la branche « pas encore repondu »
    // et reproposait de repondre sans dire que le staff avait refuse — le joueur
    // redemandait, le staff refusait, en boucle.
    const tree = render({
      event: buildEvent({ participationRequests: [declinedRequest] }),
      hasAcceptedRequest: false,
      hasPendingRequest: false,
      onDecline: jest.fn(),
      onParticipate: jest.fn(),
    });

    expect(tagTexts(tree)).toEqual(['eventList.info.declinedRequest']);
    expect(textContents(tree)).toContain('Effectif complet pour ce match.');
  });

  it('demande refusee SANS motif : le refus se voit quand meme', () => {
    const tree = render({
      event: buildEvent({
        participationRequests: [{ ...declinedRequest, reason: null }],
      }),
      onDecline: jest.fn(),
      onParticipate: jest.fn(),
    });

    expect(tagTexts(tree)).toEqual(['eventList.info.declinedRequest']);
  });

  it('TEMOIN POSITIF — refuse, le joueur n est pas coince : il peut encore repondre', () => {
    // Sans ce temoin, un ecran qui n afficherait PLUS RIEN passerait pour corrige.
    const onDecline = jest.fn();
    const onParticipate = jest.fn();
    const tree = render({
      event: buildEvent({ participationRequests: [declinedRequest] }),
      onDecline,
      onParticipate,
    });

    expect(buttonTitles(tree)).toEqual([
      'eventList.actions.present',
      'eventList.actions.absent',
    ]);

    const [present, absent] = tree.root.findAllByType(Button);
    act(() => { present.props.onPress(); });
    act(() => { absent.props.onPress(); });

    expect(onParticipate).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('ACQUIS protege — sans demande refusee, aucune etiquette de refus', () => {
    const tree = render({
      event: buildEvent(),
      onDecline: jest.fn(),
      onParticipate: jest.fn(),
    });

    expect(tagTexts(tree)).toEqual([]);
  });
});

describe('EventAnswerButtons — qui a le droit de repondre (caracterisation)', () => {
  it('un entraineur ne voit pas les boutons de reponse mais les commandes d organisateur', () => {
    mockUserData.mockReturnValue({ documentId: 'user-coach', role: { name: USER_ROLES.coach } });

    const tree = render({ event: buildEvent(), onCancel: jest.fn(), onEdit: jest.fn() });

    expect(buttonTitles(tree)).toEqual([
      'eventDetails.actions.edit',
      'eventDetails.actions.cancelEvent',
    ]);
  });

  // Y07 (GO Adel du 2026-08-20) — CES DEUX TEMOINS ONT CHANGE DE CAMP.
  //
  // Ils portaient la regle du lot W01 : « l encadrant MEMBRE repond comme un
  // joueur ». Adel a tranche l inverse — repondre Present / Absent est le geste
  // du JOUEUR. Le serveur applique la meme regle a la source
  // (`event-audience.ts:819 resolveResponderDecision`, refus
  // `EVENT_STAFF_DOES_NOT_RSVP`).
  //
  // ⛔ CE QU ON VERIFIE ICI N EST PAS « il n y a plus de boutons » : c est
  // qu il y a une PHRASE a la place. Un bouton eteint et muet etait le constat
  // d origine d Adel ; le retrait sans phrase le reproduirait a l identique.
  it('Y07 · temoin 1 — un entraineur MEMBRE lit une phrase au lieu des boutons', () => {
    mockUserData.mockReturnValue({ documentId: 'user-coach', role: { name: USER_ROLES.coach } });

    const tree = render({
      event: buildEvent({
        team: {
          documentId: 'team-1',
          name: 'Senior A',
          players: [{ documentId: ME }],
          trainers: [{ documentId: 'user-coach' }],
        },
      }),
      onDecline: jest.fn(),
      onParticipate: jest.fn(),
    });

    expect(buttonTitles(tree)).not.toContain('eventList.actions.present');
    expect(buttonTitles(tree)).not.toContain('eventList.actions.absent');
    expect(textContents(tree)).toContain('eventList.info.staffDoesNotRsvp');
  });

  it('Y07 · temoin 2 — un dirigeant MEMBRE lit la meme phrase', () => {
    mockUserData.mockReturnValue({ documentId: 'user-boss', role: { name: USER_ROLES.president } });

    const tree = render({
      event: buildEvent({
        team: {
          documentId: 'team-1',
          name: 'Senior A',
          players: [{ documentId: ME }],
          trainers: [{ documentId: 'user-boss' }],
        },
      }),
      onDecline: jest.fn(),
      onParticipate: jest.fn(),
    });

    expect(buttonTitles(tree)).not.toContain('eventList.actions.present');
    expect(buttonTitles(tree)).not.toContain('eventList.actions.absent');
    expect(textContents(tree)).toContain('eventList.info.staffDoesNotRsvp');
  });

  it('W01 · temoin 3 🔒 — un encadrant NON membre n a AUCUN bouton de reponse', () => {
    mockUserData.mockReturnValue({
      documentId: 'coach-etranger', role: { name: USER_ROLES.coach },
    });

    const tree = render({
      event: buildEvent(),
      onAbout: jest.fn(),
      onDecline: jest.fn(),
      onParticipate: jest.fn(),
    });

    expect(buttonTitles(tree)).not.toContain('eventList.actions.present');
    expect(buttonTitles(tree)).not.toContain('eventList.actions.absent');
  });

  it('un visiteur non connecte voit uniquement l invitation a se connecter', () => {
    mockUserData.mockReturnValue(null);

    const tree = render({ event: buildEvent(), onLogin: jest.fn() });

    expect(buttonTitles(tree)).toEqual(['eventList.actions.join']);
  });
});
