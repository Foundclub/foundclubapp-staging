/* eslint-disable max-len -- phrases de l écran recopiées mot pour mot : une coupure les rendrait illisibles */
/**
 * T-PAGES-6 (17/11/2026, point 4, R9 + « 4c A ») — « L'essentiel en 6 lignes » en tête des
 * conditions
 * d'inscription. Le texte français est celui APPROUVÉ par Adel (« 10- ok », 17/11), copié tel quel
 * depuis
 * design/PARCOURS-INSCRIPTION/RESUME-CONDITIONS-A-RELIRE.md ; il passe par fr.js / en.js (décision
 * du chef,
 * 17/11 : le résumé n'est pas un texte légal). Il suit conditionsTournoi.js : l'heure « fin au plus
 * tard à
 * 1 h » (décision d'Adel « 3- B ») est celle des conditions, jamais « 23 h ».
 */
import { PARAGRAPHES_DES_CONDITIONS } from '../../../../domains/tournoi/conditionsTournoi';
import en from '../en';
import fr from '../fr';

const LIGNES_APPROUVEES = [
  'Samedi 19 décembre 2026, à AR Soccer, Montpellier. Accueil à 19 h, premier match à 19 h 30, fin au plus tard à 1 h.',
  '20 € par joueur, payé en ligne. L\'équipe est validée quand 5 joueurs ont payé, au plus tard le 10 décembre à 23 h 59. Sinon, chacun est remboursé.',
  'À partir de 16 ans, révolus le 19 décembre. De 16 à 17 ans, un parent coche l\'autorisation sur la page de paiement.',
  'Maillot offert en bonus, dans la limite des tailles et des stocks. Il ne fait pas partie du prix.',
  'Pas de droit de rétractation (loisir à date fixe). Si tu te retires jusqu\'au 5 décembre inclus, tu es remboursé en entier. Après, tu peux céder ta place.',
  'Tes données servent à t\'inscrire et à te joindre le soir du tournoi. AR Soccer est ajouté à tes favoris ; tu peux le retirer en un geste.',
];
const GRAS_APPROUVES = [
  'Samedi 19 décembre 2026, à AR Soccer, Montpellier.',
  '20 € par joueur, payé en ligne.',
  'À partir de 16 ans',
  'Maillot offert en bonus',
  'Pas de droit de rétractation',
  'Tes données',
];

const ligne = (/** @type {any} */ section, /** @type {number} */ n) => `${section[`ligne${n}Gras`]}${section[`ligne${n}Suite`]}`;

test('🔴 T-PAGES-6 (4) — fr.js : les 6 lignes approuvées, mot pour mot, avec leur début en gras', () => {
  const section = fr.tournamentConditionsSummary;
  expect(section.title).toBe("L'essentiel en 6 lignes");
  expect([1, 2, 3, 4, 5, 6].map((n) => ligne(section, n))).toEqual(LIGNES_APPROUVEES);
  expect([1, 2, 3, 4, 5, 6].map((n) => section[`ligne${n}Gras`])).toEqual(GRAS_APPROUVES);
  expect(section.notice).toBe('Ce résumé ne remplace pas les conditions complètes, juste en dessous.');
});

test('🔴 T-PAGES-6 (4) — en.js porte les mêmes clés', () => {
  expect(Object.keys(en.tournamentConditionsSummary).sort()).toEqual(Object.keys(fr.tournamentConditionsSummary).sort());
});

test('T-PAGES-6 (4) — le résumé suit les conditions : « au plus tard à 1 h », jamais « 23 h »', () => {
  const conditions = PARAGRAPHES_DES_CONDITIONS.join('\n');
  expect(conditions).toContain('au plus tard à 1 h');
  expect(JSON.stringify(fr.tournamentConditionsSummary)).not.toMatch(/23 h(?! 59)|23:00/);
});
