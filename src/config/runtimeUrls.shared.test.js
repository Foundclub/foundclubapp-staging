import { buildRuntimeEndpoints } from './runtimeUrls.shared';

describe('runtimeUrls.shared', () => {
  it('uses localhost on the Android emulator in local dev', () => {
    const runtime = buildRuntimeEndpoints({
      apiPublicUrlEnv: '',
      apiUrlEnv: 'http://10.0.2.2:1337/api',
      appEnv: 'local',
      isDev: true,
      isEmulator: true,
      platformOs: 'android',
      socketUrlEnv: 'http://10.0.2.2:1337',
    });

    expect(runtime.apiUrl).toBe('http://localhost:1337/api');
    expect(runtime.socketUrl).toBe('http://localhost:1337');
    expect(runtime.uploadUrl).toBe('http://localhost:1337/api/upload');
    expect(runtime.errors).toEqual([]);
  });

  it('keeps localhost on the Android emulator when adb reverse override is enabled', () => {
    const runtime = buildRuntimeEndpoints({
      apiPublicUrlEnv: '',
      apiUrlEnv: 'http://10.0.2.2:1337/api',
      appEnv: 'local',
      isDev: true,
      isEmulator: true,
      platformOs: 'android',
      preferAndroidAdbReverse: 'true',
      socketUrlEnv: 'http://10.0.2.2:1337',
    });

    expect(runtime.apiUrl).toBe('http://localhost:1337/api');
    expect(runtime.socketUrl).toBe('http://localhost:1337');
    expect(runtime.uploadUrl).toBe('http://localhost:1337/api/upload');
    expect(runtime.errors).toEqual([]);
  });

  it('falls back to localhost on the iOS simulator when no API URL is provided', () => {
    const runtime = buildRuntimeEndpoints({
      apiPublicUrlEnv: '',
      apiUrlEnv: '',
      appEnv: 'local',
      isDev: true,
      isEmulator: true,
      platformOs: 'ios',
      socketUrlEnv: '',
    });

    expect(runtime.apiUrl).toBe('http://localhost:1337/api');
    expect(runtime.socketUrl).toBe('http://localhost:1337');
    expect(runtime.uploadUrl).toBe('http://localhost:1337/api/upload');
    expect(runtime.source).toBe('ios-simulator-fallback');
    expect(runtime.errors).toEqual([]);
  });

  it('falls back to localhost on the Android emulator when adb reverse override is enabled', () => {
    const runtime = buildRuntimeEndpoints({
      apiPublicUrlEnv: '',
      apiUrlEnv: '',
      appEnv: 'local',
      isDev: true,
      isEmulator: true,
      platformOs: 'android',
      preferAndroidAdbReverse: 'true',
      socketUrlEnv: '',
    });

    expect(runtime.apiUrl).toBe('http://localhost:1337/api');
    expect(runtime.socketUrl).toBe('http://localhost:1337');
    expect(runtime.uploadUrl).toBe('http://localhost:1337/api/upload');
    expect(runtime.source).toBe('android-emulator-localhost-fallback');
    expect(runtime.errors).toEqual([]);
  });

  it('fails clearly on a physical iOS device without explicit local URLs', () => {
    const runtime = buildRuntimeEndpoints({
      apiPublicUrlEnv: '',
      apiUrlEnv: '',
      appEnv: 'local',
      isDev: true,
      isEmulator: false,
      platformOs: 'ios',
      socketUrlEnv: '',
    });

    expect(runtime.errors).toContain(
      'API_URL is missing and no local fallback was available for this device.',
    );
  });

  it('requires API_URL and SOCKET_URL in staging/production', () => {
    const runtime = buildRuntimeEndpoints({
      apiPublicUrlEnv: '',
      apiUrlEnv: '',
      appEnv: 'production',
      isDev: false,
      isEmulator: false,
      platformOs: 'ios',
      socketUrlEnv: '',
    });

    expect(runtime.errors).toContain('API_URL is required for staging/production builds.');
    expect(runtime.errors).toContain('SOCKET_URL is required for staging/production builds.');
  });

  it('fails clearly when a native release build resolves to local app env', () => {
    const runtime = buildRuntimeEndpoints({
      apiPublicUrlEnv: '',
      apiUrlEnv: 'http://10.0.2.2:1337/api',
      appEnv: 'local',
      isDev: false,
      isEmulator: true,
      platformOs: 'android',
      socketUrlEnv: 'http://10.0.2.2:1337',
    });

    expect(runtime.errors).toContain(
      'Release builds cannot use APP_ENV=local. Build this app with staging or production runtime configuration.',
    );
    expect(runtime.errors).toContain(
      'Release builds cannot point API_URL to a loopback host such as localhost or 10.0.2.2.',
    );
  });
});
