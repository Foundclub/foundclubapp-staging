import {
  ajouterJours,
  contenuDEchec,
  dateEtHeureDeParis,
  demandeDeReservation,
  etatAffiche,
  filtresDeRecherche,
  horairesLisibles,
  jourDeParis,
  libelleEtatDuCreneau,
  libelleModeJoueur,
  lienAgendaGoogle,
  lignesDuTerrainPublic,
  momentLisible,
  numeroLisible,
  parametresDEchec,
  prixDuCreneau,
  prixDuTerrainPublic,
  quatorzeJours,
  texteAnnulation,
  texteCreneau,
  texteJourCourt,
  texteJourLong,
  texteKilometres,
  varianteDEchec,
  varianteDeLaReservation,
} from './reserverTerrain';

// RESA-L6A (14/10/2026) — les règles PURES du joueur (plan des écrans E-P01 à E-P07, E-P13 ;
// planches P00, EP01-EP07, EP13, RA1, RA2) : le jour de Paris, les 14 jours, les mots d'un
// créneau, du mode et du prix, les filtres de la recherche, le corps de « Réserver » (liste
// blanche du serveur), et chaque refus du serveur NOMMÉ (contrat L1 + L2A, `error.details.code`).

const { t: traduire } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next;

// Les montants s'écrivent avec une espace insécable (« 60 € » ne se coupe jamais) : le
// témoin la lit comme une espace ordinaire.
const ordinaire = (/** @type {any} */ valeur) => (typeof valeur === 'string'
  ? valeur.split(String.fromCharCode(160)).join(' ')
  : valeur);
const t = (/** @type {any[]} */ ...args) => ordinaire(traduire(...args));

describe('le jour de Paris et les 14 jours (E-P03)', () => {
  it('le jour de Paris d’un instant (minuit passé à Paris, pas encore en UTC)', () => {
    expect(jourDeParis(new Date('2026-10-13T22:30:00Z'))).toBe('2026-10-14');
    expect(jourDeParis(new Date('2026-10-14T10:00:00Z'))).toBe('2026-10-14');
  });

  it('ajouter des jours à une date civile, fin de mois comprise', () => {
    expect(ajouterJours('2026-10-31', 1)).toBe('2026-11-01');
    expect(ajouterJours('2026-10-14', 13)).toBe('2026-10-27');
  });

  it('les 14 jours : « Auj. 14 », « Mer. 15 »…', () => {
    const jours = quatorzeJours(t, '2026-10-14');
    expect(jours).toHaveLength(14);
    expect(jours[0]).toEqual({ court: 'Auj.', date: '2026-10-14', numero: 14 });
    // Le 14/10/2026 est un MERCREDI (la planche, fictive, dit « mardi 14 ») : le lendemain est
    // jeudi.
    expect(jours[1]).toEqual({ court: 'Jeu.', date: '2026-10-15', numero: 15 });
    expect(jours[13].date).toBe('2026-10-27');
  });

  it('le jour en toutes lettres et en court', () => {
    expect(texteJourLong(t, '2026-10-13')).toBe('Mardi 13 octobre');
    expect(texteJourCourt(t, '2026-10-13')).toBe('Mardi 13/10');
    expect(texteJourLong(t, '2026-08-01')).toBe('Samedi 1 août');
  });
});

describe('les mots d’un créneau, du mode, du prix (P00 blocs 3 et 5, RA2)', () => {
  it('« 18 h – 19 h », « 20 h 30 – 21 h 30 »', () => {
    expect(texteCreneau('18:00', '19:00')).toBe('18 h – 19 h');
    expect(texteCreneau('20:30', '21:30')).toBe('20 h 30 – 21 h 30');
  });

  it('les états d’un créneau, au mot du joueur', () => {
    expect(libelleEtatDuCreneau(t, 'libre')).toBe('Libre');
    expect(libelleEtatDuCreneau(t, 'pris')).toBe('Pris');
    expect(libelleEtatDuCreneau(t, 'ferme')).toBe('Fermé');
    expect(libelleEtatDuCreneau(t, 'trop-tard')).toBe('Trop tard ici');
  });

  it('les trois modes, côté joueur', () => {
    expect(libelleModeJoueur(t, 'automatique')).toBe('Confirmation immédiate');
    expect(libelleModeJoueur(t, 'manuel')).toBe('Sur demande');
    expect(libelleModeJoueur(t, 'telephone')).toBe('Par téléphone');
    expect(libelleModeJoueur(t, 'autre')).toBe('');
  });

  it('le prix d’un créneau : au créneau (et par joueur), ou par joueur', () => {
    expect(prixDuCreneau(t, { amount: 60, perPlayer: 6, unit: 'creneau' }, 10)).toEqual({
      principal: '60 € le créneau',
      secondaire: 'soit 6 € par joueur à 10',
    });
    expect(prixDuCreneau(t, { amount: 6, perPlayer: 6, unit: 'joueur' }, 4)).toEqual({
      principal: '6 € par joueur',
      secondaire: '24 € pour 4 joueurs',
    });
    expect(prixDuCreneau(t, null, 10)).toBeNull();
  });

  it('le prix d’un terrain sur la page : un seul prix, ou « dès »', () => {
    expect(prixDuTerrainPublic(t, { price: { max: 60, min: 60, unit: 'creneau' } }))
      .toBe('60 €, à régler sur place');
    expect(prixDuTerrainPublic(t, { price: { max: 70, min: 50, unit: 'creneau' } }))
      .toBe('dès 50 €, à régler sur place');
    expect(prixDuTerrainPublic(t, { price: { max: 6, min: 6, unit: 'joueur' } }))
      .toBe('6 € par joueur, à régler sur place');
    expect(prixDuTerrainPublic(t, { price: null })).toBe('');
  });

  it('un numéro français lisible, un numéro étranger tel quel', () => {
    expect(numeroLisible('+33639981234')).toBe('06 39 98 12 34');
    expect(numeroLisible('0639981234')).toBe('06 39 98 12 34');
    expect(numeroLisible('+41 22 123 45 67')).toBe('+41 22 123 45 67');
    expect(numeroLisible(null)).toBe('');
  });

  it('le prix d’un terrain en deux lignes (RA2) : le créneau et la part d’un joueur', () => {
    expect(lignesDuTerrainPublic(t, {
      capacity: 10, price: { max: 60, min: 60, unit: 'creneau' },
    })).toEqual({
      principal: '60 € le créneau',
      secondaire: 'soit 6 € par joueur à 10, à régler sur place',
    });
    expect(lignesDuTerrainPublic(t, {
      capacity: 4, price: { max: 8, min: 6, unit: 'joueur' },
    })).toEqual({
      principal: 'dès 6 € par joueur',
      secondaire: '24 € pour 4 joueurs, à régler sur place',
    });
    const sansJoueurs = { capacity: null, price: { max: 40, min: 40, unit: 'creneau' } };
    expect(lignesDuTerrainPublic(t, sansJoueurs))
      .toEqual({ principal: '40 € le créneau', secondaire: 'à régler sur place' });
    expect(lignesDuTerrainPublic(t, { capacity: 10, price: null })).toBeNull();
  });

  it('les horaires d’accueil : les jours qui se suivent avec les mêmes heures, ensemble', () => {
    expect(horairesLisibles(t, [
      { day: 1, ranges: [{ from: '17:00', to: '23:00' }] },
      { day: 2, ranges: [{ from: '17:00', to: '23:00' }] },
      { day: 3, ranges: [{ from: '17:00', to: '23:00' }] },
      { day: 4, ranges: [{ from: '17:00', to: '23:00' }] },
      { day: 5, ranges: [{ from: '17:00', to: '23:00' }] },
      { day: 6, ranges: [{ from: '09:00', to: '12:00' }, { from: '14:00', to: '22:00' }] },
      { day: 7, ranges: [{ from: '09:00', to: '12:00' }, { from: '14:00', to: '22:00' }] },
    ])).toEqual([
      { heures: '17 h – 23 h', jours: 'Lundi – Vendredi' },
      { heures: '9 h – 12 h, 14 h – 22 h', jours: 'Samedi – Dimanche' },
    ]);
    expect(horairesLisibles(t, [{ day: 3, ranges: [{ from: '10:00', to: '12:00' }] }]))
      .toEqual([{ heures: '10 h – 12 h', jours: 'Mercredi' }]);
    expect(horairesLisibles(t, null)).toEqual([]);
  });

  it('le délai d’annulation du complexe, en mots', () => {
    expect(texteAnnulation(t, 24)).toBe('Annulation gratuite jusqu’à 24 h avant');
    expect(texteAnnulation(t, 0)).toBe('Annulation gratuite jusqu’au début du créneau');
  });

  it('une distance en kilomètres', () => {
    expect(texteKilometres(2.4)).toBe('2,4 km');
    expect(texteKilometres(0.6)).toBe('600 m');
    expect(texteKilometres(null)).toBe('');
  });
});

describe('la recherche (E-P01, RA1)', () => {
  it('seuls les filtres choisis partent, au format du serveur', () => {
    expect(filtresDeRecherche({
      cadre: 'interieur',
      date: '2026-10-15',
      distanceKm: 10,
      heure: 'soir',
      position: { lat: 48.8, lng: 1.4 },
      sport: 'a-five',
      texte: '  padl valbr ',
    })).toEqual({
      apres: '18:00',
      cadre: 'interieur',
      date: '2026-10-15',
      lat: 48.8,
      lng: 1.4,
      q: 'padl valbr',
      rayon: 10,
      sport: 'a-five',
    });
  });

  it('sans position, pas de rayon ; un texte d’une lettre ne part pas', () => {
    expect(filtresDeRecherche({ texte: 'p' })).toEqual({});
  });
});

describe('« Réserver » : la liste blanche du serveur (E-P04, RG-SECU)', () => {
  it('le terrain, le jour, l’heure, les joueurs, le petit mot, la case du numéro', () => {
    expect(demandeDeReservation({
      date: '2026-10-14',
      from: '18:00',
      joueurs: 10,
      mot: '  Foot   du mardi ',
      partagerNumero: true,
      peutPartagerNumero: true,
      terrainId: 't-1',
    })).toEqual({
      date: '2026-10-14',
      from: '18:00',
      note: 'Foot du mardi',
      phoneShared: true,
      players: 10,
      terrain: 't-1',
    });
  });

  it('AT-04 : un mineur ne partage jamais son numéro, quelle que soit la case', () => {
    expect(demandeDeReservation({
      date: '2026-10-14',
      from: '18:00',
      partagerNumero: true,
      peutPartagerNumero: false,
      terrainId: 't-1',
    })).toEqual({
      date: '2026-10-14', from: '18:00', note: null, phoneShared: false, terrain: 't-1',
    });
  });
});

describe('les refus du serveur, NOMMÉS (E-P13)', () => {
  const refus = (code, details = {}) => ({ details: { code, ...details }, status: 409 });

  it('chaque code du contrat a sa variante', () => {
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_SLOT_TAKEN'))).toBe('pris');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_SLOT_CLOSED'))).toBe('ferme');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_TOO_LATE'))).toBe('tropTard');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_AGE'))).toBe('age');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_BIRTHDATE_REQUIRED')))
      .toBe('dateDeNaissance');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_PLAFOND'))).toBe('plafond');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_CANCEL_TOO_LATE'))).toBe('delaiAnnulation');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_TELEPHONE'))).toBe('telephone');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_BANNED'))).toBe('banni');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_NOT_FOUND'))).toBe('introuvable');
    expect(varianteDEchec(refus('COMPLEXE_NOT_FOUND'))).toBe('complexeParti');
    expect(varianteDEchec(refus('COMPLEXE_TERRAIN_NOT_FOUND'))).toBe('terrainParti');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_STATE'))).toBe('etat');
    expect(varianteDEchec(refus('COMPLEXE_RESERVATION_INVALID'))).toBe('invalide');
  });

  it('sans réseau : rien n’est parti ; le reste : une panne', () => {
    expect(varianteDEchec({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe('reseau');
    expect(varianteDEchec({ message: 'boom', status: 500 })).toBe('panne');
  });

  it('le banni lit la phrase seule, jamais la raison du complexe (RC-P08)', () => {
    const contenu = contenuDEchec(t, 'banni', {
      erreur: refus('COMPLEXE_RESERVATION_BANNED', { reason: 'X' }),
    });
    expect(contenu.titre).toBe('Tu ne peux plus réserver dans ce complexe.');
    expect(JSON.stringify(contenu)).not.toContain('X');
    expect(contenu.actions).toEqual(['ailleurs']);
  });

  it('l’âge et le plafond lisent les chiffres du complexe', () => {
    const age = refus('COMPLEXE_RESERVATION_AGE', { minAge: 16 });
    expect(contenuDEchec(t, 'age', { erreur: age }).titre)
      .toBe('Ce complexe accepte les réservations à partir de 16 ans.');
    const plafond = refus('COMPLEXE_RESERVATION_PLAFOND', { max: 2 });
    expect(contenuDEchec(t, 'plafond', { erreur: plafond }).titre)
      .toBe('Tu as déjà 2 réservations à venir dans ce complexe (le maximum).');
  });

  it('trop tard et délai passé : le numéro du complexe pour appeler', () => {
    const tard = contenuDEchec(t, 'tropTard', {
      erreur: refus('COMPLEXE_RESERVATION_TOO_LATE', { phone: '+33639981234' }),
    });
    expect(tard.titre).toBe('Trop tard pour réserver ici : appelle le complexe.');
    expect(tard.telephone).toBe('+33639981234');
    expect(tard.actions).toEqual(['appeler']);
  });
});

describe('l’état AFFICHÉ d’une réservation (P00 bloc 4) et l’heure de Paris', () => {
  const maintenant = new Date('2026-10-14T08:00:00Z');

  it('les états du serveur, et « Jouée » quand une confirmée est passée', () => {
    const etat = (/** @type {any} */ r) => etatAffiche(r, maintenant);
    expect(etat({ endsAt: '2026-10-16T17:00:00Z', status: 'en_attente' })).toBe('enAttente');
    expect(etat({ endsAt: '2026-10-16T17:00:00Z', status: 'confirmee' })).toBe('confirmee');
    expect(etat({ endsAt: '2026-10-13T17:00:00Z', status: 'confirmee' })).toBe('jouee');
    expect(etat({ status: 'refusee' })).toBe('refusee');
    expect(etat({ status: 'sans_reponse' })).toBe('sansReponse');
    expect(etat({ cancelledBy: 'reserveur', status: 'annulee' })).toBe('annuleeParToi');
    expect(etat({ cancelledBy: 'complexe', status: 'annulee' })).toBe('annuleeParLeComplexe');
  });

  it('le jour et l’heure de Paris d’un instant', () => {
    expect(dateEtHeureDeParis('2026-10-16T14:00:00.000Z'))
      .toEqual({ date: '2026-10-16', heure: '16:00' });
    expect(dateEtHeureDeParis('2026-10-13T22:30:00.000Z'))
      .toEqual({ date: '2026-10-14', heure: '00:30' });
    expect(dateEtHeureDeParis(null)).toBeNull();
  });
});

describe('un moment lisible, l’agenda (E-P07)', () => {
  it('« 16/10 » et « 18 h » à Paris', () => {
    expect(momentLisible('2026-10-16T16:00:00.000Z')).toEqual({ heure: '18 h', jour: '16/10' });
    expect(momentLisible('2026-10-12T19:04:00.000Z')).toEqual({ heure: '21 h 04', jour: '12/10' });
    expect(momentLisible('')).toBeNull();
  });

  it('le lien Google Agenda d’une réservation (heures en UTC)', () => {
    const lien = lienAgendaGoogle({
      debut: '2026-10-16T16:00:00.000Z',
      details: 'Réservé sur FoundClub',
      fin: '2026-10-16T17:00:00.000Z',
      lieu: '12 allée des Sports, Montrivage',
      titre: 'Terrain 1 · Le Five de Montrivage',
    });
    expect(lien).toBe('https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=Terrain%201%20%C2%B7%20Le%20Five%20de%20Montrivage'
      + '&dates=20261016T160000Z/20261016T170000Z'
      + '&details=R%C3%A9serv%C3%A9%20sur%20FoundClub'
      + '&location=12%20all%C3%A9e%20des%20Sports%2C%20Montrivage');
    expect(lienAgendaGoogle({ debut: 'x', fin: null, titre: 't' })).toBeNull();
  });
});

describe('les paramètres de E-P13 (ce que l’écran des échecs doit savoir)', () => {
  it('la variante, le refus du serveur (code, détails, phrase), le créneau et le complexe', () => {
    expect(parametresDEchec({
      complexe: 'Le Five de Montrivage',
      creneau: { from: '18:00', to: '19:00' },
      date: '2026-10-14',
      erreur: {
        details: { code: 'COMPLEXE_RESERVATION_PLAFOND', max: 2 }, message: 'm', status: 409,
      },
      slug: 'le-five',
      telephone: '+33639981234',
      terrain: { documentId: 't-1', name: 'Terrain 1' },
      variante: 'plafond',
    })).toEqual({
      complexe: 'Le Five de Montrivage',
      date: '2026-10-14',
      details: { code: 'COMPLEXE_RESERVATION_PLAFOND', max: 2 },
      from: '18:00',
      message: 'm',
      slug: 'le-five',
      telephone: '+33639981234',
      terrain: 'Terrain 1',
      terrainId: 't-1',
      to: '19:00',
      variante: 'plafond',
    });
  });

  it('⛔ RC-P08 : jamais la raison privée d’un bannissement dans les paramètres', () => {
    const params = parametresDEchec({
      erreur: { details: { code: 'COMPLEXE_RESERVATION_BANNED', reason: 'secret', until: null } },
      variante: 'banni',
    });
    expect(JSON.stringify(params)).not.toContain('secret');
    expect(params).toEqual({ details: { code: 'COMPLEXE_RESERVATION_BANNED' }, variante: 'banni' });
  });
});

describe('l’état d’une réservation (E-P07, E-P13 variantes 3 à 7)', () => {
  it('refusée, sans réponse, annulée par le complexe ou par toi, fermeture', () => {
    expect(varianteDeLaReservation({ status: 'refusee' })).toBe('refusee');
    expect(varianteDeLaReservation({ status: 'sans_reponse' })).toBe('sansReponse');
    const parLeComplexe = { cancelledBy: 'complexe', status: 'annulee' };
    expect(varianteDeLaReservation(parLeComplexe)).toBe('annuleeParLeComplexe');
    expect(varianteDeLaReservation({ cancelledBy: 'reserveur', status: 'annulee' }))
      .toBe('annuleeParToi');
    expect(varianteDeLaReservation(parLeComplexe, { change: 'fermeture' }))
      .toBe('fermeture');
    expect(varianteDeLaReservation({ status: 'confirmee' })).toBeNull();
    expect(varianteDeLaReservation({ status: 'en_attente' })).toBeNull();
  });

  it('le motif du complexe est lu tel quel', () => {
    const contenu = contenuDEchec(t, 'refusee', {
      complexe: 'Le Five de Montrivage', motif: 'terrain réservé pour un tournoi.',
    });
    expect(contenu.titre).toBe('Le Five de Montrivage a refusé ta demande');
    expect(contenu.texte).toBe('Motif : terrain réservé pour un tournoi.');
  });
});
