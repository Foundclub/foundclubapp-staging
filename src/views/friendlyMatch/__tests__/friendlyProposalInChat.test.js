import renderer, { act } from 'react-test-renderer';

// eslint-disable-next-line max-len
import ProposalMessageBubble from '@/components/molecules/proposalMessageBubble/ProposalMessageBubble';

import FriendlyMatchApplicationCard from '../components/FriendlyMatchApplicationCard';
import {
  buildFriendlyProposalConfirmation,
  canAcceptFriendlyProposal,
  isFriendlyProposal,
  respondToFriendlyProposal,
} from '../friendlyProposalInChat';

// Filet S03 — constat d'Adel (16/08) : « il doit y avoir, pour l'entraîneur qui
// reçoit la proposition, un BOUTON POUR ACCEPTER ».
//
// Les trois choses que ce fichier verrouille, et pourquoi elles sont ici :
//   T2. l'entraîneur qui REÇOIT voit le bouton ;
//   T3. celui qui a ENVOYÉ ne le voit PAS — accepter sa propre proposition n'a
//       aucun sens, et le serveur le refuserait de toute façon : un bouton qui
//       répond « Accès refusé » est pire que pas de bouton ;
//   T4. accepter DEPUIS LE FIL emprunte le MÊME chemin qu'accepter depuis
//       l'écran de l'annonce. Deux règles d'acceptation qui divergent sont le
//       défaut le plus cher à retrouver — on le prouve en comparant les deux
//       appels côte à côte, pas en le supposant.

const mockRespond = jest.fn();
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  respondToFriendlyMatchApplication: (/** @type {any} */ a, /** @type {any} */ b) => (
    mockRespond(a, b)
  ),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

const mockAlert = jest.fn();
jest.mock('react-native/Libraries/Alert/Alert', () => ({ alert: (...args) => mockAlert(...args) }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

// Le VRAI thème, monté sans son fournisseur — pas un faux, et surtout pas un
// Proxy : un thème simulé rend les échecs illisibles (mémoire du lot L10-B).
// Les composants lisent donc les mêmes couleurs, polices et espaces qu'à
// l'écran, et `verify:theme-contract` n'a rien de nouveau à reprocher.
jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Spaces,
    }),
  };
});

/** La charge exacte que le serveur pose dans le fil (friendly-match-workflow). */
const PROPOSITION = {
  adId: 'ad-1',
  applicationId: 'app-1',
  canAcceptUserIds: ['user-auteur', 'user-coach-a2'],
  categoryLabel: 'U15',
  clubName: 'AS Candidats',
  dateLabel: 'jeudi 12 novembre',
  hostTeamName: 'FC Annonceurs U15',
  kind: 'friendly_match',
  levelLabel: 'Departemental',
  sectionLabel: 'Football',
  status: 'pending',
  teamName: 'AS Candidats U15',
  timeLabel: 'de 14:00 à 16:00',
  type: 'proposal',
  venue: 'Stade Vallier, 13004 Marseille',
};

const textesDe = (arbre) => {
  const trouves = [];
  const descendre = (noeud) => {
    if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      trouves.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(descendre);
      return;
    }
    descendre(noeud.children);
  };
  descendre(arbre);
  return trouves.join(' | ');
};

const rendre = ({ isMe, proposal }) => {
  let rendu;
  act(() => {
    rendu = renderer.create(
      <ProposalMessageBubble allowResponseActions isMe={isMe} proposal={proposal} />,
    );
  });
  return rendu;
};

beforeEach(() => {
  mockRespond.mockReset();
  mockRespond.mockResolvedValue({});
  mockAlert.mockReset();
});

test('S03 — la bulle du fil montre les 7 informations, sans en inventer aucune', () => {
  const rendu = rendre({ isMe: false, proposal: PROPOSITION });
  const texte = textesDe(rendu.toJSON());

  // Les 7 d'Adel, une par une.
  expect(texte).toContain('jeudi 12 novembre');
  expect(texte).toContain('de 14:00 à 16:00');
  expect(texte).toContain('Stade Vallier, 13004 Marseille');
  // Qui reçoit : nommé par son ÉQUIPE, jamais par « vous » — les deux camps
  // lisent la même bulle, et « chez vous » désignerait quelqu'un d'autre selon
  // qui regarde.
  expect(texte).toContain('Qui reçoit');
  expect(texte).toContain('FC Annonceurs U15');
  expect(texte).not.toContain('chez vous');
  expect(texte).toContain('Departemental');
  expect(texte).toContain('U15');
  expect(texte).toContain('Football');
  // Et jamais l'heure fantôme de la bulle LEAGUE quand le serveur en donne une.
  expect(texte).not.toContain('--:--');
});

test('S03 — une information que le serveur ne connaît pas est DITE, pas inventée', () => {
  const rendu = rendre({
    isMe: false,
    proposal: {
      ...PROPOSITION,
      levelLabel: 'Niveau non précisé',
      timeLabel: 'horaire à convenir',
      venue: 'Lieu à convenir',
    },
  });
  const texte = textesDe(rendu.toJSON());

  expect(texte).toContain('horaire à convenir');
  expect(texte).toContain('Lieu à convenir');
  expect(texte).toContain('Niveau non précisé');
  expect(texte).not.toContain('00:00');
});

test('S03 témoin 2 — l entraîneur qui REÇOIT la proposition voit le bouton Accepter', () => {
  expect(isFriendlyProposal(PROPOSITION)).toBe(true);
  // C'est le SERVEUR qui décide, via la liste qu'il a posée dans la bulle.
  expect(canAcceptFriendlyProposal(PROPOSITION, 'user-auteur')).toBe(true);

  const rendu = rendre({ isMe: false, proposal: PROPOSITION });
  expect(textesDe(rendu.toJSON())).toContain('Accepter');
});

test('S03 témoin 3 — celui qui a ENVOYÉ la proposition ne peut pas l accepter', () => {
  // Le candidat n'est pas dans la liste du serveur...
  expect(canAcceptFriendlyProposal(PROPOSITION, 'user-candidat')).toBe(false);
  // ...ni un tiers inconnu, ni personne quand la liste manque.
  expect(canAcceptFriendlyProposal(PROPOSITION, '')).toBe(false);
  expect(canAcceptFriendlyProposal({ ...PROPOSITION, canAcceptUserIds: undefined }, 'user-auteur'))
    .toBe(false);

  // ...et l'écran ne lui montre aucun bouton d'acceptation.
  const rendu = rendre({ isMe: true, proposal: PROPOSITION });
  const texte = textesDe(rendu.toJSON());
  expect(texte).not.toContain('Accepter');
  expect(texte).toContain('En attente');
});

test('S03 — une proposition déjà traitée ne montre plus aucun bouton', () => {
  ['accepted', 'declined', 'withdrawn'].forEach((status) => {
    const texte = textesDe(rendre({ isMe: false, proposal: { ...PROPOSITION, status } }).toJSON());
    expect(texte).not.toContain('Accepter');
    expect(texte).not.toContain('Refuser');
  });
  // Et il reste lisible : le fil garde la mémoire de ce qui a été décidé.
  const acceptee = rendre({ isMe: false, proposal: { ...PROPOSITION, status: 'accepted' } });
  expect(textesDe(acceptee.toJSON())).toContain('Accept');
});

test('S03 témoin 4 — accepter depuis le FIL prend le MÊME chemin que l annonce', async () => {
  // 1. Depuis le fil.
  await respondToFriendlyProposal(PROPOSITION, 'accept');
  const depuisLeFil = mockRespond.mock.calls[0];

  mockRespond.mockClear();

  // 2. Depuis l'écran de l'annonce — le bouton « Accepter ce match » existant.
  let carte;
  act(() => {
    carte = renderer.create(
      <FriendlyMatchApplicationCard
        ad={{ applicationsCount: 1 }}
        application={{ documentId: 'app-1', status: 'pending', team: { name: 'AS Candidats U15' } }}
        onOpenConversation={() => {}}
        onResponded={() => {}}
      />,
    );
  });
  const boutonAccepter = carte.root.findAll(
    (noeud) => noeud.props?.title === 'Accepter ce match',
  )[0];
  act(() => { boutonAccepter.props.onPress(); });
  // La carte confirme d'abord (geste lourd) : on prend le « Accepter » du dialogue.
  const confirmation = mockAlert.mock.calls[0][2].find((choix) => choix.text === 'Accepter');
  await act(async () => { await confirmation.onPress(); });
  const depuisLAnnonce = mockRespond.mock.calls[0];

  // Le même identifiant, la même action, la même fonction de service.
  expect(depuisLeFil).toEqual(depuisLAnnonce);
  expect(depuisLeFil).toEqual(['app-1', { action: 'accept' }]);
});

test('S03 — accepter depuis le fil dit d abord ce que ça va produire', () => {
  const confirmation = buildFriendlyProposalConfirmation();
  expect(confirmation.title).toMatch(/Accepter/);
  expect(confirmation.body).toMatch(/planning/);
});

test('S03 — refuser depuis le fil passe par le même chemin, avec l action decline', async () => {
  await respondToFriendlyProposal(PROPOSITION, 'decline');
  expect(mockRespond).toHaveBeenCalledWith('app-1', { action: 'decline' });
});

test('S03 — sans identifiant de candidature, rien ne part sur le réseau', async () => {
  await expect(respondToFriendlyProposal({ ...PROPOSITION, applicationId: '' }, 'accept'))
    .rejects.toThrow();
  expect(mockRespond).not.toHaveBeenCalled();
});

test('S03 — une bulle LEAGUE n est pas prise pour une proposition d amical', () => {
  const bulleLeague = { matchId: 'match-1', status: 'pending', type: 'proposal' };
  expect(isFriendlyProposal(bulleLeague)).toBe(false);
  expect(isFriendlyProposal(null)).toBe(false);
});
