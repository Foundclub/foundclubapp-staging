import {
  buildCompoTemplateDestination,
  buildCompoTemplateSources,
  buildTeamDefaultCompositionPayload,
  COMPO_SOURCE_LAST,
  COMPO_SOURCE_NEW,
  COMPO_SOURCE_TEMPLATE,
  getDefaultCompoSourceKey,
  getPlacementPositionLabel,
} from '../teamCompoTemplateUtils';

// C-C — ECRAN 11 du pack composition, et son TEMOIN 2.
//
// 🔒 LE TEMOIN QUI COMPTE : « la porte "Composition type" existante marche
// toujours ». Cet ecran REMPLACE une fonction vivante — un dirigeant s'en sert
// deja. Ce qui change est la DESTINATION de la porte ; ses conditions
// d'affichage (`canManageTeam`, `isTeamOfferUnlocked`, son libelle, son cadenas)
// ne sont pas touchees, et le diff de `TeamDetails.js` le prouve : il tient
// entierement dans `handleManageDefaultComposition`.

const EQUIPE = {
  activities: [{ name: 'Football' }],
  documentId: 'team-1',
  name: 'Senior 1',
};

const EFFECTIF = [
  { documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' },
  { documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra' },
];

describe('TEMOIN 2 — la porte « Composition type » mene toujours quelque part', () => {
  test('elle emporte l equipe, son sport et son effectif', () => {
    expect(buildCompoTemplateDestination({ players: EFFECTIF, team: EQUIPE })).toEqual({
      params: {
        players: EFFECTIF,
        sport: 'Football',
        teamId: 'team-1',
        teamName: 'Senior 1',
      },
      screen: 'TeamCompoTemplate',
    });
  });

  test('sans sport declare, l equipe part avec le sport par defaut du terrain', () => {
    const destination = buildCompoTemplateDestination({
      players: [],
      team: { documentId: 'team-2', name: 'U19' },
    });

    expect(destination?.params.sport).toBe('football');
    expect(destination?.params.players).toEqual([]);
  });

  test('sans equipe, la porte ne mene nulle part — elle n ouvre pas un ecran vide', () => {
    expect(buildCompoTemplateDestination({ team: null })).toBeNull();
    expect(buildCompoTemplateDestination({ team: { name: 'Sans identifiant' } })).toBeNull();
  });
});

describe('buildCompoTemplateSources — les 3 segments du pack', () => {
  test('la compo type enregistree remplit le premier segment', () => {
    const sources = buildCompoTemplateSources({
      defaultComposition: {
        composition: {
          placements: [{
            playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
          }],
        },
      },
      players: EFFECTIF,
      sport: 'football',
    });

    const template = sources.find((source) => source.key === COMPO_SOURCE_TEMPLATE);
    expect(template?.available).toBe(true);
    expect(template?.placements).toHaveLength(1);
  });

  test('🧾 « Dernier » n a AUCUNE source au niveau d une equipe — il le dit', () => {
    const sources = buildCompoTemplateSources({ players: EFFECTIF, sport: 'football' });
    const last = sources.find((source) => source.key === COMPO_SOURCE_LAST);

    expect(last?.available).toBe(false);
    expect(last?.unavailableReason).toBe('noLastMatch');
  });

  test('« Nouvelle compo » pose la formation de depart du sport sur l effectif', () => {
    const sources = buildCompoTemplateSources({ players: EFFECTIF, sport: 'football' });
    const neuve = sources.find((source) => source.key === COMPO_SOURCE_NEW);

    expect(neuve?.available).toBe(true);
    expect(neuve?.placements).toHaveLength(2);
    expect(neuve?.placements[0].slotId).toBe('team_1:slot_1');
  });

  test('un joueur qui a quitte l equipe ne revient pas sur le terrain', () => {
    const sources = buildCompoTemplateSources({
      defaultComposition: { composition: { placements: [{ playerId: 'parti-depuis' }] } },
      players: EFFECTIF,
      sport: 'football',
    });

    expect(sources.find((source) => source.key === COMPO_SOURCE_TEMPLATE)?.available).toBe(false);
  });

  test('le segment coche a l ouverture est la compo type quand elle existe', () => {
    const avec = buildCompoTemplateSources({
      defaultComposition: { composition: { placements: [{ playerId: 'joueur-1' }] } },
      players: EFFECTIF,
      sport: 'football',
    });
    const sans = buildCompoTemplateSources({ players: EFFECTIF, sport: 'football' });

    expect(getDefaultCompoSourceKey(avec)).toBe(COMPO_SOURCE_TEMPLATE);
    expect(getDefaultCompoSourceKey(sans)).toBe(COMPO_SOURCE_NEW);
  });
});

describe('getPlacementPositionLabel — la pastille de poste du pack', () => {
  test('elle vient du repere ou le jeton s est pose', () => {
    expect(getPlacementPositionLabel({ slotId: 'team_1:slot_1' }, 'football')).toBe('GB');
    expect(getPlacementPositionLabel({ slotId: 'team_1:slot_10' }, 'football')).toBe('BU');
  });

  test('un jeton pose librement n a pas de pastille — on n invente pas un poste', () => {
    expect(getPlacementPositionLabel({ slotId: null }, 'football')).toBe('');
    expect(getPlacementPositionLabel({}, 'football')).toBe('');
  });
});

describe('buildTeamDefaultCompositionPayload', () => {
  test('elle range la compo dans la FORME que le serveur sait deja recevoir', () => {
    const charge = buildTeamDefaultCompositionPayload({
      placements: [{
        playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
      }],
      players: EFFECTIF,
      sport: 'football',
    });

    expect(charge.placements).toEqual([{
      playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
    }]);
    expect(charge.sportContext).toBe('football');
    expect(charge.slots).toHaveLength(11);
  });

  test('un joueur qui n est plus dans l effectif n est pas reecrit dans le modele', () => {
    const charge = buildTeamDefaultCompositionPayload({
      placements: [{ playerId: 'parti-depuis' }],
      players: EFFECTIF,
      sport: 'football',
    });

    expect(charge.placements).toEqual([]);
  });
});
