import {
  buildManualCallUpPlayer,
  buildRsvpAnswersByPlayerId,
  CALL_UP_RSVP_NONE,
  getCallUpCounters,
  getMatchSquadSizes,
  getPlayerUnavailability,
  hasSilentCallUp,
  isManualCallUpPlayer,
  MATCH_SQUAD_SIZES,
} from '../matchCallUpUtils';

// D77 — les regles du pack qui se calculent, isolees du rendu :
// combien de titulaires, qui est averti, et qui ne recevra RIEN.

describe('matchCallUpUtils — effectifs par sport', () => {
  test('les 5 sports du pack ont leurs valeurs exactes', () => {
    expect(MATCH_SQUAD_SIZES.football).toEqual({ bench: 5, starters: 11 });
    expect(MATCH_SQUAD_SIZES.basketball).toEqual({ bench: 5, starters: 5 });
    expect(MATCH_SQUAD_SIZES.handball).toEqual({ bench: 5, starters: 7 });
    expect(MATCH_SQUAD_SIZES.volleyball).toEqual({ bench: 4, starters: 6 });
    expect(MATCH_SQUAD_SIZES.rugby).toEqual({ bench: 5, starters: 15 });
  });

  test('le sport est reconnu quelle que soit la casse, inconnu rend null', () => {
    expect(getMatchSquadSizes('Football')).toEqual({ bench: 5, starters: 11 });
    expect(getMatchSquadSizes('petanque')).toBeNull();
    expect(getMatchSquadSizes(undefined)).toBeNull();
  });
});

describe('matchCallUpUtils — indisponibilites', () => {
  test('aucun motif sur un joueur ordinaire', () => {
    expect(getPlayerUnavailability({ id: 'p1' })).toBeNull();
    expect(getPlayerUnavailability({ id: 'p1', unavailabilityReason: 'vacances' })).toBeNull();
  });

  test('les 3 motifs du pack sont reconnus', () => {
    expect(getPlayerUnavailability({ unavailabilityReason: 'licence' }))
      .toEqual({ count: 1, reason: 'licence' });
    expect(getPlayerUnavailability({ unavailabilityReason: 'injury' }))
      .toEqual({ count: 1, reason: 'injury' });
    expect(getPlayerUnavailability({ suspensionMatches: 3, unavailabilityReason: 'suspension' }))
      .toEqual({ count: 3, reason: 'suspension' });
  });
});

describe('matchCallUpUtils — joueur hors app', () => {
  test('un identifiant manual_ suffit a le reconnaitre, meme sans marqueur', () => {
    expect(isManualCallUpPlayer({ documentId: 'manual_1700000000000' })).toBe(true);
    expect(isManualCallUpPlayer({ documentId: 'abc', isManual: true })).toBe(true);
    expect(isManualCallUpPlayer({ documentId: 'abc' })).toBe(false);
  });

  test('la forme produite est celle que le board et le serveur connaissent deja', () => {
    const player = buildManualCallUpPlayer({
      firstname: ' Yanis ',
      jerseyNumber: '23',
      lastname: 'Bertrand',
      now: 1700000000000,
    });

    expect(player.id).toBe('manual_1700000000000');
    expect(player.documentId).toBe(player.id);
    expect(player.isManual).toBe(true);
    expect(player.firstname).toBe('Yanis');
    expect(player.number).toBe('23');
  });

  // ⚠️ C-A (2026-08-14) — ces 2 temoins verrouillaient le calcul « SMS promis ou
  // non ». Il n'y a plus rien a calculer : aucun service d'envoi n'existe cote
  // serveur, donc la promesse fausse est impossible PAR CONSTRUCTION.
  test('🔒 le telephone d un tiers ne peut plus entrer, meme s il est passe', () => {
    const player = buildManualCallUpPlayer({
      firstname: 'Yanis',
      jerseyNumber: '23',
      lastname: 'Bertrand',
      notifyBySms: true,
      now: 1700000000001,
      phone: '0612345678',
    });

    expect(player.phone).toBeUndefined();
    expect(player.notifyBySms).toBeUndefined();
    expect(player.lastname).toBe('Bertrand');
  });

  test('l etiquette suit TOUT joueur hors app, sans exception', () => {
    const sansNumero = buildManualCallUpPlayer({
      firstname: 'Yanis', lastname: 'Bertrand', now: 1,
    });
    // Un joueur venu de la base avec les anciens champs : il ne sera pas
    // prevenu davantage, l'etiquette ne doit donc pas disparaitre.
    const ancienAvecSms = {
      documentId: 'manual_2', isManual: true, notifyBySms: true, phone: '0612345678',
    };

    expect(hasSilentCallUp(sansNumero)).toBe(true);
    expect(hasSilentCallUp(ancienAvecSms)).toBe(true);
    // Un joueur de l'effectif n'est jamais concerne : il a l'app.
    expect(hasSilentCallUp({ documentId: 'p1' })).toBe(false);
  });
});

describe('matchCallUpUtils — compteurs de la barre du bas', () => {
  const renfort = { documentId: 'r1' };
  const horsApp = { documentId: 'manual_9', isManual: true };

  test('14 convoques au football = 11 titulaires et 3 sur le banc', () => {
    const compteurs = getCallUpCounters({
      selectedIds: Array.from({ length: 14 }, (_, index) => `p${index}`),
      sport: 'football',
    });

    expect(compteurs.calledUp).toBe(14);
    expect(compteurs.starters).toBe(11);
    expect(compteurs.bench).toBe(3);
  });

  test('8 convoques au football n annoncent PAS 11 titulaires', () => {
    // Le compteur dit la verite : il ne peut pas y avoir plus de titulaires
    // que de joueurs coches.
    const compteurs = getCallUpCounters({
      selectedIds: Array.from({ length: 8 }, (_, index) => `p${index}`),
      sport: 'football',
    });

    expect(compteurs.starters).toBe(8);
    expect(compteurs.bench).toBe(0);
  });

  test('renforts et hors app ne sont comptes que s ils sont coches', () => {
    const compteurs = getCallUpCounters({
      manualPlayers: [horsApp],
      reinforcementPlayers: [renfort],
      selectedIds: new Set(['manual_9', 'p1', 'r1']),
      sport: 'football',
    });

    expect(compteurs.calledUp).toBe(3);
    expect(compteurs.reinforcements).toBe(1);
    expect(compteurs.offApp).toBe(1);

    const sansRenfortCoche = getCallUpCounters({
      manualPlayers: [horsApp],
      reinforcementPlayers: [renfort],
      selectedIds: new Set(['p1']),
      sport: 'football',
    });

    expect(sansRenfortCoche.reinforcements).toBe(0);
    expect(sansRenfortCoche.offApp).toBe(0);
  });

  test('un sport sans effectif connu ne fabrique pas de titulaires', () => {
    const compteurs = getCallUpCounters({ selectedIds: ['p1', 'p2'], sport: 'petanque' });

    expect(compteurs.calledUp).toBe(2);
    expect(compteurs.starters).toBe(0);
    expect(compteurs.bench).toBe(2);
  });
});

// AC09 — la reponse de chaque joueur, calculee AVANT de convoquer.
// 🧩 Ce bloc verrouille la SEULE chose que la fonction a le droit de faire :
// deleguer aux deux briques de `@/domains/event/participationState`. Si un jour
// quelqu'un y recopie une regle « a la main », le premier temoin tombe.
describe('AC09 — buildRsvpAnswersByPlayerId', () => {
  const EVENEMENT = {
    missings: [{ documentId: 'p2' }],
    participationRequests: [{
      documentId: 'req_p3',
      isActive: true,
      participationStatus: 'pending',
      user: { documentId: 'p3' },
    }],
    participations: [{ documentId: 'p1' }],
  };

  const JOUEURS = [
    { documentId: 'p1', firstname: 'Moussa', lastname: 'Diallo' },
    { documentId: 'p2', firstname: 'Hugo', lastname: 'Fofana' },
    { documentId: 'p3', firstname: 'Théo', lastname: 'Marchal' },
    { documentId: 'p4', firstname: 'Sami', lastname: 'Baki' },
  ];

  test('les 4 etats sortent, et « sans reponse » est nomme, pas absent de la table', () => {
    const table = buildRsvpAnswersByPlayerId({ event: EVENEMENT, players: JOUEURS });

    expect(table.get('p1')).toBe('present');
    expect(table.get('p2')).toBe('absent');
    expect(table.get('p3')).toBe('pending');
    expect(table.get('p4')).toBe(CALL_UP_RSVP_NONE);
    expect(table.size).toBe(4);
  });

  // ⚠️ L'ORDRE VIENT DE `resolveRsvpAnswer`, ET C'EST LUI QUI COMPTE : le
  // serveur resynchronise `participations` APRES coup, un joueur qui vient de
  // repondre « absent » peut donc rester liste dans les deux. Sa DERNIERE
  // reponse gagne. Ce temoin echouerait si on recopiait la regle a l'envers.
  test('🔒 un joueur a la fois « participant » et « absent » est ABSENT', () => {
    const table = buildRsvpAnswersByPlayerId({
      event: { missings: [{ documentId: 'p1' }], participations: [{ documentId: 'p1' }] },
      players: [JOUEURS[0]],
    });

    expect(table.get('p1')).toBe('absent');
  });

  test('⛔ un joueur HORS APP n a pas de ligne : il ne peut pas repondre', () => {
    const table = buildRsvpAnswersByPlayerId({
      event: EVENEMENT,
      players: [...JOUEURS, buildManualCallUpPlayer({
        firstname: 'Yanis', lastname: 'Bertrand', now: 1700000000000,
      })],
    });

    expect(table.has('manual_1700000000000')).toBe(false);
    expect(table.size).toBe(4);
  });

  test('🕳️ sans charge d evenement, la table est VIDE — on ne dit pas « sans reponse »', () => {
    expect(buildRsvpAnswersByPlayerId({ event: null, players: JOUEURS }).size).toBe(0);
    expect(buildRsvpAnswersByPlayerId({ event: undefined, players: JOUEURS }).size).toBe(0);
  });

  test('une charge sans aucune relation rend « sans reponse » pour tout le monde', () => {
    const table = buildRsvpAnswersByPlayerId({ event: { documentId: 'evt_1' }, players: JOUEURS });

    expect([...table.values()]).toEqual([
      CALL_UP_RSVP_NONE, CALL_UP_RSVP_NONE, CALL_UP_RSVP_NONE, CALL_UP_RSVP_NONE,
    ]);
  });

  test('ni joueurs, ni entrees bancales ne la font tomber', () => {
    expect(buildRsvpAnswersByPlayerId({ event: EVENEMENT }).size).toBe(0);
    expect(buildRsvpAnswersByPlayerId({ event: EVENEMENT, players: [null, {}] }).size).toBe(0);
  });

  test('une demande ANNULEE (isActive: false) ne compte pas comme une reponse', () => {
    const table = buildRsvpAnswersByPlayerId({
      event: {
        participationRequests: [{
          documentId: 'req_p3',
          isActive: false,
          participationStatus: 'accepted',
          user: { documentId: 'p3' },
        }],
      },
      players: [JOUEURS[2]],
    });

    expect(table.get('p3')).toBe(CALL_UP_RSVP_NONE);
  });
});
