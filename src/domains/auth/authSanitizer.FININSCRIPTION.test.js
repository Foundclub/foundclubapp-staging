// FIN-INSCRIPTION p1 (02/11) : le serveur rend l'adresse en OBJET ; le nettoyage la passait par
// normalizeString, qui rend null pour tout ce qui n'est pas un texte. Conséquence mesurée sur le
// site (Dina) : /me renvoie Marseille 6e, `foundclub:web.session`.user.address reste null, la
// ligne Ville de « Mes informations » est vide et l'alerte n'est pas préremplie.
import { haveSameSanitizedUser, sanitizeUser } from './authSanitizer';

const MARSEILLE_6E = {
  city: 'Marseille 6e Arrondissement',
  label: 'Marseille 6e Arrondissement (13006)',
  lat: 43.287545,
  lng: 5.381329,
  postcode: '13006',
  value: '5.381329|43.287545',
};

// La réponse de /me relevée sur la recette le 02/11 (Dina), plus une rue d'ancien format.
const REPONSE_DU_SERVEUR = {
  ...MARSEILLE_6E,
  bbox: null,
  context: '13, Bouches-du-Rhône, Provence-Alpes-Côte d\'Azur',
  provider: 'ban',
  providerId: '13206',
  street: 'rue de la Paix',
  type: 'municipality',
};

describe('authSanitizer - FIN-INSCRIPTION, adresse du profil', () => {
  test('une adresse en objet traverse le nettoyage, avec les seuls champs que les écrans lisent', () => {
    expect(sanitizeUser({ address: REPONSE_DU_SERVEUR, documentId: 'u1' }).address)
      .toEqual(MARSEILLE_6E);
  });

  test('une adresse en texte reste un texte, une adresse vide reste null', () => {
    expect(sanitizeUser({ address: ' Marseille ', documentId: 'u1' }).address).toBe('Marseille');
    expect(sanitizeUser({ address: '', documentId: 'u1' }).address).toBeNull();
    expect(sanitizeUser({ address: null, documentId: 'u1' }).address).toBeNull();
  });

  test('une ville changée change la signature', () => {
    const avant = { address: MARSEILLE_6E, documentId: 'u1' };
    const apres = { address: { ...MARSEILLE_6E, city: 'Lyon', label: 'Lyon' }, documentId: 'u1' };
    expect(haveSameSanitizedUser(avant, apres)).toBe(false);
    expect(haveSameSanitizedUser(avant, { ...avant })).toBe(true);
  });
});
