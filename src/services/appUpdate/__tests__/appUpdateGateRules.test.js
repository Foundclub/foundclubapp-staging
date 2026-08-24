import {
  isBlockedByUpdateGate,
  isRecommendedByUpdateGate,
  resolveUpdateRecommendedVersion,
  resolveUpdateReleaseNotes,
} from '@/services/appUpdate/appUpdateGateRules';

// R3 — LES REGLES PURES, PRISES A LA SOURCE.
//
// 🔓 Elles sont testees ici SANS rendu et SANS reseau : c'est le seul endroit
// ou l'on peut enumerer les charges tordues (texte, tableau, `null`, champ mal
// orthographie) sans monter un arbre React a chaque cas.

// ---------------------------------------------------------------------------
// LES DEUX ETAGES SONT EXCLUSIFS.
// ---------------------------------------------------------------------------

test('bloque ET recommande : seul le blocage survit', () => {
  const verdict = { blocked: true, recommended: true };

  expect(isBlockedByUpdateGate(verdict)).toBe(true);
  // 🔒 Une feuille refusable par-dessus un mur promettrait une sortie qui
  // n'existe pas. C'est faux ici, et c'est aussi faux cote serveur.
  expect(isRecommendedByUpdateGate(verdict)).toBe(false);
});

test.each([
  ['recommandation seule', { recommended: true }, true],
  ['recommandation avec blocage explicitement faux', { blocked: false, recommended: true }, true],
  ['recommandation en texte', { recommended: 'true' }, false],
  ['recommandation a 1', { recommended: 1 }, false],
  ['recommandation fausse', { recommended: false }, false],
  ['champ mal orthographie', { recomended: true }, false],
  ['charge vide', null, false],
  ['charge en texte', 'recommande', false],
  ['charge en tableau', [], false],
  ['tableau portant le champ', Object.assign([], { recommended: true }), false],
])('%s : recommande = %s', (_libelle, charge, attendu) => {
  expect(isRecommendedByUpdateGate(charge)).toBe(attendu);
});

// ---------------------------------------------------------------------------
// LA VERSION CONSEILLEE — jamais un libelle a trou.
// ---------------------------------------------------------------------------

test.each([
  ['version presente', { recommendedVersion: '2.7.0' }, '2.7.0'],
  ['espaces autour', { recommendedVersion: '  2.7.0  ' }, '2.7.0'],
  ['chaine vide', { recommendedVersion: '' }, null],
  ['que des espaces', { recommendedVersion: '   ' }, null],
  ['champ absent', {}, null],
  ['charge vide', null, null],
])('%s : version conseillee = %s', (_libelle, charge, attendu) => {
  expect(resolveUpdateRecommendedVersion(charge)).toBe(attendu);
});

// ---------------------------------------------------------------------------
// LES NOUVEAUTES — TOUJOURS un tableau, 3 lignes au plus.
// ---------------------------------------------------------------------------

test('les nouveautes remontent telles quelles, nettoyees', () => {
  expect(resolveUpdateReleaseNotes({
    releaseNotes: ['  Paiement  ', 'Notifications'],
  })).toEqual(['Paiement', 'Notifications']);
});

test('au-dela de 3 lignes, l\'app recoupe elle aussi', () => {
  // 🧾 Le serveur coupe deja. On recoupe ici parce qu'un serveur NON DEPLOYE
  // (le cas exact du jour ou ce champ arrive) enverrait la liste entiere, et
  // un mur de texte pousserait le bouton hors de l'ecran.
  expect(resolveUpdateReleaseNotes({
    releaseNotes: ['une', 'deux', 'trois', 'quatre', 'cinq'],
  })).toEqual(['une', 'deux', 'trois']);
});

test.each([
  ['champ absent', {}],
  ['charge vide', null],
  ['valeur en texte', { releaseNotes: 'Paiement' }],
  ['valeur numerique', { releaseNotes: 3 }],
  ['tableau vide', { releaseNotes: [] }],
  ['lignes vides seulement', { releaseNotes: ['', '   '] }],
  ['lignes qui ne sont pas du texte', { releaseNotes: [1, null, {}] }],
])('%s : tableau VIDE, donc aucune carte', (_libelle, charge) => {
  expect(resolveUpdateReleaseNotes(charge)).toEqual([]);
});
