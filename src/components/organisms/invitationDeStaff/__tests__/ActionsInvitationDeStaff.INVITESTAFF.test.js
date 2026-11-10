import renderer, { act } from 'react-test-renderer';

import {
  acceptStaffInvitation,
  getMyStaffInvitations,
  refuseStaffInvitation,
} from '@/services/staffInvitation/staffInvitationService';

import ActionsInvitationDeStaff from '../ActionsInvitationDeStaff';

// INVITE-STAFF (10/11/2026, maquette validée, écrans E à H) — sous la notification
// `staffInvitation` de la cloche : « Refuser » et « Voir et accepter ».
//   · accepter -> l'appel part, la bienvenue s'affiche ;
//   · refuser  -> rien d'autre ne part, « Invitation refusée » ;
//   · un refus du serveur (mineur) -> le message qui dit pourquoi.

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
        const valeur = String(cle).split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ part) => (noeud == null ? undefined : noeud[part]),
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
jest.mock('@/components/organisms/feuilleDeSucces/FeuilleDeSucces', () => function FeuilleDoublure(/** @type {any} */ props) {
  mockFeuilles.push(props);
  return null;
});

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

const DATA = {
  clubId: 'club-fle',
  clubName: 'FC Lyon Est',
  invitationId: 'inv-1',
  inviterName: 'Sofiane Benali',
  role: 'coach',
  teamName: 'U13 A',
};

/** La feuille visible en dernier rendu. */
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

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  await act(async () => { await arbre.root.findByProps({ testID }).props.onPress(); });
};

beforeEach(() => {
  mockFeuilles.length = 0;
  jest.clearAllMocks();
  /** @type {any} */ (getMyStaffInvitations).mockResolvedValue([{ documentId: 'inv-1', expiresAt: '2026-12-10T12:00:00.000Z' }]);
  /** @type {any} */ (acceptStaffInvitation).mockResolvedValue({ accepted: true });
  /** @type {any} */ (refuseStaffInvitation).mockResolvedValue({ refused: true });
});

describe('INVITE-STAFF — la carte de la cloche', () => {
  it('« Voir et accepter » ouvre la feuille qui dit le club, le rôle et ce qui change', async () => {
    const { arbre } = await monter();
    await appuyer(arbre, 'n1-staff-invite-open');
    const feuille = feuilleOuverte();
    expect(feuille.titre).toBe('FC Lyon Est t’invite comme coach de l’équipe U13 A');
    expect(feuille.texte).toContain('Invitation de Sofiane Benali.');
    expect(feuille.texte).toContain('Tu entres au club FC Lyon Est.');
    expect(feuille.texte).toContain('Tu deviens coach de l’équipe U13 A');
    expect(feuille.texte).toContain('Tes équipes actuelles ne bougent pas.');
    expect(feuille.texte).toContain('valable jusqu’au 10/12');
    expect(acceptStaffInvitation).not.toHaveBeenCalled();
    expect(refuseStaffInvitation).not.toHaveBeenCalled();
  });

  it('« Accepter » : l acceptation part, la bienvenue s affiche, la cloche se relit', async () => {
    const { arbre, relire } = await monter();
    await appuyer(arbre, 'n1-staff-invite-open');
    await act(async () => { await feuilleOuverte().actionPrincipale.onPress(); });
    expect(acceptStaffInvitation).toHaveBeenCalledWith('inv-1');
    expect(refuseStaffInvitation).not.toHaveBeenCalled();
    expect(feuilleOuverte().titre).toBe('Bienvenue dans le staff de FC Lyon Est');
    expect(relire).toHaveBeenCalled();
  });

  it('« Refuser » : seul le refus part, et rien d autre ne change', async () => {
    const { arbre } = await monter();
    await appuyer(arbre, 'n1-staff-invite-refuse');
    expect(refuseStaffInvitation).toHaveBeenCalledWith('inv-1');
    expect(acceptStaffInvitation).not.toHaveBeenCalled();
    expect(feuilleOuverte().titre).toBe('Invitation refusée');
    expect(feuilleOuverte().texte).toContain('Le club n’est pas prévenu.');
  });

  it('un mineur : le serveur refuse, la feuille dit pourquoi', async () => {
    /** @type {any} */ (acceptStaffInvitation).mockRejectedValue(Object.assign(new Error('x'), { code: 'STAFF_INVITE_MINOR' }));
    const { arbre } = await monter();
    await appuyer(arbre, 'n1-staff-invite-open');
    await act(async () => { await feuilleOuverte().actionPrincipale.onPress(); });
    expect(feuilleOuverte().titre).toBe('Il faut avoir 18 ans pour rejoindre un staff');
  });

  it('une invitation annulée ou périmée : « plus valable », sans rien envoyer', async () => {
    /** @type {any} */ (getMyStaffInvitations).mockResolvedValue([]);
    const { arbre } = await monter();
    await appuyer(arbre, 'n1-staff-invite-open');
    expect(feuilleOuverte().titre).toBe('Cette invitation n’est plus valable');
    expect(acceptStaffInvitation).not.toHaveBeenCalled();
  });

  it('un dirigeant : la phrase le dit', async () => {
    const { arbre } = await monter({ ...DATA, role: 'dirigeant', teamName: '' });
    await appuyer(arbre, 'n1-staff-invite-open');
    expect(feuilleOuverte().titre).toBe('FC Lyon Est t’invite comme dirigeant·e du club');
  });

  it('sans identifiant d invitation, rien ne s affiche', async () => {
    const { arbre } = await monter({ ...DATA, invitationId: '' });
    expect(arbre.toJSON()).toBeNull();
  });
});
