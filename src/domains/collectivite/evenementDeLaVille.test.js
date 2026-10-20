import {
  blocsDesEvenements,
  etapesDuTunnel,
  etatDepuisLaVue,
  etatInitial,
  etiquetteDuPlanning,
  fermeturesSansLesEvenements,
  lieuLabel,
  quandLabel,
  quiLeVoitLabel,
  seancesToucheesTitre,
  seanceToucheeLabel,
  verifierEvenement,
  versCorpsDeLApi,
} from '@/domains/collectivite/evenementDeLaVille';

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
    expect(new Date(blocs[0].startAt).getHours()).toBe(10);
    expect(new Date(blocs[1].endAt).getDate()).toBe(25);
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
