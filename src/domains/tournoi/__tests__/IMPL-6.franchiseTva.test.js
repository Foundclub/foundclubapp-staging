/* eslint-disable max-len -- phrases du texte légal recopiées mot pour mot */
// IMPL-6-STRIPE-PREALABLES (18/11/2026), décision d'Adel « 5b franchise » (D73, D261) : Found Club est en
// franchise en base de TVA. Aucun prix ne se dit plus « TTC » ; la mention « TVA non applicable, art. 293 B du
// CGI » le remplace. Mots exacts : `pilotage/tournoi-mtp/CGV_INSCRIPTION.md` l. 71 (dépôt méthode, 74b7e486).
// ROUGE sur l'ancien texte, vert après.
import { PARAGRAPHES_DES_CONDITIONS } from '../conditionsTournoi';

const fr = require('@/theme/strings/translations/fr').default;
const en = require('@/theme/strings/translations/en').default;

test('🔴 D261 : le § 2 des conditions dit « 20 € par joueur (TVA non applicable, art. 293 B du CGI) », plus « 20 € TTC »', () => {
  const indexPrix = PARAGRAPHES_DES_CONDITIONS.indexOf('2. Prix');
  expect(PARAGRAPHES_DES_CONDITIONS[indexPrix + 1]).toBe('20 € par joueur (TVA non applicable, art. 293 B du CGI), pour la participation au tournoi : 4 matchs de ligue, et jusqu\'à 3 matchs de phase finale, l\'arbitrage et les récompenses. Le prix ne comprend pas le déplacement ni l\'assurance personnelle du joueur (§ 6).');
  expect(PARAGRAPHES_DES_CONDITIONS.join('\n')).not.toMatch(/\bTTC\b|toutes taxes/);
});

// TVA-STORES (19/11/2026, « 23 retire ») : `pricesNotice` n'est plus que le texte du SITE (Stripe) ;
// l'application (Apple, Google vendent TVA comprise) lit `renewalNotice`, sans mention ni « TTC ».
// Avant : `pricesNotice` était le texte unique, sur toutes les plateformes.
test('🔴 D261 : la mention sous les offres d abonnement du SITE ne dit plus « Prix TTC » (fr) ni « include VAT » (en)', () => {
  expect(fr.legalFooter.pricesNotice).toBe('TVA non applicable, art. 293 B du CGI. Renouvellement automatique, résiliable à tout moment.');
  expect(en.legalFooter.pricesNotice).toBe('VAT not applicable, article 293 B of the French General Tax Code. Automatic renewal, cancel anytime.');
});

test('🔴 TVA-STORES : la mention de l application (stores) ne parle pas de TVA', () => {
  expect(fr.legalFooter.renewalNotice).toBe('Renouvellement automatique, résiliable à tout moment.');
  expect(en.legalFooter.renewalNotice).toBe('Automatic renewal, cancel anytime.');
});
