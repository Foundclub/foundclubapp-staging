/**
 * CE QU'ANNONCE LA CARTE « MON ENTRAÎNEMENT » DE L'ACCUEIL.
 *
 * 🔎 POURQUOI CETTE LOGIQUE VIT ICI, ET PAS DANS L'ÉCRAN : `HomeHub.js` fait plus
 * de 2 500 lignes et ne se monte pas dans un test — le filet de l'accueil lit son
 * TEXTE SOURCE, ce qui suffit pour vérifier l'ordre des cartes mais pas ce qu'elles
 * disent. Sorties ici, ces deux fonctions se testent pour de vrai : un compte à
 * rebours faux ou un lieu perdu se voit tout de suite.
 *
 * 🪤 CE QUE LA CARTE DISAIT AVANT (mesuré le 2026-09-08) : toujours le même mot
 * figé, « Mon entraînement », et pour seul sous-titre le thème de la séance. Depuis
 * l'accueil, le joueur ne savait ni quel programme il suivait, ni si c'était pour
 * ce matin ou pour la semaine prochaine, ni où aller, ni combien de temps ça prend.
 */

/**
 * Le nombre de jours qui séparent aujourd'hui d'une date prévue.
 * @param {string|null|undefined} datePrevue la date de la séance, au format ISO
 * @param {Date} [maintenant] le jour de référence, injectable pour les témoins
 * @returns {number|null} le nombre de jours, ou `null` si la date est illisible
 */
export const joursAvant = (datePrevue, maintenant = new Date()) => {
  if (!datePrevue) return null;
  const prevue = new Date(`${String(datePrevue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(prevue.getTime())) return null;
  const depart = new Date(maintenant);
  depart.setHours(0, 0, 0, 0);
  return Math.round((prevue.getTime() - depart.getTime()) / 86400000);
};

/**
 * Le compte à rebours, dit en mots.
 *
 * Une date sèche (« 9 sept. ») ne dit pas si c'est pour ce matin. Un joueur qui
 * ouvre l'app veut savoir s'il doit préparer son sac maintenant.
 * @param {string|null|undefined} datePrevue la date de la séance
 * @param {(key: string, options?: Record<string, any>) => string} t la traduction
 * @param {Date} [maintenant] le jour de référence, injectable pour les témoins
 * @returns {string} « aujourd'hui », « demain », « dans n jours », ou rien
 */
export const compteARebours = (datePrevue, t, maintenant = new Date()) => {
  const jours = joursAvant(datePrevue, maintenant);
  if (jours === null) return '';
  // Une séance en retard reste « aujourd'hui » : elle n'est pas perdue, elle attend.
  if (jours <= 0) return t('training.home.myCard.today');
  if (jours === 1) return t('training.home.myCard.tomorrow');
  return t('training.home.countdown', { count: jours });
};

/**
 * Le sous-titre de la carte : le thème, le lieu, la durée, et ce qu'il y a à préparer.
 *
 * Chaque morceau disparaît s'il manque, plutôt que de laisser un trou entre deux
 * points médians.
 * @param {Record<string, any>|null|undefined} journee la journée de la prochaine séance
 * @param {(key: string, options?: Record<string, any>) => string} t la traduction
 * @returns {string} le sous-titre assemblé, ou une chaîne vide sans journée
 */
export const sousTitreSeance = (journee, t) => {
  if (!journee) return '';
  const morceaux = [t('training.home.myCard.subtitle', {
    day: journee.title,
    duration: journee.durationMinutes,
    place: journee.place,
  })];
  const preparatifs = Array.isArray(journee.markers) ? journee.markers.length : 0;
  if (preparatifs > 0) {
    morceaux.push(t('training.home.myCard.toPrepare', { count: preparatifs }));
  }
  return morceaux.join(' · ');
};
