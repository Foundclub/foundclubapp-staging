import {
  buildManualCallUpPlayer,
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
      notifyBySms: true,
      now: 1700000000000,
      phone: '0612345678',
    });

    expect(player.id).toBe('manual_1700000000000');
    expect(player.documentId).toBe(player.id);
    expect(player.isManual).toBe(true);
    expect(player.firstname).toBe('Yanis');
    expect(player.number).toBe('23');
    expect(player.phone).toBe('0612345678');
    expect(player.notifyBySms).toBe(true);
  });

  test('SANS telephone, l interrupteur SMS ne peut pas rester allume', () => {
    // 🔒 « Le joueur hors app ne doit jamais recevoir une promesse fausse. »
    const player = buildManualCallUpPlayer({
      firstname: 'Yanis',
      lastname: 'Bertrand',
      notifyBySms: true,
      now: 1700000000001,
      phone: '   ',
    });

    expect(player.notifyBySms).toBe(false);
    expect(player.phone).toBeUndefined();
    expect(hasSilentCallUp(player)).toBe(true);
  });

  test('l etiquette « pas de SMS » suit le joueur sans numero ET celui qui refuse', () => {
    const sansNumero = buildManualCallUpPlayer({
      firstname: 'Yanis', lastname: 'Bertrand', now: 1,
    });
    const smsRefuse = buildManualCallUpPlayer({
      firstname: 'Yanis', lastname: 'Bertrand', notifyBySms: false, now: 2, phone: '0612345678',
    });
    const smsAccepte = buildManualCallUpPlayer({
      firstname: 'Yanis', lastname: 'Bertrand', notifyBySms: true, now: 3, phone: '0612345678',
    });

    expect(hasSilentCallUp(sansNumero)).toBe(true);
    expect(hasSilentCallUp(smsRefuse)).toBe(true);
    expect(hasSilentCallUp(smsAccepte)).toBe(false);
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
