import { FACILITY_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';

import { setClubPlanningColor } from '../collectiviteService';

const mockPut = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { put: (...args) => mockPut(...args) },
}));

it('CRCOUL : envoie le choix et le retour automatique sur la seule route protegee', async () => {
  const purple = FACILITY_PLANNING_PALETTE[5];
  mockPut.mockResolvedValue({ data: { data: { planningColor: purple } } });
  await setClubPlanningColor({
    clubId: 'club',
    collectiviteId: 'ville',
    planningColor: purple,
  });
  await setClubPlanningColor({
    clubId: 'club',
    collectiviteId: 'ville',
    planningColor: null,
  });
  expect(mockPut).toHaveBeenNthCalledWith(
    1,
    '/collectivites/ville/clubs/club/planning-color',
    { data: { planningColor: purple } },
  );
  expect(mockPut).toHaveBeenNthCalledWith(
    2,
    '/collectivites/ville/clubs/club/planning-color',
    { data: { planningColor: null } },
  );
});
