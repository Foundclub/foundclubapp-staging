import renderer, { act } from 'react-test-renderer';

import InvitationsDeStaffEnAttente from '../InvitationsDeStaffEnAttente';

// INVITE-REFUS (12/11/2026, décision d'Adel « 274 B ») — la rubrique « Invitations en attente »
// du Staff, côté dirigeant.
//   1. caractérisation (E6, le fichier n'avait aucun témoin) : une invitation sans réponse montre
//      prénom · 2 chiffres, « En attente », « Annuler » et « Relancer par SMS » ;
//   2. 274 B : une invitation refusée (serveur : `state: 'refused'`) reste visible, avec l'état
//      « Refusée » et un bouton « Inviter à nouveau », qui ouvre le formulaire d'invitation
//      (le numéro n'est jamais renvoyé : la personne le retape) ; elle ne compte plus dans
//      « Invitations en attente · N » ; ni « Annuler » ni « Relancer par SMS » sur elle.

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ valeurs) => {
        const valeur = String(cle).split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ part) => (
            noeud == null ? undefined : noeud[part]
          ),
          traductions,
        );
        if (typeof valeur !== 'string') return typeof valeurs === 'string' ? valeurs : cle;
        return valeur.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
      },
    }),
  };
});

jest.mock('@/theme/themeContext', () => {
  const vide = new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({
      Alignments: vide, ApplicationStyle: vide, Colors: vide, Fonts: vide, Spaces: vide,
    }),
  };
});

const mockInviteTrainer = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ inviteTrainer: mockInviteTrainer }),
}));

const mockNavigate = jest.fn();

/** @type {any[]} */
let mockInvitations = [];
const mockAnnuler = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: mockAnnuler, variables: undefined }),
  // Récolte T10 : la lecture rend { invitations, recentlyAccepted } (INVITE-STAFF-DESIGN).
  useQuery: () => ({
    data: { invitations: mockInvitations, recentlyAccepted: [] },
    refetch: jest.fn(),
  }),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonDoublure(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress, testID: props.testID },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const EN_ATTENTE = {
  createdAt: '2026-11-12T09:44:00.000Z',
  documentId: 'inv-ouverte',
  firstname: 'Karim',
  phoneHint: '78',
  role: 'coach',
  state: 'pending',
  team: { documentId: 't-u13', name: 'U13 A' },
};
const REFUSEE = {
  createdAt: '2026-11-12T09:40:00.000Z',
  documentId: 'inv-refusee',
  firstname: 'Titouan',
  phoneHint: '33',
  role: 'coach',
  state: 'refused',
  team: null,
};

const monter = async (/** @type {any[]} */ invitations) => {
  mockInvitations = invitations;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <InvitationsDeStaffEnAttente
        clubId="club-crt5"
        clubName="CR-T5 Club Offres"
        navigation={{ navigate: mockNavigate }}
      />,
    );
  });
  return arbre;
};

const estTexte = (/** @type {any} */ n) => n.type === 'Text'
  && typeof n.props?.children === 'string';
const textesDe = (/** @type {any} */ noeud) => noeud
  .findAll(estTexte)
  .map((/** @type {any} */ n) => n.props.children);
const textes = (/** @type {any} */ arbre) => textesDe(arbre.root);
const carte = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .find((/** @type {any} */ n) => n.type === 'View'
    && n.props?.testID === `staff-invite-pending-${id}`);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('INVITE-REFUS — caractérisation : une invitation sans réponse', () => {
  it('prénom · 2 chiffres, En attente, Annuler, Relancer par SMS ; compte 1', async () => {
    const arbre = await monter([EN_ATTENTE]);
    expect(textes(arbre)).toContain('Invitations en attente · 1');
    const ici = textesDe(carte(arbre, 'inv-ouverte'));
    expect(ici).toEqual(expect.arrayContaining([
      'Karim · •• 78', 'En attente', 'Annuler', 'Relancer par SMS',
    ]));
  });

  it('rien à montrer : la rubrique disparaît', async () => {
    const arbre = await monter([]);
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('INVITE-REFUS — 274 B : la refusée reste, « Refusée », avec « Inviter à nouveau »', () => {
  it('« Refusée » et « Inviter à nouveau », sans Annuler ni Relancer par SMS', async () => {
    const arbre = await monter([EN_ATTENTE, REFUSEE]);
    const ici = textesDe(carte(arbre, 'inv-refusee'));
    expect(ici).toEqual(expect.arrayContaining([
      'Titouan · •• 33', 'Refusée', 'Inviter à nouveau',
    ]));
    expect(ici).not.toContain('En attente');
    expect(ici).not.toContain('Annuler');
    expect(ici).not.toContain('Relancer par SMS');
  });

  it('elle ne compte plus dans « Invitations en attente · N »', async () => {
    const arbre = await monter([EN_ATTENTE, REFUSEE]);
    expect(textes(arbre)).toContain('Invitations en attente · 1');
    const seule = await monter([REFUSEE]);
    expect(textes(seule).some((texte) => texte.startsWith('Invitations en attente'))).toBe(false);
    expect(textesDe(carte(seule, 'inv-refusee'))).toContain('Refusée');
  });

  it('« Inviter à nouveau » ouvre le formulaire du bon rôle (coach, puis dirigeant)', async () => {
    const arbre = await monter([REFUSEE, { ...REFUSEE, documentId: 'inv-dir', role: 'dirigeant' }]);
    await act(async () => {
      carte(arbre, 'inv-refusee').findByProps({ title: 'Inviter à nouveau' }).props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(
      'AddCoach',
      { clubId: 'club-crt5', clubName: 'CR-T5 Club Offres' },
    );
    await act(async () => {
      carte(arbre, 'inv-dir').findByProps({ title: 'Inviter à nouveau' }).props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(
      'AddClubManager',
      { clubId: 'club-crt5', clubName: 'CR-T5 Club Offres', staffType: 'manager' },
    );
    expect(mockAnnuler).not.toHaveBeenCalled();
    expect(mockInviteTrainer).not.toHaveBeenCalled();
  });

  it('« Inviter à nouveau » d un coach d équipe garde l équipe', async () => {
    const arbre = await monter([{ ...REFUSEE, team: { documentId: 't-u13', name: 'U13 A' } }]);
    await act(async () => {
      carte(arbre, 'inv-refusee').findByProps({ title: 'Inviter à nouveau' }).props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(
      'AddCoach',
      { clubId: 'club-crt5', clubName: 'CR-T5 Club Offres', teamId: 't-u13' },
    );
  });
});
