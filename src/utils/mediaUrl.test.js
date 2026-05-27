/* eslint-disable no-underscore-dangle */
import { Platform } from 'react-native';

import { resolveMediaUrl, shouldAttachAuthToMediaUrl } from './mediaUrl';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

describe('mediaUrl utils', () => {
  const originalApiUrl = process.env.API_URL;
  const originalPublicUrl = process.env.API_PUBLIC_URL;
  const originalAdbReverse = process.env.LOCAL_ANDROID_USE_ADB_REVERSE;
  const originalDev = global.__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.API_URL;
    delete process.env.API_PUBLIC_URL;
    delete process.env.LOCAL_ANDROID_USE_ADB_REVERSE;
    global.__DEV__ = true;
  });

  afterAll(() => {
    process.env.API_URL = originalApiUrl;
    process.env.API_PUBLIC_URL = originalPublicUrl;
    process.env.LOCAL_ANDROID_USE_ADB_REVERSE = originalAdbReverse;
    global.__DEV__ = originalDev;
  });

  it('rewrites localhost media URLs to the Android emulator host', () => {
    Platform.OS = 'android';
    process.env.API_URL = 'http://localhost:1337/api';

    expect(resolveMediaUrl('http://localhost:1337/uploads/test.m4a'))
      .toBe('http://10.0.2.2:1337/uploads/test.m4a');
  });

  it('resolves relative media paths against the emulator-safe origin', () => {
    Platform.OS = 'android';
    process.env.API_URL = 'http://localhost:1337/api';

    expect(resolveMediaUrl('/uploads/test.m4a'))
      .toBe('http://10.0.2.2:1337/uploads/test.m4a');
  });

  it('keeps localhost media URLs when adb reverse override is enabled on Android', () => {
    Platform.OS = 'android';
    process.env.API_URL = 'http://localhost:1337/api';
    process.env.LOCAL_ANDROID_USE_ADB_REVERSE = 'true';

    expect(resolveMediaUrl('http://localhost:1337/uploads/test.m4a'))
      .toBe('http://localhost:1337/uploads/test.m4a');
    expect(resolveMediaUrl('/uploads/test.m4a'))
      .toBe('http://localhost:1337/uploads/test.m4a');
  });

  it('keeps already public media URLs unchanged', () => {
    Platform.OS = 'android';
    process.env.API_PUBLIC_URL = 'https://api.example.com';

    expect(resolveMediaUrl('https://cdn.example.com/audio/test.m4a'))
      .toBe('https://cdn.example.com/audio/test.m4a');
  });

  it('attaches auth headers only for first-party media URLs', () => {
    Platform.OS = 'ios';
    process.env.API_URL = 'https://api.example.com/api';

    expect(shouldAttachAuthToMediaUrl('https://api.example.com/uploads/test.m4a'))
      .toBe(true);
    expect(shouldAttachAuthToMediaUrl('https://cdn.example.com/audio/test.m4a'))
      .toBe(false);
  });
});
