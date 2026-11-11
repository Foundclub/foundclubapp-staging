import renderer, { act } from 'react-test-renderer';

import {
  acceptStaffInvitation,
  getMyStaffInvitations,
  refuseStaffInvitation,
} from '@/services/staffInvitation/staffInvitationService';

import ActionsInvitationDeStaff from '../ActionsInvitationDeStaff';
import { detailsDeLInvitationEnvoyee } from '../textesInvitationDeStaff';

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
  return { __esModule: true, default: () => ({ Alignments: vide, Fonts: vide, Spaces: vide }) };
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

// INVITE-STAFF-DESIGN (11/11/2026, maquette validée le 10/11) :
//   F · la feuille « Accepter ou refuser » porte l'écusson du club (logo, sinon initiales) ;
//   G · après « Accepter », une invitation avec équipe ouvre l'équipe ; sans équipe, le club.
/** @type {any[]} */
const mockEcussons = [];
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function EcussonDoublure(/** @type {any} */ props) {
    mockEcussons.push(props);
    return null;
  },
);

const DATA = {
  clubId: 'club-fle',
  clubName: 'FC Lyon Est',
  invitationId: 'inv-1',
  inviterName: 'Sofiane Benali',
  role: 'coach',
  teamName: 'U13 A',
};

const feuilleOuverte = () => mockFeuilles.slice(-3).find((props) => props.isVisible) || null;

const monter = async (data = DATA) => {
  /** @type {any} */
  let arbre;
  const navigation = { navigate: jest.fn() };
  await act(async () => {
    arbre = renderer.create(
      <ActionsInvitationDeStaff data={data} navigation={navigation} relire={jest.fn()} />,
    );
  });
  return { arbre, navigation };
};

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ title) => {
  await act(async () => {
    await arbre.root.findByProps({ title }).props.onPress();
  });
};

const accepter = async () => {
  await act(async () => {
    await feuilleOuverte().actionPrincipale.onPress();
  });
};

beforeEach(() => {
  mockFeuilles.length = 0;
  mockEcussons.length = 0;
  jest.clearAllMocks();
  /** @type {any} */ (getMyStaffInvitations).mockResolvedValue([{
    club: { documentId: 'club-fle', logoUrl: 'https://cdn/fle.png', name: 'FC Lyon Est' },
    documentId: 'inv-1',
    expiresAt: '2026-12-10T12:00:00.000Z',
  }]);
  /** @type {any} */ (refuseStaffInvitation).mockResolvedValue({ refused: true });
});

describe('INVITE-STAFF-DESIGN — F l écusson, G la bienvenue', () => {
  it('F : la feuille « Accepter ou refuser » montre l écusson du club et son nom', async () => {
    /** @type {any} */ (acceptStaffInvitation).mockResolvedValue({ accepted: true, team: null });
    const { arbre } = await monter();
    await appuyer(arbre, 'Voir et accepter');
    const { pastille } = feuilleOuverte();
    expect(pastille).toBeTruthy();
    /** @type {any} */
    let entete;
    await act(async () => { entete = renderer.create(pastille); });
    expect(mockEcussons[mockEcussons.length - 1]).toEqual(expect.objectContaining({
      logoUrl: 'https://cdn/fle.png',
      name: 'FC Lyon Est',
    }));
    const { Text } = jest.requireActual('react-native');
    const textes = entete.root.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);
    expect(textes).toEqual(expect.arrayContaining(['Invitation', 'FC Lyon Est']));
  });

  it('G : avec une équipe, la bienvenue la nomme et ouvre l équipe', async () => {
    /** @type {any} */ (acceptStaffInvitation).mockResolvedValue({
      accepted: true, role: 'coach', team: { documentId: 't-1', name: 'U13 A' },
    });
    const { arbre, navigation } = await monter();
    await appuyer(arbre, 'Voir et accepter');
    await accepter();
    const bienvenue = feuilleOuverte();
    expect(bienvenue.titre).toBe('Bienvenue dans le staff de FC Lyon Est');
    expect(bienvenue.texte).toContain('Tu es coach de l’équipe U13 A.');
    expect(bienvenue.actionPrincipale.title).toBe('Ouvrir l’équipe U13 A');
    await act(async () => { bienvenue.actionPrincipale.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('TeamDetails', { teamId: 't-1' });
  });

  it('G : sans équipe, la bienvenue ouvre le club, comme avant', async () => {
    /** @type {any} */ (acceptStaffInvitation).mockResolvedValue({
      accepted: true, role: 'dirigeant', team: null,
    });
    const { arbre, navigation } = await monter({ ...DATA, role: 'dirigeant', teamName: '' });
    await appuyer(arbre, 'Voir et accepter');
    await accepter();
    const bienvenue = feuilleOuverte();
    expect(bienvenue.actionPrincipale.title).toBe('Ouvrir le club');
    await act(async () => { bienvenue.actionPrincipale.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('Club', { clubId: 'club-fle' });
  });
});

describe('INVITE-STAFF-DESIGN — B les lignes de la carte « Invitation envoyée »', () => {
  const { useTranslation } = jest.requireMock('react-i18next');
  const { t } = useTranslation();

  it('numéro à 2 chiffres, rôle et équipe, échéance', () => {
    expect(detailsDeLInvitationEnvoyee(t, {
      expiresAt: '2026-12-10T12:00:00.000Z', phoneHint: '78', team: { name: 'U13 A' },
    }, 'coach')).toEqual([
      { label: 'Numéro', value: '•• 78' },
      { label: 'Rôle', value: 'Coach · U13 A' },
      { label: 'Valable', value: 'jusqu’au 10/12' },
    ]);
  });

  it('un dirigeant, sans numéro ni date connus : une seule ligne', () => {
    expect(detailsDeLInvitationEnvoyee(t, {}, 'dirigeant')).toEqual([
      { label: 'Rôle', value: 'Dirigeant·e' },
    ]);
  });
});
