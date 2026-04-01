import { buildRuntimeEndpoints } from './runtimeUrls.shared';

describe('runtimeUrls.shared', () => {
  it('rewrites localhost to the Android emulator host in local dev', () => {
    const runtime = buildRuntimeEndpoints({
      apiPublicUrlEnv: '',
      apiUrlEnv: 'http://localhost:1337/api',
      appEnv: 'local',
      isDev: true,
      isEmulator: true,
      platformOs: 'android',
      socketUrlEnv: 'http://localhost:1337',
    });

    expect(runtime.apiUrl).toBe('http://10.0.2.2:1337/api');
    expect(runtime.socketUrl).toBe('http://10.0.2.2:1337');
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
    expect(runtime.source).toBe('ios-simulator-fallback');
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
});
