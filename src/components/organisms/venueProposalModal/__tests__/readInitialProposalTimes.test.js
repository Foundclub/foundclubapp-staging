import { buildProposalDefaultsFromMatch } from '@/views/league/match/utils/proposalDefaults';

import { toParisIsoFromLocalSelection } from '@/utils/parisTime';

import { readInitialProposalTimes } from '../VenueProposalModal';

// C07 / Q3-05 — proposer un creneau de ligue : l heure du match (20:00 a
// Paris) doit s afficher 20:00 et partir 19:00Z, QUEL QUE SOIT le fuseau de
// l appareil. A lancer aussi sous TZ=America/New_York (PowerShell) : en
// Europe/Paris, l ancien code tombait juste par hasard.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));
// La fenetre elle-meme n est pas rendue : seule sa fonction pure est lue.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('@/components/molecules/dateTimeSelector/DateTimeSelector', () => () => null);

test('Q3-05 : samedi 20:00 a Paris reste samedi 20:00 a l ecran et part 19:00Z', () => {
  const defaults = buildProposalDefaultsFromMatch(/** @type {any} */ ({
    date: '2026-10-31T11:00:00.000Z',
    recurring_day: 'saturday',
    recurring_start_hour: '20:00:00',
  }));
  const { nextStart } = readInitialProposalTimes({
    durationMinutes: 60,
    initialDate: defaults.date,
    initialEndTime: defaults.end,
    initialStartTime: defaults.start,
  });
  expect([nextStart.getDay(), nextStart.getHours(), nextStart.getMinutes()]).toEqual([6, 20, 0]);
  expect(toParisIsoFromLocalSelection(nextStart)).toBe('2026-10-31T19:00:00.000Z');
});
