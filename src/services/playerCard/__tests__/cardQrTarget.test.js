// Tests jest de cardQrTarget. On mocke shareLinks (dependance alias @/) pour
// isoler la logique de decision. A executer dans le projet app : `yarn jest cardQrTarget`.
jest.mock('@/utils/shareLinks', () => ({
  buildInstallLandingUrl: ({ id, source, type }) => `https://foundclub.com/install.html?type=${type}&id=${id}&source=${source}`,
  buildPublicWebUrl: ({ path }) => `https://foundclub.app${path}`,
}));

// eslint-disable-next-line import/first
import { buildCardQrTarget, resolveCardQrTarget } from '../cardQrTarget';

describe('cardQrTarget', () => {
  describe('resolveCardQrTarget (pur)', () => {
    test('profil public dispo => url publique', () => {
      const r = resolveCardQrTarget({ installUrl: 'https://inst', isProfilePublic: true, publicUrl: 'https://pub/x' });
      expect(r).toEqual({ kind: 'public', url: 'https://pub/x' });
    });
    test('pas de page publique => install landing', () => {
      const r = resolveCardQrTarget({ installUrl: 'https://inst', isProfilePublic: false, publicUrl: null });
      expect(r).toEqual({ kind: 'install', url: 'https://inst' });
    });
    test('public demande mais url absente => fallback install', () => {
      const r = resolveCardQrTarget({ installUrl: 'https://inst', isProfilePublic: true, publicUrl: null });
      expect(r.kind).toBe('install');
    });
    test('rien => none', () => {
      expect(resolveCardQrTarget({})).toEqual({ kind: 'none', url: '' });
    });
  });

  describe('buildCardQrTarget (integration mockee)', () => {
    test('v1 : install landing tracke type player', () => {
      const r = buildCardQrTarget({ audience: 'player', user: { documentId: 'u1' } });
      expect(r.kind).toBe('install');
      expect(r.url).toContain('type=player');
      expect(r.url).toContain('id=u1');
      expect(r.url).toContain('source=card');
    });
    test('v2 : page publique si isProfilePublic + publicPath', () => {
      const r = buildCardQrTarget({
        audience: 'player',
        isProfilePublic: true,
        publicPath: '/joueurs/u1/sofia-martin',
        user: { documentId: 'u1' },
      });
      expect(r.kind).toBe('public');
      expect(r.url).toBe('https://foundclub.app/joueurs/u1/sofia-martin');
    });
  });
});
