import {
  DUREE_DU_LIEN_RETENU_MS,
  lienDeLaVilleRetenu,
  oublierLienDeLaVille,
  retenirLienDeLaVille,
} from './lienDeLaVille';

// 🏛️ COLL-ACCUEIL-BIS (03/10/2026) — PLANCHE 38, LE RETOUR AUTOMATIQUE : le lien de la Ville est
// RETENU sur l'appareil quand le club touche « Inscrire mon club » (il survit au détour par la
// connexion ou l'inscription), puis lu par la création du club, qui l'envoie au serveur. Borné :
// un lien retenu il y a plus de 48 h ne vaut plus (un club créé bien plus tard n'a peut-être plus
// rien à voir avec cette Ville). ROUGE avant le lot (le module n'existait pas).

const mockRangement = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRangement.get(cle),
  removeItem: (/** @type {string} */ cle) => { mockRangement.delete(cle); },
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRangement.set(cle, valeur);
  },
}));

const MAINTENANT = Date.parse('2026-10-03T10:00:00.000Z');

beforeEach(() => mockRangement.clear());

describe('COLL-ACCUEIL-BIS — le lien de la Ville retenu sur l appareil', () => {
  it('retenu, il se relit tant qu il a moins de 48 h', () => {
    retenirLienDeLaVille('CodeDeLaVille0123456789ab', MAINTENANT);
    expect(lienDeLaVilleRetenu(MAINTENANT + 1000)).toBe('CodeDeLaVille0123456789ab');
    expect(lienDeLaVilleRetenu(MAINTENANT + DUREE_DU_LIEN_RETENU_MS - 1))
      .toBe('CodeDeLaVille0123456789ab');
  });

  it('au-delà de 48 h, il ne vaut plus', () => {
    retenirLienDeLaVille('CodeDeLaVille0123456789ab', MAINTENANT);
    expect(lienDeLaVilleRetenu(MAINTENANT + DUREE_DU_LIEN_RETENU_MS + 1)).toBeNull();
  });

  it('oublié, il ne se relit plus ; rien de retenu : null', () => {
    expect(lienDeLaVilleRetenu(MAINTENANT)).toBeNull();
    retenirLienDeLaVille('CodeDeLaVille0123456789ab', MAINTENANT);
    oublierLienDeLaVille();
    expect(lienDeLaVilleRetenu(MAINTENANT)).toBeNull();
  });

  it('un rangement abîmé, ou un lien vide, ne vaut rien (jamais d exception)', () => {
    mockRangement.set('coll-invitation-ville', '{pas du json');
    expect(lienDeLaVilleRetenu(MAINTENANT)).toBeNull();
    retenirLienDeLaVille('', MAINTENANT);
    expect(lienDeLaVilleRetenu(MAINTENANT)).toBeNull();
  });
});

// LIENS-APP (07/10/2026) — REVENIR AU LIEN APRÈS LA CONNEXION. Le lien de la Ville ouvert sans
// compte mène à la connexion ; une fois connecté, l'app doit revenir à la page du lien. Un repère
// À PART du lien retenu 48 h : celui-là attend la création d'un club, celui-ci ne sert qu'une
// fois, juste après la connexion. Borné à 1 h. ROUGE avant le lot (les fonctions n'existaient pas).
describe('LIENS-APP — le retour au lien après la connexion', () => {
  // eslint-disable-next-line global-require
  const lien = () => require('./lienDeLaVille');

  it('retenu, il se relit pendant 1 h, puis ne vaut plus', () => {
    const { DUREE_DU_RETOUR_MS, retenirLeRetourAuLien, retourAuLienEnAttente } = lien();
    expect(DUREE_DU_RETOUR_MS).toBe(60 * 60 * 1000);
    retenirLeRetourAuLien('CodeDeLaVille0123456789ab', MAINTENANT);
    expect(retourAuLienEnAttente(MAINTENANT + 1000)).toBe('CodeDeLaVille0123456789ab');
    expect(retourAuLienEnAttente(MAINTENANT + DUREE_DU_RETOUR_MS + 1)).toBeNull();
  });

  it('oublié, il ne se relit plus ; il ne touche pas au lien retenu 48 h', () => {
    const { oublierLeRetourAuLien, retenirLeRetourAuLien, retourAuLienEnAttente } = lien();
    retenirLienDeLaVille('LienRetenu', MAINTENANT);
    retenirLeRetourAuLien('LienDuRetour', MAINTENANT);
    oublierLeRetourAuLien();
    expect(retourAuLienEnAttente(MAINTENANT)).toBeNull();
    expect(lienDeLaVilleRetenu(MAINTENANT)).toBe('LienRetenu');
  });

  it('le chemin partagé par la Ville est celui de la page du lien', () => {
    expect(lien().cheminDuLienDeLaVille('abc')).toBe('/invitation-ville/abc');
  });
});
