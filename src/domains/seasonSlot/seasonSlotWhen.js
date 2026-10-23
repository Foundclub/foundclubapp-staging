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
 * « sam. 7 nov. · mar. 17 nov. ». R17-QUAND-2 : un créneau « sauf vacances scolaires » le dit
 * (« chaque mardi, sauf vacances »). R17-QUAND-2-BIS : avec `heures`, elles passent AVANT les
 * vacances (« chaque mardi, 17:30 – 19:00, sauf vacances », planche P11-quand-ou-ca-vit).
 * @param {Function} t - La traduction.
 * @param {any} creneau - Le créneau (serveur).
 * @param {{ court?: boolean, heures?: string }} [options] - Courte (une pastille) ; les heures.
 * @returns {string} La forme.
 */
export const formeEnMots = (t, creneau, { court = false, heures = '' } = {}) => {
  const forme = slotShape(creneau);
  const base = formeSansVacances(t, forme, court);
  const saufVacances = forme.exceptHolidays && !forme.dates;
  let avecHeures = base;
  if (heures) avecHeures = saufVacances ? `${base}, ${heures}` : `${base} ${heures}`;
  return saufVacances
    ? t('collectiviteCreneaux.quand.vacances.forme', '{{forme}}, sauf vacances', {
      forme: avecHeures, interpolation: { escapeValue: false },
    })
    : avecHeures;
};

/**
 * La forme en mots, sans les vacances.
 * @param {Function} t - La traduction.
 * @param {ReturnType<typeof slotShape>} forme - La forme (`slotShape`).
 * @param {boolean} court - Courte : pour une pastille.
 * @returns {string} La forme.
 */
const formeSansVacances = (t, forme, court) => {
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
  const valeurs = {
    interpolation: { escapeValue: false },
    jour: forme.weekday ? weekdayName(forme.weekday, { inSentence: true }) : '',
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

const versJour = (/** @type {string} */ jour) => new Date(`${jour}T00:00:00.000Z`);
const enTexte = (/** @type {Date} */ date) => date.toISOString().slice(0, 10);
const lundiDe = (/** @type {Date} */ date) => {
  const lundi = new Date(date);
  lundi.setUTCDate(lundi.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return lundi;
};

/**
 * 🗓️ DATESDABORD (23/10/2026, recette iPhone d'Adel, point 9) — « ATTRIBUER UN CRÉNEAU » PREND LE
 * MODÈLE DE LA CRÉATION D'ÉVÉNEMENT (le bloc partagé `DateEtHoraire` : une date, des heures,
 * « Répéter »). La répétition devient une forme que le serveur connaît déjà (aucun champ neuf) :
 * un seul jour toutes les semaines → `periode` (`saison` dès la prochaine date jusqu'à la fin de
 * saison) ; toutes les 2 semaines → `deuxSemaines` (la parité,
 * « sauf vacances ») ; le reste (une seule fois, plusieurs jours, tous les 3 et plus, tous les
 * mois) → des `dates`, d'aujourd'hui à la fin de saison. Le jour de la date est toujours compris
 * (comme l'étape « Date & horaire » de l'événement).
 * Témoin : __tests__/seasonSlotWhen.DATESDABORD.test.js.
 * @param {{
 *   aujourdhui: string,
 *   date: string,
 *   finDeSaison: string,
 *   repetition: { actif?: boolean, au?: string | null, du?: string | null, frequence?: string,
 *     intervalleTexte?: string, jours?: any[] } | null,
 * }} entree - Les jours en AAAA-MM-JJ ; `jours` de la répétition : 0 = dimanche (DayPicker).
 * @returns {{ forme: string, jour: number, joursDifferents: boolean, dates?: string[],
 *   periodeDu?: string, periodeAu?: string, deuxDu?: string, deuxAu?: string | null }} La forme.
 */
export const quandDeLaRepetition = ({
  aujourdhui, date, finDeSaison, repetition,
}) => {
  const base = versJour(date);
  const jour = ((base.getUTCDay() + 6) % 7) + 1;
  if (!repetition?.actif) {
    return {
      dates: [date], forme: 'dates', jour, joursDifferents: true,
    };
  }

  const debut = jourCivil(repetition.du) || date;
  const voulue = jourCivil(repetition.au);
  const fin = voulue && voulue < finDeSaison ? voulue : finDeSaison;
  const saisi = Number.parseInt(String(repetition.intervalleTexte ?? ''), 10);
  const intervalle = Math.max(1, saisi || 1);
  const jours = [...new Set([base.getUTCDay(), ...(repetition.jours || []).map(Number)])]
    .filter((numero) => Number.isInteger(numero) && numero >= 0 && numero <= 6);
  const mensuel = repetition.frequence === 'month';

  if (!mensuel && jours.length === 1 && intervalle === 1) {
    // Dès la prochaine date jusqu'à la fin de saison : c'est « toute la saison » (le serveur la
    // prend par défaut ; le corps reste celui d'avant le lot).
    if (fin === finDeSaison && debut <= premierJourDepuis(aujourdhui, jour)) {
      return { forme: 'saison', jour, joursDifferents: false };
    }
    return {
      forme: 'periode', jour, joursDifferents: false, periodeAu: fin, periodeDu: debut,
    };
  }
  if (!mensuel && jours.length === 1 && intervalle === 2) {
    return {
      deuxAu: voulue ? fin : null,
      deuxDu: debut,
      forme: 'deuxSemaines',
      jour,
      joursDifferents: false,
    };
  }

  /** @type {string[]} */
  const dates = [];
  if (mensuel) {
    const quantieme = base.getUTCDate();
    for (let rang = 0; ; rang += intervalle) {
      const mois = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + rang, 1));
      const candidat = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth(), quantieme));
      if (enTexte(mois) > fin) break;
      const texte = enTexte(candidat);
      if (candidat.getUTCMonth() === mois.getUTCMonth() && texte >= debut && texte <= fin) {
        dates.push(texte);
      }
    }
  } else {
    const premierLundi = lundiDe(versJour(debut)).getTime();
    for (let curseur = versJour(debut); enTexte(curseur) <= fin;
      curseur.setUTCDate(curseur.getUTCDate() + 1)) {
      const semaine = Math.round((lundiDe(curseur).getTime() - premierLundi) / (7 * 86400000));
      if (semaine % intervalle === 0 && jours.includes(curseur.getUTCDay())) {
        dates.push(enTexte(curseur));
      }
    }
  }
  return {
    dates: dates.filter((texte) => texte >= aujourdhui),
    forme: 'dates',
    jour,
    joursDifferents: true,
  };
};
