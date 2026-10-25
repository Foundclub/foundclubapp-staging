import {
  aujourdhuiAParis,
  chiffresDuPlanning,
  enJours,
  etatDeFrise,
  expireDans,
  finsPossibles,
  grouperParJour,
  historiqueLisible,
  initialesDe,
  jourCourt,
  joursDeLaSemaine,
  joursLisibles,
  libelleDuCreneau,
  libelleStatut,
  lignesDeLaFrise,
  lignesDesPages,
  messageDeRefusResa,
  minutesAParis,
  MOTIFS_DE_FERMETURE,
  MOTIFS_DE_REFUS,
  nomCourt,
  plageHoraire,
  prochainesReservations,
  regrouperFermetures,
  semaineLisible,
  telephoneLisible,
  titreDuJour,
  totalDesPages,
  totalQuiCompte,
  versJourIso,
} from '@/domains/complexe/complexeReservation';

// RESA-L5A2 (14/10/2026) — les règles PURES des réservations côté gérant (E-G03 à E-G06, E-G10) :
// les libellés d'état, « Expire dans 5 h », les jours, l'historique de la fiche, les refus du
// serveur NOMMÉS (contrat d'API L2A : `error.details.code`). Les heures sont celles de PARIS
// (le serveur les rend ainsi) : le témoin passe sur une machine réglée en UTC comme à Paris.

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

describe('RESA-L5A2 — les états d’une réservation (plan §1.2)', () => {
  it('les 5 états du serveur ont leur libellé', () => {
    expect(['en_attente', 'confirmee', 'refusee', 'sans_reponse', 'annulee']
      .map((statut) => libelleStatut(t, statut)))
      .toEqual(['En attente', 'Confirmée', 'Refusée', 'Sans réponse', 'Annulée']);
    expect(libelleStatut(t, 'inconnu')).toBe('');
  });
});

describe('RESA-L5A2 — « Expire dans … » (E-G06)', () => {
  const maintenant = new Date('2026-10-14T08:00:00.000Z');
  it('en minutes, en heures, en jours ; rien une fois passée', () => {
    expect(expireDans(t, '2026-10-14T08:40:00.000Z', maintenant)).toBe('Expire dans 40 min');
    expect(expireDans(t, '2026-10-14T13:10:00.000Z', maintenant)).toBe('Expire dans 5 h');
    expect(expireDans(t, '2026-10-15T09:00:00.000Z', maintenant)).toBe('Expire dans 1 jour');
    expect(expireDans(t, '2026-10-17T09:00:00.000Z', maintenant)).toBe('Expire dans 3 jours');
    expect(expireDans(t, '2026-10-14T07:00:00.000Z', maintenant)).toBe('');
    expect(expireDans(t, null, maintenant)).toBe('');
  });
});

describe('RESA-L5A2 — les jours et les heures', () => {
  it('« lundi 19/10 », « Vendredi 16 octobre », « 10 h – 11 h »', () => {
    expect(jourCourt('2026-10-19')).toBe('lundi 19/10');
    expect(jourCourt('2026-10-18')).toBe('dimanche 18/10');
    expect(titreDuJour('2026-10-16')).toBe('Vendredi 16 octobre');
    expect(plageHoraire('10:00', '11:00')).toBe('10 h – 11 h');
    expect(plageHoraire('18:30', '20:00')).toBe('18 h 30 – 20 h');
  });

  it('les jours civils : +n jours, et le lundi de la semaine', () => {
    expect(enJours('2026-10-14', 1)).toBe('2026-10-15');
    expect(enJours('2026-10-31', 1)).toBe('2026-11-01');
    expect(enJours('2026-10-14', -1)).toBe('2026-10-13');
    expect(joursDeLaSemaine('2026-10-14')).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17',
      '2026-10-18',
    ]);
  });

  it('le jour et l’heure de Paris d’un instant', () => {
    // 23 h 30 en UTC le 14 = 1 h 30 le 15 à Paris (heure d'été).
    const instant = new Date('2026-10-14T23:30:00.000Z');
    expect(aujourdhuiAParis(instant)).toBe('2026-10-15');
    expect(minutesAParis(instant)).toBe(90);
  });

  it('une lecture par pages : les lignes réunies, le total du serveur', () => {
    const donnees = {
      pages: [
        { items: [{ documentId: 'a' }], pagination: { page: 1, pageSize: 20, total: 21 } },
        { items: [{ documentId: 'b' }], pagination: { page: 2, pageSize: 20, total: 21 } },
      ],
    };
    expect(lignesDesPages(donnees).map((ligne) => ligne.documentId)).toEqual(['a', 'b']);
    expect(totalDesPages(donnees)).toBe(21);
    expect(lignesDesPages(undefined)).toEqual([]);
    expect(totalDesPages(undefined)).toBeNull();
  });

  // RESA-FIN-APP-3 (23/10/2026) — « Aujourd'hui (n) » : seules les Confirmées et les demandes En
  // attente comptent (la tuile de l'accueil, « À venir ») ; la liste montre aussi les annulées.
  it('le nombre qui compte : le total moins les lignes lues qui ne tiennent pas le créneau', () => {
    const page = (/** @type {string[]} */ statuts, total = statuts.length) => ({
      items: statuts.map((status, i) => ({ documentId: `r-${i}`, status })),
      pagination: { page: 1, pageSize: 20, total },
    });
    expect(totalQuiCompte({
      pages: [page(['confirmee', 'en_attente', 'annulee', 'refusee', 'sans_reponse'])],
    })).toBe(2);
    expect(totalQuiCompte({ pages: [page(['confirmee', 'annulee'], 30)] })).toBe(29);
    expect(totalQuiCompte({ pages: [page([])] })).toBe(0);
    expect(totalQuiCompte(undefined)).toBeNull();
  });

  it('une liste groupée par jour, dans l’ordre reçu', () => {
    const groupes = grouperParJour([
      { date: '2026-10-15', documentId: 'a' },
      { date: '2026-10-15', documentId: 'b' },
      { date: '2026-10-16', documentId: 'c' },
    ]);
    expect(groupes.map((groupe) => [groupe.date, groupe.items.length]))
      .toEqual([['2026-10-15', 2], ['2026-10-16', 1]]);
  });
});

describe('RESA-L5A2 — le planning (E-G03)', () => {
  const creneau = (/** @type {Record<string, any>} */ autres) => ({
    closure: null, from: '20:00', reservation: null, state: 'libre', to: '21:00', ...autres,
  });

  it('chaque créneau dit son état et sa source', () => {
    expect([
      creneau({ reservation: { label: 'Julien M.' }, state: 'reserve-app' }),
      creneau({ reservation: { label: 'M. Dupont' }, state: 'reserve-exterieur' }),
      creneau({ reservation: { label: 'Lina T.' }, state: 'en-attente' }),
      creneau({ closure: { kind: 'block', label: 'entretien' }, state: 'bloque' }),
      creneau({ closure: { kind: 'block', label: null }, state: 'bloque' }),
      creneau({ closure: { kind: 'closure', reason: 'travaux' }, state: 'ferme' }),
      creneau({
        closure: { kind: 'closure', label: 'Jour férié', reason: 'autre' }, state: 'ferme',
      }),
      creneau({}),
    ].map((c) => libelleDuCreneau(t, c))).toEqual([
      'Julien M. · App',
      'M. Dupont · Extérieur',
      'Lina T. · En attente',
      'Bloqué : entretien',
      'Bloqué',
      'Fermé : travaux',
      'Fermé : Jour férié',
      'Libre',
    ]);
    expect(['reserve-app', 'reserve-exterieur', 'en-attente', 'bloque', 'ferme', 'libre', '?']
      .map(etatDeFrise))
      .toEqual(['app', 'exterieur', 'attente', 'bloque', 'ferme', 'libre', 'libre']);
  });

  it('« 12 – 18 octobre », « 28 septembre – 4 octobre »', () => {
    expect(semaineLisible('2026-10-12')).toBe('12 – 18 octobre');
    expect(semaineLisible('2026-09-28')).toBe('28 septembre – 4 octobre');
  });

  it('bloquer à partir d’ici : les fins possibles, les créneaux réservés gardés', () => {
    const jour = [
      creneau({ from: '18:00', state: 'reserve-app', to: '19:00' }),
      creneau({ from: '20:00', to: '21:00' }),
      creneau({ from: '21:00', state: 'en-attente', to: '22:00' }),
      creneau({ from: '22:00', to: '23:00' }),
      creneau({ from: '23:00', state: 'ferme', to: '23:30' }),
    ];
    expect(finsPossibles(jour, '20:00')).toEqual([
      { bloques: 1, gardes: 0, to: '21:00' },
      { bloques: 1, gardes: 1, to: '22:00' },
      { bloques: 2, gardes: 1, to: '23:00' },
    ]);
    // Un créneau qui n'est pas libre n'ouvre pas de plage ; une fermeture l'arrête.
    expect(finsPossibles(jour, '18:00')).toEqual([]);
  });
});

describe('RESA-L5A2 — l’accueil (E-G02) : frise, chiffres, prochaines, hier', () => {
  /**
   * Un créneau d'une heure (heure d'été : Paris = UTC+2).
   * @param {string} date - Le jour.
   * @param {number} heure - L'heure de début, à Paris.
   * @param {string} state - L'état.
   * @param {Record<string, any>} [autres] - La réservation, la fermeture.
   * @returns {Record<string, any>} Le créneau.
   */
  const creneau = (date, heure, state, autres = {}) => ({
    closure: null,
    endsAt: `${date}T${String(heure - 1).padStart(2, '0')}:00:00.000Z`,
    from: `${String(heure).padStart(2, '0')}:00`,
    reservation: null,
    startsAt: `${date}T${String(heure - 2).padStart(2, '0')}:00:00.000Z`,
    state,
    to: `${String(heure + 1).padStart(2, '0')}:00`,
    ...autres,
  });
  const PLANNING = {
    terrains: [{
      days: [
        {
          date: '2026-10-13',
          slots: [
            creneau('2026-10-13', 18, 'reserve-app'),
            creneau('2026-10-13', 19, 'reserve-exterieur'),
          ],
        },
        {
          date: '2026-10-14',
          slots: [
            creneau('2026-10-14', 18, 'reserve-app', {
              reservation: { documentId: 'r-1', label: 'Julien M.' },
            }),
            creneau('2026-10-14', 19, 'libre'),
            creneau('2026-10-14', 20, 'en-attente', {
              reservation: { documentId: 'r-2', label: 'Lina T.' },
            }),
            creneau('2026-10-14', 21, 'ferme', { closure: { kind: 'closure', reason: 'travaux' } }),
          ],
        },
      ],
      documentId: 't-1',
      name: 'Terrain 1',
    }],
  };

  it('la frise : chaque créneau du jour, son état, une réservation nommée', () => {
    expect(lignesDeLaFrise(t, PLANNING, '2026-10-14')).toEqual([{
      cle: 't-1',
      creneaux: [
        {
          etat: 'app', from: '18:00', libelle: 'Julien M.', reservationId: 'r-1', to: '19:00',
        },
        {
          etat: 'libre', from: '19:00', reservationId: null, to: '20:00',
        },
        {
          etat: 'attente', from: '20:00', libelle: 'Lina T.', reservationId: 'r-2', to: '21:00',
        },
        {
          etat: 'ferme',
          from: '21:00',
          libelle: 'Fermé : travaux',
          reservationId: null,
          to: '22:00',
        },
      ],
      nom: 'Terrain 1',
    }]);
    expect(lignesDeLaFrise(t, PLANNING, '2026-10-20')).toEqual([]);
  });

  it('les chiffres : du jour, de la semaine (fermé = pas offert), d’hier', () => {
    // Semaine : 6 créneaux dont 1 fermé ⇒ 5 h offertes, 4 h occupées (2 hier, 2 aujourd'hui).
    expect(chiffresDuPlanning(PLANNING, '2026-10-14')).toEqual({
      hier: 2, occupation: 80, reservations: 2,
    });
    expect(chiffresDuPlanning(undefined, '2026-10-14')).toEqual({
      hier: 0, occupation: 0, reservations: 0,
    });
  });

  it('les 3 prochaines : actives, à venir, dans l’ordre', () => {
    const maintenant = new Date('2026-10-14T16:30:00.000Z');
    const ligne = (
      /** @type {string} */ id,
      /** @type {string} */ debut,
      status = 'confirmee',
    ) => ({
      documentId: id, startsAt: debut, status,
    });
    expect(prochainesReservations([
      ligne('passee', '2026-10-14T16:00:00.000Z'),
      ligne('d', '2026-10-16T17:00:00.000Z'),
      ligne('a', '2026-10-14T17:00:00.000Z'),
      ligne('annulee', '2026-10-14T18:00:00.000Z', 'annulee'),
      ligne('b', '2026-10-14T19:00:00.000Z', 'en_attente'),
      ligne('c', '2026-10-15T17:00:00.000Z'),
    ], maintenant).map((l) => l.documentId)).toEqual(['a', 'b', 'c']);
  });
});

describe('RESA-L5A2 — les fermetures (E-G10)', () => {
  it('les 4 motifs et ce qu’ils envoient au serveur', () => {
    expect(MOTIFS_DE_FERMETURE.map((motif) => [motif.texte(t), motif.corps(t)])).toEqual([
      ['Travaux', { reason: 'travaux' }],
      ['Jour férié', { label: 'Jour férié', reason: 'autre' }],
      ['Météo', { label: 'Météo', reason: 'autre' }],
      ['Autre', { reason: 'autre' }],
    ]);
  });

  it('les dates saisies, les jours lisibles', () => {
    expect(versJourIso('25/10/2026')).toBe('2026-10-25');
    expect(versJourIso('2026-10-25')).toBe('');
    expect(joursLisibles('2026-10-25', '2026-10-26')).toBe('25/10 – 26/10');
    expect(joursLisibles('2026-10-25', '2026-10-25')).toBe('25/10');
  });

  it('une ligne par geste : les terrains réunis, les blocages et les rouvertes à part', () => {
    const terrains = [
      { documentId: 't-1', name: 'Terrain 1' },
      { documentId: 't-2', name: 'Terrain 2' },
      { documentId: 't-3', name: 'Padel A' },
    ];
    const fermeture = (/** @type {Record<string, any>} */ autres) => ({
      endDate: '2026-10-26',
      kind: 'closure',
      label: null,
      reason: 'travaux',
      startDate: '2026-10-25',
      status: 'active',
      ...autres,
    });
    const lignes = regrouperFermetures(t, [
      fermeture({ documentId: 'f-1', terrainId: 't-1' }),
      fermeture({ documentId: 'f-2', terrainId: 't-2' }),
      fermeture({ documentId: 'f-3', kind: 'block', terrainId: 't-1' }),
      fermeture({ documentId: 'f-5', status: 'reopened', terrainId: 't-3' }),
      fermeture({
        documentId: 'f-4',
        endDate: '2026-10-15',
        label: 'Météo',
        reason: 'autre',
        startDate: '2026-10-13',
        terrainId: 't-3',
      }),
    ], terrains, '2026-10-14');
    // RESA-FIN-APP-2 : la rouverte reste, à part (« Rouverte », plan E-G10 §5).
    expect(lignes.map((ligne) => [
      ligne.motif, ligne.terrains, ligne.ids, ligne.enCours, ligne.rouverte,
    ])).toEqual([
      ['Météo', ['Padel A'], ['f-4'], true, false],
      ['Travaux', ['Terrain 1', 'Terrain 2'], ['f-1', 'f-2'], false, false],
      ['Travaux', ['Padel A'], ['f-5'], false, true],
    ]);
  });
});

describe('RESA-L5A2 — le réserveur dans la fiche (E-G05)', () => {
  it('le nom court, les initiales, le numéro lisible', () => {
    expect(nomCourt({ firstname: 'Julien', lastname: 'marchal' })).toBe('Julien M.');
    expect(nomCourt({ firstname: '', lastname: 'Marchal' })).toBe('M.');
    expect(nomCourt(null)).toBe('');
    expect(initialesDe({ firstname: 'Julien', lastname: 'Marchal' })).toBe('JM');
    expect(telephoneLisible('+33639985678')).toBe('06 39 98 56 78');
    expect(telephoneLisible('0639985678')).toBe('06 39 98 56 78');
    expect(telephoneLisible('+3225551234')).toBe('+3225551234');
  });
});

describe('RESA-L5A2 — l’historique de la fiche (E-G05)', () => {
  it('des faits datés, « par toi » pour le complexe, le nom court pour le réserveur', () => {
    const lignes = historiqueLisible(t, [
      { at: '2026-10-12T19:04:00.000Z', kind: 'reservee' },
      { at: '2026-10-13T08:00:00.000Z', kind: 'acceptee' },
      { at: '2026-10-14T16:30:00.000Z', by: 'reserveur', kind: 'annulee' },
    ], { reserveur: 'Julien M.' });
    expect(lignes).toEqual([
      'Réservée le 12/10 à 21 h 04 dans l’app',
      'Acceptée par toi le 13/10 à 10 h',
      'Annulée par Julien M. le 14/10 à 18 h 30',
    ]);
  });

  it('une note extérieure, un refus, une demande expirée, une annulation par le complexe', () => {
    expect(historiqueLisible(t, [
      { at: '2026-10-13T08:12:00.000Z', kind: 'notee' },
      { at: '2026-10-13T09:00:00.000Z', kind: 'refusee' },
      { at: '2026-10-13T10:00:00.000Z', kind: 'sans-reponse' },
      { at: '2026-10-13T11:00:00.000Z', by: 'complexe', kind: 'annulee' },
      { at: null, kind: 'inconnu' },
    ], { reserveur: '' })).toEqual([
      'Notée par toi le 13/10 à 10 h 12',
      'Refusée par toi le 13/10 à 11 h',
      'Sans réponse le 13/10 à 12 h',
      'Annulée par toi le 13/10 à 13 h',
    ]);
  });
});

describe('RESA-L5A2 — les refus du serveur, nommés (contrat L2A)', () => {
  const refus = (/** @type {string} */ code, message = 'Phrase du serveur.') => ({
    details: { code }, message, status: 409,
  });

  it('créneau pris, introuvable, déjà traitée, motif manquant', () => {
    expect(messageDeRefusResa(t, refus('COMPLEXE_RESERVATION_SLOT_TAKEN'), 'repli'))
      .toBe('Ce créneau vient d’être pris.');
    expect(messageDeRefusResa(t, refus('COMPLEXE_RESERVATION_NOT_FOUND'), 'repli'))
      .toBe('Cette réservation n’existe plus.');
    const etat = refus('COMPLEXE_RESERVATION_STATE', 'Cette demande a expiré.');
    expect(messageDeRefusResa(t, etat, 'repli'))
      .toBe('Cette demande a expiré.');
    expect(messageDeRefusResa(
      t,
      refus('COMPLEXE_RESERVATION_INVALID', 'Donne un motif : le joueur le lira.'),
      'repli',
    )).toBe('Donne un motif : le joueur le lira.');
  });

  it('fermeture : le texte « Ville » du serveur est traduit (contrat L2A)', () => {
    const ville = refus('FACILITY_CLOSURE_MANAGER_REQUIRED', 'La Ville seule');
    expect(messageDeRefusResa(t, ville, 'repli'))
      .toBe('Tu ne gères pas ce terrain.');
  });

  it('le reste : les refus du complexe (L5A1), puis le repli', () => {
    expect(messageDeRefusResa(t, refus('COMPLEXE_NOT_FOUND'), 'repli'))
      .toBe('Ce complexe est introuvable, ou tu ne le gères plus.');
    expect(messageDeRefusResa(t, { message: 'boum', status: 500 }, 'repli')).toBe('repli');
  });

  it('les 4 motifs de refus en un appui (E-G05 état 3)', () => {
    expect(MOTIFS_DE_REFUS.map((motif) => motif.texte(t))).toEqual([
      'Créneau déjà pris à l’extérieur',
      'Fermeture',
      'Terrain indisponible',
      'Autre',
    ]);
  });
});
