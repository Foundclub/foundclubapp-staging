import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// S10-C / D5 — LA SECTION « ACCEPTER / REFUSER » EST L UNIQUE ENDROIT D ACTION,
// ET ELLE NE MONTRE UN BOUTON QU A QUI LE SERVEUR LAISSERA PASSER.
//
// 🎯 CE QUI EST MESURE, ET POURQUOI :
//   · S10-A (D2) ferme l auto-acceptation : `accept` et `refuse` deviennent
//     reserves a un responsable de l EQUIPE INVITEE. Les boutons que ce
//     composant montrait a l organisateur rendraient donc 403 — un bouton qui
//     promet une action que le serveur refuse est pire que pas de bouton.
//   · L organisateur, lui, garde `cancel` (S10-A D2). Sans bouton, cette route
//     ne serait atteinte par RIEN dans l app.
//   · Un DIRIGEANT du club de l equipe invitee peut repondre : le serveur
//     interroge `canManageTeam`, pas la seule liste des entraineurs
//     (admin/event-team-audience.ts:135-144). L app doit lire la meme regle.
//
// ⚠️ CE QUI NE DOIT PAS BOUGER (caracterisation, E6 — ce fichier n avait aucun
// temoin avant ce lot) : la section disparait sans audience, elle nomme
// l equipe, son club, son genre et son statut.
// ==========================================================================

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => options.mutationFn(variables),
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

const mockRespondEventTeamAudience = jest.fn(() => Promise.resolve({}));

jest.mock('@/services/event/eventService', () => ({
  respondEventTeamAudience: (/** @type {any} */ audienceId, /** @type {any} */ action) => (
    mockRespondEventTeamAudience(audienceId, action)
  ),
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

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');

  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled),
        onPress: props.onPress,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// eslint-disable-next-line import/first
import EventTeamAudiencesSection from '../EventTeamAudiencesSection';

const textOf = (/** @type {any} */ children) => (
  Array.isArray(children) ? children.map(textOf).join('') : String(children ?? '')
);

const EQUIPE_INVITEE = {
  club: { documentId: 'club-visiteur', name: 'FC Visiteur' },
  documentId: 'team-invitee',
  name: 'U15 Visiteur',
  trainers: [{ documentId: 'coach-invite' }],
};

const AUDIENCE_PENDING = {
  audienceKind: 'external_invited',
  documentId: 'audience-1',
  selectionMode: 'ALL_MEMBERS',
  status: 'PENDING',
  team: EQUIPE_INVITEE,
};

const ANNULER = "Annuler l'invitation";

const monter = (/** @type {any} */ props = {}) => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      <EventTeamAudiencesSection
        canManageEvent={props.canManageEvent ?? false}
        event={props.event ?? { documentId: 'event-1', teamAudiences: [AUDIENCE_PENDING] }}
        userData={props.userData ?? null}
      />,
    );
  });

  return arbre;
};

const textesVisibles = (/** @type {any} */ root) => root.root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node.props.children).trim())
  .filter(Boolean);

const titreBouton = (/** @type {any} */ node) => (
  textOf(node.props.children?.props?.children).trim()
);

const boutons = (/** @type {any} */ root) => root.root
  .findAllByType(TouchableOpacity)
  .map(titreBouton)
  .filter(Boolean);

describe('S10-C / D5 — la section des invitations d equipe', () => {
  beforeEach(() => {
    mockRespondEventTeamAudience.mockClear();
  });

  test('sans audience, la section ne se rend pas du tout', () => {
    const root = monter({ event: { documentId: 'event-1', teamAudiences: [] } });
    expect(root.toJSON()).toBeNull();
  });

  test('elle nomme l equipe, son club, son genre et son statut', () => {
    const root = monter({ userData: { documentId: 'quelqu-un' } });
    const textes = textesVisibles(root);

    expect(textes).toContain('U15 Visiteur');
    expect(textes).toContain('FC Visiteur');
    expect(textes).toContain('En attente');
    expect(textes.some((/** @type {string} */ t) => t.includes('Équipe externe'))).toBe(true);
  });

  test('l ORGANISATEUR ne voit plus Accepter/Refuser — le serveur les lui refuse', () => {
    const root = monter({
      canManageEvent: true,
      userData: { documentId: 'organisateur' },
    });

    expect(boutons(root)).not.toContain('Accepter');
    expect(boutons(root)).not.toContain('Refuser');
  });

  test('l ORGANISATEUR garde Annuler, et il appelle bien la route cancel', () => {
    const root = monter({
      canManageEvent: true,
      userData: { documentId: 'organisateur' },
    });

    expect(boutons(root)).toContain(ANNULER);

    const bouton = root.root
      .findAllByType(TouchableOpacity)
      .find((/** @type {any} */ node) => titreBouton(node) === ANNULER);
    act(() => { bouton.props.onPress(); });

    expect(mockRespondEventTeamAudience).toHaveBeenCalledWith('audience-1', 'cancel');
  });

  test('l ENTRAINEUR de l equipe invitee voit Accepter et Refuser, jamais Annuler', () => {
    const root = monter({ userData: { documentId: 'coach-invite' } });

    expect(boutons(root)).toContain('Accepter');
    expect(boutons(root)).toContain('Refuser');
    expect(boutons(root)).not.toContain(ANNULER);
  });

  test('le DIRIGEANT du club de l equipe invitee repond aussi (meme regle que le serveur)', () => {
    const root = monter({
      userData: {
        club: { documentId: 'club-visiteur' },
        documentId: 'dirigeant-visiteur',
        role: { name: 'president' },
      },
    });

    expect(boutons(root)).toContain('Accepter');
  });

  test('un joueur de passage ne voit aucun bouton', () => {
    const root = monter({ userData: { documentId: 'joueur-lambda' } });

    expect(boutons(root)).toEqual([]);
  });

  // 🪤 LE TROU MESURE AVANT CE LOT : `currentUserKey === getUserKey(respondedBy)`
  // comparait DEUX chaines vides quand ni le lecteur ni la reponse n avaient
  // d identite. Un visiteur sans profil charge voyait donc Accepter et Refuser.
  test('sans identite, personne ne voit de bouton', () => {
    const root = monter({ userData: null });

    expect(boutons(root)).toEqual([]);
  });

  test('une invitation deja acceptee ne propose plus rien', () => {
    const root = monter({
      canManageEvent: true,
      event: {
        documentId: 'event-1',
        teamAudiences: [{ ...AUDIENCE_PENDING, status: 'ACCEPTED' }],
      },
      userData: { documentId: 'coach-invite' },
    });

    expect(textesVisibles(root)).toContain('Acceptee');
    expect(boutons(root)).toEqual([]);
  });
});
