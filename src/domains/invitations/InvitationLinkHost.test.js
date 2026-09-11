/**
 * Temoins E6 du lot Y03 — LA fenetre d'invitation (chemin 2 : l'app est deja la).
 *
 * Ce que ces temoins protegent, dans l'ordre du PROMPT_Y03 :
 *  1. un lien d'equipe ouvert avec l'app installee PROPOSE d'envoyer la demande
 *  2. un lien d'evenement fait la meme chose — meme systeme, pas un deuxieme
 *  3. un lien invalide DIT pourquoi (jamais d'ecran blanc)
 *  4. 🔒 un lien ne fait JAMAIS rejoindre sans que la personne ait appuye
 *  5. le meme lien marche sur les deux plateformes (aucune branche iOS/Android ici)
 */
import { act, create } from 'react-test-renderer';

let urlListener = null;
const mockGetInitialURL = jest.fn();
const mockAddEventListener = jest.fn((eventName, listener) => {
  urlListener = listener;
  return { remove: jest.fn() };
});
const mockNavigate = jest.fn(() => true);
// La racine REELLE au moment de l appui (navigationService.js:6). Par defaut pas prete :
// les temoins historiques ci-dessous gardent donc la forme nue.
const mockNavigationRef = {
  getRootState: jest.fn(() => undefined),
  isReady: jest.fn(() => false),
};
const mockClearPendingInvite = jest.fn();
const mockReadPendingInvite = jest.fn(() => null);
const mockSavePendingInvite = jest.fn();

jest.mock('react-native', () => ({
  Linking: {
    addEventListener: (...args) => mockAddEventListener(...args),
    getInitialURL: (...args) => mockGetInitialURL(...args),
  },
  Platform: { OS: 'ios', select: (options) => options.ios },
}));

jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
  navigationRef: mockNavigationRef,
}));

jest.mock('@/domains/invitations/pendingInvite', () => ({
  clearPendingInvite: (...args) => mockClearPendingInvite(...args),
  readPendingInvite: (...args) => mockReadPendingInvite(...args),
  savePendingInvite: (...args) => mockSavePendingInvite(...args),
}));

let lastModalProps = null;
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => {
  // eslint-disable-next-line global-require -- une usine jest.mock ne peut pas etre hissee
  const React = require('react');
  return function GlobalPromptModalProbe(props) {
    lastModalProps = props;
    return React.createElement('GlobalPromptModalProbe', null);
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key, fallback) => fallback || _key }),
}));

const { RouteNames } = require('@/navigation/routeNames');

const InvitationLinkHost = require('./InvitationLinkHost').default;
const { resolveInviteDestination, resolveInviteLinkOutcome } = require('./InvitationLinkHost');

const renderHost = async () => {
  let tree;
  await act(async () => {
    tree = create(<InvitationLinkHost />);
  });
  return tree;
};

describe('InvitationLinkHost — la fenetre d invitation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    urlListener = null;
    lastModalProps = null;
    mockGetInitialURL.mockResolvedValue(null);
    mockReadPendingInvite.mockReturnValue(null);
  });

  describe('la decision, isolee et pure', () => {
    it('un lien d equipe demande la question', () => {
      expect(resolveInviteLinkOutcome('https://foundclub.app/i/team/t-1')).toEqual({
        invite: { id: 't-1', subject: 'team' },
        kind: 'ask',
      });
    });

    it('un lien d evenement passe par le MEME chemin', () => {
      expect(resolveInviteLinkOutcome('https://foundclub.app/i/event/e-1')).toEqual({
        invite: { id: 'e-1', subject: 'event' },
        kind: 'ask',
      });
    });

    it('un lien abime s explique au lieu de se taire', () => {
      expect(resolveInviteLinkOutcome('https://foundclub.app/i/team/').kind).toBe('explain');
      expect(resolveInviteLinkOutcome('https://foundclub.app/i/licorne/x-1').kind).toBe('explain');
    });

    it('un lien qui n est pas une invitation est ignore en silence', () => {
      expect(resolveInviteLinkOutcome('https://foundclub.app/teams/t-1').kind).toBe('ignore');
      expect(resolveInviteLinkOutcome('foundclub://team/t-1').kind).toBe('ignore');
      expect(resolveInviteLinkOutcome('https://mechant.example/i/team/t-1').kind).toBe('ignore');
    });

    it('chaque sujet connait sa destination', () => {
      expect(resolveInviteDestination({ id: 't-1', subject: 'team' })).toEqual({
        params: { invite: true, teamId: 't-1' },
        route: RouteNames.TeamDetails,
      });
      expect(resolveInviteDestination({ id: 'e-1', subject: 'event' })).toEqual({
        params: { eventId: 'e-1' },
        route: RouteNames.EventDetails,
      });
      expect(resolveInviteDestination({ id: 's-1', subject: 'squad' })).toEqual({
        params: { invite: true, teamId: 's-1' },
        route: RouteNames.SquadDetails,
      });
      expect(resolveInviteDestination({ id: 'c-1', subject: 'club' })).toEqual({
        params: { clubId: 'c-1' },
        route: RouteNames.Club,
      });
      expect(resolveInviteDestination({ id: 'x', subject: 'licorne' })).toBeNull();
    });
  });

  describe('1. un lien d equipe ouvert avec l app installee propose d envoyer la demande', () => {
    it('ouvre la fenetre au demarrage a froid', async () => {
      mockGetInitialURL.mockResolvedValue('https://foundclub.app/i/team/t-1');

      await renderHost();

      expect(lastModalProps.visible).toBe(true);
      expect(lastModalProps.primaryAction.label).toBeTruthy();
      expect(lastModalProps.secondaryAction.label).toBeTruthy();
    });

    it('range l invitation pour le cas ou la personne ferme l app', async () => {
      mockGetInitialURL.mockResolvedValue('https://foundclub.app/i/team/t-1');

      await renderHost();

      expect(mockSavePendingInvite).toHaveBeenCalledWith({ id: 't-1', subject: 'team' });
    });

    it('ouvre la fenetre quand le lien arrive app ouverte', async () => {
      await renderHost();
      expect(lastModalProps.visible).toBe(false);

      await act(async () => {
        urlListener({ url: 'https://foundclub.app/i/team/t-2' });
      });

      expect(lastModalProps.visible).toBe(true);
    });

    it('reprend une invitation rangee lors d une session precedente', async () => {
      mockReadPendingInvite.mockReturnValue({ createdAt: 1, id: 't-3', subject: 'team' });

      await renderHost();

      expect(lastModalProps.visible).toBe(true);
    });
  });

  describe('2. un lien d evenement fait la meme chose', () => {
    it('ouvre la meme fenetre et mene a la fiche de l evenement', async () => {
      mockGetInitialURL.mockResolvedValue('https://foundclub.app/i/event/e-9');

      await renderHost();
      expect(lastModalProps.visible).toBe(true);

      await act(async () => {
        lastModalProps.primaryAction.onPress();
      });

      expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EventDetails, { eventId: 'e-9' });
    });
  });

  describe('3. un lien invalide dit pourquoi', () => {
    it('affiche une explication et aucun bouton d adhesion', async () => {
      mockGetInitialURL.mockResolvedValue('https://foundclub.app/i/team/');

      await renderHost();

      expect(lastModalProps.visible).toBe(true);
      expect(lastModalProps.body).toBeTruthy();
      expect(lastModalProps.secondaryAction).toBeUndefined();
      expect(mockSavePendingInvite).not.toHaveBeenCalled();
    });

    it('ne montre RIEN pour un lien qui n est pas une invitation', async () => {
      mockGetInitialURL.mockResolvedValue('https://foundclub.app/teams/t-1');

      await renderHost();

      expect(lastModalProps.visible).toBe(false);
      expect(mockSavePendingInvite).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('🔒 4. un lien ne fait JAMAIS rejoindre sans que la personne ait appuye', () => {
    it('ne navigue nulle part tant que rien n a ete touche', async () => {
      mockGetInitialURL.mockResolvedValue('https://foundclub.app/i/team/t-1');

      await renderHost();

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockClearPendingInvite).not.toHaveBeenCalled();
    });

    it('mene a l ecran de l equipe seulement apres l appui', async () => {
      mockGetInitialURL.mockResolvedValue('https://foundclub.app/i/team/t-1');

      await renderHost();
      await act(async () => {
        lastModalProps.primaryAction.onPress();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        RouteNames.TeamDetails,
        { invite: true, teamId: 't-1' },
      );
      expect(mockClearPendingInvite).toHaveBeenCalled();
      expect(lastModalProps.visible).toBe(false);
    });

    it('« plus tard » ferme la fenetre et ne navigue nulle part', async () => {
      mockGetInitialURL.mockResolvedValue('https://foundclub.app/i/team/t-1');

      await renderHost();
      await act(async () => {
        lastModalProps.secondaryAction.onPress();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(lastModalProps.visible).toBe(false);
    });

    it('« plus tard » est une REPONSE : rien ne revient au demarrage', async () => {
      mockGetInitialURL.mockResolvedValue('https://foundclub.app/i/team/t-1');

      await renderHost();
      await act(async () => {
        lastModalProps.secondaryAction.onPress();
      });

      expect(mockClearPendingInvite).toHaveBeenCalled();
    });
  });

  describe('4 bis. NAVMORTE2 -- « Voir » mene a l ecran depuis la racine REELLE', () => {
    // Connecte, Club, EventDetails et TeamDetails ne vivent que dans leur pile : un nom nu
    // lance depuis la racine n etait pris par personne, l appui ne faisait rien (relecture
    // adverse NAVMORTE2, constat 1). Deconnecte, la racine publique les porte nus. Le rejeu
    // avec le vrai routeur est dans
    // src/navigation/__tests__/notificationNavigation.depuisLaRacine.test.js.
    const RACINE_CONNECTEE = [
      RouteNames.HomeTab,
      RouteNames.ClubStack,
      RouteNames.EventStack,
      RouteNames.TeamStack,
      RouteNames.SquadDetails,
    ];
    const RACINE_PUBLIQUE = [
      RouteNames.HomeTab,
      RouteNames.Club,
      RouteNames.EventDetails,
      RouteNames.TeamDetails,
      RouteNames.SquadDetails,
    ];

    afterEach(() => {
      mockNavigationRef.isReady.mockImplementation(() => false);
      mockNavigationRef.getRootState.mockImplementation(() => undefined);
    });

    /**
     * Ouvre la fenetre sur ce lien, avec cette racine prete, et appuie sur « Voir ».
     * @param {string} url le lien d invitation
     * @param {string[]} routeNames les routes de la racine montee
     * @returns {Promise<void>}
     */
    const accepter = async (url, routeNames) => {
      mockNavigationRef.isReady.mockImplementation(() => true);
      mockNavigationRef.getRootState.mockImplementation(() => ({ routeNames }));
      mockGetInitialURL.mockResolvedValue(url);
      await renderHost();
      await act(async () => {
        lastModalProps.primaryAction.onPress();
      });
    };

    it.each([
      [
        'https://foundclub.app/i/club/c-1',
        RouteNames.ClubStack,
        RouteNames.Club,
        { clubId: 'c-1' },
      ],
      [
        'https://foundclub.app/i/event/e-1',
        RouteNames.EventStack,
        RouteNames.EventDetails,
        { eventId: 'e-1' },
      ],
      [
        'https://foundclub.app/i/team/t-1',
        RouteNames.TeamStack,
        RouteNames.TeamDetails,
        { invite: true, teamId: 't-1' },
      ],
    ])('connecte : %s ouvre %s > %s', async (url, pile, ecran, params) => {
      await accepter(url, RACINE_CONNECTEE);

      expect(mockNavigate).toHaveBeenCalledWith(pile, { params, screen: ecran });
    });

    it('web : la reference du shim n a pas getRootState, le nom nu reste', async () => {
      // Le web compile ces sources avec son propre createNavigationContainerRef
      // (web/src/shims/react-navigation/native.tsx:52-59) : isReady rend true, et
      // getRootState N EXISTE PAS. L appui ne doit ni planter ni changer de forme.
      mockNavigationRef.isReady.mockImplementation(() => true);
      const { getRootState } = mockNavigationRef;
      delete /** @type {any} */ (mockNavigationRef).getRootState;
      try {
        mockGetInitialURL.mockResolvedValue('https://foundclub.app/i/club/c-1');
        await renderHost();
        await act(async () => {
          lastModalProps.primaryAction.onPress();
        });

        expect(mockNavigate).toHaveBeenCalledWith(RouteNames.Club, { clubId: 'c-1' });
      } finally {
        mockNavigationRef.getRootState = getRootState;
      }
    });

    it('connecte : une squad, portee par la racine, reste nue', async () => {
      await accepter('https://foundclub.app/i/squad/s-1', RACINE_CONNECTEE);

      expect(mockNavigate).toHaveBeenCalledWith(
        RouteNames.SquadDetails,
        { invite: true, teamId: 's-1' },
      );
    });

    it.each([
      ['https://foundclub.app/i/club/c-1', RouteNames.Club, { clubId: 'c-1' }],
      ['https://foundclub.app/i/event/e-1', RouteNames.EventDetails, { eventId: 'e-1' }],
      ['https://foundclub.app/i/team/t-1', RouteNames.TeamDetails, { invite: true, teamId: 't-1' }],
    ])('deconnecte : %s ouvre %s nu', async (url, ecran, params) => {
      await accepter(url, RACINE_PUBLIQUE);

      expect(mockNavigate).toHaveBeenCalledWith(ecran, params);
    });
  });

  describe('5. le meme lien marche sur les deux plateformes', () => {
    it('ne contient aucune branche par plateforme', () => {
      // eslint-disable-next-line global-require
      const source = require('fs').readFileSync(`${__dirname}/InvitationLinkHost.js`, 'utf8');
      expect(source).not.toMatch(/Platform\.OS/);
    });
  });
});
