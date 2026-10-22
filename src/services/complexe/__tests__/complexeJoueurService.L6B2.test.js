import client from '@/services/client';

import {
  ajouterAuxFavoris,
  ecrireAuComplexe,
  fermerUneAnnonce,
  lienDInvitation,
  lireLeGroupe,
  lireLesPartenaires,
  lireLInvitation,
  lireMaFidelite,
  lireMaRelationAuComplexe,
  lireMesFavoris,
  lireUneAnnonce,
  ouvrirLaDiscussion,
  publierUneAnnonce,
  quitterLeCanal,
  rejoindreUneAnnonce,
  repondreALaPartie,
  repondreParLeLien,
  retirerDesFavoris,
  signalerUnComplexe,
} from '../complexeJoueurService';

// RESA-L6B-2 (20/10/2026) — le service du JOUEUR suit le contrat d'API « Ajouté après RESA-L3 et
// RESA-L4 » (dépôt méthode `docs/RESERVATION_CONTRAT_API_L1.md`, admin `integ/RESA-admin`
// a91b03c7 : `routes/groupe-custom.ts`, `routes/communaute-custom.ts`). Chaque corps porte
// SEULEMENT ce que le serveur lit (RC-T01) ; les chemins encodent ce qu'ils reçoivent.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { delete: jest.fn(), get: jest.fn(), post: jest.fn() },
}));

const mockClient = /** @type {any} */ (client);

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.get.mockResolvedValue({ data: { data: { lu: true } } });
  mockClient.post.mockResolvedValue({ data: { data: { fait: true } } });
  mockClient.delete.mockResolvedValue({ data: { data: { favori: false } } });
});

describe('RESA-L6B-2 — le groupe d’une réservation (serveur RESA-L3)', () => {
  it('lire le groupe, répondre présent / absent', async () => {
    expect(await lireLeGroupe('r 1')).toEqual({ data: { lu: true } });
    expect(mockClient.get).toHaveBeenCalledWith('/reservations-terrain/r%201/groupe');
    await repondreALaPartie('r-1', 'present');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/reservations-terrain/r-1/reponse',
      { data: { reponse: 'present' } },
    );
  });

  it('le lien : l’activer, le désactiver', async () => {
    await lienDInvitation('r-1', true);
    expect(mockClient.post).toHaveBeenCalledWith(
      '/reservations-terrain/r-1/lien',
      { data: { actif: true } },
    );
    await lienDInvitation('r-1', false);
    expect(mockClient.post).toHaveBeenLastCalledWith(
      '/reservations-terrain/r-1/lien',
      { data: { actif: false } },
    );
  });

  it('la page du lien (sans compte), répondre par le lien (avec un compte)', async () => {
    await lireLInvitation('K7Q2M9');
    expect(mockClient.get).toHaveBeenCalledWith('/public-reservations/K7Q2M9');
    await repondreParLeLien('K7Q2M9', 'absent');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/reservations-terrain/lien/K7Q2M9/reponse',
      { data: { reponse: 'absent' } },
    );
  });

  it('la discussion du groupe, « Écrire au complexe » : un corps vide', async () => {
    await ouvrirLaDiscussion('r-1');
    expect(mockClient.post).toHaveBeenCalledWith('/reservations-terrain/r-1/discussion', {});
    await ecrireAuComplexe('r-1');
    expect(mockClient.post).toHaveBeenCalledWith('/reservations-terrain/r-1/conversation', {});
  });

  it('l’annonce : publier (places, niveau, favoris), lire, rejoindre, fermer', async () => {
    await publierUneAnnonce('r-1', { level: null, notifyFavorites: true, places: 2 });
    expect(mockClient.post).toHaveBeenCalledWith(
      '/reservations-terrain/r-1/annonce',
      { data: { notifyFavorites: true, places: 2 } },
    );
    await publierUneAnnonce('r-1', { level: 'loisir', notifyFavorites: false, places: 1 });
    expect(mockClient.post).toHaveBeenLastCalledWith(
      '/reservations-terrain/r-1/annonce',
      { data: { level: 'loisir', notifyFavorites: false, places: 1 } },
    );
    await lireUneAnnonce('a-1');
    expect(mockClient.get).toHaveBeenCalledWith('/annonces-reservation/a-1');
    await rejoindreUneAnnonce('a-1');
    expect(mockClient.post).toHaveBeenCalledWith('/annonces-reservation/a-1/rejoindre', {});
    await fermerUneAnnonce('a-1');
    expect(mockClient.post).toHaveBeenCalledWith('/annonces-reservation/a-1/fermer', {});
  });
});

describe('RESA-L6B-2 — la communauté du joueur (serveur RESA-L4)', () => {
  it('les favoris : lister, ajouter (origine), retirer (le canal gardé, ou quitté)', async () => {
    await lireMesFavoris();
    expect(mockClient.get).toHaveBeenCalledWith('/complexes-favoris/mine');
    await ajouterAuxFavoris('le-five', 'affiche');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/complexes-favoris',
      { data: { complexe: 'le-five', origin: 'affiche' } },
    );
    await ajouterAuxFavoris('le-five');
    expect(mockClient.post).toHaveBeenLastCalledWith(
      '/complexes-favoris',
      { data: { complexe: 'le-five', origin: 'bouton' } },
    );
    await retirerDesFavoris('le five');
    expect(mockClient.delete).toHaveBeenCalledWith('/complexes-favoris/le%20five', undefined);
    await retirerDesFavoris('le-five', { quitterCanal: true });
    expect(mockClient.delete).toHaveBeenLastCalledWith(
      '/complexes-favoris/le-five',
      { params: { quitterCanal: true } },
    );
  });

  it('ma relation au complexe, ma fidélité, quitter le canal', async () => {
    await lireMaRelationAuComplexe('le-five');
    expect(mockClient.get).toHaveBeenCalledWith('/complexes-moi/le-five');
    await lireMaFidelite();
    expect(mockClient.get).toHaveBeenCalledWith('/complexes-fidelite/mine');
    await quitterLeCanal('le-five');
    expect(mockClient.post).toHaveBeenCalledWith('/complexes-canal/le-five/quitter', {});
  });

  it('signaler : le slug, le motif (liste fermée), le mot s’il est écrit', async () => {
    await signalerUnComplexe({ complexe: 'le-five', details: '  ', motif: 'autre' });
    expect(mockClient.post).toHaveBeenCalledWith(
      '/complexes-signalements',
      { data: { complexe: 'le-five', motif: 'autre' } },
    );
    await signalerUnComplexe({
      complexe: 'le-five', details: ' Fermé  depuis un an ', motif: 'inexistant',
    });
    expect(mockClient.post).toHaveBeenLastCalledWith(
      '/complexes-signalements',
      { data: { complexe: 'le-five', details: 'Fermé depuis un an', motif: 'inexistant' } },
    );
  });

  it('les partenaires, sans compte', async () => {
    await lireLesPartenaires('le-five');
    expect(mockClient.get).toHaveBeenCalledWith('/public-complexes/le-five/partenaires');
  });
});
