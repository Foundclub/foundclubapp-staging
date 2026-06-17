const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
  },
}));

const { getClubFacilityContext, getCMFacilities } = require('./facilityService');

const expectedPlanningFacilitiesUrl = '/facilities?filters[club][documentId][$eq]=club-doc-1'
  + '&fields[0]=documentId'
  + '&fields[1]=id'
  + '&fields[2]=name'
  + '&fields[3]=planningColor'
  + '&fields[4]=capacityConflictMode'
  + '&fields[5]=maxSlots'
  + '&populate[club][fields][0]=documentId'
  + '&populate[club][fields][1]=id'
  + '&populate[club][fields][2]=name'
  + '&populate[multisportClub][fields][0]=documentId'
  + '&populate[multisportClub][fields][1]=id'
  + '&populate[multisportClub][fields][2]=name';

describe('facilityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getClubFacilityContext skips parent multisport resolution when disabled', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [],
      },
    });

    await expect(
      getClubFacilityContext('club-doc-1', null, { resolveCmId: false }),
    ).resolves.toEqual({
      allFacilities: [],
      clubFacilities: [],
      cmId: null,
      hasSharedFacilities: false,
      sharedFacilities: [],
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      expectedPlanningFacilitiesUrl,
    );
  });

  test('getCMFacilities uses the dedicated multisport route', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            documentId: 'facility-shared-1',
            name: 'Gymnase central',
          },
        ],
      },
    });

    await expect(getCMFacilities('cm-doc-1')).resolves.toEqual({
      data: [
        {
          documentId: 'facility-shared-1',
          name: 'Gymnase central',
        },
      ],
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/cm/cm-doc-1/facilities');
  });

  test('getClubFacilityContext loads shared multisport facilities', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              club: { name: 'HFC' },
              documentId: 'facility-club-1',
              name: 'Stade A',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              documentId: 'facility-shared-1',
              multisportClub: { name: 'FoundClub League' },
              name: 'Gymnase central',
            },
          ],
        },
      });

    await expect(
      getClubFacilityContext('club-doc-1', 'cm-doc-1', { resolveCmId: false }),
    ).resolves.toMatchObject({
      cmId: 'cm-doc-1',
      hasSharedFacilities: true,
    });

    expect(mockGet).toHaveBeenNthCalledWith(
      1,
      expectedPlanningFacilitiesUrl,
    );
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      '/cm/cm-doc-1/facilities',
    );
    expect(mockGet).not.toHaveBeenCalledWith(
      '/clubs/club-doc-1',
      expect.anything(),
    );
  });
});
