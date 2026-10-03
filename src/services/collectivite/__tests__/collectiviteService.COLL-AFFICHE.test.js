import { requeteAfficheInstallation } from '../collectiviteService';

// 🏛️ COLL-AFFICHE (03/10) — L'ADRESSE de l'affiche de l'installation (planche 30 B) et
// l'en-tête du compte : la route est gardée (admin `GET /collectivites/:id/chiffres/affiche`).
// Le client HTTP est un VRAI client axios (même `getUri` que celui de l'app), sans réseau :
// c'est lui qui compose l'adresse.

let mockJeton = /** @type {string | null} */ ('jeton-de-test');

jest.mock('@/services/client', () => {
  const axios = jest.requireActual('axios/dist/browser/axios.cjs');
  return { __esModule: true, default: axios.create({ baseURL: 'https://api.exemple/api' }) };
});
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => (mockJeton ? { token: mockJeton } : null),
}));

describe('COLL-AFFICHE — requeteAfficheInstallation', () => {
  it('l’adresse complète de la route gardée, et le jeton du compte connecté', () => {
    mockJeton = 'jeton-de-test';
    const requete = requeteAfficheInstallation('ville de recette', {
      installation: 'gymnase', semaine: '2026-09-28',
    });
    expect(requete).toEqual({
      headers: { Authorization: 'Bearer jeton-de-test' },
      url: 'https://api.exemple/api/collectivites/ville%20de%20recette/chiffres/affiche'
        + '?installation=gymnase&semaine=2026-09-28',
    });
  });

  it('sans compte connecté, aucun en-tête inventé (le serveur refusera)', () => {
    mockJeton = null;
    const requete = requeteAfficheInstallation('ville', {
      installation: 'dojo', semaine: '2026-10-05',
    });
    expect(requete.headers).toEqual({});
  });
});
