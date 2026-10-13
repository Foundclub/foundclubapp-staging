import { colors as couleursDuTheme } from '@/theme/colors';

import {
  assignClubPlanningColors,
  CLUB_PLANNING_PALETTE,
  FACILITY_PLANNING_PALETTE,
  legendeDesClubs,
} from './facilityPlanningColor';

// COLL1D (29/09) — « UNE COULEUR PAR CLUB » dans le planning d'une installation
// (SPEC Collectivites §2 C), lisible en clair et en sombre.
//
// L'app et le site n'ont qu'un theme, SOMBRE (themeContext.js demarre et reste en
// « dark », AppModeContext.js ne rappelle que changeTheme('dark')). La lisibilite se
// mesure donc ici par le CALCUL (contraste WCAG), pas a l'ecran : chaque couleur de la
// palette contre le fond sombre de l'app, et les premieres attribuees contre un fond
// blanc (un theme clair, un planning imprime ou exporte au lot CHIFFRES).

const luminance = (/** @type {string} */ hex) => {
  const canaux = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return (0.2126 * canaux[0]) + (0.7152 * canaux[1]) + (0.0722 * canaux[2]);
};
const contraste = (/** @type {string} */ a, /** @type {string} */ b) => {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
};

/**
 * Un bloc du planning, pour ce club.
 * @param {any} club - Le club du bloc.
 * @param {string} [suffixe] - Pour distinguer deux blocs du meme club.
 * @returns {any} Le bloc.
 */
const bloc = (club, suffixe = '') => ({
  club,
  documentId: `evt-${club?.documentId || 'x'}${suffixe}`,
  title: `${club?.name || ''} · Seniors`,
});
const A = { documentId: 'club-A', name: 'AS Ville A' };
const B = { documentId: 'club-B', name: 'US Ville B' };
const C = { documentId: 'club-C', name: 'FC Voisin C' };

/**
 * La couleur de chaque club, par identifiant.
 * @param {any[]} blocs - Les blocs colores.
 * @returns {Record<string, string>} club -> couleur.
 */
const couleurParClub = (blocs) => Object.fromEntries(
  blocs.map((b) => [b.club.documentId, b.displayColor]),
);

describe('COLL1D — assignClubPlanningColors : une couleur par club', () => {
  it('2 clubs = 2 couleurs ; le meme club garde la sienne d un bloc a l autre', () => {
    const [a, b, bBis] = assignClubPlanningColors([bloc(A), bloc(B), bloc(B, '-2')]);
    expect(a.displayColor).not.toBe(b.displayColor);
    expect(bBis.displayColor).toBe(b.displayColor);
  });

  it('la couleur d un club ne depend pas de l ordre des blocs de la semaine', () => {
    const avant = assignClubPlanningColors([bloc(A), bloc(B), bloc(C)]);
    const apres = assignClubPlanningColors([bloc(C), bloc(B), bloc(A)]);
    expect(couleurParClub(apres)).toEqual(couleurParClub(avant));
  });

  it('jusqu a 10 clubs : 10 couleurs, toutes de la palette des plannings (0 hexa neuf)', () => {
    const clubs = Array.from({ length: 10 }, (_, i) => ({
      documentId: `club-${i}`,
      name: `Club ${String(i).padStart(2, '0')}`,
    }));
    const couleurs = assignClubPlanningColors(clubs.map((club) => bloc(club)))
      .map((b) => b.displayColor);
    expect(new Set(couleurs).size).toBe(10);
    couleurs.forEach((couleur) => expect(FACILITY_PLANNING_PALETTE).toContain(couleur));
    expect([...CLUB_PLANNING_PALETTE].sort()).toEqual([...FACILITY_PLANNING_PALETTE].sort());
  });

  it('un bloc sans club garde la couleur de son installation (aucune couleur inventee)', () => {
    const [sansClub] = assignClubPlanningColors([{ documentId: 'evt-x', title: 'Fermeture' }]);
    expect(sansClub.displayColor).toBeUndefined();
    expect(assignClubPlanningColors(null)).toEqual([]);
  });
});

describe('COLL1D — lisible en sombre ET en clair (contraste WCAG calcule)', () => {
  it('en SOMBRE (fond de l app) : chaque couleur de club >= 4,49:1', () => {
    CLUB_PLANNING_PALETTE.forEach((couleur) => {
      expect(contraste(couleur, couleursDuTheme.primary900)).toBeGreaterThanOrEqual(4.49);
    });
  });

  it('en CLAIR (fond blanc) : les 4 premieres >= 3:1 (repere graphique, WCAG 1.4.11)', () => {
    CLUB_PLANNING_PALETTE.slice(0, 4).forEach((couleur) => {
      expect(contraste(couleur, couleursDuTheme.neutral00)).toBeGreaterThanOrEqual(3);
    });
  });
});

// 🎨 COLL-R-A6 (13/10/2026, COL-019, décision d'Adel D13 = A, planche P7v4-couleur validée) :
// la couleur AUTOMATIQUE d'un club est STABLE — son rang dans la liste des clubs de la Ville, pas
// son rang parmi les clubs présents cette semaine-là (facilityPlanningColor.js:116 avant le lot).
// ROUGE avant : seul, un club prenait la 1re couleur ; après un autre, la 2e.
const VILLE = [A, C, B];

describe('COLL-R-A6 — un club = une couleur stable partout (liste de la Ville)', () => {
  it('une semaine où le club est SEUL et une où il vient APRÈS un autre : la MÊME couleur', () => {
    const [seul] = assignClubPlanningColors([bloc(B)], VILLE);
    const [, apresUnAutre] = assignClubPlanningColors([bloc(A), bloc(B)], VILLE);
    expect(seul.displayColor).toBeTruthy();
    expect(apresUnAutre.displayColor).toBe(seul.displayColor);
  });

  it('la couleur suit le rang dans la liste de la Ville (3e club = 3e couleur)', () => {
    const [b] = assignClubPlanningColors([bloc(B)], VILLE);
    const [c] = assignClubPlanningColors([bloc(C)], VILLE);
    expect(b.displayColor).toBe(CLUB_PLANNING_PALETTE[2]);
    expect(c.displayColor).toBe(CLUB_PLANNING_PALETTE[1]);
  });

  it('un club absent de la liste (pas rattaché) : une couleur APRÈS celles de la Ville', () => {
    const AUTRE = { documentId: 'club-Z', name: 'Club de passage' };
    const [, z] = assignClubPlanningColors([bloc(A), bloc(AUTRE)], VILLE);
    expect(z.displayColor).toBe(CLUB_PLANNING_PALETTE[3]);
  });

  it('sans la liste (pas la Ville) : comme avant, par nom des clubs présents', () => {
    const [seul] = assignClubPlanningColors([bloc(B)]);
    expect(seul.displayColor).toBe(CLUB_PLANNING_PALETTE[0]);
  });

  it('la légende : un club par couleur, rangés par nom, sans les blocs sans club', () => {
    const blocs = assignClubPlanningColors(
      [bloc(B), bloc(A), bloc(B, '-2'), { documentId: 'evt-x', title: 'Fermeture' }],
      VILLE,
    );
    expect(legendeDesClubs(blocs)).toEqual([
      { couleur: CLUB_PLANNING_PALETTE[0], nom: 'AS Ville A' },
      { couleur: CLUB_PLANNING_PALETTE[2], nom: 'US Ville B' },
    ]);
    expect(legendeDesClubs(null)).toEqual([]);
  });
});
