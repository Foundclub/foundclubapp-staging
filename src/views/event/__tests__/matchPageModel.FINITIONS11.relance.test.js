/* eslint-disable max-len -- les libellés se lisent en entier. */
import { countPlayersToRemind, listMissingResponders } from '../matchPageModel';

// FINITIONS11-STATS · point 4 (écran 7, carte « Après le match ») — « Relancer les N » compte
// ceux que le SERVEUR relancera, et rien d'autre (`remindEventMissingResponses`) :
//   · un joueur qui n'a pas envoyé sa réponse ;
//   · CONVOQUÉ (« c oui ») : `convoked === false` = hors convocation, jamais relancé ;
//   · avec un COMPTE : un joueur ajouté à la main n'en a pas (`userDocumentId: null`).
// Avant : la carte comptait la liste des PRÉNOMS, coupée à 5 plus « +N » — 7 manquants
// donnaient « Relancer les 6 », et les non-convoqués y entraient.
// Un serveur d'avant ne marque ni `convoked` ni l'absence de compte : tout le monde reste compté.

const reponse = (/** @type {string} */ label, /** @type {any} */ champs = {}) => ({
  label,
  status: 'pending',
  userDocumentId: `compte-${label}`,
  ...champs,
});

const FEUILLE = [
  reponse('Ali B.', { convoked: true, status: 'submitted' }),
  reponse('Hugo L.', { convoked: true }),
  reponse('Léa M.', { convoked: true, status: 'draft' }),
  reponse('Max P.', { convoked: true }),
  reponse('Nina R.', { convoked: true }),
  reponse('Omar S.', { convoked: true }),
  reponse('Paul T.', { convoked: true }),
  reponse('Zoé V.', { convoked: true }),
  // Hors convocation : il garde sa ligne sur la feuille (« feuille convoqués A »), sans relance.
  reponse('Yanis K.', { convoked: false }),
  // Ajouté à la main, sans compte : personne à relancer.
  reponse('Joueur ajouté', { convoked: false, documentId: null, userDocumentId: null }),
];

describe('FINITIONS11 · point 4 — « Relancer les N » = ceux que le serveur relancera', () => {
  test('1 · 🔴 7 convoqués sans réponse : 7, pas 6 (la liste des prénoms est coupée à 5 + « +2 »)', () => {
    expect(countPlayersToRemind(FEUILLE)).toBe(7);
  });

  test('2 · 🔴 « manquent … » ne nomme que les convoqués avec un compte', () => {
    expect(listMissingResponders(FEUILLE)).toEqual(['Hugo', 'Léa', 'Max', 'Nina', 'Omar', '+2']);
    expect(listMissingResponders([
      reponse('Hugo L.', { convoked: true }),
      reponse('Yanis K.', { convoked: false }),
      reponse('Joueur ajouté', { userDocumentId: null }),
    ])).toEqual(['Hugo']);
  });

  test('3 · 🔴 personne de convoqué ne manque : 0, même si des non-convoqués n ont pas répondu', () => {
    expect(countPlayersToRemind([
      reponse('Ali B.', { convoked: true, status: 'submitted' }),
      reponse('Yanis K.', { convoked: false }),
    ])).toBe(0);
  });

  test('4 · 🔒 serveur d avant (ni `convoked`, ni marque de compte) : tous les manquants comptent', () => {
    const avant = [
      { label: 'Hugo L.', status: 'pending' },
      { label: 'Léa M.', status: 'draft' },
      { label: 'Ali B.', status: 'submitted' },
    ];
    expect(countPlayersToRemind(avant)).toBe(2);
    expect(listMissingResponders(avant)).toEqual(['Hugo', 'Léa']);
  });

  test('5 · 🔒 sans feuille : 0 et aucune ligne', () => {
    expect(countPlayersToRemind(null)).toBe(0);
    expect(listMissingResponders(undefined)).toEqual([]);
  });
});
