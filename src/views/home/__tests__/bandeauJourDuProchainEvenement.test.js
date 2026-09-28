const fs = require('fs');
const path = require('path');

// FINITIONS (recette émulateur du 2026-09-28, tournée 2) — « AUJOURD'HUI » au-dessus
// d'un match du MERCREDI, un LUNDI (capture T2-accueil-aujourdhui-mercredi).
//
// La règle de rangement vit dans `domains/home/homeCounters.js` (`selectBannerDay`,
// témoin `homeCounters.FINITIONS.test.js`). Ce fichier-ci tient le BRANCHEMENT : la
// branche dirigeant du bandeau doit s'en servir, au lieu de poser l'étiquette
// « Aujourd'hui » en dur. Contrôle sur la SOURCE, comme ses voisins
// (`bandeauProchainEvenement.test.js`) : HomeHub fait près de 3 000 lignes et dépend
// d'une vingtaine de contextes React. Écrit ROUGE.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');

/**
 * La branche « dirigeant » du memo qui fabrique le bandeau. LÈVE si un repère a
 * disparu — un renommage rend ce fichier ROUGE plutôt que vert par accident.
 * @returns {string} Le texte de la branche.
 */
const brancheDirigeant = () => {
  const memo = SOURCE.indexOf('const headBanner = useMemo(');
  if (memo === -1) throw new Error("HomeHub n'a plus de memo « headBanner »");
  const debut = SOURCE.indexOf('if (isPresident) {', memo);
  const fin = SOURCE.indexOf('if (isCoach) {', debut);
  if (debut === -1 || fin === -1) throw new Error('Branche dirigeant du bandeau introuvable');
  return SOURCE.slice(debut, fin);
};

describe('FINITIONS 3 — le bandeau du dirigeant se range sous le JOUR de l événement', () => {
  it('🥇 l étiquette passe par la règle partagée, jamais par « Aujourd hui » en dur', () => {
    const branche = brancheDirigeant();

    expect(branche).toContain('selectBannerDay(');
    expect(branche).not.toMatch(/label: t\('homeHub\.banner\.today\.label'/);
  });

  it('les quatre jours ont chacun leur libellé', () => {
    const branche = brancheDirigeant();

    ['homeHub.banner.today.label', 'homeHub.banner.when.tomorrow',
      'homeHub.banner.when.thisWeek', 'homeHub.banner.when.later'].forEach((cle) => {
      expect(branche).toContain(`t('${cle}'`);
    });
  });

  it('la ligne de l événement reçoit « maintenant », pour dire la date quand il est loin', () => {
    expect(brancheDirigeant()).toMatch(/formatBannerShortTime\(\s*homeCounters\.prochainEvenement\?\.startsAt,\s*\w+/);
  });
});
