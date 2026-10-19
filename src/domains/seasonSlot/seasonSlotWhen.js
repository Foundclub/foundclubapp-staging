import {
  formatDay, slotOccurrences, slotShape, toMinutes, weekdayName,
} from './seasonSlotDisplay';

/**
 * 🗓️ R17-QUAND-1, point 4 (REC17-007, planches P10-quand-tel / P11-quand-v2-tel validées par
 * Adel le 19/10) — L'ÉTAPE « QUAND ? » d'un créneau de la Ville. Quatre formes :
 *   - `saison` : toute la saison (par défaut, un appui) ;
 *   - `periode` : chaque semaine, du … au … ;
 *   - `deuxSemaines` : toutes les 2 semaines, à partir d'un 1er jour (il fixe la parité),
 *     jusqu'à la fin de saison ou une date ;
 *   - `dates` : des dates choisies, n'importe quels jours (Q4 B), les mêmes heures pour toutes.
 * Fonctions pures : la forme choisie devient le corps envoyé au serveur (contrat
 * docs/CONTRAT_CRENEAUX_SAISON.md, R17-QUAND-1), et un créneau « comme si » que la règle partagée
 * (`slotOccurrences`) sait compter. Témoin : __tests__/seasonSlotWhen.R17Q1.test.js.
 */

export const FORMES_DU_QUAND = ['saison', 'periode', 'deuxSemaines', 'dates'];

const jourCivil = (/** @type {unknown} */ valeur) => String(valeur || '').slice(0, 10) || null;
const datesTriees = (/** @type {unknown} */ dates) => (Array.isArray(dates)
  ? [...new Set(dates.map(jourCivil).filter(Boolean))].sort()
  : []);

/**
 * @typedef {object} Quand
 * @property {string} forme - Une de FORMES_DU_QUAND.
 * @property {number | null} [jour] - Le jour ISO (1 = lundi) ; aucun pour des dates choisies.
 * @property {{ validFrom: string, validUntil: string } | null} [saison] - La saison (serveur).
 * @property {string | null} [periodeDu] - AAAA-MM-JJ.
 * @property {string | null} [periodeAu] - AAAA-MM-JJ.
 * @property {string | null} [deuxDu] - Le 1er jour de « toutes les 2 semaines ».
 * @property {string | null} [deuxAu] - Sa fin ; vide = la fin de saison.
 * @property {string[]} [dates] - Les dates choisies.
 */

/**
 * Le 1er jour, à partir de `jour` (compris), qui tombe le jour ISO `numero`.
 * @param {string} jour - AAAA-MM-JJ.
 * @param {number} numero - 1 à 7.
 * @returns {string} AAAA-MM-JJ.
 */
const premierJourDepuis = (jour, numero) => {
  const date = new Date(`${jour}T00:00:00.000Z`);
  const iso = ((date.getUTCDay() + 6) % 7) + 1;
  date.setUTCDate(date.getUTCDate() + ((numero - iso + 7) % 7));
  return date.toISOString().slice(0, 10);
};

/**
 * La saison qui contient un jour, comme le serveur (`seasonOf`) : du 1er septembre au 30 juin ;
 * juillet et août préparent la suivante.
 * @param {string | null | undefined} jour - AAAA-MM-JJ.
 * @returns {{ validFrom: string, validUntil: string } | null} La saison.
 */
export const saisonDuJour = (jour) => {
  const texte = jourCivil(jour);
  if (!texte) return null;
  const annee = Number(texte.slice(0, 4));
  const debut = Number(texte.slice(5, 7)) >= 7 ? annee : annee - 1;
  return { validFrom: `${debut}-09-01`, validUntil: `${debut + 1}-06-30` };
};

/**
 * Le corps que la forme ajoute à l'attribution (et à l'aperçu de place). Toute la saison : rien, le
 * serveur la prend par défaut.
 * @param {Quand} quand - La forme choisie.
 * @returns {Record<string, unknown>} Les champs à envoyer.
 */
export const corpsDuQuand = (quand) => {
  if (quand.forme === 'periode') {
    return { validFrom: jourCivil(quand.periodeDu), validUntil: jourCivil(quand.periodeAu) };
  }
  if (quand.forme === 'deuxSemaines') {
    const du = jourCivil(quand.deuxDu);
    return {
      anchorDate: du && quand.jour ? premierJourDepuis(du, Number(quand.jour)) : du,
      everyWeeks: 2,
      recurrence: 'weekly',
      validFrom: du,
      validUntil: jourCivil(quand.deuxAu) || jourCivil(quand.saison?.validUntil),
    };
  }
  if (quand.forme === 'dates') return { dates: datesTriees(quand.dates), recurrence: 'dates' };
  return {};
};

/**
 * Le créneau « comme si » il était attribué : de quoi compter ses séances par la règle partagée.
 * @param {Quand} quand - La forme choisie.
 * @returns {any} Un créneau (forme, jour, période).
 */
export const creneauDuQuand = (quand) => {
  const corps = corpsDuQuand(quand);
  if (quand.forme === 'dates') {
    const { dates } = /** @type {{ dates: string[] }} */ (corps);
    return { ...corps, validFrom: dates[0] || null, validUntil: dates[dates.length - 1] || null };
  }
  return {
    validFrom: jourCivil(quand.saison?.validFrom),
    validUntil: jourCivil(quand.saison?.validUntil),
    ...corps,
    weekday: quand.jour,
  };
};

/**
 * Les séances À VENIR de la forme (aujourd'hui compris) : ce que le club recevra.
 * @param {any} creneau - Le créneau « comme si » (`creneauDuQuand`).
 * @param {string} aujourdhui - AAAA-MM-JJ.
 * @returns {string[]} Les jours.
 */
export const seancesDuQuand = (creneau, aujourdhui) => (
  creneau?.validFrom && creneau?.validUntil ? slotOccurrences(creneau, { from: aujourdhui }) : []
);

/**
 * Les séances qui tombent dans une fermeture de l'installation : la règle du serveur
 * (`blockTouchesClosure`) — une fermeture sans heures prend ses jours entiers ; ses heures
 * valent au 1er et au dernier jour ; un blocage vaut ses heures, son seul jour.
 * @param {string[]} jours - Les séances (AAAA-MM-JJ).
 * @param {any[] | null | undefined} fermetures - Les fermetures actives (`useFacilityClosures`).
 * @param {string} debut - HH:MM.
 * @param {string} fin - HH:MM.
 * @returns {Array<{ date: string, label: string }>} Les séances fermées, et leur fermeture.
 */
export const fermeturesTouchees = (jours, fermetures, debut, fin) => {
  const de = toMinutes(debut) ?? 0;
  const a = toMinutes(fin) ?? 24 * 60;
  const liste = Array.isArray(fermetures) ? fermetures : [];
  return jours.flatMap((jour) => {
    const fermeture = liste.find((ligne) => {
      const du = jourCivil(ligne?.startDate);
      const au = jourCivil(ligne?.endDate);
      if (!du || !au || jour < du || jour > au) return false;
      const heureDe = toMinutes(String(ligne?.startTime || '').slice(0, 5));
      const heureA = toMinutes(String(ligne?.endTime || '').slice(0, 5));
      const blocage = ligne?.kind === 'block';
      if (!blocage && heureDe === null && heureA === null) return true;
      const ouvre = blocage || jour === du ? heureDe ?? 0 : 0;
      const ferme = blocage || jour === au ? heureA ?? 24 * 60 : 24 * 60;
      return de < ferme && ouvre < a;
    });
    return fermeture ? [{ date: jour, label: String(fermeture.label || '') }] : [];
  });
};

/**
 * La forme d'un créneau qu'on modifie, telle que l'étape la rouvre.
 * @param {any} creneau - Le créneau (serveur).
 * @param {{ validFrom: string, validUntil: string } | null} saison - La saison.
 * @returns {Quand} La forme et ses champs.
 */
export const quandDuCreneau = (creneau, saison) => {
  const forme = slotShape(creneau);
  const du = jourCivil(creneau?.validFrom);
  const au = jourCivil(creneau?.validUntil);
  const base = {
    dates: [],
    deuxAu: null,
    deuxDu: null,
    jour: forme.weekday,
    periodeAu: au,
    periodeDu: du,
    saison,
  };
  if (forme.dates) return { ...base, dates: forme.dates, forme: 'dates' };
  if (forme.everyWeeks === 2) {
    // La 1re date : l'ancrage s'il vient après le début (une ligne coupée garde le sien).
    const premiere = forme.anchorDate && forme.anchorDate > (du || '') ? forme.anchorDate : du;
    return {
      ...base, deuxAu: au, deuxDu: premiere, forme: 'deuxSemaines',
    };
  }
  const touteLaSaison = Boolean(saison) && du === saison?.validFrom && au === saison?.validUntil;
  return { ...base, forme: touteLaSaison ? 'saison' : 'periode' };
};

/**
 * R17-QUAND-1, point 6 — LA FORME EN MOTS, là où un créneau se lit (semaine type, listes, fiche
 * d'un club, « Tes créneaux de la Ville », planning). Courte : « chaque semaine »,
 * « 1 sem. sur 2 », « 3 dates ». Longue : « chaque mardi », « un mercredi sur deux »,
 * « sam. 7 nov. · mar. 17 nov. ».
 * @param {(cle: string, ...autres: any[]) => string} t - La traduction.
 * @param {any} creneau - Le créneau (serveur).
 * @param {{ court?: boolean }} [options] - Courte : pour une pastille.
 * @returns {string} La forme.
 */
export const formeEnMots = (t, creneau, { court = false } = {}) => {
  const forme = slotShape(creneau);
  if (forme.dates) {
    const count = forme.dates.length;
    if (court) {
      return t('collectiviteCreneaux.quand.pastilleDates', {
        count, defaultValue_one: '{{count}} date', defaultValue_other: '{{count}} dates',
      });
    }
    const lus = forme.dates.slice(0, 4).map((jour) => formatDay(jour, { withYear: false }));
    return count > 4
      ? t('collectiviteCreneaux.quand.etAutres', '{{dates}} et {{count}} autres', {
        count: count - 4, dates: lus.join(' · '), interpolation: { escapeValue: false },
      })
      : lus.join(' · ');
  }
  const jour = weekdayName(forme.weekday).toLocaleLowerCase();
  const valeurs = {
    interpolation: { escapeValue: false }, jour, jourMajuscule: weekdayName(forme.weekday),
  };
  if (forme.everyWeeks > 1) {
    return court
      ? t('collectiviteCreneaux.quand.pastilleDeux', '1 sem. sur 2')
      : t('collectiviteCreneaux.quand.unSurDeuxCourt', 'un {{jour}} sur deux', valeurs);
  }
  return court
    ? t('collectiviteCreneaux.quand.pastilleChaque', 'chaque semaine')
    : t('collectiviteCreneaux.quand.chaqueJourCourt', 'chaque {{jour}}', valeurs);
};

/**
 * La forme courte d'un créneau, pour les listes (« 1 sem. sur 2 », « 3 dates », « chaque
 * semaine »).
 * @param {any} creneau - Le créneau.
 * @returns {{ count: number, kind: 'chaqueSemaine' | 'deuxSemaines' | 'dates' }} De quoi l'écrire.
 */
export const formeCourte = (creneau) => {
  const forme = slotShape(creneau);
  if (forme.dates) return { count: forme.dates.length, kind: 'dates' };
  if (forme.everyWeeks === 2) return { count: 2, kind: 'deuxSemaines' };
  return { count: 1, kind: 'chaqueSemaine' };
};
