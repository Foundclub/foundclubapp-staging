const mockGet = jest.fn();
const mockPut = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: jest.fn(() => 'http://127.0.0.1:1337'),
}));

jest.mock('@/platform/auth', () => ({
  confirmOtp: jest.fn(),
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendOtp: jest.fn(),
}));

jest.mock('@/platform/device', () => ({
  getAppVersion: jest.fn(() => '1.0.0'),
  getDeviceId: jest.fn(() => 'device-id'),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
    put: mockPut,
  },
}));

const { getMe, switchManagedClub } = require('./authService');

const buildProfilePayload = () => ({
  clubs: [
    {
      clubPartner: true,
      documentId: 'club-section-1',
      id: 101,
      logo: { url: '/uploads/club.png' },
      name: 'Section Football',
      parentMultisport: {
        admins: [
          {
            avatar: { url: '/uploads/admin.png' },
            documentId: 'user-admin-1',
            firstname: 'Camille',
            id: 501,
            lastname: 'Martin',
          },
        ],
        documentId: 'cm-1',
        id: 301,
        logo: { url: '/uploads/cm.png' },
        name: 'FoundClub Omnisport',
        sections: [
          {
            documentId: 'club-section-1',
            id: 101,
            name: 'Section Football',
          },
        ],
      },
    },
  ],
  documentId: 'user-1',
  id: 1,
  phoneNumber: '+33600000000',
});

describe('authService profile switching payloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getMe accepts enriched parent multisport payloads for section-managed users', async () => {
    const payload = buildProfilePayload();
    mockGet.mockResolvedValueOnce({
      data: {
        data: payload,
      },
    });

    await expect(getMe()).resolves.toMatchObject({
      clubs: [
        expect.objectContaining({
          documentId: 'club-section-1',
          parentMultisport: expect.objectContaining({
            admins: [
              expect.objectContaining({
                documentId: 'user-admin-1',
              }),
            ],
            documentId: 'cm-1',
            sections: [
              expect.objectContaining({
                documentId: 'club-section-1',
              }),
            ],
          }),
        }),
      ],
      documentId: 'user-1',
    });

    expect(mockGet).toHaveBeenCalledWith('/firebase-auth/me');
  });

  test('switchManagedClub accepts the same enriched payload after profile toggling', async () => {
    const payload = buildProfilePayload();
    mockPut.mockResolvedValueOnce({
      data: {
        data: payload,
      },
    });

    await expect(switchManagedClub('club-section-1')).resolves.toMatchObject({
      clubs: [
        expect.objectContaining({
          documentId: 'club-section-1',
        }),
      ],
    });

    expect(mockPut).toHaveBeenCalledWith(
      '/firebase-auth/me/managed-club',
      { clubId: 'club-section-1' },
    );
  });
});
