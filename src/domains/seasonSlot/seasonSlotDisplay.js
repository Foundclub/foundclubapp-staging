import { format, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import localeDesFormats from '@/theme/strings/localeDesFormats';

import { getServerErrorCode } from '@/utils/errors/displayError';
import { getPlanningItemWindow, normalizePlanningItems } from '@/utils/planning/planningSlots';

/**
 * COLL-C2B (02/10) — ce que l ecran DIT d un creneau de saison : jours, heures, periode,
 * « club · equipe », moments complets, heures libres, refus du serveur. Fonctions pures :
 * elles ne lisent que ce qu on leur donne (et la langue d i18next pour les dates).
 *
 * Le jour est ISO (1 = lundi … 7 = dimanche), comme le serveur (contrat §5).
 * Les heures sont « HH:MM », murales de Paris : on ne les convertit jamais ici.
 */

export const SEASON_SLOT_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Le 5 janvier 2026 est un lundi : le jour ISO n tombe le (4 + n) janvier.
const LUNDI_DE_REFERENCE = 4;

/**
 * La locale date-fns de la langue de l app.
 * @returns {import('date-fns').Locale} fr ou en-GB.
 */
const dateLocale = () => (localeDesFormats() === 'en-GB' ? enGB : fr);

/**
 * Premiere lettre en capitale (« mer. 30 sept. » -> « Mer. 30 sept. »).
 * @param {string} texte - Le texte.
 * @returns {string} Le texte, sa premiere lettre en capitale.
 */
export const capitalize = (texte) => (
  texte ? `${texte.charAt(0).toLocaleUpperCase()}${texte.slice(1)}` : ''
);

/**
 * Le nom d un jour ISO dans la langue de l app (« Lundi », ou « Lun. » en court).
 * @param {number} isoDay - 1 a 7.
 * @param {{ short?: boolean }} [options] - Court : « Lun. ».
 * @returns {string} Le nom, avec sa capitale ; vide pour un jour hors bornes.
 */
export const weekdayName = (isoDay, { short = false } = {}) => {
  const jour = Number(isoDay);
  if (!Number.isInteger(jour) || jour < 1 || jour > 7) return '';
  const date = new Date(2026, 0, LUNDI_DE_REFERENCE + jour);
  return capitalize(format(date, short ? 'EEE' : 'EEEE', { locale: dateLocale() }));
};

/**
 * Le jour ISO d une date (lundi = 1).
 * @param {Date} date - La date (heure de l appareil).
 * @returns {number} 1 a 7.
 */
export const isoWeekdayOf = (date) => ((date.getDay() + 6) % 7) + 1;

/**
 * 🎨 FINITIONS12-COLL (03/10) — UN SEUL POINT en fin de phrase quand elle finit sur une date
 * abrégée (« … à partir du sam. 3 oct.. », tournée T11, C23 : `formatDay` garde le point de
 * « oct. », la phrase en ajoutait un).
 * @param {string} phrase - La phrase.
 * @returns {string} La phrase, sans point doublé à la fin.
 */
// FINITIONS13-COLL (04/10) : le motif était /..$/ (deux caractères QUELCONQUES) :
// « 1 juin. » devenait « 1 jui. ». Seul un point doublé tombe.
export const unSeulPointFinal = (phrase) => String(phrase || '').replace(/\.\.$/, '.');

/**
 * 🗓️ FINITIONS12-COLL (03/10) — LA FIN D'UN CRÉNEAU, celle qu'on écrit : le dernier jour où il a
 * lieu (`effectiveUntil`, serveur : un créneau retiré « à partir du 1er juin » finit le 31 mai),
 * sinon sa période (`validUntil`). Tournée T11 (C23) : « du 1 sept. au 30 juin » sur un créneau
 * qui s'arrête au 31 mai.
 * @param {{ effectiveUntil?: string | null, validUntil?: string | null } | null | undefined} slot
 * @returns {string | null} AAAA-MM-JJ, ou null.
 */
export const finDuCreneau = (slot) => (
  String(slot?.effectiveUntil || slot?.validUntil || '').slice(0, 10) || null
);

/**
 * Une heure « HH:MM » valide ?
 * @param {unknown} valeur - Ce qui a ete tape.
 * @returns {boolean} Vrai pour « 08:00 », faux pour « 8h ».
 */
export const isTime = (valeur) => typeof valeur === 'string' && HEURE.test(valeur.trim());

/**
 * 🧭 FINITIONS11-COLL (03/10, décision d'Adel « deplacer A ») — LA QUESTION POSÉE AU SERVEUR
 * POUR UNE SÉANCE QU'ON DÉPLACE : les paramètres de l'aperçu
 * (`GET /facilities/:id/season-slots/preview`, au nom du club : COLL-FIX2 y rend
 * `decision.outcome`, les mêmes juges qu'event.update). Hors du créneau du club, la mairie
 * décide, et si elle refuse la séance est annulée : le club doit le lire AVANT d'enregistrer.
 * Seulement si la séance a BOUGÉ (jour, heures, installation) : sinon le serveur ne rejuge rien
 * (COLL-C2B-BIS, `isSessionMoved`).
 * @param {any} seance - La séance enregistrée (date, startTime, endTime, facility, club, team).
 * @param {{ club?: string | null, debut: string, facilityId?: string | null, fin: string,
 *   jour: string, team?: string | null }} saisie - La saisie de l'écran (jour AAAA-MM-JJ).
 * @returns {Record<string, string | number> | null} Les paramètres, ou null (rien à demander).
 */
export const parametresApercuDuDeplacement = (seance, saisie) => {
  const club = saisie?.club || seance?.club?.documentId || null;
  if (!seance?.documentId || !club || !saisie?.facilityId) return null;
  if (!isTime(saisie.debut) || !isTime(saisie.fin)) return null;
  const jour = parseISO(String(saisie.jour || ''));
  if (Number.isNaN(jour.getTime())) return null;
  const jourEnregistre = seance.date ? format(new Date(seance.date), 'yyyy-MM-dd') : '';
  const bouge = saisie.facilityId !== (seance.facility?.documentId || null)
    || saisie.jour !== jourEnregistre
    || saisie.debut !== String(seance.startTime || '').slice(0, 5)
    || saisie.fin !== String(seance.endTime || '').slice(0, 5);
  if (!bouge) return null;
  const team = saisie.team || seance.team?.documentId || null;
  return {
    club,
    endTime: saisie.fin,
    startTime: saisie.debut,
    ...(team ? { team } : {}),
    validFrom: saisie.jour,
    validUntil: saisie.jour,
    weekday: isoWeekdayOf(jour),
  };
};

/**
 * « HH:MM » (ou « HH:MM:SS.000 ») en minutes depuis minuit.
 * @param {unknown} valeur - L heure.
 * @returns {number | null} Les minutes, ou null si illisible.
 */
export const toMinutes = (valeur) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(valeur || '').trim());
  if (!match) return null;
  const heures = Number(match[1]);
  const minutes = Number(match[2]);
  if (heures > 24 || minutes > 59) return null;
  return (heures * 60) + minutes;
};

/**
 * Des minutes depuis minuit en « HH:MM ».
 * @param {number} minutes - Les minutes (0 a 1440).
 * @returns {string} L heure.
 */
export const fromMinutes = (minutes) => {
  const borne = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const heures = String(Math.floor(borne / 60)).padStart(2, '0');
  return `${heures}:${String(borne % 60).padStart(2, '0')}`;
};

/**
 * « 17:30 – 19:00 ».
 * @param {string} debut - HH:MM.
 * @param {string} fin - HH:MM.
 * @returns {string} La plage.
 */
export const timeRange = (debut, fin) => (
  `${String(debut || '').slice(0, 5)} – ${String(fin || '').slice(0, 5)}`
);

/**
 * Un jour civil « AAAA-MM-JJ » (ou une date) en « lun. 5 oct. 2026 ».
 * @param {string | Date | null | undefined} jour - Le jour.
 * @param {{ withYear?: boolean }} [options] - Sans annee : « lun. 5 oct. ».
 * @returns {string} Le jour lisible, ou vide.
 */
export const formatDay = (jour, { withYear = true } = {}) => {
  if (!jour) return '';
  const date = typeof jour === 'string' ? parseISO(jour) : jour;
  if (Number.isNaN(date.getTime())) return '';
  return format(date, withYear ? 'EEE d MMM yyyy' : 'EEE d MMM', { locale: dateLocale() });
};

/**
 * « 1 sept. 2026 – 30 juin 2027 ».
 * @param {string | null | undefined} debut - AAAA-MM-JJ.
 * @param {string | null | undefined} fin - AAAA-MM-JJ.
 * @param {{ withYear?: boolean }} [options] - Sans annee : « 1 sept. – 30 juin ».
 * @returns {string} La periode, ou vide.
 */
export const formatPeriod = (debut, fin, { withYear = true } = {}) => {
  if (!debut || !fin) return '';
  const motif = withYear ? 'd MMM yyyy' : 'd MMM';
  const locale = dateLocale();
  const de = format(parseISO(debut), motif, { locale });
  return `${de} – ${format(parseISO(fin), motif, { locale })}`;
};

/**
 * Les deux annees d une saison (« 2026-2027 »).
 * @param {{ validFrom?: string, validUntil?: string } | null | undefined} saison - meta.season.
 * @returns {{ debut: string, fin: string } | null} Les annees, ou null.
 */
export const seasonYears = (saison) => {
  const debut = String(saison?.validFrom || '').slice(0, 4);
  const fin = String(saison?.validUntil || '').slice(0, 4);
  return debut && fin ? { debut, fin } : null;
};

/**
 * « AS Montrivage · U15 », ou le club seul quand le creneau est pour tout le club (D5).
 * Club et equipe : jamais une personne (SPEC §2 H).
 * @param {any} creneau - Un creneau, un occupant de l apercu, ou un bloc du planning.
 * @returns {string} Qui occupe.
 */
export const slotWho = (creneau) => [creneau?.club?.name, creneau?.team?.name]
  .map((partie) => String(partie || '').trim())
  .filter(Boolean)
  .join(' · ');

/**
 * Les creneaux ranges par jour de la semaine, puis par heure (le serveur trie deja).
 * @param {any[]} creneaux - Les creneaux.
 * @returns {Array<{ weekday: number, slots: any[] }>} Les jours qui en ont, du lundi au dimanche.
 */
export const groupSlotsByWeekday = (creneaux) => SEASON_SLOT_WEEKDAYS
  .map((weekday) => ({
    slots: (Array.isArray(creneaux) ? creneaux : [])
      .filter((creneau) => Number(creneau?.weekday) === weekday)
      .sort((a, b) => (toMinutes(a?.startTime) ?? 0) - (toMinutes(b?.startTime) ?? 0)),
    weekday,
  }))
  .filter((jour) => jour.slots.length > 0);

/**
 * Les plages ou au moins `capacite` intervalles se chevauchent (le « complet »).
 * @param {Array<{ start: number, end: number }>} intervalles - Des bornes comparables.
 * @param {number} capacite - Le nombre de places.
 * @returns {Array<{ start: number, end: number }>} Les plages pleines, fusionnees.
 */
export const fullRanges = (intervalles, capacite) => {
  const places = Math.max(1, Number(capacite) || 1);
  /** @type {Array<{ delta: number, at: number }>} */
  const marques = [];
  intervalles.forEach(({ end, start }) => {
    if (!(end > start)) return;
    marques.push({ at: start, delta: 1 }, { at: end, delta: -1 });
  });
  marques.sort((a, b) => (a.at - b.at) || (a.delta - b.delta));

  /** @type {Array<{ start: number, end: number }>} */
  const pleines = [];
  let courant = 0;
  /** @type {number | null} */
  let debut = null;
  marques.forEach(({ at, delta }) => {
    courant += delta;
    if (courant >= places && debut === null) debut = at;
    if (courant < places && debut !== null) {
      const derniere = pleines[pleines.length - 1];
      if (derniere && derniere.end === debut) derniere.end = at;
      else if (at > debut) pleines.push({ end: at, start: debut });
      debut = null;
    }
  });
  return pleines;
};

/**
 * Les moments complets d un jour de la semaine type, en minutes.
 * 🐞 COLL-FIX2 (03/10), planche 23 (tournée T10) : deux créneaux ne prennent une place ENSEMBLE
 * que si leurs heures ET leurs périodes se chevauchent (`validFrom` / `validUntil`, jours
 * « AAAA-MM-JJ »). Avant, le même club sur deux périodes qui se suivent se lisait « complet ».
 * Des périodes qui se croisent ont un jour commun : le plus tardif de leurs débuts. On juge
 * donc les heures à chaque début de période, et on réunit les plages pleines.
 * @param {any[]} creneaux - Les creneaux d UN jour.
 * @param {number} capacite - maxSlots.
 * @returns {Array<{ start: number, end: number }>} Les plages pleines.
 */
export const fullRangesOfSlots = (creneaux, capacite) => {
  const du = (/** @type {any} */ c) => String(c?.validFrom || '0000-01-01').slice(0, 10);
  const au = (/** @type {any} */ c) => String(c?.validUntil || '9999-12-31').slice(0, 10);
  const pleines = [...new Set(creneaux.map(du))].flatMap((jour) => fullRanges(
    creneaux
      .filter((creneau) => du(creneau) <= jour && jour <= au(creneau))
      .map((creneau) => ({
        end: toMinutes(creneau?.endTime) ?? 0,
        start: toMinutes(creneau?.startTime) ?? 0,
      })),
    capacite,
  ));
  return pleines
    .sort((a, b) => a.start - b.start)
    .reduce((/** @type {Array<{ start: number, end: number }>} */ fusion, plage) => {
      const derniere = fusion[fusion.length - 1];
      if (derniere && plage.start <= derniere.end) derniere.end = Math.max(derniere.end, plage.end);
      else fusion.push({ ...plage });
      return fusion;
    }, []);
};

/**
 * Les moments complets d un planning (blocs dates), du plus tot au plus tard.
 * @param {any[]} blocs - Les blocs normalises du planning.
 * @param {number} capacite - maxSlots.
 * @returns {Array<{ start: Date, end: Date }>} Les plages pleines.
 */
export const fullMomentsOfPlanning = (blocs, capacite) => fullRanges(
  (Array.isArray(blocs) ? blocs : []).map((bloc) => {
    const fenetre = getPlanningItemWindow(bloc);
    return fenetre
      ? { end: fenetre.endAt.getTime(), start: fenetre.startAt.getTime() }
      : { end: 0, start: 0 };
  }),
  capacite,
).map(({ end, start }) => ({ end: new Date(end), start: new Date(start) }));

/**
 * Les heures LIBRES d une journee : l ouverture moins ce qui est occupe (par n importe qui).
 * @param {Array<{ start: number, end: number }>} occupees - Les plages occupees, en minutes.
 * @param {number} ouverture - En minutes (defaut 08:00).
 * @param {number} fermeture - En minutes (defaut 22:00).
 * @returns {Array<{ start: number, end: number }>} Les plages libres.
 */
export const freeRanges = (occupees, ouverture = 8 * 60, fermeture = 22 * 60) => {
  const triees = [...occupees]
    .filter(({ end, start }) => end > start)
    .sort((a, b) => a.start - b.start);
  /** @type {Array<{ start: number, end: number }>} */
  const libres = [];
  let curseur = ouverture;
  triees.forEach(({ end, start }) => {
    if (start > curseur) libres.push({ end: Math.min(start, fermeture), start: curseur });
    curseur = Math.max(curseur, end);
  });
  if (curseur < fermeture) libres.push({ end: fermeture, start: curseur });
  return libres.filter(({ end, start }) => end > start);
};

/**
 * L apercu porte par un refus 409 de capacite (« Attribuer quand meme »), ou null.
 * @param {any} erreur - L erreur rejetee par le client HTTP.
 * @returns {any | null} `details.preview`, ou null pour tout autre refus.
 */
export const overCapacityPreviewOf = (erreur) => (
  getServerErrorCode(erreur) === 'SEASON_SLOT_OVER_CAPACITY'
    ? erreur?.details?.preview || erreur?.response?.data?.error?.details?.preview || {}
    : null
);

/**
 * Le refus du serveur, dit a la mairie (au « vous »), ou null s il n a pas de code connu.
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {any} erreur - L erreur rejetee par le client HTTP.
 * @returns {string | null} Le message, ou null (l appelant affiche alors le message generique).
 */
export const seasonSlotErrorMessage = (t, erreur) => {
  switch (getServerErrorCode(erreur)) {
    case 'FACILITY_PLATEAUX_INVALID':
      return t(
        'collectiviteCreneaux.erreurs.plateauxInvalides',
        'Chaque plateau a un nom court et différent, et il n’y en a pas plus que d’équipes à '
          + 'la fois.',
      );
    case 'SEASON_SLOT_ALREADY_WITHDRAWN':
      return t('collectiviteCreneaux.erreurs.dejaRetire', 'Ce créneau est déjà retiré.');
    case 'SEASON_SLOT_CLUB_NOT_ALLOWED':
      return t('collectiviteCreneaux.erreurs.club', 'Ce club n’est pas rattaché à la Ville.');
    case 'SEASON_SLOT_INVALID_PAYLOAD':
      return t(
        'collectiviteCreneaux.erreurs.saisie',
        'Vérifiez le jour, les heures et la période.',
      );
    case 'SEASON_SLOT_MANAGER_REQUIRED':
      return t(
        'collectiviteCreneaux.erreurs.droits',
        'Seule la Ville attribue les créneaux de ses installations.',
      );
    case 'SEASON_SLOT_NOT_FOUND':
      return t('collectiviteCreneaux.erreurs.introuvable', 'Ce créneau n’existe plus.');
    case 'SEASON_SLOT_NOT_WITHDRAWN':
      return t('collectiviteCreneaux.erreurs.pasRetire', 'Ce créneau n’est pas retiré.');
    case 'SEASON_SLOT_OUTSIDE_OPENING_HOURS':
      return t(
        'collectiviteCreneaux.erreurs.horaires',
        'Ce créneau sort des horaires d’ouverture de l’installation.',
      );
    case 'SEASON_SLOT_PLATEAU_UNKNOWN':
      return t(
        'collectiviteCreneaux.erreurs.plateau',
        'Ce plateau n’existe plus : choisissez-en un autre.',
      );
    case 'SEASON_SLOT_TEAM_NOT_IN_CLUB':
      return t('collectiviteCreneaux.erreurs.equipe', 'Cette équipe n’appartient pas à ce club.');
    default:
      return null;
  }
};

/**
 * La semaine d une installation, lue dans son planning : combien de seances, et le premier
 * moment complet.
 * @param {any} reponse - La reponse du planning (`{ data: blocs }`).
 * @param {number} capacite - maxSlots.
 * @returns {{ count: number, full: { start: Date, end: Date } | null }} Le resume.
 */
export const summarizeInstallationWeek = (reponse, capacite) => {
  const blocs = normalizePlanningItems(Array.isArray(reponse?.data) ? reponse.data : []);
  return { count: blocs.length, full: fullMomentsOfPlanning(blocs, capacite)[0] || null };
};

/**
 * Un moment date, dit court : « jeu. 18:00 – 19:30 ».
 * @param {{ start: Date, end: Date }} moment - Les bornes.
 * @returns {string} Le moment.
 */
export const momentLabel = ({ end, start }) => (
  `${format(start, 'EEE', { locale: dateLocale() })} ${format(start, 'HH:mm')} – `
  + `${format(end, 'HH:mm')}`
);

// Deux plages separees d au plus 30 minutes restent dans la meme bande de la grille.
const ECART_DANS_LA_BANDE = 30;

/**
 * Les plages horaires de creneaux, en minutes, lisibles et dans l ordre.
 * @param {any[]} creneaux - Des creneaux (`startTime`, `endTime`).
 * @returns {Array<{ creneau: any, debut: number, fin: number }>} Les plages.
 */
const plagesDe = (creneaux) => (Array.isArray(creneaux) ? creneaux : [])
  .map((creneau) => ({
    creneau,
    debut: toMinutes(creneau?.startTime),
    fin: toMinutes(creneau?.endTime),
  }))
  .filter((plage) => plage.debut !== null && plage.fin !== null && plage.fin > plage.debut)
  .map((plage) => ({ creneau: plage.creneau, debut: Number(plage.debut), fin: Number(plage.fin) }))
  .sort((a, b) => (a.debut - b.debut) || (a.fin - b.fin));

/**
 * 📐 COLL-C2B-BIS (03/10) — planche 23, ordinateur : LA SEMAINE TYPE A L ECHELLE DES HEURES (design
 * P4v2-creneaux-ordi, etat A). Les heures ou un creneau existe, tous jours confondus, forment des
 * BANDES a l echelle, avec leurs reperes (le debut, puis chaque heure pleine) ; entre elles, et
 * avant ou apres si les horaires sont connus, une ligne REPLIEE (« Aucun creneau de 12:00 a
 * 17:30 »).
 * @param {any[]} creneaux - Les creneaux actifs de l installation.
 * @param {{ fermeture?: number | null, ouverture?: number | null }} [bornes] - En minutes.
 * @returns {Array<{ type: 'bande', debut: number, fin: number, reperes: number[] }
 *   | { type: 'creux', debut: number, fin: number | null }>} Les lignes, de haut en bas.
 */
export const weekGridRows = (creneaux, { fermeture = null, ouverture = null } = {}) => {
  const bandes = plagesDe(creneaux).reduce((
    /** @type {Array<{ debut: number, fin: number }>} */ fusion,
    plage,
  ) => {
    const derniere = fusion[fusion.length - 1];
    if (derniere && plage.debut <= derniere.fin + ECART_DANS_LA_BANDE) {
      derniere.fin = Math.max(derniere.fin, plage.fin);
    } else {
      fusion.push({ debut: plage.debut, fin: plage.fin });
    }
    return fusion;
  }, []);
  /** @type {any[]} */
  const lignes = [];
  bandes.forEach((bande, index) => {
    const avant = index === 0 ? ouverture : bandes[index - 1].fin;
    if (avant !== null && avant < bande.debut) {
      lignes.push({ debut: avant, fin: bande.debut, type: 'creux' });
    }
    const reperes = [bande.debut];
    for (let heure = (Math.floor(bande.debut / 60) + 1) * 60; heure < bande.fin; heure += 60) {
      reperes.push(heure);
    }
    lignes.push({
      debut: bande.debut, fin: bande.fin, reperes, type: 'bande',
    });
  });
  const derniere = bandes[bandes.length - 1];
  if (derniere && (fermeture === null || derniere.fin < fermeture)) {
    lignes.push({ debut: derniere.fin, fin: fermeture, type: 'creux' });
  }
  return lignes;
};

/**
 * Les creneaux d UN jour, cote a cote quand ils se chevauchent (le jeudi complet de la planche) :
 * chaque grappe de creneaux qui se touchent partage sa largeur en `voies` ; un creneau prend la
 * premiere voie libre a son debut.
 * @param {any[]} creneaux - Les creneaux d un jour.
 * @returns {Array<{ creneau: any, debut: number, fin: number, voie: number, voies: number }>}
 *   Les creneaux places.
 */
export const weekGridLanes = (creneaux) => {
  /** @type {Array<{ creneau: any, debut: number, fin: number, voie: number, voies: number }>} */
  const places = [];
  /** @type {Array<{ creneau: any, debut: number, fin: number }>} */
  let grappe = [];
  let finDeGrappe = -1;
  const poserLaGrappe = () => {
    /** @type {number[]} */
    const voies = [];
    const posees = grappe.map((plage) => {
      let voie = voies.findIndex((fin) => fin <= plage.debut);
      if (voie < 0) {
        voie = voies.length;
        voies.push(0);
      }
      voies[voie] = plage.fin;
      return { ...plage, voie };
    });
    posees.forEach((plage) => places.push({ ...plage, voies: voies.length }));
  };
  plagesDe(creneaux).forEach((plage) => {
    if (grappe.length && plage.debut >= finDeGrappe) {
      poserLaGrappe();
      grappe = [];
      finDeGrappe = -1;
    }
    grappe.push(plage);
    finDeGrappe = Math.max(finDeGrappe, plage.fin);
  });
  if (grappe.length) poserLaGrappe();
  return places;
};
