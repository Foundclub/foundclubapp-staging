jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('i18next', () => ({ __esModule: true, default: { t: (_k, fallback) => fallback } }));

const { getLeagueClosedMessageLines } = require('../leaguePlatformService');

// BH09 P2-19 : des lignes serveur toutes vides ne doivent pas vider l'écran « Ligue fermée ».
test('lignes vides du serveur : repli utilisé', () => {
  const lines = getLeagueClosedMessageLines({ platform: { messageLines: ['', ' '] } }, 'platform');
  expect(lines.length).toBeGreaterThan(0);
});
