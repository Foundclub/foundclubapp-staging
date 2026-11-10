import { Platform } from 'react-native';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { getTourProfile } from '@/domains/tour/tourCatalog';

// GUIDES-SITE-CORR (tournée des guides sur le site, 09/11) : les textes faux et la sortie sans
// flèche Retour. Chaque attente nomme son défaut (DEFAUTS.md de la tournée).

const etape = (/** @type {string} */ guide, /** @type {string} */ id) => (
  /** @type {any} */ (guide === 'president' ? PRESIDENT_GUIDE : getTourProfile(guide)).steps
    .find((/** @type {any} */ s) => s.id === id)
);

const avecPlateforme = (/** @type {string} */ os, /** @type {() => void} */ geste) => {
  const avant = Platform.OS;
  Platform.OS = /** @type {any} */ (os);
  try {
    geste();
  } finally {
    Platform.OS = avant;
  }
};

test('S06 : sur le site, « retourne sur la fiche du club » montre l onglet du club', () => {
  avecPlateforme('web', () => {
    const { fallback } = etape('president', 'm1-fback');
    expect(fallback.targets).toEqual(['dock.teams']);
    expect(fallback.text).toMatch(/onglet entouré/);
  });
  avecPlateforme('ios', () => {
    expect(etape('president', 'm1-fback').fallback).toBeUndefined();
  });
});

test('S04, S23 : le planning d exemple ne se dit plus « encore vide »', () => {
  expect(etape('president', 'm1-pdemo').text).not.toMatch(/encore vide/);
  expect(etape('president', 'm1-pdemo').text).toMatch(/exemple/);
});

test('S15 : le récapitulatif de la campagne nomme le bouton à toucher', () => {
  expect(etape('president', 'c6').text).toMatch(/« Ouvrir la campagne »/);
});

test('S28 : sur le site, le partage de l invitation dit ce qui s ouvre ou est copié', () => {
  avecPlateforme('web', () => {
    expect(etape('coach', 'm2-pick').text).toMatch(/fenêtre de partage.*copié/);
  });
  avecPlateforme('ios', () => {
    expect(etape('coach', 'm2-pick').text).not.toMatch(/ordinateur/);
  });
});

test('S05 : en vue « Mois », les flèches du calendrier ont leur cadre et leur texte', () => {
  const { fallback } = etape('president', 'm1-parrows');
  expect(fallback.targets).toEqual(['planning.grid']);
  expect(fallback.text).toMatch(/flèches en haut du calendrier/);
});
