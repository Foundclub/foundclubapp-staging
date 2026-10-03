/* eslint-disable max-len -- les libellés se lisent en entier. */
import { hasPublishedConvocation, listPresentWithoutConvocation } from '../matchPageModel';

// FINITIONS11-STATS · point 6 bis — « listes ok » (Adel, 03/10 ~13h20) : après le match,
// l'entraîneur voit DEUX listes sur la carte « Après le match » :
//   1. « Convoqués : 7 sur 9 ont répondu » (le compte du point 6) ;
//   2. « Aussi présents, sans convocation : Lucas, Nathan » — les joueurs VENUS sans être
//      convoqués. Un joueur non convoqué peut quand même être présent.
// La donnée est déjà dans la charge de la feuille (aucune lecture neuve) : `convoked === false`
// (ST-MATCH10-BIS) et la preuve qu'il est venu — sa réponse « j'ai joué » / « présent sans
// jouer », ou des minutes sur la feuille. Un non-convoqué sans aucune trace n'est pas « présent ».

const reponse = (/** @type {string} */ label, /** @type {any} */ champs = {}) => ({
  label,
  participation: null,
  status: null,
  userDocumentId: `compte-${label.split(' ')[0].toLowerCase()}`,
  ...champs,
});

const FEUILLE = [
  reponse('Léa Martin', { convoked: true, participation: 'played', status: 'submitted' }),
  reponse('Sami Diallo', { convoked: true }),
  // Venu sans convocation, et il l'a dit : « j'ai joué ».
  reponse('Lucas Petit', { convoked: false, participation: 'played', status: 'submitted' }),
  // Venu sans convocation, sans répondre : l'entraîneur lui a mis 30 minutes sur la feuille.
  reponse('Nathan Roux', { convoked: false }),
  // Présent sans jouer, il l'a dit (brouillon suffit : il est venu).
  reponse('Omar Sow', { convoked: false, participation: 'present_no_play', status: 'draft' }),
  // Non convoqué, aucune trace : il n'est pas venu.
  reponse('Yanis Kader', { convoked: false }),
  // Non convoqué qui dit ne pas être concerné.
  reponse('Zoé Vidal', { convoked: false, participation: 'not_involved', status: 'submitted' }),
  // Ajouté à la main, sans compte : il est DANS la convocation, pas « sans convocation ».
  reponse('Joueur Ajouté', { convoked: false, userDocumentId: null }),
];

const LIGNES = [
  { minutesPlayed: 30, userDocumentId: 'compte-nathan' },
  { minutesPlayed: 0, userDocumentId: 'compte-yanis' },
  { minutesPlayed: 90, user: { documentId: 'compte-lea' } },
];

describe('FINITIONS11 · point 6 bis — « Aussi présents, sans convocation »', () => {
  test('1 · 🔴 les non-convoqués VENUS : sa réponse le dit, ou ses minutes sur la feuille', () => {
    expect(listPresentWithoutConvocation(FEUILLE, LIGNES)).toEqual(['Lucas', 'Nathan', 'Omar']);
  });

  test('2 · 🔴 ni le non-convoqué sans trace, ni « pas concerné », ni le joueur ajouté sans compte', () => {
    const noms = listPresentWithoutConvocation(FEUILLE, LIGNES);
    expect(noms).not.toContain('Yanis');
    expect(noms).not.toContain('Zoé');
    expect(noms).not.toContain('Joueur');
  });

  test('3 · 🔴 « Convoqués : » ne se dit que s il y a une convocation publiée', () => {
    expect(hasPublishedConvocation(FEUILLE)).toBe(true);
    expect(hasPublishedConvocation([reponse('Léa Martin', { convoked: null })])).toBe(false);
  });

  test('4 · 🔒 serveur d avant (pas de `convoked`) ou sans feuille : aucune liste, aucune convocation', () => {
    const avant = [{ label: 'Lucas Petit', participation: 'played', status: 'submitted' }];
    expect(listPresentWithoutConvocation(avant, [])).toEqual([]);
    expect(hasPublishedConvocation(avant)).toBe(false);
    expect(listPresentWithoutConvocation(null, null)).toEqual([]);
    expect(hasPublishedConvocation(undefined)).toBe(false);
  });

  test('5 · 🔒 plus de 5 : 5 prénoms puis « +N », comme « manquent »', () => {
    const sept = ['Ali', 'Ben', 'Cyr', 'Dan', 'Eli', 'Fay', 'Gus']
      .map((prenom) => reponse(`${prenom} X`, { convoked: false, participation: 'played', status: 'submitted' }));
    expect(listPresentWithoutConvocation(sept, [])).toEqual(['Ali', 'Ben', 'Cyr', 'Dan', 'Eli', '+2']);
  });
});
