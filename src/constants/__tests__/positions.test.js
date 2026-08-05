import {
  getPositionsForSport,
  getPositionValuesForSport,
  POSITION_GROUPS_BY_SPORT,
  POSITIONS_BY_SPORT,
  sportHasPositions,
  SPORTS_WITH_POSITIONS,
} from '@/constants/positions';

// LOT L44 — `positions.js` est desormais la SEULE liste de postes de l'app :
// l'inscription, l'edition du profil, le site, le recrutement, les detections et
// le mercato la lisent tous. Elle n'avait aucun test.
//
// Ce fichier n'invente rien : il fige ce qui existe, et surtout les INVARIANTS
// dont la rupture a produit le defaut du lot — deux listes qui divergent.
//
// ⚠️ Les valeurs sont des IDENTIFIANTS, pas des libelles : ce sont les chaines
// enregistrees en base sur de vrais comptes. En renommer une orpheline le poste
// des joueurs concernes. Ce test est la pour rendre ce renommage bruyant.

describe('L44 — la liste unique des postes', () => {
  test('5 sports, 38 postes', () => {
    expect(Object.keys(POSITIONS_BY_SPORT)).toHaveLength(5);
    expect(Object.values(POSITIONS_BY_SPORT).flat()).toHaveLength(38);
  });

  test('le football propose 11 postes, dont « Attaquant »', () => {
    expect(getPositionsForSport('football')).toHaveLength(11);
    expect(getPositionValuesForSport('football')).toContain('Attaquant');
  });

  test('le rugby propose ses 10 postes', () => {
    expect(getPositionsForSport('rugby')).toHaveLength(10);
    expect(getPositionValuesForSport('rugby')).toContain('Demi de mêlée');
  });

  // L'inscription enregistre `activity.name` tel que Strapi le nomme, donc avec
  // une majuscule. Les deux portes d'entree doivent la tolerer.
  test('le sport se reconnait quelle que soit la casse', () => {
    expect(getPositionValuesForSport('Football')).toEqual(getPositionValuesForSport('football'));
    expect(sportHasPositions('Rugby')).toBe(true);
  });

  test('un sport inconnu ne rend rien, et ne casse pas', () => {
    expect(getPositionsForSport('padel')).toEqual([]);
    expect(getPositionsForSport(undefined)).toEqual([]);
    expect(sportHasPositions('padel')).toBe(false);
    expect(sportHasPositions(undefined)).toBe(false);
  });

  // L'INVARIANT QUI A CASSE : `authUseCases` decidait de MONTRER ou non l'etape
  // des postes a l'inscription a partir d'une AUTRE liste que celle affichee par
  // l'ecran. Un sport present d'un cote et absent de l'autre = une etape sautee
  // (rugby) ou une etape vide.
  test('les sports « qui ont des postes » sont exactement ceux qui en ont', () => {
    expect([...SPORTS_WITH_POSITIONS].sort()).toEqual(Object.keys(POSITIONS_BY_SPORT).sort());
  });

  // Les familles de postes citent les valeurs par leur chaine : une faute de
  // frappe y fait disparaitre un poste de l'ecran groupe, en silence.
  test('chaque famille ne cite que des postes qui existent', () => {
    Object.entries(POSITION_GROUPS_BY_SPORT).forEach(([sport, familles]) => {
      const connus = getPositionValuesForSport(sport);
      const cites = familles.flatMap((famille) => famille.positions);

      expect(cites.filter((poste) => !connus.includes(poste))).toEqual([]);
      // ... et reciproquement : aucun poste ne doit tomber dans « Autres postes ».
      expect(connus.filter((poste) => !cites.includes(poste))).toEqual([]);
    });
  });

  test('aucun doublon de valeur a l interieur d un sport', () => {
    Object.keys(POSITIONS_BY_SPORT).forEach((sport) => {
      const valeurs = getPositionValuesForSport(sport);
      expect(new Set(valeurs).size).toBe(valeurs.length);
    });
  });
});
