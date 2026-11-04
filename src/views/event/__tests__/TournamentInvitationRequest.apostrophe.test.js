import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import i18n from '@/theme/strings';

import TournamentInvitationRequest from '../TournamentInvitationRequest';

// Récolte train 3 (04/11) : un club ou une équipe avec une apostrophe s'affiche tel quel. Le VRAI
// i18next, celui qui échappe : la doublure de traduction ne le ferait pas.

const mockApercu = {
  club: { name: "L'Olympique d'Aix" }, invitationPreview: true, name: 'Tournoi de Noël',
};

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => {
    const { default: instance } = jest.requireActual('@/theme/strings');
    return { t: (/** @type {any[]} */ ...args) => instance.t(...args) };
  },
}));
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQuery: () => ({ data: mockApercu, isLoading: false }),
}));
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(rn.Text, null, props.title);
  };
});
jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Colors,
      Fonts: generateFonts(Colors),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: { trainedTeams: [{ documentId: 'eq-9', name: "L'Étoile U15" }] },
  }),
}));
jest.mock('@/services/event/eventService', () => ({ getTournamentInvitationPreview: jest.fn() }));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  registerClubTeamToTournament: jest.fn(),
}));

describe('TournamentInvitationRequest — les noms avec une apostrophe', () => {
  it.each(['fr', 'en'])('%s : le club et l équipe s affichent sans entité HTML', async (langue) => {
    await i18n.changeLanguage(langue);
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<TournamentInvitationRequest eventId="tournoi" />);
    });
    const textes = arbre.root.findAllByType(Text)
      .map((/** @type {any} */ n) => [n.props.children].flat().join(''))
      .join(' | ');
    act(() => arbre.unmount());

    expect(textes).toContain("L'Olympique d'Aix");
    expect(textes).toContain("L'Étoile U15");
    expect(textes).not.toMatch(/&#|&amp;|&apos;/);
  });
});
