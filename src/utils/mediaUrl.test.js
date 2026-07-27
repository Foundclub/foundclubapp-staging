/* eslint-disable no-underscore-dangle */
import { Platform } from 'react-native';

import { resolveMediaUrl, shouldAttachAuthToMediaUrl } from './mediaUrl';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Les origines sont injectées par ce mock, jamais mutées via `process.env` :
// babel-plugin-inline-dotenv réécrit chaque lecture littérale `process.env.X`
// en `process.env.X || "<valeur du fichier .env>"`, et neutralise
// `delete process.env.X` (le `delete` porte alors sur une expression, plus sur
// une référence : il ne supprime rien). Un test qui muterait `process.env`
// n'isolerait donc rien, et resterait vert même si l'origine n'était pas lue.
// La chaîne env -> origines est couverte par src/config/runtimeUrls.shared.test.js.
jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: jest.fn(() => ''),
  getPublicApiOrigin: jest.fn(() => ''),
}));

const { getApiBaseUrl, getPublicApiOrigin } = jest.requireMock('@/config/runtimeUrls');

describe('mediaUrl utils', () => {
  const originalDev = global.__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    getApiBaseUrl.mockReturnValue('');
    getPublicApiOrigin.mockReturnValue('');
    global.__DEV__ = true;
  });

  afterAll(() => {
    global.__DEV__ = originalDev;
  });

  it('keeps localhost media URLs on the Android emulator', () => {
    Platform.OS = 'android';
    getApiBaseUrl.mockReturnValue('http://10.0.2.2:4444/api');
    getPublicApiOrigin.mockReturnValue('http://localhost:4444');

    expect(resolveMediaUrl('http://localhost:4444/uploads/test.m4a'))
      .toBe('http://localhost:4444/uploads/test.m4a');
  });

  it('resolves relative media paths against the localhost emulator origin', () => {
    Platform.OS = 'android';
    getApiBaseUrl.mockReturnValue('http://10.0.2.2:4444/api');
    getPublicApiOrigin.mockReturnValue('http://localhost:4444');

    expect(resolveMediaUrl('/uploads/test.m4a'))
      .toBe('http://localhost:4444/uploads/test.m4a');
  });

  it('rewrites loopback media URLs to the runtime emulator origin', () => {
    Platform.OS = 'android';
    getApiBaseUrl.mockReturnValue('http://10.0.2.2:4444/api');
    getPublicApiOrigin.mockReturnValue('http://localhost:4444');

    expect(resolveMediaUrl('http://10.0.2.2:4444/uploads/test.m4a'))
      .toBe('http://localhost:4444/uploads/test.m4a');
  });

  it('keeps already public media URLs unchanged', () => {
    Platform.OS = 'android';
    getApiBaseUrl.mockReturnValue('http://localhost:4444/api');

    expect(resolveMediaUrl('https://cdn.example.com/audio/test.m4a'))
      .toBe('https://cdn.example.com/audio/test.m4a');
  });

  it('attaches auth headers only for first-party media URLs', () => {
    Platform.OS = 'ios';
    getApiBaseUrl.mockReturnValue('https://api.example.com/api');
    getPublicApiOrigin.mockReturnValue('https://api.example.com');

    expect(shouldAttachAuthToMediaUrl('https://api.example.com/uploads/test.m4a'))
      .toBe(true);
    expect(shouldAttachAuthToMediaUrl('https://cdn.example.com/audio/test.m4a'))
      .toBe(false);
  });
});
