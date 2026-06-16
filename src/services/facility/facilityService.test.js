const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
  },
}));

const { getClubFacilityContext, getCMFacilities } = require('./facilityService');

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
      '/facilities?filters[club][documentId][$eq]=club-doc-1&populate=*',
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
      '/facilities?filters[club][documentId][$eq]=club-doc-1&populate=*',
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
