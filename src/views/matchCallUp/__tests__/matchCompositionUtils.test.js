import {
  buildFormationPlacements,
  buildFormationSlots,
  buildMatchCompositionPack,
  buildStartFromOptions,
  getBenchPlayers,
  getBoardCounters,
  getDefaultStartFromKey,
  getMatchFormation,
  keepPlacementsOfCalledUpPlayers,
  MATCH_FORMATIONS,
  MATCH_POSITION_LABELS,
  placePlayerAt,
  readPlacementsFromPack,
  removePlayerFromField,
  snapToNearestSlot,
  START_FROM_DEFAULT,
  START_FROM_EMPTY,
  START_FROM_LAST_MATCH,
} from '../matchCompositionUtils';

// D79 — ECRANS 4 a 6 du pack composition : « Partir de… », le terrain + banc, et
// la feuille enregistrer / publier.
//
// Les 4 regles que ce fichier tient, parce que les rater se voit a l'ecran :
//   1. Une option sans source est GRISEE avec sa raison — jamais choisissable a vide.
//   2. Le glisser-deposer marche DANS LES DEUX SENS : banc -> terrain et terrain -> banc.
//   3. L'aimantation est un interrupteur : eteinte, le jeton reste ou on l'a pose.
//   4. Les 2 reglages de l'ecran 6 partent a la RACINE du pack, la ou D73 les lit.

const joueur = (id, firstname, lastname, extra = {}) => ({
  documentId: id, firstname, lastname, ...extra,
});

const ONZE = Array.from({ length: 11 }, (_, index) => joueur(`p${index}`, `Prenom${index}`, `Nom${index}`));

describe('les formations viennent du pack, telles quelles', () => {
  test('les 5 sports ont une formation, et autant de postes que de places', () => {
    ['basketball', 'football', 'handball', 'rugby', 'volleyball'].forEach((sport) => {
      expect(MATCH_FORMATIONS[sport].length).toBe(MATCH_POSITION_LABELS[sport].length);
    });
  });

  test('les effectifs sont ceux du pack : 11 / 5 / 7 / 6 / 15', () => {
    expect(getMatchFormation('football')).toHaveLength(11);
    expect(getMatchFormation('basketball')).toHaveLength(5);
    expect(getMatchFormation('handball')).toHaveLength(7);
    expect(getMatchFormation('volleyball')).toHaveLength(6);
    expect(getMatchFormation('rugby')).toHaveLength(15);
  });

  test('un libelle de sport ecrit a la main est reconnu', () => {
    expect(getMatchFormation('Basket-ball')).toHaveLength(5);
    expect(getMatchFormation('Football à 11')).toHaveLength(11);
  });

  test('un sport inconnu ne fabrique pas de formation muette', () => {
    expect(getMatchFormation('pétanque')).toHaveLength(0);
    expect(buildFormationSlots('pétanque')).toHaveLength(0);
  });

  test('le gardien de but part bien en bas du terrain de football', () => {
    const [premier] = buildFormationSlots('football');
    expect(premier.label).toBe('GB');
    expect(premier.positionY).toBeGreaterThan(80);
  });
});

describe('placer la formation de depart', () => {
  test('les 11 premiers convoques prennent les 11 postes', () => {
    const placements = buildFormationPlacements({ players: ONZE, sport: 'football' });
    expect(placements).toHaveLength(11);
    expect(placements[0].playerId).toBe('p0');
    expect(placements[0].slotId).toBe('team_1:slot_1');
  });

  test('les convoques en trop RESTENT au banc : on ne fabrique pas un 6e titulaire au basket', () => {
    const placements = buildFormationPlacements({ players: ONZE, sport: 'basketball' });
    expect(placements).toHaveLength(5);
    expect(getBenchPlayers(ONZE, placements)).toHaveLength(6);
  });
});

describe('lire un pack, quelle que soit sa forme', () => {
  test('forme v3 : les placements vivent sous teams[]', () => {
    const lus = readPlacementsFromPack({ teams: [{ placements: [{ playerId: 'p1', positionX: 50, positionY: 90 }] }] });
    expect(lus).toEqual([{
      playerId: 'p1', positionX: 50, positionY: 90, slotId: null,
    }]);
  });

  test('forme ancienne : les placements vivent a la racine — c est celle de la compo type', () => {
    const lus = readPlacementsFromPack({
      placements: [{
        playerId: 'p2', positionX: 10, positionY: 20, slotId: 's1',
      }],
    });
    expect(lus).toEqual([{
      playerId: 'p2', positionX: 10, positionY: 20, slotId: 's1',
    }]);
  });

  test('une coordonnee hors bornes est ramenee dans le terrain', () => {
    const [lu] = readPlacementsFromPack({ placements: [{ playerId: 'p3', positionX: -40, positionY: 420 }] });
    expect(lu.positionX).toBe(0);
    expect(lu.positionY).toBe(100);
  });

  test('un joueur NON convoque ne remonte pas sur le terrain', () => {
    const placements = [{ playerId: 'p0' }, { playerId: 'inconnu' }];
    expect(keepPlacementsOfCalledUpPlayers(placements, ONZE)).toHaveLength(1);
  });
});

describe('ecran 4 — les 3 points de depart, et ce qui les grise', () => {
  const compoType = { composition: { placements: [{ playerId: 'p0', positionX: 50, positionY: 90 }] } };
  const dernierMatch = {
    composition: { teams: [{ placements: [{ playerId: 'p1', positionX: 20, positionY: 60 }] }] },
    source: 'last_match',
  };

  test('« Terrain vide » est TOUJOURS disponible — il n a besoin d aucune donnee', () => {
    const [vide] = buildStartFromOptions({ players: ONZE, sport: 'football' });
    expect(vide.key).toBe(START_FROM_EMPTY);
    expect(vide.available).toBe(true);
    expect(vide.placements).toHaveLength(0);
  });

  test('sans compo type, la rangee est GRISEE avec sa raison', () => {
    const options = buildStartFromOptions({ players: ONZE, sport: 'football' });
    const compo = options.find((option) => option.key === START_FROM_DEFAULT);
    expect(compo.available).toBe(false);
    expect(compo.unavailableReason).toBe('noDefaultComposition');
  });

  test('avec une compo type, la rangee porte ses placements', () => {
    const options = buildStartFromOptions({ defaultComposition: compoType, players: ONZE, sport: 'football' });
    const compo = options.find((option) => option.key === START_FROM_DEFAULT);
    expect(compo.available).toBe(true);
    expect(compo.placements).toHaveLength(1);
  });

  test('« Dernier match » n est disponible que si le serveur a VRAIMENT rendu cette source', () => {
    const sansSource = buildStartFromOptions({
      bootstrap: { composition: { teams: [{ placements: [{ playerId: 'p1' }] }] }, source: 'draft' },
      players: ONZE,
    });
    const rangee = sansSource.find((option) => option.key === START_FROM_LAST_MATCH);
    expect(rangee.available).toBe(false);
    expect(rangee.unavailableReason).toBe('noLastMatch');

    const avecSource = buildStartFromOptions({ bootstrap: dernierMatch, players: ONZE });
    expect(avecSource.find((option) => option.key === START_FROM_LAST_MATCH).available).toBe(true);
  });

  test('la compo type est cochee par defaut quand elle existe, sinon le terrain vide', () => {
    expect(getDefaultStartFromKey(buildStartFromOptions({
      defaultComposition: compoType, players: ONZE,
    }))).toBe(START_FROM_DEFAULT);
    expect(getDefaultStartFromKey(buildStartFromOptions({ players: ONZE }))).toBe(START_FROM_EMPTY);
  });
});

describe('ecran 5 — le glisser-deposer, DANS LES DEUX SENS', () => {
  const postes = buildFormationSlots('football');

  test('banc -> terrain : deposer place le joueur', () => {
    const apres = placePlayerAt({
      placements: [], playerId: 'p0', slots: postes, x: 50, y: 50,
    });
    expect(apres).toHaveLength(1);
    expect(getBenchPlayers(ONZE, apres)).toHaveLength(10);
  });

  test('terrain -> banc : sortir le jeton le remet au banc', () => {
    const surTerrain = buildFormationPlacements({ players: ONZE, sport: 'football' });
    const apres = removePlayerFromField(surTerrain, 'p0');
    expect(apres).toHaveLength(10);
    expect(getBenchPlayers(ONZE, apres).map((player) => player.documentId)).toContain('p0');
  });

  test('deplacer un joueur deja place ne le duplique pas', () => {
    const surTerrain = buildFormationPlacements({ players: ONZE, sport: 'football' });
    const apres = placePlayerAt({
      placements: surTerrain, playerId: 'p0', slots: postes, x: 12, y: 12,
    });
    expect(apres.filter((placement) => placement.playerId === 'p0')).toHaveLength(1);
    expect(apres).toHaveLength(11);
  });
});

describe('l aimantation est un interrupteur, pas une fatalite', () => {
  const postes = buildFormationSlots('football');

  test('eteinte : le jeton reste EXACTEMENT ou on l a pose', () => {
    const [pose] = placePlayerAt({
      magnetEnabled: false, placements: [], playerId: 'p0', slots: postes, x: 33.3, y: 44.4,
    });
    expect(pose.positionX).toBe(33.3);
    expect(pose.positionY).toBe(44.4);
    expect(pose.slotId).toBeNull();
  });

  test('allumee : le jeton colle au poste libre le plus proche', () => {
    const gardien = postes[0];
    const [pose] = placePlayerAt({
      magnetEnabled: true,
      placements: [],
      playerId: 'p0',
      slots: postes,
      x: gardien.positionX + 3,
      y: gardien.positionY + 3,
    });
    expect(pose.slotId).toBe(gardien.slotId);
    expect(pose.positionX).toBe(gardien.positionX);
  });

  // (50, 44) est a 17 du milieu de terrain [50, 61], le poste le plus proche :
  // au-dela du rayon de 14, donc hors d'accroche.
  test('allumee mais loin de tout poste : on pose quand meme ou le doigt a lache', () => {
    const [pose] = placePlayerAt({
      magnetEnabled: true, placements: [], playerId: 'p0', slots: postes, x: 50, y: 44,
    });
    expect(pose.slotId).toBeNull();
    expect(pose.positionY).toBe(44);
  });

  test('un poste DEJA occupe n aimante pas un second joueur', () => {
    const gardien = postes[0];
    const occupe = [{
      playerId: 'p1', positionX: gardien.positionX, positionY: gardien.positionY, slotId: gardien.slotId,
    }];
    expect(snapToNearestSlot({
      occupiedSlotIds: [gardien.slotId],
      slots: [gardien],
      x: gardien.positionX,
      y: gardien.positionY,
    })).toBeNull();
    const [, pose] = placePlayerAt({
      magnetEnabled: true,
      placements: occupe,
      playerId: 'p0',
      slots: [gardien],
      x: gardien.positionX,
      y: gardien.positionY,
    });
    expect(pose.slotId).toBeNull();
  });
});

describe('les compteurs disent la verite', () => {
  test('11 places au football : 11/11 places, 0 au banc', () => {
    const placements = buildFormationPlacements({ players: ONZE, sport: 'football' });
    const compteurs = getBoardCounters({ placements, players: ONZE, sport: 'football' });
    expect(compteurs).toMatchObject({
      bench: 0, calledUp: 11, placed: 11, starters: 11,
    });
  });

  test('5 places au basket sur 11 convoques : 6 au banc', () => {
    const placements = buildFormationPlacements({ players: ONZE, sport: 'basketball' });
    const compteurs = getBoardCounters({ placements, players: ONZE, sport: 'basketball' });
    expect(compteurs).toMatchObject({ bench: 6, placed: 5, starters: 5 });
  });

  test('seuls les joueurs hors app REELLEMENT convoques comptent', () => {
    const horsApp = joueur('manual_1', 'Yanis', 'Bertrand', { isManual: true });
    const ecarte = joueur('manual_2', 'Ecarte', 'Ecarte', { isManual: true });
    const compteurs = getBoardCounters({
      manualPlayers: [horsApp, ecarte], players: [...ONZE, horsApp], sport: 'football',
    });
    expect(compteurs.offApp).toBe(1);
  });
});

describe('ecran 6 — la charge envoyee au serveur', () => {
  const placements = buildFormationPlacements({ players: ONZE, sport: 'football' });

  test('les 2 reglages partent a la RACINE du pack, la ou D73 les lit', () => {
    const pack = buildMatchCompositionPack({
      placements, players: ONZE, requireResponse: false, sport: 'football',
    });
    expect(pack.requireResponse).toBe(false);
    expect(pack.visibility).toBe('team');
  });

  test('« Demander une reponse » est allume par defaut', () => {
    expect(buildMatchCompositionPack({ placements, players: ONZE, sport: 'football' }).requireResponse).toBe(true);
  });

  test('une visibilite inconnue retombe sur « team », jamais sur du vide', () => {
    expect(buildMatchCompositionPack({ players: ONZE, visibility: 'n_importe_quoi' }).visibility).toBe('team');
    expect(buildMatchCompositionPack({ players: ONZE, visibility: 'called_only' }).visibility).toBe('called_only');
  });

  test('les convoques non places partent en reserve, pas dans le vide', () => {
    const pack = buildMatchCompositionPack({
      placements: buildFormationPlacements({ players: ONZE, sport: 'basketball' }),
      players: ONZE,
      sport: 'basketball',
    });
    expect(pack.reservePlayerIds).toHaveLength(6);
    expect(pack.teams[0].placements).toHaveLength(5);
  });

  test('selectedPlayerIds porte TOUS les convoques — terrain et banc', () => {
    const pack = buildMatchCompositionPack({ placements: [], players: ONZE, sport: 'football' });
    expect(pack.selectedPlayerIds).toHaveLength(11);
  });

  test('le pack part en placement libre : l aimantation est une aide de saisie, pas une regle serveur', () => {
    expect(buildMatchCompositionPack({ placements, players: ONZE, sport: 'football' }).placementMode).toBe('free');
  });
});
