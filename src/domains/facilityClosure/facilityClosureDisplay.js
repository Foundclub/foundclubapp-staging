import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import { genreDuLieu, lieuAvecArticle } from '@/domains/collectivite/collectiviteDemandes';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getServerErrorCode } from '@/utils/errors/displayError';
import { getFacilityTypeNoun } from '@/utils/facilityTypes';
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
// FINITIONS12-COLL (03/10) — le nom d une fermeture tient en 40 caracteres, comme au serveur
// (`CLOSURE_MAX_NAME_LENGTH`, admin `facility-closure/utils`).
export const CLOSURE_MAX_NAME_LENGTH = 40;

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
 * « 14:00 » depuis « 14:00:00.000 », ou vide.
 * @param {string | null | undefined} heure - L heure du serveur.
 * @returns {string} HH:MM.
 */
const heureCourte = (heure) => (heure ? String(heure).slice(0, 5) : '');

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
  // CRFERM (13/10, « heures : plage ») : une fermeture peut dire l heure de son premier et de son
  // dernier jour (« du vendredi 16 octobre à 14:00 au lundi 19 octobre à 12:00 »).
  const heureDebut = fermeture?.kind === 'closure' ? heureCourte(fermeture?.startTime) : '';
  const heureFin = fermeture?.kind === 'closure' ? heureCourte(fermeture?.endTime) : '';
  if (!fermeture?.endDate || fermeture.endDate === fermeture.startDate) {
    let heures = '';
    if (heureDebut && heureFin) {
      heures = t('collectiviteFermetures.jours.deA', 'de {{debut}} à {{fin}}', {
        debut: heureDebut, fin: heureFin, ...SANS_ECHAPPEMENT,
      });
    } else if (heureDebut || heureFin) {
      heures = heureDebut
        ? t('collectiviteFermetures.jours.des', 'dès {{heure}}', {
          heure: heureDebut, ...SANS_ECHAPPEMENT,
        })
        : t('collectiviteFermetures.jours.jusqua', 'jusqu’à {{heure}}', {
          heure: heureFin, ...SANS_ECHAPPEMENT,
        });
    }
    return [debut, heures].filter(Boolean).join(' ');
  }
  const aLHeure = (/** @type {string} */ jour, /** @type {string} */ heure) => (heure
    ? t('collectiviteFermetures.jours.a', '{{jour}} à {{heure}}', {
      heure, jour, ...SANS_ECHAPPEMENT,
    })
    : jour);
  return t('collectiviteFermetures.jours.du', 'du {{debut}} au {{fin}}', {
    debut: aLHeure(debut, heureDebut),
    fin: aLHeure(fin, heureFin),
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * « Toute la journée » ou « 09:00 – 13:00 ». CRFERM (13/10) : une fermeture en plage dit les heures
 * de son premier et de son dernier jour (« dès 14:00 · jusqu’à 12:00 »).
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {{ kind?: string, startDate?: string|null, endDate?: string|null,
 *   startTime?: string|null, endTime?: string|null }} fermeture - La fermeture.
 * @returns {string} Les heures.
 */
export const closureHoursLabel = (t, fermeture) => {
  const debut = heureCourte(fermeture?.startTime);
  const fin = heureCourte(fermeture?.endTime);
  const unJour = fermeture?.kind === 'block' || fermeture?.startDate === fermeture?.endDate;
  if (unJour && debut && fin) return `${debut} – ${fin}`;
  if (fermeture?.kind === 'block' || (!debut && !fin)) {
    return t('collectiviteFermetures.jours.journee', 'Toute la journée');
  }
  const des = debut
    ? t('collectiviteFermetures.jours.des', 'dès {{heure}}', {
      heure: debut, ...SANS_ECHAPPEMENT,
    })
    : '';
  const jusqua = fin
    ? t('collectiviteFermetures.jours.jusqua', 'jusqu’à {{heure}}', {
      heure: fin, ...SANS_ECHAPPEMENT,
    })
    : '';
  return [des, jusqua].filter(Boolean).join(' · ');
};

/**
 * 🏷️ FINITIONS12-COLL (03/10, décision d Adel « férié B ») — le NOM d une fermeture (« Ascension »,
 * facultatif, 40 caractères) : il passe avant le motif partout où le motif s affiche. Rien pour un
 * blocage (son `label` est son « pour quoi », lu à part).
 * @param {{ kind?: string, label?: string|null }} fermeture - La fermeture.
 * @returns {string} Le nom, ou vide.
 */
export const closureName = (fermeture) => (
  fermeture?.kind === 'block' ? '' : String(fermeture?.label || '').trim()
);

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
  if (closureName(fermeture)) {
    return t('collectiviteFermetures.liste.pastilleFermeture', 'Fermeture · {{motif}}', {
      ...SANS_ECHAPPEMENT,
      motif: closureName(fermeture),
    });
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
  if (closureName(fermeture)) {
    return t('collectiviteFermetures.planning.ferme', 'Fermé · {{motif}}', {
      ...SANS_ECHAPPEMENT,
      motif: closureName(fermeture),
    });
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
 * 🎨 FINITIONS13-COLL (04/10) — LES FERMETURES DU BANDEAU, telles que le serveur les annonce :
 * toutes celles qui durent ou approchent (`meta.bandeaux`, la plus proche d abord) ; un serveur
 * d avant ne rend que la premiere (`meta.bandeau`). Tournee T13 : une fermeture le 15 restait
 * invisible tant qu une autre existait le 10.
 * @param {any} meta - `meta` de GET /facilities/:id/closures.
 * @returns {any[]} Les fermetures, dans l ordre.
 */
export const closuresOfBanner = (meta) => {
  if (Array.isArray(meta?.bandeaux)) return meta.bandeaux.filter(Boolean);
  return meta?.bandeau ? [meta.bandeau] : [];
};

/**
 * 🟨 VILLE-T18A (07/10, tournée T18, G54a) — LE TITRE DE LA CARTE « touchées » : un
 * créneau de saison sans séance posée (`kind: 'slot'`) n est pas une séance — « 1 séance
 * touchée, 1 créneau touché », plus « 2 séances touchées ». Le serveur rend au plus
 * 30 lignes : au-delà, la répartition n est plus connue, et un créneau vu dit « séances ou
 * créneaux ».
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {any} carte - La carte du serveur (`affected` : `sessions`, `sessionsCount`).
 * @returns {string} « 1 séance touchée, 1 créneau touché » (sans les clubs).
 */
export const touchedCountLabel = (t, carte) => {
  const total = Number(carte?.sessionsCount) || 0;
  const lignes = Array.isArray(carte?.sessions) ? carte.sessions : [];
  const creneaux = lignes.filter((ligne) => ligne?.kind === 'slot').length;
  const seances = (/** @type {number} */ count) => t('collectiviteFermetures.carte.seances', {
    count,
    defaultValue_one: '{{count}} séance touchée',
    defaultValue_other: '{{count}} séances touchées',
  });
  if (!creneaux) return seances(total);
  if (lignes.length < total) {
    return t('collectiviteFermetures.carte.seancesOuCreneaux', {
      count: total,
      defaultValue_one: '{{count}} séance ou créneau touché',
      defaultValue_other: '{{count}} séances ou créneaux touchés',
    });
  }
  return [
    total > creneaux ? seances(total - creneaux) : null,
    t('collectiviteFermetures.carte.creneaux', {
      count: creneaux,
      defaultValue_one: '{{count}} créneau touché',
      defaultValue_other: '{{count}} créneaux touchés',
    }),
  ].filter(Boolean).join(', ');
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
  // COLL-C4B-BIS (03/10, tournee T10) : une seance SANS heure de fin (`endTime: null`) garde son
  // heure de debut — la carte perdait les deux (« AS Montrivage · U15 »).
  const debut = seance?.startTime ? String(seance.startTime).slice(0, 5) : '';
  const fin = seance?.endTime ? String(seance.endTime).slice(0, 5) : '';
  const heures = debut && fin ? `${debut} – ${fin}` : debut;
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
 * 🖥️ COLL-C4B-BIS (03/10) — la fermeture d UN jour (vue Mois, Liste) : celle de toute la journee
 * d abord (elle ferme tout), sinon le premier blocage du jour.
 * @param {any[]} fermetures - `meta.closures` (et le brouillon du panneau).
 * @param {string} jour - AAAA-MM-JJ.
 * @returns {any | null} La fermeture, ou null si le jour est ouvert.
 */
export const closureOfDay = (fermetures, jour) => {
  const couvrantes = (Array.isArray(fermetures) ? fermetures : [])
    .filter((fermeture) => closureCoversDay(fermeture, jour));
  return couvrantes.find((fermeture) => fermeture?.kind !== 'block') || couvrantes[0] || null;
};

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
  const jour = format(fenetre.startAt, 'yyyy-MM-dd');
  if (!closureCoversDay(fermeture, jour)) return false;
  const debut = fenetre.startAt.getHours() * 60 + fenetre.startAt.getMinutes();
  const fin = debut + Math.round((fenetre.endAt.getTime() - fenetre.startAt.getTime()) / 60000);
  if (fermeture.kind !== 'block') {
    // CRFERM (13/10) : une fermeture en plage — le premier jour dès son heure, le dernier
    // jusqu a la sienne, les jours du milieu en entier (la regle du serveur, admin CRFERM-3).
    const de = jour === fermeture.startDate ? minutesDe(fermeture.startTime) : null;
    const a = jour === fermeture.endDate ? minutesDe(fermeture.endTime) : null;
    if (de === null && a === null) return true;
    return debut < (a ?? 24 * 60) && (de ?? 0) < fin;
  }
  const de = minutesDe(fermeture.startTime);
  const a = minutesDe(fermeture.endTime);
  if (de === null || a === null) return false;
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
      // CRFERM (13/10) : une fermeture en plage hachure son premier jour dès son heure, son dernier
      // jusqu a la sienne.
      const iso = format(jour, 'yyyy-MM-dd');
      const de = (bloc || iso === fermeture.startDate ? minutesDe(fermeture.startTime) : null)
        ?? heures.opening;
      const a = (bloc || iso === fermeture.endDate ? minutesDe(fermeture.endTime) : null)
        ?? heures.closing;
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
 * 🚧 CRFERM (13/10, COL-011) — LE REFUS D UNE INSTALLATION FERMÉE, DIT AU CLUB (« tu ») : le lieu,
 * les jours (et les heures d un blocage ou d une plage), le motif — « Le Gymnase Cosec est fermé du
 * dimanche 11 octobre au jeudi 15 octobre (vacances). Choisis un autre jour ou une autre
 * installation. » Jamais le mot de la Ville (le serveur ne l envoie pas : route publique). Sans
 * fermeture lue (serveur d avant), une phrase au « tu » sans détail.
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {any} fermeture - `closure` de l occupation ou du refus EVENT_FACILITY_CLOSED, ou null.
 * @param {string | null | undefined} [nomDuLieu] - Le nom de l installation.
 * @returns {string} La phrase.
 */
export const closureRefusalText = (t, fermeture, nomDuLieu = null) => {
  if (!fermeture?.startDate) {
    return t(
      'eventWizard.steps.location.fermeture.sansDetail',
      'La Ville a fermé cette installation à ce moment-là. '
        + 'Choisis un autre jour ou une autre installation.',
    );
  }
  const blocage = fermeture.kind === 'block';
  const unJour = !fermeture.endDate || fermeture.endDate === fermeture.startDate;
  let quand = closureDaysLabel(t, fermeture, { long: true });
  if (blocage && fermeture.startTime && fermeture.endTime) {
    quand = `${quand} ${t('collectiviteFermetures.jours.deA', 'de {{debut}} à {{fin}}', {
      debut: heureCourte(fermeture.startTime),
      fin: heureCourte(fermeture.endTime),
      ...SANS_ECHAPPEMENT,
    })}`;
  }
  if (unJour) {
    quand = t('collectiviteFermetures.confirmer.le', 'le {{jour}}', {
      jour: quand, ...SANS_ECHAPPEMENT,
    });
  }
  const motif = blocage
    ? String(fermeture.label || '').trim()
    : closureName(fermeture) || reasonLabel(t, fermeture.reason).toLocaleLowerCase();
  const nom = String(nomDuLieu || '').trim();
  const valeurs = {
    ...SANS_ECHAPPEMENT,
    lieu: nom ? lieuAvecArticle(nom, t).replace(/^./, (lettre) => lettre.toLocaleUpperCase()) : '',
    motif: motif ? ` (${motif})` : '',
    quand,
  };
  let genre = 'generique';
  if (nom) genre = genreDuLieu(nom) === 'feminin' ? 'feminin' : 'masculin';
  // Les phrases par défaut (fr.js porte les mêmes) : le sujet accordé, puis la suite.
  const sujets = blocage
    ? {
      feminin: '{{lieu}} est réservée par la Ville',
      generique: 'Cette installation est réservée par la Ville',
      masculin: '{{lieu}} est réservé par la Ville',
    }
    : {
      feminin: '{{lieu}} est fermée',
      generique: 'Cette installation est fermée',
      masculin: '{{lieu}} est fermé',
    };
  const suite = blocage
    ? ' {{quand}}{{motif}}. Choisis une autre heure ou une autre installation.'
    : ' {{quand}}{{motif}}. Choisis un autre jour ou une autre installation.';
  const suffixe = { feminin: 'Feminin', generique: '', masculin: 'Masculin' }[genre];
  return t(
    `eventWizard.steps.location.fermeture.${blocage ? 'bloque' : 'ferme'}${suffixe}`,
    `${sujets[genre]}${suite}`,
    valeurs,
  );
};

/**
 * FINITIONS11-COLL (03/10, planche 25) — la phrase accordee au TYPE de l installation : « Le
 * gymnase est ferme », « La piscine est fermee » ; sans type connu, la generique (« L installation
 * est fermee »).
 * @param {{ genre: string, nom: string } | null} lieu - `getFacilityTypeNoun(facility.type)`.
 * @param {{ feminine: string, generic: string, masculine: string }} phrases - Les trois phrases.
 * @returns {string} Celle qui convient.
 */
export const phraseForFacilityType = (lieu, { feminine, generic, masculine }) => {
  if (!lieu) return generic;
  return lieu.genre === 'feminin' ? feminine : masculine;
};

/**
 * Le bandeau d une seance ou d une installation : « Le gymnase est fermé ce jour-là ».
 * FINITIONS11-COLL : le type de l installation (`facilityType`, la valeur du serveur) donne le nom
 * et son genre ; un type inconnu, ou absent, garde « L installation ».
 * @param {any} t - i18next (TFunction ; `any` comme ailleurs dans src/domains).
 * @param {any} fermeture - La fermeture (`facility`, `kind`, `startDate`, `endDate`).
 * @param {{ facilityType?: string | null, withDays?: boolean }} [options] - Le type de
 *   l installation (`facility.type`) ; le jour dans le titre (fiche de l installation, planning) ;
 *   sans : « ce jour-la » (la fiche d une seance porte deja son jour).
 * @returns {{ titre: string, texte: string }} Le titre et la ligne du bandeau.
 */
export const closureBannerText = (t, fermeture, { facilityType = null, withDays = false } = {}) => {
  const motif = fermeture?.kind === 'block'
    ? fermeture.label || ''
    : closureName(fermeture) || reasonLabel(t, fermeture?.reason);
  const mot = fermeture?.message
    ? t('collectiviteFermetures.bandeau.mot', 'Mot de la Ville : « {{mot}} ».', {
      ...SANS_ECHAPPEMENT,
      mot: fermeture.message,
    })
    : '';
  const jour = closureDay(fermeture?.startDate, { long: true });
  const lieu = getFacilityTypeNoun(facilityType);
  const valeurs = {
    ...SANS_ECHAPPEMENT,
    jour,
    jours: closureDaysLabel(t, fermeture, { long: true }),
    lieu: lieu?.nom,
  };
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
      ? phraseForFacilityType(lieu, {
        feminine: t(
          'collectiviteFermetures.bandeau.fermeLeFeminin',
          'La {{lieu}} est fermée le {{jour}}',
          valeurs,
        ),
        generic: t(
          'collectiviteFermetures.bandeau.fermeLe',
          'L’installation est fermée le {{jour}}',
          valeurs,
        ),
        masculine: t(
          'collectiviteFermetures.bandeau.fermeLeMasculin',
          'Le {{lieu}} est fermé le {{jour}}',
          valeurs,
        ),
      })
      : phraseForFacilityType(lieu, {
        feminine: t(
          'collectiviteFermetures.bandeau.fermeJourFeminin',
          'La {{lieu}} est fermée ce jour-là',
          valeurs,
        ),
        generic: t(
          'collectiviteFermetures.bandeau.fermeJour',
          'L’installation est fermée ce jour-là',
        ),
        masculine: t(
          'collectiviteFermetures.bandeau.fermeJourMasculin',
          'Le {{lieu}} est fermé ce jour-là',
          valeurs,
        ),
      });
  } else {
    titre = phraseForFacilityType(lieu, {
      feminine: t(
        'collectiviteFermetures.bandeau.fermePeriodeFeminin',
        'La {{lieu}} est fermée {{jours}}',
        valeurs,
      ),
      generic: t(
        'collectiviteFermetures.bandeau.fermePeriode',
        'L’installation est fermée {{jours}}',
        valeurs,
      ),
      masculine: t(
        'collectiviteFermetures.bandeau.fermePeriodeMasculin',
        'Le {{lieu}} est fermé {{jours}}',
        valeurs,
      ),
    });
  }
  return { texte: [motif ? `${motif}.` : '', mot].filter(Boolean).join(' '), titre };
};
