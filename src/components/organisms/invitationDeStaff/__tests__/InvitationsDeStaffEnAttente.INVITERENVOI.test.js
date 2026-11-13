import renderer, { act } from 'react-test-renderer';

import InvitationsDeStaffEnAttente from '../InvitationsDeStaffEnAttente';

// INVITE-RENVOI (D117, 13/11/2026) — le testeur, M1190 validée : « Inviter à nouveau » oblige à
// retaper le numéro et le prénom. Attendu : l'invitation repart en un geste, avec la mémoire de
// l'ancienne (même numéro, prénom, rôle, équipe) : l'app envoie `fromInvitationId` sur la route
// d'envoi existante, SANS numéro (elle ne l'a jamais) ; le serveur le relit. Puis la même feuille
// « Invitation envoyée » qu'aujourd'hui, et la liste est relue (la carte repasse « En attente »).
// Un serveur d'avant le train 11 répond STAFF_INVITE_PHONE_INVALID : on retombe sur le formulaire.

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
  default: () => ({
    invitationDuStaff: () => ({ message: 'sms' }),
    inviteTrainer: mockInviteTrainer,
  }),
}));

/** @type {any[]} */
let mockInvitations = [];
const mockRefetch = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn(), variables: undefined }),
  useQuery: () => ({
    data: { invitations: mockInvitations, recentlyAccepted: [] },
    refetch: mockRefetch,
  }),
}));

const mockSend = jest.fn();
jest.mock('@/services/staffInvitation/staffInvitationService', () => ({
  cancelStaffInvitation: jest.fn(),
  getSentStaffInvitations: jest.fn(),
  sendStaffInvitation: (/** @type {any} */ params) => mockSend(params),
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

/** @type {any} */
let mockFeuille = null;
jest.mock('@/components/organisms/trainerInvitedModal/TrainerInvitedModal', () => (
  function FeuilleDoublure(/** @type {any} */ props) {
    mockFeuille = props;
    return null;
  }
));

const REFUSEE = {
  createdAt: '2026-11-12T09:40:00.000Z',
  documentId: 'inv-refusee',
  firstname: 'Titouan',
  phoneHint: '33',
  role: 'coach',
  state: 'refused',
  team: { documentId: 't-u13', name: 'U13 A' },
};
const REPONSE = {
  invitation: {
    createdAt: '2026-11-13T21:00:00.000Z',
    documentId: 'inv-nouvelle',
    expiresAt: '2026-12-13T21:00:00.000Z',
    firstname: 'Titouan',
    phoneHint: '33',
    role: 'coach',
    state: 'pending',
    team: { documentId: 't-u13', name: 'U13 A' },
  },
  sent: true,
};

const mockNavigate = jest.fn();
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
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ id) => {
  await act(async () => {
    await arbre.root
      .find((/** @type {any} */ n) => n.type === 'View'
        && n.props?.testID === `staff-invite-pending-${id}`)
      .findByProps({ title: 'Inviter à nouveau' })
      .props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFeuille = null;
});

describe('INVITE-RENVOI — « Inviter à nouveau » renvoie sans rien retaper', () => {
  it('coach d équipe : même prénom, rôle, équipe ; aucun numéro ; pas de formulaire', async () => {
    mockSend.mockResolvedValue(REPONSE);
    const arbre = await monter([REFUSEE]);
    await appuyer(arbre, 'inv-refusee');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const envoi = mockSend.mock.calls[0][0];
    expect(envoi).toEqual({
      clubId: 'club-crt5',
      firstname: 'Titouan',
      fromInvitationId: 'inv-refusee',
      role: 'coach',
      teamId: 't-u13',
    });
    expect(envoi.phoneNumber).toBeUndefined();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('puis la même feuille « Invitation envoyée » : prénom, •• 33, rôle et équipe', async () => {
    mockSend.mockResolvedValue(REPONSE);
    const arbre = await monter([REFUSEE]);
    await appuyer(arbre, 'inv-refusee');

    expect(mockFeuille?.isVisible).toBe(true);
    expect(mockFeuille.titre).toContain('Titouan');
    expect(mockFeuille.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: '•• 33' }),
      expect.objectContaining({ value: 'Coach · U13 A' }),
    ]));
    // « Envoyer par SMS » : le numéro reste inconnu de l'app, la personne choisit le destinataire.
    await act(async () => { mockFeuille.onInvite(); });
    expect(mockInviteTrainer).toHaveBeenCalledWith(expect.objectContaining({
      firstname: 'Titouan', isManager: false, phoneNumber: undefined,
    }));
  });

  it('dirigeant : le rôle suit, sans équipe', async () => {
    mockSend.mockResolvedValue({
      ...REPONSE,
      invitation: { ...REPONSE.invitation, role: 'dirigeant', team: null },
    });
    const arbre = await monter([{
      ...REFUSEE, documentId: 'inv-dir', role: 'dirigeant', team: null,
    }]);
    await appuyer(arbre, 'inv-dir');

    expect(mockSend.mock.calls[0][0]).toEqual({
      clubId: 'club-crt5',
      firstname: 'Titouan',
      fromInvitationId: 'inv-dir',
      role: 'dirigeant',
      teamId: undefined,
    });
    expect(mockFeuille?.isManager).toBe(true);
  });

  it('serveur d avant le train 11 (numéro exigé) : on retombe sur le formulaire', async () => {
    mockSend.mockRejectedValue(
      Object.assign(new Error('x'), { code: 'STAFF_INVITE_PHONE_INVALID', status: 400 }),
    );
    const arbre = await monter([REFUSEE]);
    await appuyer(arbre, 'inv-refusee');

    expect(mockNavigate).toHaveBeenLastCalledWith(
      'AddCoach',
      { clubId: 'club-crt5', clubName: 'CR-T5 Club Offres', teamId: 't-u13' },
    );
    expect(mockFeuille).toBeNull();
  });
});
