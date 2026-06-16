const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
  },
}));

const { getCMHighlightRequests } = require('./multisportClubService');

describe('multisportClubService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getCMHighlightRequests uses the dedicated multisport pending requests route', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            documentId: 'request-1',
            event: { documentId: 'event-1' },
          },
        ],
      },
    });

    await expect(getCMHighlightRequests('cm-doc-1')).resolves.toEqual({
      data: [
        {
          documentId: 'request-1',
          event: { documentId: 'event-1' },
        },
      ],
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      '/multisport-clubs/cm-doc-1/pending-featured-requests',
    );
  });
});
