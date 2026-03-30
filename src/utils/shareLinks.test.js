import {
  buildFoundClubDeepLink,
  buildInstallLandingUrl,
  buildShareMessageWithUrl,
  resolveShareEnvironment,
  toPublicOrigin,
} from './shareLinks';

describe('shareLinks utils', () => {
  test('toPublicOrigin removes trailing api suffix', () => {
    expect(toPublicOrigin('https://example.com/api')).toBe('https://example.com');
    expect(toPublicOrigin('https://example.com/api/')).toBe('https://example.com');
  });

  test('resolveShareEnvironment keeps production and collapses others to staging', () => {
    expect(resolveShareEnvironment('production')).toBe('production');
    expect(resolveShareEnvironment('staging')).toBe('staging');
    expect(resolveShareEnvironment('local')).toBe('staging');
  });

  test('buildInstallLandingUrl uses stable id and environment-aware params', () => {
    expect(buildInstallLandingUrl({
      apiUrl: 'https://impressive-bat-b03c2eeb7d.strapiapp.com/api',
      env: 'staging',
      id: 'team-doc-123',
      source: 'sms',
      type: 'team',
    })).toBe('https://impressive-bat-b03c2eeb7d.strapiapp.com/install.html?env=staging&id=team-doc-123&source=sms&type=team');
  });

  test('buildFoundClubDeepLink appends invite query only for invite flows', () => {
    expect(buildFoundClubDeepLink({
      id: 'team-doc-123',
      invite: true,
      type: 'team',
    })).toBe('foundclub://team/team-doc-123?invite=true');

    expect(buildFoundClubDeepLink({
      id: 'event-doc-55',
      type: 'event',
    })).toBe('foundclub://event/event-doc-55');
  });

  test('buildShareMessageWithUrl keeps intro and readable link section', () => {
    expect(buildShareMessageWithUrl({
      intro: 'Rejoins mon equipe sur FoundClub.',
      linkLabel: 'Ouvrir dans FoundClub',
      url: 'https://example.com/install.html?type=team&id=abc',
    })).toBe('Rejoins mon equipe sur FoundClub.\n\nOuvrir dans FoundClub :\nhttps://example.com/install.html?type=team&id=abc');
  });
});
