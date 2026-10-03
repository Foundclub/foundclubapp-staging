import { requeteAfficheInstallation } from '../collectiviteService';

// 🏛️ COLL-AFFICHE-2 (03/10) — L'ADRESSE de l'affiche de la SAISON (décision d'Adel « saison A ») :
// la même route gardée, avec `periode=saison` et sans semaine (le serveur prend la saison de
// maintenant ; admin docs/CONTRAT_CHIFFRES_VILLE.md §7 ter). La semaine garde son adresse.
// Le client HTTP est un VRAI client axios (même `getUri` que celui de l'app), sans réseau.

jest.mock('@/services/client', () => {
  const axios = jest.requireActual('axios/dist/browser/axios.cjs');
  return { __esModule: true, default: axios.create({ baseURL: 'https://api.exemple/api' }) };
});
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => ({ token: 'jeton-de-test' }),
}));

describe('COLL-AFFICHE-2 — requeteAfficheInstallation, la saison', () => {
  it('l’affiche de la saison : `periode=saison`, aucune semaine', () => {
    expect(requeteAfficheInstallation('ville', { installation: 'gymnase', periode: 'saison' })).toEqual({
      headers: { Authorization: 'Bearer jeton-de-test' },
      url: 'https://api.exemple/api/collectivites/ville/chiffres/affiche?installation=gymnase&periode=saison',
    });
  });

  it('la semaine garde son adresse, même si une semaine traîne avec la saison', () => {
    expect(requeteAfficheInstallation('ville', { installation: 'dojo', semaine: '2026-10-05' }).url)
      .toBe('https://api.exemple/api/collectivites/ville/chiffres/affiche?installation=dojo&semaine=2026-10-05');
    expect(requeteAfficheInstallation('ville', {
      installation: 'dojo', periode: 'saison', semaine: '2026-10-05',
    }).url).toBe('https://api.exemple/api/collectivites/ville/chiffres/affiche?installation=dojo&periode=saison');
  });
});
