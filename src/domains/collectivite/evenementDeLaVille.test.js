import {
  blocsDesEvenements,
  etapesDuTunnel,
  etatDepuisLaVue,
  etatInitial,
  etiquetteDuPlanning,
  fermeturesSansLesEvenements,
  lieuLabel,
  occupationDesLieux,
  occupationLabel,
  quandLabel,
  quiLeVoitLabel,
  seancesToucheesTitre,
  seanceToucheeLabel,
  verifierEvenement,
  versCorpsDeLApi,
} from '@/domains/collectivite/evenementDeLaVille';

import { toDeviceDateFromParisInstant } from '@/utils/parisTime';

// 🏛️ R17-EVT-1 (20/10/2026, REC17-005) — l'événement de la Ville, en règles pures (planches
// P10-evenement-ordi / -tel, P11-evenement-v2-tel). Ce témoin fige : les étapes du tunnel (6, ou 4
// depuis une case du planning ; « Ailleurs » saute « Quelle place ? »), les refus du formulaire,
// le corps envoyé au serveur (« Qui le voit ? » en 3 niveaux, toute la place ou aucune) et les
// phrases du récapitulatif.

const t = (/** @type {string} */ _cle, /** @type {string} */ repli, /** @type {any} */ options) => String(repli).replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));

const FETE = {
  ...etatInitial(),
  date: '2026-10-24',
  facilityId: 'stade',
  heureDebut: '10:00',
  heureFin: '17:00',
  name: 'Fête du sport',
};

describe('R17-EVT-1 — l’événement de la Ville, en règles pures', () => {
  // VILLEEVT-CODE (27/10) : un jour passé se refuse désormais ; l'horloge est figée avant le 24/10.
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date(2026, 9, 20, 8, 0) });
  });
  afterAll(() => {
    jest.useRealTimers();
  });
  it('le tunnel : 6 étapes ; 4 depuis une case ; « Ailleurs » saute la place', () => {
    expect(etapesDuTunnel()).toEqual(['quoi', 'quand', 'ou', 'place', 'qui', 'recap']);
    expect(etapesDuTunnel({ depuisUneCase: true })).toEqual(['quoi', 'place', 'qui', 'recap']);
    expect(etapesDuTunnel({ ailleurs: true })).toEqual(['quoi', 'quand', 'ou', 'qui', 'recap']);
  });

  it('l’état initial de la planche ; la case du planning pré-remplit', () => {
    expect(etatInitial()).toMatchObject({
      audience: 'dirigeants',
      takesPlace: true,
      visibility: 'actualite',
    });
    expect(
      etatInitial({
        date: '2026-10-24',
        endTime: '15:30',
        facilityId: 'stade',
        startTime: '14:00',
      }),
    ).toMatchObject({
      date: '2026-10-24',
      facilityId: 'stade',
      heureDebut: '14:00',
      heureFin: '15:30',
    });
  });

  it('les refus du formulaire, champ par champ', () => {
    expect(verifierEvenement(FETE)).toEqual({});
    expect(verifierEvenement({ ...FETE, name: '  ' })).toEqual({
      name: 'collectiviteEvenement.refus.nom',
    });
    expect(verifierEvenement({ ...FETE, heureFin: '09:00' })).toEqual({
      heures: 'collectiviteEvenement.refus.finApresDebut',
    });
    expect(verifierEvenement({ ...FETE, dateFin: '2026-10-23', plusieursJours: true })).toEqual({
      dateFin: 'collectiviteEvenement.refus.finApresDebut',
    });
    expect(verifierEvenement({ ...FETE, facilityId: null })).toEqual({
      lieu: 'collectiviteEvenement.refus.lieu',
    });
    expect(verifierEvenement({ ...FETE, adresse: '', ailleurs: true })).toEqual({
      lieu: 'collectiviteEvenement.refus.lieu',
    });
  });

  it('le corps envoyé : niveaux, audience, « Ailleurs », plusieurs jours', () => {
    expect(versCorpsDeLApi(FETE).data).toEqual({
      address: null,
      audience: 'dirigeants',
      // VILLEEVT-CODE (3B) : sans places, null.
      capacity: null,
      description: null,
      endDate: null,
      endTime: '17:00',
      facilityId: 'stade',
      kind: 'manifestation',
      name: 'Fête du sport',
      startDate: '2026-10-24',
      startTime: '10:00',
      takesPlace: true,
      visibility: 'actualite',
    });
    expect(versCorpsDeLApi({ ...FETE, visibility: 'clubs' }).data.audience).toBeNull();
    expect(
      versCorpsDeLApi({ ...FETE, audience: 'dirigeants', visibility: 'public' }).data.audience,
    ).toBe('membres');
    const ailleurs = versCorpsDeLApi({
      ...FETE,
      adresse: ' Parc des sports ',
      ailleurs: true,
    }).data;
    expect(ailleurs).toMatchObject({
      address: 'Parc des sports',
      facilityId: null,
      takesPlace: false,
    });
    expect(
      versCorpsDeLApi({ ...FETE, dateFin: '2026-10-25', plusieursJours: true }).data.endDate,
    ).toBe('2026-10-25');
    expect(
      versCorpsDeLApi({ ...FETE, dateFin: '2026-10-25', plusieursJours: false }).data.endDate,
    ).toBeNull();
  });

  // R17-EVT-1-BIS (f) (20/10, tri du chef) : l'affiche (facultative). Le corps ne porte `poster`
  // que si elle a CHANGÉ (ajoutée : son id ; retirée : null) ; sinon il ne la touche pas (le
  // serveur garde celle qui est en place). ROUGE avant (aucune affiche).
  it('🔴 l’affiche : envoyée si elle change ; « Modifier » garde celle en place', () => {
    expect(etatInitial()).toMatchObject({ affiche: null, afficheModifiee: false });
    expect('poster' in versCorpsDeLApi(FETE).data).toBe(false);
    expect(versCorpsDeLApi({
      ...FETE, affiche: { id: 12, url: '/uploads/a.jpg' }, afficheModifiee: true,
    }).data.poster).toBe(12);
    const retiree = versCorpsDeLApi({ ...FETE, affiche: null, afficheModifiee: true });
    expect(retiree.data.poster).toBeNull();
    const enPlace = etatDepuisLaVue({
      name: 'Fête du sport',
      poster: {
        formats: null, height: 1200, url: '/uploads/fete.jpg', width: 800,
      },
      startDate: '2026-10-24',
    });
    expect(enPlace).toMatchObject({
      affiche: { id: null, url: '/uploads/fete.jpg' },
      afficheModifiee: false,
    });
    expect('poster' in versCorpsDeLApi(enPlace).data).toBe(false);
  });

  // R17-EVT-1-BIS (e) (20/10) : « Ailleurs » se place sur la carte (saisie R17-ADRESSE) ; le corps
  // porte son point (`addressLocation` { lat, lng }), null s'il n'est que du texte ; jamais
  // avec une installation. « Modifier » repart du point en place. ROUGE avant.
  it('🔴 « Ailleurs » : l’adresse et son point ; une installation, aucun point', () => {
    const place = versCorpsDeLApi({
      ...FETE,
      adresse: 'Parc des sports',
      adresseLieu: { label: 'Parc des sports', lat: 45.75, lng: 4.83 },
      ailleurs: true,
    }).data;
    expect(place).toMatchObject({
      address: 'Parc des sports', addressLocation: { lat: 45.75, lng: 4.83 },
    });
    const texte = versCorpsDeLApi({ ...FETE, adresse: 'Salle des fêtes', ailleurs: true }).data;
    expect(texte.addressLocation).toBeNull();
    expect('addressLocation' in versCorpsDeLApi(FETE).data).toBe(false);
    expect(etatDepuisLaVue({
      address: 'Parc des sports',
      addressLocation: { lat: 45.75, lng: 4.83 },
      facility: null,
      name: 'Cross',
      startDate: '2026-10-24',
    })).toMatchObject({
      adresse: 'Parc des sports',
      adresseLieu: { label: 'Parc des sports', lat: 45.75, lng: 4.83 },
      ailleurs: true,
    });
  });

  it('« Modifier » repart de la vue de la Ville', () => {
    const etat = etatDepuisLaVue({
      address: null,
      audience: 'membres',
      description: 'Stands',
      endDate: '2026-10-25',
      endTime: '17:00',
      facility: { documentId: 'stade', name: 'Stade municipal' },
      kind: 'tournoi',
      name: 'Tournoi',
      startDate: '2026-10-24',
      startTime: '10:00',
      takesPlace: false,
      visibility: 'public',
    });
    expect(etat).toMatchObject({
      ailleurs: false,
      audience: 'membres',
      dateFin: '2026-10-25',
      facilityId: 'stade',
      kind: 'tournoi',
      plusieursJours: true,
      takesPlace: false,
      visibility: 'public',
    });
  });

  it('les phrases du récapitulatif et du planning', () => {
    expect(quandLabel(t, { endTime: '17:00', startDate: '2026-10-24', startTime: '10:00' })).toBe(
      'sam. 24 oct. · 10:00 – 17:00',
    );
    expect(
      quandLabel(t, {
        endDate: '2026-10-25',
        endTime: '17:00',
        startDate: '2026-10-24',
        startTime: '10:00',
      }),
    ).toBe('du sam. 24 oct. au dim. 25 oct. · 10:00 – 17:00');
    expect(lieuLabel(t, { facilityName: 'Stade municipal', takesPlace: true })).toBe(
      'Stade municipal · toute l’installation',
    );
    expect(lieuLabel(t, { facilityName: 'Stade municipal', takesPlace: false })).toBe(
      'Stade municipal · à côté',
    );
    expect(lieuLabel(t, { address: 'Parc des sports', facilityName: null })).toBe(
      'Parc des sports',
    );
    expect(quiLeVoitLabel(t, { visibility: 'clubs' })).toBe('Les clubs');
    expect(quiLeVoitLabel(t, { audience: 'dirigeants', visibility: 'actualite' })).toBe(
      'Les clubs + actualité aux dirigeants',
    );
    expect(quiLeVoitLabel(t, { audience: 'membres', visibility: 'actualite' })).toBe(
      'Les clubs + actualité à tous les membres',
    );
    expect(quiLeVoitLabel(t, { audience: 'membres', visibility: 'public' })).toBe('Tout le monde');
    expect(seancesToucheesTitre(t, 1)).toBe('1 séance touchée');
    expect(seancesToucheesTitre(t, 3)).toBe('3 séances touchées');
    expect(
      seanceToucheeLabel(t, {
        club: { name: 'AS Montrivage' },
        date: '2026-10-24',
        endTime: '15:30',
        startTime: '14:00',
        team: { name: 'U13' },
      }),
    ).toBe('AS Montrivage · U13, sam. 24 oct. 14:00 – 15:30');
    expect(etiquetteDuPlanning(t, { takesPlace: true })).toBe('Ville · toute l’installation');
    expect(etiquetteDuPlanning(t, { takesPlace: false })).toBe('Ville · à côté');
  });
});

describe('R17-EVT-1 — sur le planning d’une installation', () => {
  const EV = {
    closureDocumentId: 'bloc-1',
    documentId: 'evt-1',
    endDate: '2026-10-25',
    endTime: '17:00',
    name: 'Fête du sport',
    startDate: '2026-10-24',
    startTime: '10:00',
    takesPlace: true,
  };

  it('un bloc par jour de la fenêtre, sans documentId, avec l’événement', () => {
    const blocs = blocsDesEvenements([EV], { from: '2026-10-19', to: '2026-10-25' });
    expect(blocs).toHaveLength(2);
    expect(blocs[0]).toMatchObject({
      documentId: null,
      evenementDeLaVille: EV,
      title: 'Fête du sport',
    });
    // C05 (Q2-08) : lus comme le planning les lit, à l'heure de Paris.
    expect(toDeviceDateFromParisInstant(blocs[0].startAt)?.getHours()).toBe(10);
    expect(toDeviceDateFromParisInstant(blocs[1].endAt)?.getDate()).toBe(25);
    expect(blocsDesEvenements([EV], { from: '2026-10-25', to: '2026-10-31' })).toHaveLength(1);
    expect(blocsDesEvenements([EV], { from: 'x', to: 'y' })).toEqual([]);
  });

  it('le blocage lié ne se dessine pas en plus du bloc de l’événement', () => {
    const fermetures = [{ documentId: 'bloc-1' }, { documentId: 'travaux' }, { documentId: null }];
    expect(fermeturesSansLesEvenements(fermetures, [EV]).map((f) => f.documentId)).toEqual([
      'travaux',
      null,
    ]);
    expect(fermeturesSansLesEvenements(fermetures, [])).toHaveLength(3);
  });
});

// 🏛️ R17-EVT-1-BIS (d) (20/10/2026, tri du chef) — « OÙ ? » DIT L'OCCUPATION DE CHAQUE
// INSTALLATION aux jours et heures choisis (lus sur son planning, comme le planning de toutes les
// installations) : libre, N séances, « complet » quand sa capacité est atteinte à un moment de la
// plage (une demande en attente ne compte pas), « fermée » quand une FERMETURE (pas un blocage)
// touche un des jours. ROUGE avant (rien de tout cela).
describe('R17-EVT-1-BIS — « Où ? » : l’occupation de chaque installation', () => {
  /**
   * Un bloc du planning d'une installation, tel que le serveur le rend (heure de Paris, UTC+2).
   * @param {string} jour - AAAA-MM-JJ.
   * @param {string} debut - HH:mm.
   * @param {string} fin - HH:mm.
   * @param {any} [extra] - Le reste.
   * @returns {any} Le bloc.
   */
  const seance = (jour, debut, fin, extra = {}) => {
    const utc = (/** @type {string} */ heure) => (
      `${String(Number(heure.slice(0, 2)) - 2).padStart(2, '0')}${heure.slice(2)}`
    );
    return {
      endAt: `${jour}T${utc(fin)}:00.000Z`,
      endTime: `${fin}:00.000`,
      hasExplicitTime: true,
      kind: 'slot',
      pending: false,
      startAt: `${jour}T${utc(debut)}:00.000Z`,
      startTime: `${debut}:00.000`,
      ...extra,
    };
  };
  const INSTALLATIONS = [
    { documentId: 'gym', maxSlots: 1, name: 'Gymnase des Tilleuls' },
    { documentId: 'stade', maxSlots: 2, name: 'Stade municipal' },
    { documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal' },
  ];

  it('🔴 aux heures choisies : libre, N séances, complet ; pas une demande en attente', () => {
    const occupations = occupationDesLieux({
      fenetre: {
        date: '2026-10-24', dateFin: '', heureDebut: '10:00', heureFin: '12:00',
      },
      fermetures: [],
      installations: INSTALLATIONS,
      lectures: [
        { data: [seance('2026-10-24', '10:30', '11:30')] },
        {
          data: [
            seance('2026-10-24', '09:00', '10:30'),
            seance('2026-10-24', '14:00', '15:00'),
            seance('2026-10-24', '11:00', '12:00', { pending: true }),
          ],
        },
        { data: [] },
      ],
    });
    expect(occupations.gym).toEqual({ complet: true, fermeture: null, seances: 1 });
    expect(occupations.stade).toEqual({ complet: false, fermeture: null, seances: 1 });
    expect(occupations.dojo).toEqual({ complet: false, fermeture: null, seances: 0 });
  });

  it('🔴 « complet » : la capacité atteinte EN MÊME TEMPS, pas l’une après l’autre', () => {
    const occupations = occupationDesLieux({
      fenetre: {
        date: '2026-10-24', dateFin: '', heureDebut: '10:00', heureFin: '14:00',
      },
      fermetures: [],
      installations: [INSTALLATIONS[1]],
      lectures: [{
        data: [
          seance('2026-10-24', '10:00', '11:00'),
          seance('2026-10-24', '12:00', '13:00'),
        ],
      }],
    });
    expect(occupations.stade).toEqual({ complet: false, fermeture: null, seances: 2 });
  });

  it('🔴 fermée un des jours (une fermeture, jamais un blocage) ; chaque jour compte', () => {
    const fermeture = {
      documentId: 'f-1',
      endDate: '2026-10-25',
      facility: { documentId: 'gym' },
      kind: 'closure',
      reason: 'travaux',
      startDate: '2026-10-25',
    };
    const blocage = {
      documentId: 'b-1',
      endDate: '2026-10-24',
      facility: { documentId: 'stade' },
      kind: 'block',
      startDate: '2026-10-24',
    };
    const occupations = occupationDesLieux({
      fenetre: {
        date: '2026-10-24', dateFin: '2026-10-25', heureDebut: '10:00', heureFin: '12:00',
      },
      fermetures: [fermeture, blocage],
      installations: INSTALLATIONS,
      lectures: [
        { data: [] },
        { data: [seance('2026-10-25', '10:00', '11:00')] },
        { data: [] },
      ],
    });
    expect(occupations.gym.fermeture).toEqual(fermeture);
    expect(occupations.stade).toEqual({ complet: false, fermeture: null, seances: 1 });
  });

  it('🔴 les phrases', () => {
    expect(occupationLabel(t, { complet: false, fermeture: null, seances: 0 }))
      .toBe('Libre sur ces heures');
    expect(occupationLabel(t, { complet: false, fermeture: null, seances: 1 }))
      .toBe('1 séance sur ces heures');
    expect(occupationLabel(t, { complet: false, fermeture: null, seances: 3 }))
      .toBe('3 séances sur ces heures');
    expect(occupationLabel(t, { complet: true, fermeture: null, seances: 2 }))
      .toBe('Complet sur ces heures');
    expect(occupationLabel(t, { complet: false, fermeture: { kind: 'closure' }, seances: 0 }))
      .toBe('Fermeture ce jour-là');
    expect(occupationLabel(t, undefined)).toBe('');
  });
});

describe('C05 (Q2-08) — les blocs d un événement de la Ville sont à l heure de Paris', () => {
  // Témoin à lancer aussi hors de Paris : `$env:TZ='America/New_York'` (PowerShell).
  it('le 27/10 de 09:00 à 11:00, quel que soit le fuseau de l appareil', () => {
    const evenement = {
      endDate: '2026-10-27',
      endTime: '11:00',
      name: 'Fête',
      startDate: '2026-10-27',
      startTime: '09:00',
    };
    const [bloc] = blocsDesEvenements([evenement], { from: '2026-10-26', to: '2026-11-01' });
    // Paris est en UTC+1 le 27/10 (heure d hiver depuis le 25/10).
    expect(bloc.startAt).toBe('2026-10-27T08:00:00.000Z');
    expect(bloc.endAt).toBe('2026-10-27T10:00:00.000Z');
  });
});
