import {
  colonnesDuTonMode,
  dansLeMenuDuSite,
  demanderLAnnonceDArrivee,
  positionActive,
  positionsDuCompte,
  prendreLAnnonceDArrivee,
} from './tonMode';

// RESA-BASCULE (20/10/2026) — les règles de la planche RB-3 validée : seulement les modes du
// compte, ordre fixe Complexe · Dirigeant (ou Coach) · Joueur · Parent, 4 positions en 2 × 2, 1 par
// rangée en texte très agrandi, dans le menu du site à partir de 1 024 px. Écrit ROUGE (le module
// n'existait pas).

const cles = (/** @type {any[]} */ positions) => positions.map((p) => `${p.cle}:${p.mode}`);

describe('RB-3 — les positions d un compte, dans l ordre fixe', () => {
  it('1 · gérant + joueur : Complexe · Joueur', () => {
    expect(cles(positionsDuCompte({
      aDesEnfants: false, aUnComplexe: true, peutJouer: false, roleDuCompte: 'player',
    }))).toEqual(['complexe:null', 'joueur:null']);
  });

  it('2 · gérant + compte Parent : Complexe · Parent (sans mode joueur)', () => {
    expect(cles(positionsDuCompte({
      aDesEnfants: true, aUnComplexe: true, peutJouer: false, roleDuCompte: 'parent',
    }))).toEqual(['complexe:null', 'parent:null']);
  });

  it('3 · gérant + joueur avec un enfant : Complexe · Joueur · Parent', () => {
    expect(cles(positionsDuCompte({
      aDesEnfants: true, aUnComplexe: true, peutJouer: false, roleDuCompte: 'player',
    }))).toEqual(['complexe:null', 'joueur:null', 'parent:parent']);
  });

  it('4 · dirigeant qui joue, avec enfants : Complexe · Dirigeant · Joueur · Parent', () => {
    expect(cles(positionsDuCompte({
      aDesEnfants: true, aUnComplexe: true, peutJouer: true, roleDuCompte: 'president',
    }))).toEqual(['complexe:null', 'dirigeant:null', 'joueur:player', 'parent:parent']);
  });

  it('4b · un coach : « Coach » à la place de « Dirigeant »', () => {
    expect(cles(positionsDuCompte({
      aDesEnfants: true, aUnComplexe: true, peutJouer: true, roleDuCompte: 'coach',
    }))).toEqual(['complexe:null', 'coach:null', 'joueur:player', 'parent:parent']);
  });

  it('un dirigeant qui ne joue pas et n a pas d enfant : Complexe · Dirigeant', () => {
    expect(cles(positionsDuCompte({
      aDesEnfants: false, aUnComplexe: true, peutJouer: false, roleDuCompte: 'president',
    }))).toEqual(['complexe:null', 'dirigeant:null']);
  });

  it('un seul mode (compte né « pour un complexe », super admin) : une seule position', () => {
    ['new', 'superAdmin', ''].forEach((roleDuCompte) => {
      expect(cles(positionsDuCompte({
        aDesEnfants: true, aUnComplexe: true, peutJouer: true, roleDuCompte,
      }))).toEqual(['complexe:null']);
    });
  });

  it('sans complexe, pas de position Complexe', () => {
    expect(cles(positionsDuCompte({
      aDesEnfants: true, aUnComplexe: false, peutJouer: false, roleDuCompte: 'player',
    }))).toEqual(['joueur:null', 'parent:parent']);
  });

  it('« peutJouer » ne vaut que pour qui encadre : un joueur l est déjà', () => {
    expect(cles(positionsDuCompte({
      aDesEnfants: false, aUnComplexe: true, peutJouer: true, roleDuCompte: 'player',
    }))).toEqual(['complexe:null', 'joueur:null']);
  });
});

describe('RB-3 — la position allumée', () => {
  it('dans l espace du complexe : Complexe, quel que soit le mode gardé', () => {
    expect(positionActive({ dansLeComplexe: true, modeAffiche: 'parent', roleDuCompte: 'player' }))
      .toBe('complexe');
  });

  it('le mode d affichage actif l emporte sur le rôle du compte', () => {
    expect(positionActive({ dansLeComplexe: false, modeAffiche: 'player', roleDuCompte: 'coach' }))
      .toBe('joueur');
    expect(positionActive({ dansLeComplexe: false, modeAffiche: 'parent', roleDuCompte: 'player' }))
      .toBe('parent');
  });

  it('sans mode : la position du rôle du compte', () => {
    expect(['president', 'coach', 'player', 'parent', 'new'].map((roleDuCompte) => positionActive({
      dansLeComplexe: false, modeAffiche: null, roleDuCompte,
    }))).toEqual(['dirigeant', 'coach', 'joueur', 'parent', null]);
  });
});

describe('RB-3 — la disposition (T2 A)', () => {
  it('2 ou 3 positions : une ligne ; 4 : deux rangées de deux', () => {
    expect(colonnesDuTonMode({ largeur: 326, nombre: 2 })).toBe(2);
    expect(colonnesDuTonMode({ largeur: 326, nombre: 3 })).toBe(3);
    expect(colonnesDuTonMode({ largeur: 326, nombre: 4 })).toBe(2);
    expect(colonnesDuTonMode({ nombre: 4 })).toBe(2);
  });

  it('trois positions tiennent dès un téléphone de 360 px (93 px chacune)', () => {
    // 360 − 2 × 16 (marges de l'écran) − 2 × 16 (la carte) = 296 ; (296 − 2 × 8) / 3 = 93.
    expect(colonnesDuTonMode({ largeur: 296, nombre: 3 })).toBe(3);
  });

  it('texte très agrandi : une position par rangée, rien n est coupé', () => {
    expect(colonnesDuTonMode({ echelleDuTexte: 1.3, largeur: 326, nombre: 3 })).toBe(1);
    expect(colonnesDuTonMode({ echelleDuTexte: 2, largeur: 326, nombre: 4 })).toBe(1);
  });
});

describe('RB-3 — sur le site, la bascule vit dans le menu quand l espace en a un', () => {
  const site = { largeur: 1360, plateforme: 'web' };
  it('l espace du complexe, et le club d un dirigeant ou d un coach, à partir de 1 024 px', () => {
    expect(dansLeMenuDuSite({ ...site, dansLeComplexe: true, roleDuCompte: 'player' })).toBe(true);
    expect(dansLeMenuDuSite({ ...site, dansLeComplexe: false, roleDuCompte: 'president' }))
      .toBe(true);
    expect(dansLeMenuDuSite({ ...site, dansLeComplexe: false, roleDuCompte: 'coach' })).toBe(true);
  });

  it('un joueur ou un parent n a pas de menu : en tête de l accueil', () => {
    expect(dansLeMenuDuSite({ ...site, dansLeComplexe: false, roleDuCompte: 'player' }))
      .toBe(false);
    expect(dansLeMenuDuSite({ ...site, dansLeComplexe: false, roleDuCompte: 'parent' }))
      .toBe(false);
  });

  it('sous 1 024 px, et sur téléphone ou tablette : jamais dans un menu', () => {
    expect(dansLeMenuDuSite({
      dansLeComplexe: true, largeur: 390, plateforme: 'web', roleDuCompte: 'president',
    })).toBe(false);
    expect(dansLeMenuDuSite({
      dansLeComplexe: true, largeur: 1366, plateforme: 'ios', roleDuCompte: 'president',
    })).toBe(false);
  });
});

describe('RB-3 — l annonce d arrivée dans le complexe (5b), à un coup', () => {
  it('demandée par la bascule, prise une seule fois', () => {
    expect(prendreLAnnonceDArrivee()).toBe(false);
    demanderLAnnonceDArrivee();
    expect(prendreLAnnonceDArrivee()).toBe(true);
    expect(prendreLAnnonceDArrivee()).toBe(false);
  });
});
