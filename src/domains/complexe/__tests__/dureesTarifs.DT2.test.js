/* eslint-disable max-len -- témoins DT-2 : libellés et données d'exemple écrits en entier, comme à l'écran. */
import { prixDeLaSemaine } from '@/domains/complexe/complexeTerrain';
import {
  bandesDeLaSemaine,
  departsDe,
  departsReguliers,
  dureesDe,
  dureesDuPlan,
  fondreLesReservations,
  modeDesDeparts,
  offresDeLaPlage,
  plageQuiChevauche,
  prixDeLaSemaineParDuree,
} from '@/domains/complexe/dureesTarifs';

// DT-2 (12/11/2026) — DUREES-TARIFS, écrans du gérant : la règle du serveur DT-1 (slot-plan.ts,
// `startsOf`, `slotPrice`, `overlapInWeek`) redite côté app pour que la grille dise ce que le
// joueur paiera, et que la semaine en bandes montre un chevauchement AVANT l'envoi.

const SEMAINE = {
  days: [1, 2, 3, 4, 5], durationMinutes: 60, durations: [60, 120], from: '17:00', to: '23:00',
};
const WEEKEND = {
  days: [6, 7], durationMinutes: 120, from: '10:00', to: '22:00',
};

describe('DT-2 — durées et départs d’une plage', () => {
  it('les durées : `durations` sinon `durationMinutes`', () => {
    expect(dureesDe(SEMAINE)).toEqual([60, 120]);
    expect(dureesDe(WEEKEND)).toEqual([120]);
    expect(dureesDuPlan({ ranges: [SEMAINE, WEEKEND] })).toEqual([60, 120]);
  });

  it('sans départs choisis : l’ouverture puis toutes les « durée » (règle d’avant)', () => {
    expect(departsDe(SEMAINE, 60)).toEqual([1020, 1080, 1140, 1200, 1260, 1320]);
    expect(departsDe(SEMAINE, 120)).toEqual([1020, 1140, 1260]);
  });

  it('départs choisis : ceux qui laissent tenir la durée ; après minuit = +24 h', () => {
    const plage = { ...SEMAINE, starts: ['17:00', '18:00', '22:00'] };
    expect(departsDe(plage, 60)).toEqual([1020, 1080, 1320]);
    expect(departsDe(plage, 120)).toEqual([1020, 1080]);
    const nuit = {
      days: [5], durationMinutes: 60, from: '22:00', starts: ['22:00', '00:30'], to: '02:00',
    };
    expect(departsDe(nuit, 60)).toEqual([1320, 1470]);
  });

  it('« toutes les heures » / « toutes les 30 min » et leur relecture', () => {
    expect(departsReguliers({ from: '17:00', to: '23:00' }, 60, 60))
      .toEqual(['17:00', '18:00', '19:00', '20:00', '21:00', '22:00']);
    expect(departsReguliers({ from: '17:00', to: '19:00' }, 30, 90))
      .toEqual(['17:00', '17:30']);
    expect(modeDesDeparts(WEEKEND)).toBe('suite');
    expect(modeDesDeparts({ ...SEMAINE, starts: departsReguliers(SEMAINE, 60, 60) })).toBe('heure');
    expect(modeDesDeparts({ ...SEMAINE, starts: departsReguliers(SEMAINE, 30, 60) })).toBe('demi');
    expect(modeDesDeparts({ ...SEMAINE, starts: ['17:00', '18:30'] })).toBe('choix');
  });

  it('« Ce que verront les joueurs » : par durée, le 1er et le dernier créneau', () => {
    const plage = { ...SEMAINE, starts: departsReguliers(SEMAINE, 60, 60) };
    expect(offresDeLaPlage(plage)).toEqual([
      {
        dernier: { a: '23:00', de: '22:00' }, duree: 60, nombre: 6, premier: { a: '18:00', de: '17:00' },
      },
      {
        dernier: { a: '23:00', de: '21:00' }, duree: 120, nombre: 5, premier: { a: '19:00', de: '17:00' },
      },
    ]);
  });
});

describe('DT-2 G1 / G2 bis — la semaine en bandes et le chevauchement', () => {
  it('une bande par plage et par jour, sur un axe 8 h – 24 h', () => {
    const semaine = bandesDeLaSemaine([SEMAINE, WEEKEND]);
    expect(semaine.axe).toEqual({ debut: 480, fin: 1440 });
    expect(semaine.jours[0].bandes).toEqual([expect.objectContaining({
      conflit: false, debut: 1020, fantome: false, fin: 1380, rang: 0, texte: '17–23 · 1 h, 2 h',
    })]);
    expect(semaine.jours[5].bandes[0]).toEqual(expect.objectContaining({
      debut: 600, fin: 1320, rang: 1, texte: '10–22 · 2 h',
    }));
  });

  it('une plage après minuit allonge l’axe au-delà de 24 h', () => {
    const nuit = {
      days: [5], durationMinutes: 60, from: '20:00', to: '02:00',
    };
    expect(bandesDeLaSemaine([nuit]).axe).toEqual({ debut: 480, fin: 1560 });
  });

  it('la plage en cours en pointillé ; celle qu’elle chevauche en rouge, ce jour-là seulement', () => {
    const premiere = {
      days: [1, 2, 4, 5], durationMinutes: 60, from: '14:00', to: '23:00',
    };
    const enCours = {
      days: [5, 6], durationMinutes: 90, from: '17:00', to: '23:00',
    };
    const semaine = bandesDeLaSemaine([premiere], { enCours });
    expect(semaine.jours[3].bandes[0].conflit).toBe(false);
    expect(semaine.jours[4].bandes).toEqual([
      expect.objectContaining({ conflit: true, rang: 0 }),
      expect.objectContaining({ fantome: true, rang: null }),
    ]);
    expect(plageQuiChevauche([premiere], enCours)).toEqual({ jour: 5, rang: 0 });
    expect(plageQuiChevauche([premiere], { ...enCours, days: [6] })).toBeNull();
  });

  it('modifier une plage : elle ne se chevauche pas elle-même', () => {
    expect(plageQuiChevauche([SEMAINE, WEEKEND], SEMAINE, 0)).toBeNull();
    const semaine = bandesDeLaSemaine([SEMAINE, WEEKEND], { enCours: SEMAINE, rangEnCours: 0 });
    expect(semaine.jours[0].bandes).toEqual([expect.objectContaining({ fantome: true })]);
  });

  it('le bout d’après minuit d’un dimanche chevauche le lundi', () => {
    const dimanche = {
      days: [7], durationMinutes: 60, from: '22:00', to: '02:00',
    };
    const lundi = {
      days: [1], durationMinutes: 60, from: '00:00', to: '03:00',
    };
    expect(plageQuiChevauche([dimanche], lundi)).toEqual({ jour: 1, rang: 0 });
  });
});

describe('DT-2 G3 — les prix de la semaine, par durée (281 A)', () => {
  const plan = {
    ranges: [SEMAINE, WEEKEND],
    rates: [
      {
        days: [1, 2, 3, 4, 5], durationMinutes: 60, from: '17:00', price: 8, to: '18:00',
      },
      {
        days: [1, 2, 3, 4, 5], durationMinutes: 120, from: '17:00', price: 14, to: '18:00',
      },
      { days: [6, 7], durationMinutes: 120, price: 16 },
    ],
  };

  it('1 h : le tarif d’1 h, sinon le prix de base ; jamais un tarif de 2 h', () => {
    const lignes = prixDeLaSemaineParDuree(plan, 10, 60);
    expect(lignes).toEqual([
      {
        a: '18:00', cases: [8, 8, 8, 8, 8, null, null].map((p) => (p === null ? null : { calcule: false, prix: p })), de: '17:00',
      },
      {
        a: '23:00', cases: [10, 10, 10, 10, 10, null, null].map((p) => (p === null ? null : { calcule: false, prix: p })), de: '18:00',
      },
    ]);
  });

  it('2 h : le tarif de 2 h ; sans lui, 2 × le prix d’1 h, marqué « calculé »', () => {
    const lignes = prixDeLaSemaineParDuree(plan, 10, 120);
    const ligne = (de) => lignes.find((l) => l.de === de);
    expect(ligne('10:00').cases[5]).toEqual({ calcule: false, prix: 16 });
    expect(ligne('10:00').cases[0]).toBeNull();
    expect(ligne('17:00').cases[0]).toEqual({ calcule: false, prix: 14 });
    expect(ligne('18:00').cases[0]).toEqual({ calcule: true, prix: 20 });
  });

  it('une seule durée, aucun réglage neuf : les mêmes prix que la grille d’avant', () => {
    const avant = {
      ranges: [
        {
          days: [1, 2, 3, 4, 5], durationMinutes: 60, from: '17:00', to: '23:00',
        },
        {
          days: [6, 7], durationMinutes: 90, from: '09:00', to: '22:00',
        },
      ],
      rates: [{ days: [6, 7], price: 70 }, {
        days: [1, 2, 3, 4, 5], from: '18:00', price: 80, to: '22:00',
      }],
    };
    // Sans onglet (aucune plage à plusieurs durées) : la grille d'avant, case pour case.
    const nouvelle = prixDeLaSemaineParDuree(avant, 60, null)
      .map((l) => ({ a: l.a, de: l.de, prix: l.cases.map((c) => (c ? c.prix : null)) }));
    expect(nouvelle).toEqual(prixDeLaSemaine(avant, 60));
    const touteLaSemaine = [60, 90].flatMap((duree) => prixDeLaSemaineParDuree(avant, 60, duree));
    expect(touteLaSemaine.every((l) => l.cases.every((c) => !c || !c.calcule))).toBe(true);
  });
});

describe('DT-2 G4 — le planning : une réservation de 2 h = un seul bloc', () => {
  const creneau = (de, a, reservation) => ({
    endsAt: `2026-11-17T${a}:00.000Z`, from: de, reservation, startsAt: `2026-11-17T${de}:00.000Z`, to: a,
  });
  it('deux créneaux d’1 h de la même réservation se fondent ; les autres restent', () => {
    const julien = { documentId: 'r-2h', label: 'Julien M. · App' };
    const martin = { documentId: 'r-1h', label: 'Groupe Martin · App' };
    const fondus = fondreLesReservations([
      creneau('17:00', '18:00', null),
      creneau('18:00', '19:00', null),
      creneau('19:00', '20:00', martin),
      creneau('20:00', '21:00', julien),
      creneau('21:00', '22:00', julien),
      creneau('22:00', '23:00', null),
    ]);
    expect(fondus.map((c) => `${c.from}-${c.to}`))
      .toEqual(['17:00-18:00', '18:00-19:00', '19:00-20:00', '20:00-22:00', '22:00-23:00']);
    expect(fondus[3]).toEqual(expect.objectContaining({
      endsAt: '2026-11-17T22:00:00.000Z', reservation: julien, startsAt: '2026-11-17T20:00:00.000Z',
    }));
  });
});
