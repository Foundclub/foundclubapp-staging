import {
  buildFoundClubDeepLink,
  buildInstallLandingUrl,
  buildPublicEventUrl,
  buildPublicWebUrl,
  buildShareMessageWithUrl,
  resolveShareEnvironment,
  resolveWebAppOrigin,
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
      invite: true,
      source: 'sms',
      type: 'team',
    })).toBe('https://impressive-bat-b03c2eeb7d.strapiapp.com/install.html?env=staging&id=team-doc-123&invite=true&source=sms&type=team');
  });

  test('resolveWebAppOrigin prefers configured web URL and trims trailing slashes', () => {
    expect(resolveWebAppOrigin({
      apiUrl: 'https://api.example.com/api',
      publicOrigin: 'https://public.example.com',
      webUrl: 'https://foundclub.app/',
    })).toBe('https://foundclub.app');
  });

  test('resolveWebAppOrigin avoids falling back to the API host for public web links', () => {
    expect(resolveWebAppOrigin({
      apiUrl: 'https://api.foundclubpro.com/api',
      publicOrigin: 'https://api.foundclubpro.com',
    })).toBe('https://foundclub.app');
  });

  test('buildPublicEventUrl targets the public event page', () => {
    expect(buildPublicEventUrl({
      apiUrl: 'https://api.example.com/api',
      eventId: 'event-doc-55',
      webUrl: 'https://foundclub.app',
    })).toBe('https://foundclub.app/events/event-doc-55');
  });

  test('buildPublicWebUrl builds shared public routes from the configured web origin', () => {
    expect(buildPublicWebUrl({
      path: '/licenses/pay/demo-token',
      webUrl: 'https://foundclub.app/',
    })).toBe('https://foundclub.app/licenses/pay/demo-token');
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

    expect(buildFoundClubDeepLink({
      id: 'squad-doc-9',
      invite: true,
      type: 'league-team',
    })).toBe('foundclub://squad/squad-doc-9?invite=true');
  });

  test('buildShareMessageWithUrl keeps intro and readable link section', () => {
    expect(buildShareMessageWithUrl({
      intro: 'Rejoins mon équipe sur FoundClub.',
      linkLabel: 'Ouvrir dans FoundClub',
      url: 'https://example.com/install.html?type=team&id=abc',
    })).toBe('Rejoins mon équipe sur FoundClub.\n\nOuvrir dans FoundClub :\nhttps://example.com/install.html?type=team&id=abc');
  });
});
