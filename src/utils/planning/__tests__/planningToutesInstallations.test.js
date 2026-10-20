import { FACILITY_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';

import {
  blocsDeLaVille,
  blocsDuMois,
  grilleDeLaSemaine,
  journeeParInstallation,
  listeDeLaSemaine,
  prochainBloc,
} from '../planningToutesInstallations';

// 🏟️ R17-PLANNING (20/10/2026, REC17-005 lot 1) — LE PLANNING DE TOUTES LES INSTALLATIONS DE LA
// VILLE, sous les cartes (planches P10-planning-ordi et P10-planning-tel, validées le 19/10).
// Semaine : une rangée par installation, une colonne par jour ; téléphone : la liste jour par
// jour, chaque ligne dit son installation ; Jour : rangé par installation ; Mois : un point par
// installation utilisée. Une couleur PAR CLUB (celle de COL-019), la même d'une installation à
// l'autre.

// Les couleurs d installation de la palette du projet (contrat de thème : aucun hexa en clair).
const [, , VERT, ORANGE, , VIOLET] = FACILITY_PLANNING_PALETTE;

const LUNDI = new Date(2026, 9, 19, 0, 0, 0);
const INSTALLATIONS = [
  {
    documentId: 'gym', maxSlots: 2, name: 'Gymnase des Tilleuls', planningColor: VERT,
  },
  {
    documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', planningColor: VIOLET,
  },
  {
    documentId: 'stade', maxSlots: 2, name: 'Stade municipal', planningColor: ORANGE,
  },
];
const AS = { documentId: 'club-as', name: 'AS Montrivage' };
const FC = { documentId: 'club-fc', name: 'Montrivage FC' };

/**
 * Un bloc du planning d'une installation, tel que le serveur le rend (contrat C2A §7).
 * @param {any} club - Le club.
 * @param {string} jour - AAAA-MM-JJ.
 * @param {string} heure - HH:mm (heure de Paris en hiver : UTC+1, en octobre UTC+2).
 * @param {string} equipe - L'équipe.
 * @returns {any} Le bloc.
 */
const bloc = (club, jour, heure, equipe) => {
  const [h, m] = heure.split(':').map(Number);
  const utc = `${String(h - 2).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return {
    club,
    documentId: null,
    endAt: `${jour}T${String(h - 1).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`,
    endTime: `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000`,
    hasExplicitTime: true,
    kind: 'slot',
    origin: 'slot',
    pending: false,
    startAt: `${jour}T${utc}:00.000Z`,
    startTime: `${heure}:00.000`,
    team: { name: equipe },
    title: `${club.name} · ${equipe}`,
  };
};

const LECTURES = [
  { data: [bloc(FC, '2026-10-19', '18:00', 'Senior B'), bloc(AS, '2026-10-20', '17:30', 'U15')] },
  { data: [] },
  { data: [bloc(AS, '2026-10-21', '14:00', 'U11'), bloc(FC, '2026-10-20', '18:30', 'U17')] },
];

describe('R17-PLANNING — le planning de toutes les installations', () => {
  test('1 — chaque bloc dit son installation, et un club garde SA couleur partout', () => {
    const blocs = blocsDeLaVille(LECTURES, INSTALLATIONS, null);
    expect(blocs).toHaveLength(4);
    expect(blocs.map((b) => b.installation.documentId)).toEqual(['gym', 'gym', 'stade', 'stade']);
    const couleur = (/** @type {any} */ club, /** @type {string} */ inst) => blocs
      .find((b) => b.club?.documentId === club.documentId && b.installation.documentId === inst)
      ?.displayColor;
    expect(couleur(AS, 'gym')).toBeTruthy();
    expect(couleur(AS, 'gym')).toBe(couleur(AS, 'stade'));
    expect(couleur(FC, 'gym')).toBe(couleur(FC, 'stade'));
    expect(couleur(AS, 'gym')).not.toBe(couleur(FC, 'gym'));
  });

  test('2 — une lecture encore absente ne casse rien', () => {
    expect(blocsDeLaVille([undefined, { data: [] }], INSTALLATIONS, null)).toEqual([]);
  });

  test('3 — Semaine (ordinateur) : une rangée par installation, une colonne par jour', () => {
    const blocs = blocsDeLaVille(LECTURES, INSTALLATIONS, null);
    const grille = grilleDeLaSemaine(blocs, INSTALLATIONS, LUNDI);
    expect(grille.map((r) => r.installation.name))
      .toEqual(['Gymnase des Tilleuls', 'Dojo municipal', 'Stade municipal']);
    expect(grille.every((r) => r.jours.length === 7)).toBe(true);
    expect(grille[0].jours[0].map((b) => b.title)).toEqual(['Montrivage FC · Senior B']);
    expect(grille[0].jours[1].map((b) => b.title)).toEqual(['AS Montrivage · U15']);
    expect(grille[1].jours.every((jour) => jour.length === 0)).toBe(true);
    expect(grille[2].jours[2].map((b) => b.title)).toEqual(['AS Montrivage · U11']);
  });

  test('4 — Semaine (téléphone) : la liste jour par jour, dans l ordre des heures', () => {
    const liste = listeDeLaSemaine(blocsDeLaVille(LECTURES, INSTALLATIONS, null), LUNDI);
    expect(liste.map((j) => j.jour.getDate())).toEqual([19, 20, 21]);
    expect(liste[1].blocs.map((b) => `${b.title} @ ${b.installation.name}`)).toEqual([
      'AS Montrivage · U15 @ Gymnase des Tilleuls',
      'Montrivage FC · U17 @ Stade municipal',
    ]);
  });

  test('5 — Jour : rangé par installation, toutes les installations, même vides', () => {
    const jour = journeeParInstallation(
      blocsDeLaVille(LECTURES, INSTALLATIONS, null),
      INSTALLATIONS,
      new Date(2026, 9, 20, 12),
    );
    expect(jour.map((r) => [r.installation.documentId, r.blocs.length]))
      .toEqual([['gym', 1], ['dojo', 0], ['stade', 1]]);
  });

  test('6 — Mois : la couleur de l INSTALLATION (on compte des installations utilisées)', () => {
    const mois = blocsDuMois(blocsDeLaVille(LECTURES, INSTALLATIONS, null));
    expect(mois.filter((b) => b.installation.documentId === 'gym')
      .every((b) => b.displayColor === VERT)).toBe(true);
    expect(mois.filter((b) => b.installation.documentId === 'stade')
      .every((b) => b.displayColor === ORANGE)).toBe(true);
  });

  test('7 — un jour sans rien : la prochaine séance connue, ou rien', () => {
    const blocs = blocsDeLaVille(LECTURES, INSTALLATIONS, null);
    const apres = prochainBloc(blocs, new Date(2026, 9, 18, 12));
    expect(apres?.title).toBe('Montrivage FC · Senior B');
    expect(prochainBloc(blocs, new Date(2026, 9, 21, 12))).toBeNull();
  });
});
