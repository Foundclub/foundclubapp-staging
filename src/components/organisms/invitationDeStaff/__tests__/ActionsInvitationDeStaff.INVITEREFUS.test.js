import renderer, { act } from 'react-test-renderer';

import {
  acceptStaffInvitation,
  getMyStaffInvitations,
  refuseStaffInvitation,
} from '@/services/staffInvitation/staffInvitationService';

import ActionsInvitationDeStaff from '../ActionsInvitationDeStaff';

// Même montage que ActionsInvitationDeStaff.INVITESTAFF.test.js (doublures, vraie fr.js).
jest.unmock('@/components/organisms/invitationDeStaff/ActionsInvitationDeStaff');
jest.mock('@/services/staffInvitation/staffInvitationService', () => ({
  acceptStaffInvitation: jest.fn(),
  getMyStaffInvitations: jest.fn(),
  refuseStaffInvitation: jest.fn(),
}));

// La vraie fr.js derrière `t` : le témoin lit les phrases qu'Adel verra.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ valeurs) => {
        const valeur = String(cle)
          .split('.')
          .reduce(
            (/** @type {any} */ noeud, /** @type {string} */ part) => (
              noeud == null ? undefined : noeud[part]
            ),
            traductions,
          );
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
      },
    }),
  };
});

jest.mock('@/theme/themeContext', () => {
  const vide = new Proxy({}, { get: () => ({}) });
  return { __esModule: true, default: () => ({ Alignments: vide, Spaces: vide }) };
});

/** @type {any[]} */
const mockFeuilles = [];
jest.mock(
  '@/components/organisms/feuilleDeSucces/FeuilleDeSucces',
  () => function FeuilleDoublure(/** @type {any} */ props) {
    mockFeuilles.push(props);
    return null;
  },
);

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

const DATA = {
  clubId: 'club-fle',
  clubName: 'FC Lyon Est',
  invitationId: 'inv-1',
  inviterName: 'Sofiane Benali',
  role: 'coach',
  teamName: 'U13 A',
};

/**
 * La feuille visible en dernier rendu.
 * @returns {any} ses props, ou null.
 */
const feuilleOuverte = () => {
  const dernierRendu = mockFeuilles.slice(-3);
  return dernierRendu.find((props) => props.isVisible) || null;
};

const monter = async (data = DATA) => {
  /** @type {any} */
  let arbre;
  const relire = jest.fn();
  await act(async () => {
    arbre = renderer.create(<ActionsInvitationDeStaff data={data} relire={relire} testID="n1" />);
  });
  return { arbre, relire };
};

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ title) => {
  await act(async () => {
    await arbre.root.findByProps({ title }).props.onPress();
  });
};

beforeEach(() => {
  mockFeuilles.length = 0;
  jest.clearAllMocks();
  /** @type {any} */ (getMyStaffInvitations).mockResolvedValue([
    { documentId: 'inv-1', expiresAt: '2026-12-10T12:00:00.000Z' },
  ]);
  /** @type {any} */ (acceptStaffInvitation).mockResolvedValue({ accepted: true });
  /** @type {any} */ (refuseStaffInvitation).mockResolvedValue({ refused: true });
});

// INVITE-REFUS (M1190, 12/11/2026) — après une réponse, la carte n'offre plus
// « Refuser » / « Voir et accepter », sans attendre la relecture de la cloche
// (le serveur pose `data.answered`, la relecture le confirme ensuite).
const boutons = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => ['Refuser', 'Voir et accepter'].includes(n.props?.title))
  .filter((/** @type {any} */ noeud) => typeof noeud.props.onPress === 'function');

describe('INVITE-REFUS — la carte s éteint après la réponse', () => {
  it('« Refuser » réussi : plus de boutons, la feuille « Invitation refusée » reste', async () => {
    const { arbre, relire } = await monter();
    expect(boutons(arbre).length).toBeGreaterThan(0);
    await appuyer(arbre, 'Refuser');
    expect(feuilleOuverte().titre).toBe('Invitation refusée');
    expect(boutons(arbre)).toHaveLength(0);
    expect(relire).toHaveBeenCalled();
  });

  it('« Refuser » sur une invitation close : la carte s éteint, la cloche se relit', async () => {
    /** @type {any} */ (refuseStaffInvitation).mockRejectedValue(
      Object.assign(new Error('x'), { code: 'STAFF_INVITE_NOT_FOUND' }),
    );
    const { arbre, relire } = await monter();
    await appuyer(arbre, 'Refuser');
    expect(feuilleOuverte().titre).toBe('Cette invitation n’est plus valable');
    expect(boutons(arbre)).toHaveLength(0);
    expect(relire).toHaveBeenCalled();
  });

  it('« Voir et accepter » sur une invitation close : la carte s éteint', async () => {
    /** @type {any} */ (getMyStaffInvitations).mockResolvedValue([]);
    const { arbre, relire } = await monter();
    await appuyer(arbre, 'Voir et accepter');
    expect(boutons(arbre)).toHaveLength(0);
    expect(relire).toHaveBeenCalled();
  });

  it('un refus serveur non définitif (club complet) : la carte garde ses boutons', async () => {
    /** @type {any} */ (acceptStaffInvitation).mockRejectedValue(
      Object.assign(new Error('x'), { code: 'STAFF_INVITE_CLUB_FULL' }),
    );
    const { arbre } = await monter();
    await appuyer(arbre, 'Voir et accepter');
    await act(async () => {
      await feuilleOuverte().actionPrincipale.onPress();
    });
    expect(boutons(arbre).length).toBeGreaterThan(0);
  });
});

describe('INVITE-REFUS — la cloche relue garde la feuille ouverte', () => {
  it('une carte déjà répondue (serveur : data.answered) n affiche rien', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<ActionsInvitationDeStaff data={DATA} repondue testID="n1" />);
    });
    expect(arbre.toJSON()).toBeNull();
  });

  it('la relecture arrive pendant « Invitation refusée » : la feuille reste', async () => {
    const { arbre } = await monter();
    await appuyer(arbre, 'Refuser');
    // La cloche relue rend la même ligne, désormais `answered`.
    await act(async () => {
      arbre.update(<ActionsInvitationDeStaff data={DATA} repondue testID="n1" />);
    });
    expect(feuilleOuverte().titre).toBe('Invitation refusée');
    expect(boutons(arbre)).toHaveLength(0);
    // Une fois la feuille fermée, la carte ne montre plus rien.
    await act(async () => {
      feuilleOuverte().actionPrincipale.onPress();
    });
    expect(arbre.toJSON()).toBeNull();
  });
});
