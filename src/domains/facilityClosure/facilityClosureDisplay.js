import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getServerErrorCode } from '@/utils/errors/displayError';
import { getPlanningItemWindow } from '@/utils/planning/planningSlots';

/**
 * COLL-C4B (02/10) — ce que l ecran DIT d une fermeture ou d un blocage : jours, heures, motif,
 * seances touchees, refus du serveur ; et les PLAGES du planning (hachurees). Fonctions pures :
 * aucune lecture, aucun client — importables par n importe quel ecran sans doublure de plus.
 *
 * Les jours sont des jours civils « AAAA-MM-JJ » ; les heures « HH:MM », murales de Paris
 * (contrat C2A §5) : on ne les convertit jamais ici.
 */

export const CLOSURE_REASONS = ['travaux', 'vacances', 'manifestation', 'autre'];

/**
 * La locale date-fns de la langue de l app.
 * @returns {import('date-fns').Locale} fr ou en-GB.
 */
const dateLocale = () => (localeDesFormats() === 'en-GB' ? enGB : fr);

/**
 * Le motif d une fermeture, dans la langue de l app.
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {string | null | undefined} reason - travaux, vacances, manifestation, autre.
 * @returns {string} Le libelle (« Travaux »), ou vide.
 */
export const reasonLabel = (t, reason) => {
  switch (reason) {
    case 'autre':
      return t('collectiviteFermetures.motifs.autre', 'Autre');
    case 'manifestation':
      return t('collectiviteFermetures.motifs.manifestation', 'Manifestation');
    case 'travaux':
      return t('collectiviteFermetures.motifs.travaux', 'Travaux');
    case 'vacances':
      return t('collectiviteFermetures.motifs.vacances', 'Vacances');
    default:
      return '';
  }
};

/**
 * Un jour civil en « ven. 2 oct. » (ou « vendredi 2 octobre » en long).
 * @param {string | null | undefined} jour - AAAA-MM-JJ.
 * @param {{ long?: boolean }} [options] - Long : « vendredi 2 octobre ».
 * @returns {string} Le jour, ou vide.
 */
export const closureDay = (jour, { long = false } = {}) => {
  if (!jour) return '';
  const date = parseISO(jour);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, long ? 'EEEE d MMMM' : 'EEE d MMM', { locale: dateLocale() });
};

/**
 * Les jours d une fermeture : « ven. 2 oct. » ou « du sam. 17 oct. au dim. 25 oct. ».
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {{ startDate?: string|null, endDate?: string|null }} fermeture - Les bornes.
 * @param {{ long?: boolean }} [options] - Long : « vendredi 2 octobre ».
 * @returns {string} Les jours.
 */
export const closureDaysLabel = (t, fermeture, { long = false } = {}) => {
  const debut = closureDay(fermeture?.startDate, { long });
  const fin = closureDay(fermeture?.endDate, { long });
  if (!fermeture?.endDate || fermeture.endDate === fermeture.startDate) return debut;
  return t('collectiviteFermetures.jours.du', 'du {{debut}} au {{fin}}', {
    debut,
    fin,
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * « Toute la journée » ou « 09:00 – 13:00 ».
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {{ kind?: string, startTime?: string|null, endTime?: string|null }} fermeture - La
 *   fermeture.
 * @returns {string} Les heures.
 */
export const closureHoursLabel = (t, fermeture) => {
  if (fermeture?.kind !== 'block' || !fermeture.startTime || !fermeture.endTime) {
    return t('collectiviteFermetures.jours.journee', 'Toute la journée');
  }
  return `${String(fermeture.startTime).slice(0, 5)} – ${String(fermeture.endTime).slice(0, 5)}`;
};

/**
 * La pastille d une fermeture (onglet « Fermetures ») : « Fermeture · travaux », « Blocage ·
 * Ville ».
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {{ kind?: string, reason?: string|null }} fermeture - La fermeture.
 * @returns {string} La pastille.
 */
export const closureTagLabel = (t, fermeture) => {
  if (fermeture?.kind === 'block') {
    return t('collectiviteFermetures.liste.pastilleBlocage', 'Blocage · Ville');
  }
  const motif = reasonLabel(t, fermeture?.reason);
  return motif
    ? t('collectiviteFermetures.liste.pastilleFermeture', 'Fermeture · {{motif}}', {
      ...SANS_ECHAPPEMENT,
      motif: motif.toLocaleLowerCase(),
    })
    : t('collectiviteFermetures.liste.fermeture', 'Fermeture');
};

/**
 * Ce que la plage dit dans le planning : « Fermé · travaux », « Bloqué par la Ville · Forum ».
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {{ kind?: string, reason?: string|null, label?: string|null }} fermeture - La fermeture.
 * @returns {string} Le libelle de la plage.
 */
export const closureBandLabel = (t, fermeture) => {
  if (fermeture?.kind === 'block') {
    return fermeture.label
      ? t('collectiviteFermetures.planning.bloque', 'Bloqué par la Ville · {{motif}}', {
        ...SANS_ECHAPPEMENT,
        motif: fermeture.label,
      })
      : t('collectiviteFermetures.planning.bloqueSeul', 'Bloqué par la Ville');
  }
  const motif = reasonLabel(t, fermeture?.reason);
  return motif
    ? t('collectiviteFermetures.planning.ferme', 'Fermé · {{motif}}', {
      ...SANS_ECHAPPEMENT,
      motif: motif.toLocaleLowerCase(),
    })
    : t('collectiviteFermetures.planning.fermeSeul', 'Fermé');
};

/**
 * Une seance touchee, telle que la carte la dit : « AS Montrivage · U15, 18:00 – 19:30 ».
 * @param {{ club?: { name?: string|null }|null, team?: { name?: string|null }|null,
 *   startTime?: string|null, endTime?: string|null, date?: string|null }} seance - La seance.
 * @param {{ withDay?: boolean }} [options] - Le jour en plus (fermeture de plusieurs jours).
 * @returns {string} La ligne.
 */
export const touchedSessionLine = (seance, { withDay = false } = {}) => {
  const qui = [seance?.club?.name, seance?.team?.name].filter(Boolean).join(' · ');
  const heures = seance?.startTime && seance?.endTime
    ? `${String(seance.startTime).slice(0, 5)} – ${String(seance.endTime).slice(0, 5)}`
    : '';
  const quand = [withDay ? closureDay(seance?.date) : '', heures].filter(Boolean).join(' ');
  return [qui, quand].filter(Boolean).join(', ');
};

/**
 * Le refus du serveur, dit a la mairie (`error.details.code`, contrat §13).
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {unknown} erreur - L erreur de la requete.
 * @returns {string | null} Le message, ou null si le code est inconnu.
 */
export const closureErrorMessage = (t, erreur) => {
  switch (getServerErrorCode(erreur)) {
    case 'FACILITY_CLOSURE_ALREADY_REOPENED':
      return t('collectiviteFermetures.erreurs.dejaRouverte', 'Cette fermeture est déjà rouverte.');
    case 'FACILITY_CLOSURE_INVALID_PAYLOAD':
      return t(
        'collectiviteFermetures.erreurs.saisie',
        'Vérifiez les dates, les heures et le motif.',
      );
    case 'FACILITY_CLOSURE_MANAGER_REQUIRED':
      return t(
        'collectiviteFermetures.erreurs.droits',
        'Seule la Ville ferme ou bloque ses installations.',
      );
    case 'FACILITY_CLOSURE_NOT_FOUND':
      return t('collectiviteFermetures.erreurs.introuvable', 'Cette fermeture n’existe plus.');
    default:
      return null;
  }
};

/**
 * La fermeture touche-t-elle ce jour ?
 * @param {{ startDate?: string|null, endDate?: string|null }} fermeture - La fermeture.
 * @param {string} jour - AAAA-MM-JJ.
 * @returns {boolean} Vrai si le jour est dans la periode.
 */
export const closureCoversDay = (fermeture, jour) => Boolean(
  fermeture?.startDate
      && fermeture?.endDate
      && fermeture.startDate <= jour
      && jour <= fermeture.endDate,
);

/**
 * « 09:30 » en minutes depuis minuit, ou null si l heure manque.
 * @param {string | null | undefined} heure - HH:MM.
 * @returns {number | null} Les minutes.
 */
const minutesDe = (heure) => {
  const lu = /^(\d{1,2}):(\d{2})/.exec(String(heure || ''));
  return lu ? Number(lu[1]) * 60 + Number(lu[2]) : null;
};

/**
 * 🖥️ COLL-C4B-BIS (03/10) — LA REGLE DU SERVEUR (contrat C2A §13.3), recopiee pour le BROUILLON
 * d une saisie : le planning cerne les seances que la fermeture toucherait, PENDANT qu on tape
 * (« P4v3-fermer-ordi »). Fermeture : le jour de debut de la seance est dans la periode. Blocage :
 * le meme jour, et les heures se chevauchent (sans heure de fin : 1 h 30). Le serveur reste le
 * juge : la carte des seances touchees vient de lui, ceci ne fait que dessiner.
 * @param {any} bloc - Un bloc normalise du planning (`normalizePlanningItem`).
 * @param {{ kind?: string, startDate?: string|null, endDate?: string|null,
 *   startTime?: string|null, endTime?: string|null } | null} fermeture - La saisie.
 * @returns {boolean} Vrai si la fermeture touche le bloc.
 */
export const closureTouchesBlock = (bloc, fermeture) => {
  if (!fermeture || bloc?.raw?.closureBand) return false;
  const fenetre = getPlanningItemWindow(bloc);
  if (!fenetre) return false;
  if (!closureCoversDay(fermeture, format(fenetre.startAt, 'yyyy-MM-dd'))) return false;
  if (fermeture.kind !== 'block') return true;
  const de = minutesDe(fermeture.startTime);
  const a = minutesDe(fermeture.endTime);
  if (de === null || a === null) return false;
  const debut = fenetre.startAt.getHours() * 60 + fenetre.startAt.getMinutes();
  const fin = debut + Math.round((fenetre.endAt.getTime() - fenetre.startAt.getTime()) / 60000);
  return debut < a && de < fin;
};

/**
 * LES PLAGES HACHUREES DU PLANNING (planche P4v3-fermer-tel ecran 4) : une plage par jour de la
 * fenetre que la fermeture couvre, des heures d ouverture a la fermeture (journee entiere) ou sur
 * la plage bloquee. Ce sont des elements du planning a part (`raw.closureBand`) : jamais comptes
 * comme une seance (capacite, legende).
 * @param {any[]} fermetures - `meta.closures` du planning.
 * @param {{ from: string, to: string }} plage - La fenetre lue (AAAA-MM-JJ).
 * @param {{ opening: number, closing: number }} heures - Ouverture et fermeture (minutes).
 * @param {(fermeture: any) => string} libelle - Ce que la plage dit.
 * @returns {any[]} Les elements, au format d un bloc du planning (`startAt`, `endAt`). ⛔ Ni
 *   `id` ni `documentId` : la normalisation en ferait une seance a ouvrir.
 */
export const closureBandsForRange = (fermetures, plage, heures, libelle) => {
  const debut = parseISO(plage?.from || '');
  const fin = parseISO(plage?.to || '');
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()) || fin < debut) return [];
  const jours = eachDayOfInterval({ end: fin, start: debut });
  return (Array.isArray(fermetures) ? fermetures : []).flatMap((fermeture) => jours
    .filter((jour) => closureCoversDay(fermeture, format(jour, 'yyyy-MM-dd')))
    .map((jour) => {
      const bloc = fermeture.kind === 'block';
      const de = (bloc ? minutesDe(fermeture.startTime) : null) ?? heures.opening;
      const a = (bloc ? minutesDe(fermeture.endTime) : null) ?? heures.closing;
      const instant = (/** @type {number} */ minutes) => new Date(
        jour.getFullYear(),
        jour.getMonth(),
        jour.getDate(),
        0,
        minutes,
      ).toISOString();
      return {
        closureBand: fermeture,
        documentId: null,
        endAt: instant(a),
        hasExplicitTime: true,
        startAt: instant(de),
        title: libelle(fermeture),
      };
    }));
};

/**
 * Le bandeau d une seance ou d une installation : « Le gymnase est fermé ce jour-là ».
 * Le premier mot du nom (« Gymnase », « Dojo ») porte la phrase ; le genre n est pas devine ici.
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {any} fermeture - La fermeture (`facility`, `kind`, `startDate`, `endDate`).
 * @param {{ withDays?: boolean }} [options] - Le jour dans le titre (fiche de l installation,
 *   planning) ; sans : « ce jour-la » (la fiche d une seance porte deja son jour).
 * @returns {{ titre: string, texte: string }} Le titre et la ligne du bandeau.
 */
export const closureBannerText = (t, fermeture, { withDays = false } = {}) => {
  const motif = fermeture?.kind === 'block'
    ? fermeture.label || ''
    : reasonLabel(t, fermeture?.reason);
  const mot = fermeture?.message
    ? t('collectiviteFermetures.bandeau.mot', 'Mot de la Ville : « {{mot}} ».', {
      ...SANS_ECHAPPEMENT,
      mot: fermeture.message,
    })
    : '';
  const jour = closureDay(fermeture?.startDate, { long: true });
  let titre;
  if (fermeture?.kind === 'block') {
    titre = withDays && jour
      ? t(
        'collectiviteFermetures.bandeau.bloqueLe',
        'Bloquée par la Ville le {{jour}}, {{heures}}',
        {
          ...SANS_ECHAPPEMENT,
          heures: closureHoursLabel(t, fermeture),
          jour,
        },
      )
      : t('collectiviteFermetures.bandeau.bloque', 'Bloquée par la Ville, {{heures}}', {
        ...SANS_ECHAPPEMENT,
        heures: closureHoursLabel(t, fermeture),
      });
  } else if (fermeture?.startDate && fermeture.startDate === fermeture.endDate) {
    titre = withDays && jour
      ? t('collectiviteFermetures.bandeau.fermeLe', 'L’installation est fermée le {{jour}}', {
        ...SANS_ECHAPPEMENT,
        jour,
      })
      : t('collectiviteFermetures.bandeau.fermeJour', 'L’installation est fermée ce jour-là');
  } else {
    titre = t(
      'collectiviteFermetures.bandeau.fermePeriode',
      'L’installation est fermée {{jours}}',
      {
        ...SANS_ECHAPPEMENT,
        jours: closureDaysLabel(t, fermeture, { long: true }),
      },
    );
  }
  return { texte: [motif ? `${motif}.` : '', mot].filter(Boolean).join(' '), titre };
};
