import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { useComplexePublic, usePagesDesComplexes } from '@/services/complexe/complexeJoueurQueries';

// RESA-CARTE (20/10/2026) — LES POSITIONS DES COMPLEXES DE LA VUE CARTE (E-P01). La recherche du
// serveur ne rend pas la position d'un complexe ; sa page publique, si. Ce témoin tient les trois
// règles de la lecture : rien n'est lu quand la carte n'est pas montrée (`enabled` faux) ; une
// page par complexe, rangée par slug ; la MÊME mémoire que la page du complexe (E-P02), donc pas
// de seconde lecture d'une page déjà ouverte.

const mockLectures = /** @type {string[]} */ ([]);
jest.mock('@/services/complexe/complexeJoueurService', () => ({
  lireComplexePublic: async (/** @type {string} */ slug) => {
    mockLectures.push(slug);
    return { data: { address: { lat: 48.8, lng: 1.4 }, name: `Complexe ${slug}`, slug } };
  },
}));

const mockVu = { dernier: /** @type {any} */ (null) };

/**
 * Le crochet, monté dans un composant.
 * @param {{ enabled: boolean, slugs: string[] }} props - Les propriétés.
 * @returns {null} Rien à dessiner.
 */
function Sonde({ enabled, slugs }) {
  mockVu.dernier = usePagesDesComplexes(slugs, { enabled });
  return null;
}

/**
 * La page d'UN complexe, comme E-P02 la lit.
 * @param {{ slug: string }} props - Les propriétés.
 * @returns {null} Rien à dessiner.
 */
function PageDuComplexe({ slug }) {
  useComplexePublic(slug);
  return null;
}

const nouveauClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * Monte des composants sous un client de requêtes et laisse les lectures finir.
 * @param {QueryClient} client - Le client.
 * @param {import('react').ReactElement} enfants - Les composants.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (client, enfants) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<QueryClientProvider client={client}>{enfants}</QueryClientProvider>);
  });
  await act(async () => {
    await new Promise((fin) => {
      setTimeout(fin, 0);
    });
  });
  return arbre;
};

beforeEach(() => {
  mockLectures.length = 0;
  mockVu.dernier = null;
});

describe('RESA-CARTE — usePagesDesComplexes', () => {
  it('carte cachée (`enabled` faux) : AUCUNE page lue', async () => {
    const arbre = await monter(nouveauClient(), <Sonde enabled={false} slugs={['a', 'b']} />);
    expect(mockLectures).toEqual([]);
    expect(mockVu.dernier).toEqual({ enCours: false, pages: {} });
    act(() => arbre.unmount());
  });

  it('carte montrée : une page par complexe, rangée par slug', async () => {
    const arbre = await monter(nouveauClient(), <Sonde enabled slugs={['a', 'b']} />);
    expect([...mockLectures].sort()).toEqual(['a', 'b']);
    expect(mockVu.dernier.enCours).toBe(false);
    expect(Object.keys(mockVu.dernier.pages).sort()).toEqual(['a', 'b']);
    expect(mockVu.dernier.pages.b.address).toEqual({ lat: 48.8, lng: 1.4 });
    act(() => arbre.unmount());
  });

  it('la page déjà lue par E-P02 n’est pas relue (même mémoire)', async () => {
    const client = nouveauClient();
    const page = await monter(client, <PageDuComplexe slug="a" />);
    expect(mockLectures).toEqual(['a']);
    const carte = await monter(client, <Sonde enabled slugs={['a', 'b']} />);
    expect(mockLectures).toEqual(['a', 'b']);
    expect(Object.keys(mockVu.dernier.pages).sort()).toEqual(['a', 'b']);
    act(() => {
      page.unmount();
      carte.unmount();
    });
  });
});
