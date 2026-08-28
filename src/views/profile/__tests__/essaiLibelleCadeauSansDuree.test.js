const fs = require('fs');
const path = require('path');

/**
 * LOT ESSAI (28/08) — « MON ABONNEMENT » NE DOIT PLUS PROMETTRE 30 JOURS.
 *
 * 🧨 CE QUE LA MESURE A TROUVÉ, et personne ne le cherchait : l'écran
 * « Mon abonnement » nommait le plan offert « Aperçu Club (essai 30 jours) »,
 * la durée écrite EN DUR dans le libellé. Le cadeau de bienvenue réutilise ce
 * MÊME plan `fc_trial_club` pour 7 jours ⇒ l'écran aurait promis 30 jours à
 * quelqu'un dont les droits s'éteignent au 7ᵉ.
 *
 * ⛔ La durée ne se réécrit pas ici : elle est déjà affichée juste à côté, en
 * « J-N », calculée sur `currentPeriodEnd`. Elle reste donc vraie quelle que
 * soit la décision d'Adel sur 7 ou 30 jours — c'est exactement ce que ce témoin
 * protège.
 */
describe('ESSAI — aucun écran ne promet une durée d\'essai écrite en dur', () => {
  const racineSources = path.resolve(__dirname, '..', '..', '..');

  /**
   * Le contenu d'un fichier source, lu depuis la racine `src/`.
   * @param {string} cheminRelatif - Chemin depuis `src/`.
   * @returns {string} - Le contenu du fichier.
   */
  const lireSource = (cheminRelatif) => fs.readFileSync(
    path.resolve(racineSources, cheminRelatif),
    'utf8',
  );

  /**
   * Tous les fichiers de code (témoins exclus) sous un dossier.
   * @param {string} dossier - Le dossier de départ.
   * @returns {string[]} - Les chemins absolus.
   */
  const fichiersDeCode = (dossier) => fs.readdirSync(dossier, { withFileTypes: true })
    .filter((entree) => entree.name !== '__snapshots__' && entree.name !== 'node_modules')
    .flatMap((entree) => {
      const complet = path.join(dossier, entree.name);
      if (entree.isDirectory()) return fichiersDeCode(complet);
      const estCode = /\.(js|jsx)$/.test(entree.name) && !/\.test\.jsx?$/.test(entree.name);
      return estCode ? [complet] : [];
    });

  /**
   * Le code d'un fichier, commentaires retirés. Ce qui est interdit est une
   * durée AFFICHÉE : un commentaire qui explique pourquoi elle a été retirée
   * est utile, et il cite forcément la phrase fautive.
   * @param {string} chemin - Chemin absolu du fichier.
   * @returns {string} - Le code sans ses lignes de commentaire.
   */
  const codeSansCommentaires = (chemin) => fs.readFileSync(chemin, 'utf8')
    .split(/\r?\n/)
    .filter((ligne) => !/^\s*(\/\/|\*|\/\*)/.test(ligne))
    .join(' ');

  test('les libellés des plans offerts ne citent aucun nombre de jours', () => {
    const source = lireSource('views/profile/SubscriptionOverview.js');
    const debut = source.indexOf('const TRIAL_PLAN_LABELS');
    const blocLibelles = source.slice(debut, source.indexOf('};', debut));

    expect(debut).toBeGreaterThan(0);
    expect(blocLibelles).not.toMatch(/\d+\s*jours?/i);
  });

  test('aucune source de l\'app n\'écrit une durée d\'essai en dur', () => {
    // La durée du cadeau se règle sur UNE constante serveur
    // (`ONBOARDING_GIFT_DURATION_DAYS`). Toute copie de ce nombre côté app est
    // une promesse que personne ne pensera à mettre à jour.
    const coupables = fichiersDeCode(racineSources)
      .filter((chemin) => /essai\s*30\s*jours/i.test(codeSansCommentaires(chemin)))
      .map((chemin) => path.relative(racineSources, chemin));

    expect(coupables).toEqual([]);
  });
});
