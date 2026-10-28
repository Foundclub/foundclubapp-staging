const fs = require('fs');
const path = require('path');

// PETITSBUGS-2683 (27/10/2026) — décision d'Adel « 5- offre équipe » : la cotisation de
// l'équipe appartient à l'OFFRE ÉQUIPE.
//
// Le récapitulatif des offres (GuideOffersRecap) la range dans l'offre Équipe, la fiche
// d'équipe la verrouille « team », et le serveur la débloque avec une offre Équipe dès que la
// campagne ne vise qu'une équipe (admin, subscription-permission.ts, resolveRequiredPlans).
// L'accueil de l'entraîneur, lui, posait le badge « Offre Club » sur « Cotisations de mes
// équipes ». Le badge est informatif (HomeActionCard) : aucun droit ni prix ne change ici.
//
// Contrôle sur la SOURCE, comme ses voisins (accueilParRole.test.js) : HomeHub dépend d'une
// vingtaine de contextes, et la carte de l'entraîneur n'est pas celle du dirigeant.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');

/**
 * Le badge d'offre de la carte « manage-licenses » dont le titre porte cette clef.
 * @param {string} clefDuTitre
 * @returns {string}
 */
const badgeDeLaCarte = (clefDuTitre) => {
  const fin = SOURCE.indexOf(`'${clefDuTitre}'`);
  if (fin === -1) throw new Error(`HomeHub n'a plus de titre « ${clefDuTitre} »`);
  const debut = SOURCE.lastIndexOf("key: 'manage-licenses'", fin);
  if (debut === -1) throw new Error(`La carte « ${clefDuTitre} » n'est plus « manage-licenses »`);
  const badge = SOURCE.slice(debut, fin).match(/premiumScope: (\w+)/);
  if (!badge) throw new Error(`La carte « ${clefDuTitre} » n'a plus de badge d'offre`);
  return badge[1];
};

describe('PETITSBUGS — la cotisation de l équipe porte le badge de l offre Équipe', () => {
  it('« Cotisations de mes équipes » (accueil de l entraîneur) : Offre Équipe', () => {
    expect(badgeDeLaCarte('homeHub.cards.manage.licenses.teamsTitle')).toBe('teamCardPremiumScope');
  });

  it('« Cotisations du club » (accueil du dirigeant) reste à l offre Club', () => {
    expect(badgeDeLaCarte('homeHub.cards.manage.licenses.title')).toBe('clubCardPremiumScope');
  });
});
