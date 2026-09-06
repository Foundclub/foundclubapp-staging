import {
  buildAutoPlacementsByDeclaredPosition,
  getFootballFormatFromCategory,
  getMatchFormationByKey,
  getMatchFormations,
} from '../matchFormationCatalog';

// 🎁 LOT TERRAIN — CHANTIERS B et C.
//
// B : un sport n'avait qu'UNE disposition en dur. Il en a maintenant une LISTE
//     nommee, et le football en a une par FORMAT (a 11, a 8, a 5).
// C : le coach choisit « 4-4-2 » et l'app place deja chaque convoque sur son
//     poste declare. Il corrige deux jetons au lieu d'en poser onze.
//
// 🔒 LES 2 REGLES QUI NE DOIVENT JAMAIS TOMBER, et c'est pour elles que ce
// fichier existe :
//   · un joueur SANS poste declare reste au BANC — jamais pose au hasard,
//     parce qu'un placement faux est pire qu'un terrain vide : le coach ne le
//     voit pas ;
//   · deux joueurs qui visent la meme case ne se mangent pas : premier arrive
//     premier servi, et le second reste au banc, ou il est visible.

const joueur = (id, position) => ({
  documentId: id, firstname: id, lastname: 'Test', position,
});

/**
 * Les libelles des postes vraiment tenus, dans l'ordre des placements.
 * @param {any} formation
 * @param {any[]} placements
 * @returns {Array<string | undefined>}
 */
const libellesTenus = (formation, placements) => {
  const parSlot = new Map(
    formation.slots.map((slot, index) => [`team_1:slot_${index + 1}`, slot.label]),
  );
  return placements.map((placement) => parSlot.get(placement.slotId));
};

describe('TERRAIN T3 — chaque formation livree a le bon nombre de postes', () => {
  const attendu = [
    // [sport, categorie, cle, nombre de postes]
    ['Football', 'U15 (15 ans)', '4-3-3', 11],
    ['Football', 'U15 (15 ans)', '4-4-2', 11],
    ['Football', 'U15 (15 ans)', '4-2-3-1', 11],
    ['Football', 'U15 (15 ans)', '3-5-2', 11],
    ['Football', 'U15 (15 ans)', '5-3-2', 11],
    ['Football', 'U11 (11 ans)', '3-3-1', 8],
    ['Football', 'U11 (11 ans)', '3-1-3', 8],
    ['Football', 'U8 (8 ans)', '1-2-1', 5],
    ['Football', 'U8 (8 ans)', '2-2', 5],
    ['Futsal', '', '1-2-1', 5],
    ['Futsal', '', '2-2', 5],
    ['Basketball', '', '1-3-1', 5],
    ['Basketball', '', '2-3', 5],
    ['Handball', '', '5-1', 7],
    ['Handball', '', '3-2-1', 7],
    ['Volleyball', '', '5-1', 6],
    ['Volleyball', '', '4-2', 6],
    ['Rugby à XIII', '', 'xiii', 13],
  ];

  test.each(attendu)('%s %s — « %s » rend %i postes', (sport, categorie, cle, nombre) => {
    const formation = getMatchFormationByKey(sport, categorie, cle);
    expect(formation).toBeTruthy();
    expect(formation.slots).toHaveLength(nombre);
    expect(formation.starters).toBe(nombre);
  });

  test('AUCUNE formation ne porte un poste sans libelle ni une case hors terrain', () => {
    const tous = [
      ...getMatchFormations('Football', 'Sénior (+18 ans)'),
      ...getMatchFormations('Football', 'U11 (11 ans)'),
      ...getMatchFormations('Football', 'U8 (8 ans)'),
      ...getMatchFormations('Futsal', ''),
      ...getMatchFormations('Basketball', ''),
      ...getMatchFormations('Handball', ''),
      ...getMatchFormations('Volleyball', ''),
      ...getMatchFormations('Rugby', ''),
      ...getMatchFormations('Rugby à XIII', ''),
    ];
    expect(tous.length).toBeGreaterThan(15);

    tous.forEach((formation) => {
      expect(String(formation.label).trim()).not.toBe('');
      expect(formation.slots).toHaveLength(formation.starters);
      formation.slots.forEach((slot) => {
        expect(String(slot.label).trim()).not.toBe('');
        expect(slot.positionX).toBeGreaterThanOrEqual(0);
        expect(slot.positionX).toBeLessThanOrEqual(100);
        expect(slot.positionY).toBeGreaterThanOrEqual(0);
        expect(slot.positionY).toBeLessThanOrEqual(100);
      });
    });
  });

  test('deux postes ne se dessinent JAMAIS au meme endroit dans une formation', () => {
    ['Football', 'Futsal', 'Basketball', 'Handball', 'Volleyball', 'Rugby', 'Rugby à XIII']
      .forEach((sport) => {
        getMatchFormations(sport, 'Sénior (+18 ans)').forEach((formation) => {
          const points = formation.slots.map((slot) => `${slot.positionX}/${slot.positionY}`);
          expect(new Set(points).size).toBe(points.length);
        });
      });
  });

  test('le 4-3-3 d aujourd hui est GARDE, et il reste le premier propose', () => {
    const football = getMatchFormations('Football', 'U15 (15 ans)');
    expect(football[0].key).toBe('4-3-3');
    expect(football[0].slots.map((slot) => slot.label))
      .toEqual(['GB', 'DD', 'DC', 'DC', 'DG', 'MD', 'MC', 'MG', 'AD', 'BU', 'AG']);
    // Les coordonnees de `design_reference/fields.jsx`, au pixel pres.
    expect(football[0].slots[0]).toMatchObject({ label: 'GB', positionX: 50, positionY: 93 });
    expect(football[0].slots[9]).toMatchObject({ label: 'BU', positionX: 50, positionY: 20 });
  });

  test('le format du football se lit dans la CATEGORIE', () => {
    expect(getFootballFormatFromCategory('U6 (6 ans)')).toBe(5);
    expect(getFootballFormatFromCategory('U9 (9 ans)')).toBe(5);
    expect(getFootballFormatFromCategory('U10 (10 ans)')).toBe(8);
    expect(getFootballFormatFromCategory('U13 (13 ans)')).toBe(8);
    expect(getFootballFormatFromCategory('U14 (14 ans)')).toBe(11);
    expect(getFootballFormatFromCategory('U21 (21 ans)')).toBe(11);
    expect(getFootballFormatFromCategory('Sénior (+18 ans)')).toBe(11);
    // Les variantes SANS parenthese existent aussi en base : meme reponse.
    expect(getFootballFormatFromCategory('U11')).toBe(8);
    // Categorie absente ou inconnue : on garde le comportement d aujourd hui.
    expect(getFootballFormatFromCategory('')).toBe(11);
    expect(getFootballFormatFromCategory('Loisir')).toBe(11);
  });

  test('🕳️ les 130 autres activites n ont AUCUNE formation inventee', () => {
    ['Judo', 'Danse', 'Baseball', 'Roller et Rink Hockey', 'Football américain', 'Flag Football']
      .forEach((sport) => {
        expect(getMatchFormations(sport, '')).toEqual([]);
      });
  });
});

describe('TERRAIN T4 — 11 postes declares, 11 joueurs bien places', () => {
  const ONZE = [
    joueur('gardien', 'Gardien'),
    joueur('lateral-d', 'Latéral droit'),
    joueur('central-1', 'Défenseur central'),
    joueur('central-2', 'Défenseur central'),
    joueur('lateral-g', 'Latéral gauche'),
    joueur('milieu-def', 'Milieu défensif'),
    joueur('milieu-cen', 'Milieu central'),
    joueur('milieu-off', 'Milieu offensif'),
    joueur('ailier-d', 'Ailier droit'),
    joueur('ailier-g', 'Ailier gauche'),
    joueur('avant-centre', 'Avant-centre'),
  ];

  test('le 4-3-3 place les 11, chacun sur un poste, personne au banc', () => {
    const formation = getMatchFormationByKey('Football', 'U15 (15 ans)', '4-3-3');
    const { placements, unplacedPlayerIds } = buildAutoPlacementsByDeclaredPosition({
      formation, players: ONZE, teamEntryId: 'team_1',
    });

    expect(placements).toHaveLength(11);
    expect(unplacedPlayerIds).toEqual([]);
    // Un poste tenu une seule fois : personne n est cache sous personne.
    expect(new Set(placements.map((placement) => placement.slotId)).size).toBe(11);
    expect(new Set(placements.map((placement) => placement.playerId)).size).toBe(11);
  });

  test('chacun est place AU BON ENDROIT, pas seulement quelque part', () => {
    const formation = getMatchFormationByKey('Football', 'U15 (15 ans)', '4-3-3');
    const { placements } = buildAutoPlacementsByDeclaredPosition({
      formation, players: ONZE, teamEntryId: 'team_1',
    });
    const parJoueur = new Map(placements.map((placement) => [placement.playerId, placement]));
    const posteDe = (id) => libellesTenus(formation, [parJoueur.get(id)])[0];

    expect(posteDe('gardien')).toBe('GB');
    expect(posteDe('lateral-d')).toBe('DD');
    expect(posteDe('lateral-g')).toBe('DG');
    expect(posteDe('central-1')).toBe('DC');
    expect(posteDe('central-2')).toBe('DC');
    expect(posteDe('ailier-d')).toBe('AD');
    expect(posteDe('ailier-g')).toBe('AG');
    expect(posteDe('avant-centre')).toBe('BU');
    // Les 3 milieux de terrain tombent dans les 3 cases du milieu, quelles
    // qu elles soient : c est le rang du 4-3-3, pas leur specialite exacte.
    expect(['MD', 'MC', 'MG']).toContain(posteDe('milieu-def'));
    expect(['MD', 'MC', 'MG']).toContain(posteDe('milieu-cen'));
    expect(['MD', 'MC', 'MG']).toContain(posteDe('milieu-off'));
  });

  test('le jeton est pose EXACTEMENT sur la case, pas a cote', () => {
    const formation = getMatchFormationByKey('Football', 'U15 (15 ans)', '4-4-2');
    const { placements } = buildAutoPlacementsByDeclaredPosition({
      formation, players: [joueur('gardien', 'Gardien')], teamEntryId: 'team_1',
    });

    expect(placements[0].positionX).toBe(formation.slots[0].positionX);
    expect(placements[0].positionY).toBe(formation.slots[0].positionY);
    expect(placements[0].slotId).toBe('team_1:slot_1');
  });

  test('un joueur qui declare PLUSIEURS postes prend le premier encore libre', () => {
    const formation = getMatchFormationByKey('Football', 'U15 (15 ans)', '4-3-3');
    const { placements } = buildAutoPlacementsByDeclaredPosition({
      formation,
      players: [
        joueur('premier', 'Gardien'),
        // Le compte reel mesure en production : 4 postes separes par des virgules.
        joueur('polyvalent', 'Latéral droit, Latéral gauche, Attaquant, Avant-centre'),
      ],
      teamEntryId: 'team_1',
    });

    expect(libellesTenus(formation, placements)).toEqual(['GB', 'DD']);
  });
});

describe('TERRAIN T5 — sans poste declare, on reste au BANC', () => {
  test('un joueur sans poste n est JAMAIS pose au hasard', () => {
    const formation = getMatchFormationByKey('Football', 'U15 (15 ans)', '4-3-3');
    const { placements, unplacedPlayerIds } = buildAutoPlacementsByDeclaredPosition({
      formation,
      players: [
        joueur('sans-poste', ''),
        joueur('sans-champ', undefined),
        joueur('gardien', 'Gardien'),
      ],
      teamEntryId: 'team_1',
    });

    expect(placements).toHaveLength(1);
    expect(placements[0].playerId).toBe('gardien');
    expect(unplacedPlayerIds).toEqual(['sans-poste', 'sans-champ']);
  });

  test('un poste ECRIT MAIS INCONNU du sport laisse aussi au banc', () => {
    const formation = getMatchFormationByKey('Football', 'U15 (15 ans)', '4-3-3');
    // « 3 eme ligne » est un poste de RUGBY : mesure en production, le
    // vocabulaire du champ `position` n est PAS que du football.
    const { placements, unplacedPlayerIds } = buildAutoPlacementsByDeclaredPosition({
      formation, players: [joueur('rugbyman', '3 eme ligne')], teamEntryId: 'team_1',
    });

    expect(placements).toEqual([]);
    expect(unplacedPlayerIds).toEqual(['rugbyman']);
  });

  test('...mais « 3 eme ligne » est bien reconnu SUR UN TERRAIN DE RUGBY', () => {
    const formation = getMatchFormationByKey('Rugby', '', 'xv');
    const { placements, unplacedPlayerIds } = buildAutoPlacementsByDeclaredPosition({
      formation, players: [joueur('rugbyman', '3 eme ligne')], teamEntryId: 'team_1',
    });

    expect(unplacedPlayerIds).toEqual([]);
    expect(['3L G', '3L D', 'N°8']).toContain(libellesTenus(formation, placements)[0]);
  });
});

describe('TERRAIN T6 — le cas dur : deux joueurs pour la meme case', () => {
  const formation = () => getMatchFormationByKey('Football', 'U15 (15 ans)', '4-3-3');

  test('DEUX « Défenseur central » pour DEUX cases DC : les deux sont places', () => {
    const compo = formation();
    const { placements, unplacedPlayerIds } = buildAutoPlacementsByDeclaredPosition({
      formation: compo,
      players: [joueur('dc-1', 'Défenseur central'), joueur('dc-2', 'Défenseur central')],
      teamEntryId: 'team_1',
    });

    expect(libellesTenus(compo, placements)).toEqual(['DC', 'DC']);
    expect(placements[0].slotId).not.toBe(placements[1].slotId);
    expect(unplacedPlayerIds).toEqual([]);
  });

  test('TROIS « Défenseur central », DEUX cases : le 3e reste au banc, il ne DISPARAIT pas', () => {
    const compo = formation();
    const joueurs = [
      joueur('dc-1', 'Défenseur central'),
      joueur('dc-2', 'Défenseur central'),
      joueur('dc-3', 'Défenseur central'),
    ];
    const { placements, unplacedPlayerIds } = buildAutoPlacementsByDeclaredPosition({
      formation: compo, players: joueurs, teamEntryId: 'team_1',
    });

    // Premier arrive, premier servi — l ordre est celui que le coach VOIT.
    expect(placements.map((placement) => placement.playerId)).toEqual(['dc-1', 'dc-2']);
    expect(unplacedPlayerIds).toEqual(['dc-3']);
    // 🔒 PERSONNE NE DISPARAIT : places + restes au banc = tous les convoques.
    expect(placements.length + unplacedPlayerIds.length).toBe(joueurs.length);
  });

  test('aucun joueur n est pose sur une case deja tenue, jamais', () => {
    const compo = formation();
    const joueurs = Array.from({ length: 20 }, (_, index) => joueur(`p${index}`, 'Attaquant'));
    const { placements, unplacedPlayerIds } = buildAutoPlacementsByDeclaredPosition({
      formation: compo, players: joueurs, teamEntryId: 'team_1',
    });

    expect(new Set(placements.map((placement) => placement.slotId)).size)
      .toBe(placements.length);
    expect(placements.length + unplacedPlayerIds.length).toBe(20);
    expect(placements.length).toBeLessThanOrEqual(compo.starters);
  });

  test('sans formation, on ne place personne et on ne perd personne', () => {
    const { placements, unplacedPlayerIds } = buildAutoPlacementsByDeclaredPosition({
      formation: null, players: [joueur('a', 'Gardien')], teamEntryId: 'team_1',
    });

    expect(placements).toEqual([]);
    expect(unplacedPlayerIds).toEqual(['a']);
  });
});
