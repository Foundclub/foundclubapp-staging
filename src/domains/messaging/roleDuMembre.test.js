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

  // R17-ROLES (REC17-006) : « Pratiquant / Joueur » et « Coach / Prof », pour parler a tout
  // le monde.
  test('RM3 — `genre A` : un seul libelle par role, sans genre', () => {
    expect(libelleDuRole('Dirigeant', t)).toBe('Dirigeant');
    expect(libelleDuRole('Entraîneur', t)).toBe('Coach / Prof');
    expect(libelleDuRole('Joueur', t)).toBe('Pratiquant / Joueur');
  });

  // R17-ROLES : le nom technique du serveur (« Entraineur », sans accent) ne s'affiche plus brut.
  test('RM4 — le nom technique du serveur passe par la meme table', () => {
    expect(libelleDuRole('Entraineur', t)).toBe('Coach / Prof');
    expect(libelleDuRole('entraineur', t)).toBe('Coach / Prof');
  });

  // R17-ROLES : la console garde « SuperAdmin » ; un ecran d'evenement garde son propre « Membre ».
  test('RM5 — un role hors club rend le repli demande, s il y en a un', () => {
    expect(libelleDuRole('SuperAdmin', t, 'SuperAdmin')).toBe('SuperAdmin');
    expect(libelleDuRole('Entraineur', t, 'Entraineur')).toBe('Coach / Prof');
    expect(libelleDuRole(undefined, t, '')).toBe('');
  });
});
