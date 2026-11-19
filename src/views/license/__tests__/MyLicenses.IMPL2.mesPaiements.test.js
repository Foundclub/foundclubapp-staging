/* eslint-disable max-len -- les témoins se lisent en entier. */
import '@/theme/strings';

import i18next from 'i18next';

// IMPL-2-EQUIPE (18/11/2026, planche 10e) — « Mes cotisations » devient « Mes paiements » : la place
// d'un tournoi et les cotisations de club au même endroit. Seul le TITRE de l'écran change
// (`myLicenses.title`) ; la route (`RouteNames.MyLicenses`) et les entrées de l'accueil et du profil
// (autres écrans) ne bougent pas. Que la place de tournoi payée s'affiche dans la liste est déjà
// prouvé par MyLicenses.TNOTIFS.montantSolde.test.js (« 20,00 EUR »).

test('le titre de l’écran : « Mes paiements » (fr) et « My payments » (en)', async () => {
  await i18next.changeLanguage('fr');
  expect(i18next.t('myLicenses.title')).toBe('Mes paiements');
  await i18next.changeLanguage('en');
  expect(i18next.t('myLicenses.title')).toBe('My payments');
  await i18next.changeLanguage('fr');
});
