import { clefDuRole, libelleDuRole } from './roleDuMembre';

// MSG1BA (§3.1) — le libelle sous le nom d'un membre, dans « Infos du groupe ».
// Le pack montre « Entraîneur », « Joueur »... ; l'app ecrivait « Membre » pour tout le monde.

const t = (/** @type {string} */ _cle, /** @type {string} */ repli) => repli;

describe('roleDuMembre (§3.1)', () => {
  test('RM1 — les noms du serveur (accents, anglais) ramenes a une clef', () => {
    expect(clefDuRole('Entraîneur')).toBe('entraineur');
    expect(clefDuRole('Coach')).toBe('entraineur');
    expect(clefDuRole('Dirigeant')).toBe('dirigeant');
    expect(clefDuRole('President')).toBe('dirigeant');
    expect(clefDuRole('Joueur')).toBe('joueur');
    expect(clefDuRole('Parent')).toBe('parent');
  });

  test('RM2 — un role qui ne dit rien d un club (ou absent) reste « Membre »', () => {
    expect(libelleDuRole('SuperAdmin', t)).toBe('Membre');
    expect(libelleDuRole('Authenticated', t)).toBe('Membre');
    expect(libelleDuRole(undefined, t)).toBe('Membre');
  });

  test('RM3 — `genre A` : un seul libelle par role, sans genre', () => {
    expect(libelleDuRole('Dirigeant', t)).toBe('Dirigeant');
    expect(libelleDuRole('Entraîneur', t)).toBe('Entraîneur');
    expect(libelleDuRole('Joueur', t)).toBe('Joueur');
  });
});
