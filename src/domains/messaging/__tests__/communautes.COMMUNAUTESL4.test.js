/* eslint-disable max-len */
import {
  bandeauDuComplexe,
  communauteDeLaLigne,
  communautesSansLigne,
  dOfficeSansApercu,
  groupesVisibles,
  nonLusDeLaCommunaute,
  peutQuitterLeGroupe,
  raisonDuGroupe,
  resumeDesGroupes,
} from '../communautes';

// COMMUNAUTES-L4 (14/11/2026, D76, maquette v3) — les règles des écrans de lecture, sans React.

const t = (/** @type {string} */ cle, /** @type {any} */ o) => {
  if (typeof o === 'string') return o;
  return String(o?.defaultValue || cle).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? ''));
};
const CLUB = {
  annonces: 'fil-club',
  genre: 'club',
  groupes: [
    { chat: 'u13', origine: 'equipe', theme: 'equipe' },
    { chat: 'parents', origine: 'groupe', theme: 'parents' },
    { chat: 'covoit', origine: 'groupe', theme: 'covoiturage' },
    { chat: 'staff', origine: 'groupe', theme: 'staff' },
    { chat: 'libre', origine: 'groupe', theme: 'libre' },
    { chat: 'ville', origine: 'ville', theme: 'staff' },
  ],
  groupesAvecDuNouveau: 3,
  nonLus: 7,
};

describe('COMMUNAUTES-L4 — règles', () => {
  test('R1 — la ligne garde l identifiant de son fil : seule l Annonces porte sa communauté', () => {
    expect(communauteDeLaLigne([CLUB], 'fil-club')).toBe(CLUB);
    expect(communauteDeLaLigne([CLUB], 'u13')).toBeNull();
    expect(communauteDeLaLigne(null, 'fil-club')).toBeNull();
    expect(communauteDeLaLigne([{ annonces: null }], 'null')).toBeNull();
  });

  test('R2 — le bouton de repli ne sert qu aux communautés sans ligne', () => {
    expect(communautesSansLigne([CLUB], [{ documentId: 'fil-club' }])).toEqual([]);
    expect(communautesSansLigne([CLUB], [{ documentId: 'u13' }])).toEqual([CLUB]);
    expect(communautesSansLigne([{ annonces: null, documentId: 'x' }], [])).toHaveLength(1);
    expect(communautesSansLigne(null, [])).toEqual([]);
  });

  test('R3 — la pastille : le total de la communauté, sinon le compteur du fil', () => {
    expect(nonLusDeLaCommunaute(CLUB, 1)).toBe(7);
    expect(nonLusDeLaCommunaute({ ...CLUB, nonLus: undefined }, 1)).toBe(1);
    expect(nonLusDeLaCommunaute({ ...CLUB, nonLus: 0 }, 3)).toBe(0);
  });

  test('R4 — « 6 groupes · 3 avec du nouveau », « 1 groupe », rien sans groupe', () => {
    expect(resumeDesGroupes(t, CLUB)).toBe('6 groupes · 3 avec du nouveau');
    expect(resumeDesGroupes(t, { groupes: [{}], groupesAvecDuNouveau: 0 })).toBe('1 groupe');
    expect(resumeDesGroupes(t, { groupes: [] })).toBe('');
  });

  test('R5 — un mineur ne voit AUCUN groupe d adultes ; l équipe, la Ville, le libre restent', () => {
    expect(groupesVisibles(CLUB, { mineur: true }).map((g) => g.chat)).toEqual(['u13', 'libre', 'ville']);
    expect(groupesVisibles(CLUB, { mineur: false })).toHaveLength(6);
  });

  test('R6 — la raison : « parent de Lina et Adam » ; « D’office » seulement à défaut d aperçu', () => {
    expect(raisonDuGroupe(t, { enfants: ['Lina', 'Adam'], raison: 'parent' }))
      .toBe('D’office · parent de Lina et Adam');
    expect(raisonDuGroupe(t, { dOffice: true })).toBe('');
    expect(dOfficeSansApercu(t, { dOffice: true })).toBe('D’office');
    expect(dOfficeSansApercu(t, {})).toBe('');
    expect(raisonDuGroupe(t, { enfants: [], raison: 'parent' })).toBe('');
    expect(raisonDuGroupe(t, {})).toBe('');
  });

  test('R7 — on ne quitte qu un groupe à thème ; le bandeau seulement pour un favori', () => {
    expect(CLUB.groupes.filter(peutQuitterLeGroupe).map((g) => g.chat))
      .toEqual(['parents', 'covoit', 'staff', 'libre']);
    expect(bandeauDuComplexe({ genre: 'complexe', pourquoi: 'favori' })).toBe(true);
    expect(bandeauDuComplexe({ genre: 'complexe', pourquoi: 'gerant' })).toBe(false);
    expect(bandeauDuComplexe({ genre: 'club', pourquoi: 'favori' })).toBe(false);
  });
});
