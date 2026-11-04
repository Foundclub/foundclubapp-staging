import { useEvenementsPublicsDeLaVille } from '../collectiviteEvenementQueries';
import { getEvenementsPublicsDeLaVille } from '../collectiviteEvenementService';

// 🏛️ T4-EVENEMENT-PROXIMITE (décision d'Adel « 5- C » du 03/11/2026) — ce que la recherche demande :
// un mot passe seul, il trouve de loin ; le lieu des filtres ne part que sans mot ; sans lui, rien
// ne part et le serveur lit l'adresse du compte (elle ne passe jamais dans l'adresse de la requête).

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(),
  useQueries: jest.fn(),
  useQuery: (/** @type {any} */ options) => options,
  useQueryClient: jest.fn(),
}));
jest.mock('../collectiviteEvenementService', () => ({
  getEvenementsPublicsDeLaVille: jest.fn(async () => ({ data: [] })),
}));

const LYON = { lat: 45.76, lon: 4.84, radius: 30 };
/**
 * Ce que le hook envoie, et sa clé de cache.
 * @param {string} [mot] - Le mot tapé.
 * @param {any} [lieu] - Le lieu des filtres.
 * @returns {Promise<{ cle: any[], params: any }>} La demande.
 */
const demande = async (mot, lieu) => {
  const options = /** @type {any} */ (useEvenementsPublicsDeLaVille(mot, lieu));
  await options.queryFn();
  return {
    cle: options.queryKey,
    params: /** @type {any} */ (getEvenementsPublicsDeLaVille).mock.lastCall[0],
  };
};

describe('T4-EVENEMENT-PROXIMITE — ce que la recherche demande', () => {
  it('🔴 sans mot, le lieu des filtres part, et change la clé de cache', async () => {
    const { cle, params } = await demande('', LYON);
    expect(params).toEqual(LYON);
    expect(cle).not.toEqual((await demande('', null)).cle);
  });

  it('🔴 avec un mot, le mot seul part : il trouve de loin', async () => {
    const { params } = await demande('fête', LYON);
    expect(params).toEqual({ q: 'fête' });
  });

  it('sans mot ni lieu, rien ne part', async () => {
    expect((await demande('', null)).params).toEqual({});
    expect((await demande()).params).toEqual({});
  });

  it('les clés restent sous « evenements-de-la-ville », que les gestes de la Ville relisent', async () => {
    expect((await demande('', LYON)).cle.slice(0, 2)).toEqual(['evenements-de-la-ville', 'publics']);
  });
});
