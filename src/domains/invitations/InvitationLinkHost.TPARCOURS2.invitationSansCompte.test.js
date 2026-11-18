/**
 * T-PARCOURS-2 (17/11/2026, point 5, R13) — L'INVITATION OUVERTE SANS COMPTE DIT À QUOI ON EST
 * INVITÉ.
 *
 * Avant : « Tu es invité·e à rejoindre l'équipe … Connecte-toi ou crée ton compte : l'invitation
 * t'attendra. », sans la date, le lieu, les joueurs ni le prix (capture app-P2-01), et
 * « Continuer » fermait la fenêtre sur l'Accueil du visiteur (app-P2-02).
 * Maintenant : la date, le lieu, les
 * joueurs (plus « sur N » depuis T-SANS-PLAFOND, D239) et le prix (si le serveur le rend) sont
 * lus dans l'aperçu public, et « Continuer »
 * ouvre la connexion. AUCUNE personne n'est affichée (décision d'Adel en attente).
 */
import { act, create } from 'react-test-renderer';

import { formatEventWhenLine } from '@/views/event/eventInfoLines';

const CODE = 'Abcdefghijklmnopqrstuvwx';
const LIEN = `https://foundclub.app/i/tournament/tournoi-1912?c=${CODE}`;
const DATE = '2026-12-19T18:00:00.000Z';

const mockNavigate = jest.fn(() => true);
const mockApercu = jest.fn();

// T-PAGES-6 : le bouton « Conditions d'inscription » de la fenêtre (doublures, react-native est
// simulé ici).
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/views/event/components/tournamentTerms', () => ({ openTournamentTerms: jest.fn() }));
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: {
    addEventListener: () => ({ remove: jest.fn() }),
    getInitialURL: () => Promise.resolve(
      'https://foundclub.app/i/tournament/tournoi-1912?c=Abcdefghijklmnopqrstuvwx',
    ),
  },
  Platform: { OS: 'android', select: (/** @type {any} */ options) => options.android },
}));
jest.mock('@/navigation/navigationService', () => ({
  navigate: (/** @type {any[]} */ ...args) => mockNavigate(...args),
  navigationRef: { getRootState: () => undefined, isReady: () => false },
}));
jest.mock('@/services/teamInvite/teamInviteService', () => ({
  claimTeamInvite: jest.fn(() => Promise.resolve(null)),
  getTeamInvitePreview: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  acceptTeamInvitation: jest.fn(),
  createTeamMembershipRequest: jest.fn(),
  refuseTeamInvitation: jest.fn(),
}));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  previewTournamentTeamInviteLink: (/** @type {any[]} */ ...args) => mockApercu(...args),
}));
jest.mock('@/domains/invitations/pendingInvite', () => ({
  clearPendingInvite: jest.fn(),
  readPendingInvite: jest.fn(() => null),
  savePendingInvite: jest.fn(),
}));
jest.mock('@/domains/invitations/deferredInviteRecovery', () => ({
  readAndroidDeferredInviteUrl: jest.fn(() => Promise.resolve(null)),
  readIOSClipboardInviteUrl: jest.fn(() => Promise.resolve(null)),
  shouldOfferIOSClipboardInvite: jest.fn(() => Promise.resolve(false)),
}));

/** @type {any} */
let lastModalProps = null;
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => {
  // eslint-disable-next-line global-require -- une usine jest.mock ne peut pas etre hissee
  const React = require('react');
  return function GlobalPromptModalProbe(/** @type {any} */ props) {
    lastModalProps = props;
    return React.createElement('GlobalPromptModalProbe', null);
  };
});

/**
 * La doublure de traduction : le texte par défaut, avec ses variables.
 * @param {string} cle - La clé.
 * @param {any} parDefaut - Le texte par défaut.
 * @param {any} [options] - Les variables.
 * @returns {string} Le texte.
 */
const mockT = (cle, parDefaut, options = {}) => (
  String(parDefaut || cle).replace(/{{(\w+)}}/g, (_tout, nom) => String(options[nom] ?? ''))
);
const t = mockT;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

const InvitationLinkHost = require('./InvitationLinkHost').default;
const { describeCodedTournamentInvite } = require('./InvitationLinkHost');

const apercu = (/** @type {any} */ sur = {}) => ({
  entryFeeCents: 2000,
  event: {
    date: DATE, documentId: 'tournoi-1912', name: 'FoundClub x AR Soccer', place: 'AR Soccer',
  },
  maxRosterSize: 5,
  rosterCount: 3,
  status: 'active',
  team: { documentId: 'equipe-a', name: 'EMU Test 002' },
  ...sur,
});
const INTRO = "Tu es invité·e à rejoindre l'équipe EMU Test 002 pour le tournoi FoundClub x AR "
  + 'Soccer.';
const ATTENDRA = "Connecte-toi ou crée ton compte : l'invitation t'attendra.";

describe('T-PARCOURS-2 point 5 — l invitation de tournoi ouverte SANS compte', () => {
  test('🔴 elle dit la date, le lieu, les joueurs (sans « sur 5 », D239) et le prix', () => {
    const coded = describeCodedTournamentInvite({ isSignedIn: false, preview: apercu(), t });
    expect(coded.body.split('\n')).toEqual([
      INTRO,
      // T-PAGES-6 (M1319) : la règle de la fiche (jour + heure saisie).
      `${formatEventWhenLine({ date: DATE })} · AR Soccer`,
      '3 joueurs · 20 € par joueur',
      ATTENDRA,
    ]);
    expect(coded.title).toBe('Rejoindre EMU Test 002');
    expect(coded.primary).toBe('Continuer');
  });

  test('🔴 sans prix dans l aperçu (serveur d avant, ou tournoi gratuit) : aucun prix', () => {
    [undefined, 0].forEach((entryFeeCents) => {
      const coded = describeCodedTournamentInvite({
        isSignedIn: false, preview: apercu({ entryFeeCents }), t,
      });
      expect(coded.body.split('\n')[2]).toBe('3 joueurs');
      expect(coded.body).not.toContain('€');
    });
  });

  test('🔴 aucune personne : ni capitaine ni joueur nommé, même si l aperçu en portait', () => {
    const coded = describeCodedTournamentInvite({
      isSignedIn: false,
      preview: apercu({
        captain: { firstName: 'Dorian' },
        team: {
          captainUser: { firstname: 'Dorian' }, documentId: 'equipe-a', name: 'EMU Test 002',
        },
      }),
      t,
    });
    expect(coded.body).not.toContain('Dorian');
  });

  test('caractérisant — aperçu pas encore arrivé : la phrase d avant, sur une ligne', () => {
    const coded = describeCodedTournamentInvite({ isSignedIn: false, preview: null, t });
    expect(coded.body).toBe(`Tu es invité·e à rejoindre une équipe de tournoi. ${ATTENDRA}`);
  });

  // T-PAGES-6 (R5, un seul écran) : connecté, la fenêtre dit aussi la date, le lieu, les places et
  // le prix, sous la même phrase d'invitation.
  test('caractérisant — avec un compte : « Rejoindre l équipe », la même phrase en tête', () => {
    const coded = describeCodedTournamentInvite({ isSignedIn: true, preview: apercu(), t });
    expect(coded.body.split('\n')[0]).toBe(INTRO);
    expect(coded.primary).toBe("Rejoindre l'équipe");
  });

  test('🔴 « Continuer », sans compte, ouvre la connexion (plus l Accueil)', async () => {
    mockApercu.mockResolvedValue(apercu());
    await act(async () => { create(<InvitationLinkHost />); });
    await act(async () => { await Promise.resolve(); });
    expect(mockApercu).toHaveBeenCalledWith(CODE);
    expect(LIEN).toContain(CODE);
    expect(lastModalProps.body).toContain('3 joueurs · 20 € par joueur');

    await act(async () => { await lastModalProps.primaryAction.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('PublicAuthStack', {
      params: { source: 'tournament-team-invite' }, screen: 'Login',
    });
  });
});
