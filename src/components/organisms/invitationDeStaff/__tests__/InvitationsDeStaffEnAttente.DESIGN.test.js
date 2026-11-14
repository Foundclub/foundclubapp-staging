import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { withAlpha } from '@/theme/colors';

import InvitationsDeStaffEnAttente from '../InvitationsDeStaffEnAttente';

// INVITE-STAFF-DESIGN (11/11/2026, maquette C validée le 10/11) — la rubrique « Invitations en
// attente » n'avait aucun témoin (E6). Ce fichier fige d'abord ce qu'elle montre (prénom ·
// 2 chiffres, rôle · équipe · date, En attente, Annuler, Relancer, note), puis demande le dessin
// de la maquette : pastille orange « En attente », bord pointillé.

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
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const mockInviteTrainer = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ inviteTrainer: mockInviteTrainer }),
}));

const mockAnnuler = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: mockAnnuler, variables: undefined }),
  useQuery: () => ({
    data: {
      invitations: [{
        createdAt: '2026-11-10T10:00:00.000Z',
        documentId: 'inv-1',
        firstname: 'Karim',
        phoneHint: '78',
        role: 'coach',
        team: { documentId: 't-1', name: 'U13 A' },
      }],
      recentlyAccepted: [],
    },
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/staffInvitation/staffInvitationService', () => ({
  cancelStaffInvitation: jest.fn(),
  getSentStaffInvitations: jest.fn(),
}));

// INVITE-RENVOI (13/11) : la rubrique monte la feuille « Invitation envoyée » ; doublure, comme
// les témoins d'AddCoach (la vraie tire react-native-gesture-handler).
jest.mock('@/components/organisms/trainerInvitedModal/TrainerInvitedModal', () => () => null);

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonDoublure(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const couleurs = jest.requireActual('@/theme/colors').default();

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<InvitationsDeStaffEnAttente clubId="club-1" clubName="FC Lyon Est" />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));

describe('INVITE-STAFF-DESIGN — C les invitations en attente', () => {
  it('ce que la rubrique montre déjà (caractérisation)', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Invitations en attente · 1',
      'Karim · •• 78',
      'Coach · U13 A · envoyée le 10/11',
      'En attente',
      'Annuler',
      'Relancer par SMS',
    ]));
  });

  it('« En attente » est une pastille orange', async () => {
    const arbre = await monter();
    const etat = arbre.root.findAllByType(Text)
      .find((/** @type {any} */ n) => n.props.children === 'En attente');
    const style = StyleSheet.flatten(etat.props.style);
    expect(style.color).toBe(couleurs.warning400);
    expect(style.backgroundColor).toBe(withAlpha(couleurs.warning500, 0.16));
    expect(style.borderRadius).toBeGreaterThanOrEqual(999);
  });

  it('la carte d une invitation a un bord pointillé', async () => {
    const arbre = await monter();
    const carte = arbre.root.findByProps({ testID: 'staff-invite-pending-inv-1' });
    const style = StyleSheet.flatten(carte.props.style);
    expect(style.borderStyle).toBe('dashed');
    expect(style.borderWidth).toBe(1);
  });
});
