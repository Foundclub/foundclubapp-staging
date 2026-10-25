const fs = require('fs');
const path = require('path');

jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/services/league/leagueActionQueries', () => ({}));
jest.mock('@/services/league/leagueMatchQueries', () => ({}));
jest.mock('@/services/league/leagueMatchService', () => ({}));
jest.mock('@/services/league/leaguePlatformQueries', () => ({}));
jest.mock('@/services/league/MatchmakingService', () => ({}));
jest.mock('@/services/teamSlot/teamSlotService', () => ({}));
jest.mock('@/domains/auth/useAuth', () => () => ({}));
jest.mock('@/context/PopupManagerContext', () => ({ usePopupManager: () => ({}) }));
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: () => null }));
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/atoms/league/LeagueCard', () => () => null);
jest.mock('@/components/atoms/teamShield/TeamShield', () => () => null);
jest.mock('@/components/organisms/league/MatchFinalPosterModal', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => () => null);
jest.mock('@/views/league/components/LeagueStateView', () => () => null);

const { wasScorePersistedDespiteError } = require('../EndMatchScreen');

const source = fs.readFileSync(path.join(__dirname, '..', 'EndMatchScreen.js'), 'utf8');
const bodyOf = (name) => {
  const start = source.indexOf(`const ${name} = `);
  return source.slice(start, source.indexOf('\n  };\n', start));
};

// BH09 P10-02 : seule la saisie de SON équipe (ou un score final validé) prouve l'enregistrement.
describe('wasScorePersistedDespiteError', () => {
  const previous = { status: 'scheduled' };

  it("refuse la saisie de l'adversaire comme preuve", () => {
    const refreshed = {
      status: 'pending_validation',
      submitted_score_team_b: { score_a: 2, score_b: 1 },
    };
    expect(wasScorePersistedDespiteError(previous, refreshed, 2, 1, 'a')).toBe(false);
  });

  it('accepte sa propre saisie', () => {
    const refreshed = {
      status: 'pending_validation',
      submitted_score_team_a: { score_a: 2, score_b: 1 },
    };
    expect(wasScorePersistedDespiteError(previous, refreshed, 2, 1, 'a')).toBe(true);
  });

  it('accepte un score final identique sur un match validé', () => {
    const refreshed = { score_a: 2, score_b: 1, status: 'valid' };
    expect(wasScorePersistedDespiteError(previous, refreshed, 2, 1, 'b')).toBe(true);
  });
});

// BH09 P10-13 : « Confirmer le score » gardé contre le double appui et la fenêtre fermée.
test('handleConfirmOpponentScore est gardé', () => {
  const body = bodyOf('handleConfirmOpponentScore');
  expect(body).toContain('submitMutation.isPending');
  expect(body).toContain('isScoreSubmissionAllowed');
});

// BH09 P10-14 : le récapitulatif suit le côté de l'utilisateur, pas le seul capitaine B.
test.each(['getFinalRecapForCurrentTeam', 'buildFinalPosterPayload'])('%s suit scoreTeamSide', (name) => {
  expect(bodyOf(name)).not.toContain('isCaptainB');
});

// C07 / Q4-18 — notre ANCIENNE saisie, deja identique avant l envoi, ne prouve
// pas que le nouvel envoi (avec litige et photo) est passe : l ecran annoncait
// « Litige ouvert, score enregistré » alors que rien n etait parti.
describe('wasScorePersistedDespiteError — saisie inchangee (Q4-18)', () => {
  it('refuse une saisie qui etait deja la meme avant l envoi', () => {
    const before = {
      status: 'pending_validation',
      submitted_score_team_a: { dispute: false, score_a: 2, score_b: 1 },
    };
    const refreshed = JSON.parse(JSON.stringify(before));
    expect(wasScorePersistedDespiteError(before, refreshed, 2, 1, 'a')).toBe(false);
  });

  it('accepte encore une saisie apparue pendant l envoi', () => {
    expect(wasScorePersistedDespiteError(
      { status: 'scheduled' },
      { status: 'pending_validation', submitted_score_team_a: { score_a: 2, score_b: 1 } },
      2,
      1,
      'a',
    )).toBe(true);
  });
});
