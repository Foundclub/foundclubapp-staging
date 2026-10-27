import {
  etatDepuisLaVue,
  etatInitial,
  finAutomatique,
  garderBrouillon,
  lireBrouillon,
  occupationDesLieux,
  occupationLabel,
  oublierBrouillon,
  placesLabel,
  repetitionLabel,
  verifierEvenement,
  versCorpsDeLApi,
} from '@/domains/collectivite/evenementDeLaVille';

// 🏛️ VILLEEVT-CODE (27/10/2026, décisions d'Adel du 25/10 « 9- 1a 2B 3B 4B ») — l'événement de la
// Ville rattrape l'entraîneur (lignes 3, 5 et 12 du tableau de VILLEEVT), puis « Répéter » et
// « N places ». Ce témoin fige, en règles pures :
//   - ligne 3 : la fin suit le début (une heure après) ; un début passé se refuse ;
//   - 3B : « Nombre de places », facultatif, un entier de 1 à 100 000 ; « 200 places » ;
//   - 2B : la répétition part au serveur (`repetition`), « sauf vacances » compris, jamais sur
//     plusieurs jours ni en « Modifier » ; sa phrase (« Chaque samedi jusqu'au … ») ;
//   - ligne 5 : une installation dont l'occupation n'a pas pu être lue dit « Impossible de vérifier » ;
//   - ligne 12 : le brouillon se garde, se relit (dates comprises), s'oublie.

const t = (/** @type {string} */ _cle, /** @type {any} */ repli, /** @type {any} */ options) => String(
  typeof repli === 'string' ? repli : '',
).replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? (typeof repli === 'object' ? repli?.[nom] : '') ?? ''));

const FETE = {
  ...etatInitial(),
  date: '2026-10-24',
  facilityId: 'stade',
  heureDebut: '10:00',
  heureFin: '17:00',
  name: 'Fête du sport',
};
const MAINTENANT = new Date(2026, 9, 24, 12, 0);

describe('VILLEEVT-CODE — ligne 3 : la fin suit le début, un début passé se refuse', () => {
  it('🔴 la fin vide, ou avant le nouveau début : une heure après ; choisie plus tard : gardée', () => {
    expect(finAutomatique('10:00', '')).toBe('11:00');
    expect(finAutomatique('18:30', '17:00')).toBe('19:30');
    expect(finAutomatique('10:00', '17:00')).toBe('17:00');
    expect(finAutomatique('23:30', '')).toBe('23:59');
    expect(finAutomatique('', '17:00')).toBe('17:00');
  });

  it('🔴 aujourd’hui à 10:00 quand il est 12:00 : « début passé » ; un jour passé aussi', () => {
    expect(verifierEvenement(FETE, { maintenant: MAINTENANT }).heures)
      .toBe('collectiviteEvenement.refus.debutPasse');
    expect(verifierEvenement({ ...FETE, date: '2026-10-23' }, { maintenant: MAINTENANT }).date)
      .toBe('collectiviteEvenement.refus.datePassee');
    expect(verifierEvenement({ ...FETE, heureDebut: '14:00' }, { maintenant: MAINTENANT }))
      .toEqual({});
    // « Modifier » un événement du jour déjà commencé reste possible (le serveur juge la fin).
    expect(verifierEvenement(FETE, { maintenant: MAINTENANT, modification: true })).toEqual({});
  });
});

describe('VILLEEVT-CODE — 3B : « N places »', () => {
  it('🔴 facultatif ; un entier de 1 à 100 000, sinon un refus', () => {
    const futur = { ...FETE, date: '2026-11-07' };
    expect(verifierEvenement({ ...futur, capacite: '' }, { maintenant: MAINTENANT })).toEqual({});
    expect(verifierEvenement({ ...futur, capacite: '200' }, { maintenant: MAINTENANT })).toEqual({});
    ['0', '-2', '2,5', 'beaucoup', '100001'].forEach((capacite) => {
      expect(verifierEvenement({ ...futur, capacite }, { maintenant: MAINTENANT }).capacite)
        .toBe('collectiviteEvenement.refus.places');
    });
  });

  it('🔴 le corps porte `capacity` (null sans places) ; « Modifier » la relit', () => {
    expect(versCorpsDeLApi({ ...FETE, capacite: '200' }).data.capacity).toBe(200);
    expect(versCorpsDeLApi({ ...FETE, capacite: '' }).data.capacity).toBeNull();
    expect(etatDepuisLaVue({ capacity: 80, startDate: '2026-10-24' }).capacite).toBe('80');
    expect(etatDepuisLaVue({ capacity: null, startDate: '2026-10-24' }).capacite).toBe('');
  });

  it('🔴 « 1 place », « 200 places », rien sans places', () => {
    expect(placesLabel(t, 1)).toBe('1 place');
    expect(placesLabel(t, 200)).toBe('200 places');
    expect(placesLabel(t, null)).toBe('');
  });
});

describe('VILLEEVT-CODE — 2B : « Répéter »', () => {
  const chaqueSamedi = {
    au: new Date(2026, 10, 14), du: new Date(2026, 9, 24), frequence: 'week', intervalleTexte: '1', jours: [6],
  };

  it('🔴 la répétition part au serveur, « sauf vacances » compris', () => {
    expect(versCorpsDeLApi({ ...FETE, repetition: chaqueSamedi, saufVacances: true }).data.repetition)
      .toEqual({
        au: '2026-11-14', frequence: 'week', intervalle: 1, jours: [6], saufVacances: true,
      });
    expect(versCorpsDeLApi(FETE).data.repetition).toBeUndefined();
  });

  it('🔴 jamais avec « Sur plusieurs jours »', () => {
    const corps = versCorpsDeLApi({
      ...FETE, dateFin: '2026-10-25', plusieursJours: true, repetition: chaqueSamedi,
    });
    expect(corps.data.repetition).toBeUndefined();
    expect(corps.data.endDate).toBe('2026-10-25');
  });

  it('🔴 « jusqu’au » avant la date : un refus', () => {
    const avant = { ...chaqueSamedi, au: new Date(2026, 9, 20) };
    expect(verifierEvenement({ ...FETE, date: '2026-10-25', repetition: avant }, { maintenant: MAINTENANT })
      .repetition).toBe('collectiviteEvenement.refus.repetitionFin');
  });

  it('🔴 sa phrase, pour la fiche : la règle du serveur', () => {
    expect(repetitionLabel(t, {
      au: '2026-11-14', frequence: 'week', intervalle: 1, jours: [6], saufVacances: false,
    })).toBe('Chaque semaine (samedi) jusqu’au sam. 14 nov.');
    expect(repetitionLabel(t, {
      au: '2027-04-30', frequence: 'month', intervalle: 2, jours: [], saufVacances: true,
    })).toBe('Tous les 2 mois jusqu’au ven. 30 avr., sauf vacances scolaires');
    expect(repetitionLabel(t, null)).toBe('');
  });
});

describe('VILLEEVT-CODE — ligne 5 : « Impossible de vérifier »', () => {
  it('🔴 une lecture en échec ne dit pas « libre » : elle dit qu’on n’a pas pu vérifier', () => {
    const occupations = occupationDesLieux({
      echecs: [true, false],
      fenetre: { date: '2026-10-24', heureDebut: '10:00', heureFin: '17:00' },
      fermetures: [],
      installations: [{ documentId: 'gym' }, { documentId: 'stade' }],
      lectures: [undefined, { data: [] }],
    });
    expect(occupations.gym.erreur).toBe(true);
    expect(occupationLabel(t, occupations.gym)).toBe('Impossible de vérifier');
    expect(occupationLabel(t, occupations.stade)).toBe('Libre sur ces heures');
  });
});

describe('VILLEEVT-CODE — ligne 12 : le brouillon', () => {
  beforeEach(() => {
    const memoire = new Map();
    global.window = /** @type {any} */ ({
      sessionStorage: {
        getItem: (/** @type {string} */ cle) => (memoire.has(cle) ? memoire.get(cle) : null),
        removeItem: (/** @type {string} */ cle) => memoire.delete(cle),
        setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => memoire.set(cle, valeur),
      },
    });
  });
  afterEach(() => {
    delete global.window;
  });

  it('🔴 gardé, relu (les dates de « Répéter » redeviennent des dates), puis oublié', () => {
    const etat = {
      ...FETE,
      repetition: {
        au: new Date(2026, 10, 14), du: new Date(2026, 9, 24), frequence: 'week', intervalleTexte: '1', jours: [6],
      },
    };
    garderBrouillon('ville-1', etat);
    const relu = lireBrouillon('ville-1');
    expect(relu.name).toBe('Fête du sport');
    expect(relu.repetition.au).toBeInstanceOf(Date);
    expect(relu.repetition.au.getDate()).toBe(14);
    expect(lireBrouillon('ville-2')).toBeNull();
    oublierBrouillon('ville-1');
    expect(lireBrouillon('ville-1')).toBeNull();
  });

  it('🔴 sans stockage (téléphone) : rien, sans erreur', () => {
    delete global.window;
    expect(() => garderBrouillon('ville-1', FETE)).not.toThrow();
    expect(lireBrouillon('ville-1')).toBeNull();
  });
});
