import { setClubPlanningColor } from '../collectiviteService';

const mockPut = jest.fn();
jest.mock('@/services/client', () => ({ __esModule: true, default: { put: (...args) => mockPut(...args) } }));

it('CRCOUL : envoie le choix et le retour automatique sur la seule route protegee', async () => {
  mockPut.mockResolvedValue({ data: { data: { planningColor: '#9D4DFF' } } });
  await setClubPlanningColor({ clubId: 'club', collectiviteId: 'ville', planningColor: '#9D4DFF' });
  await setClubPlanningColor({ clubId: 'club', collectiviteId: 'ville', planningColor: null });
  expect(mockPut).toHaveBeenNthCalledWith(1, '/collectivites/ville/clubs/club/planning-color', { data: { planningColor: '#9D4DFF' } });
  expect(mockPut).toHaveBeenNthCalledWith(2, '/collectivites/ville/clubs/club/planning-color', { data: { planningColor: null } });
});
