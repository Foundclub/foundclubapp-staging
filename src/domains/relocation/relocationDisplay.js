import { format, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import {
  genreDuLieu, lieuAvecArticle, lieuAvecPreposition,
} from '@/domains/collectivite/collectiviteDemandes';
import {
  closureDay, closureDaysLabel, closureName, reasonLabel,
} from '@/domains/facilityClosure/facilityClosureDisplay';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getErrorStatus, getServerErrorCode } from '@/utils/errors/displayError';

/**
 * COLL-R-DEPLACER A8 (14/10, COL-013, décision d'Adel « D9 = b ») — LES MOTS DE « DÉPLACER LA
 * SÉANCE » (planches P5v4-deplacer-tel, -ville-tel, -ordi). Fonctions PURES : ce que le serveur
 * rend (`GET /events/:id/relocation-options`, une proposition de place) devient des phrases.
 * Au club « tu », à la Ville « vous » (règles du 01/10). Le serveur est le seul juge des états :
 * l'app ne devine jamais une place libre.
 */

/** Les quatre états d'une place, dans l'ordre où l'écran les range. */
export const RELOCATION_STATES = ['libre', 'villeDecidera', 'complet', 'ferme'];

/**
 * Une place qu'on peut choisir : libre, ou « la Ville décidera » (le club envoie alors une
 * demande). Complet et fermé se lisent, ils ne se choisissent pas.
 * @param {string | null | undefined} state - L'état rendu par le serveur.
 * @returns {boolean} Vrai si la place se choisit.
 */
export const isSelectableState = (state) => state === 'libre' || state === 'villeDecidera';

/**
 * Le mot de la pastille.
 * @param {any} t - i18next.
 * @param {string | null | undefined} state - L'état.
 * @returns {string} « Libre », « La Ville décidera », « Complet », « Fermé ».
 */
export const relocationStateLabel = (t, state) => {
  switch (state) {
    case 'complet':
      return t('deplacerSeance.etat.complet', 'Complet');
    case 'ferme':
      return t('deplacerSeance.etat.ferme', 'Fermé');
    case 'libre':
      return t('deplacerSeance.etat.libre', 'Libre');
    case 'villeDecidera':
      return t('deplacerSeance.etat.villeDecidera', 'La Ville décidera');
    default:
      return '';
  }
};

/**
 * La couleur d'un état (planche v53 « évite au max le gris ») : libre en vert, « la Ville
 * décidera » en cyan pâle, complet et fermé en orange (le ton du bandeau de fermeture).
 * @param {any} Colors - Les couleurs du thème.
 * @param {string | null | undefined} state - L'état.
 * @returns {string} La couleur.
 */
export const relocationStateColor = (Colors, state) => {
  if (state === 'libre') return Colors.success500;
  if (state === 'villeDecidera') return Colors.primary200;
  return Colors.warning500;
};

const dateLocale = () => (localeDesFormats() === 'en-GB' ? enGB : fr);

/**
 * Le jour de la semaine en toutes lettres : « vendredi ».
 * @param {string | null | undefined} jour - AAAA-MM-JJ.
 * @returns {string} Le jour, ou vide.
 */
export const weekdayName = (jour) => {
  if (!jour) return '';
  const date = parseISO(jour);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'EEEE', { locale: dateLocale() });
};

/**
 * « Ven. 16 oct. » (en tête de ligne) ou « ven. 16 oct. » (dans une phrase).
 * @param {string | null | undefined} jour - AAAA-MM-JJ.
 * @param {{ capital?: boolean }} [options] - Une majuscule en tête.
 * @returns {string} Le jour court.
 */
export const shortDay = (jour, { capital = false } = {}) => {
  const texte = closureDay(jour);
  return capital && texte ? `${texte.charAt(0).toLocaleUpperCase()}${texte.slice(1)}` : texte;
};

/**
 * « 18:00 – 19:30 ».
 * @param {string | null | undefined} debut - HH:MM.
 * @param {string | null | undefined} fin - HH:MM.
 * @returns {string} Les heures, ou vide.
 */
export const hoursLabel = (debut, fin) => (debut && fin ? `${debut} – ${fin}` : '');

/**
 * Le motif d'une fermeture, en minuscules : « vacances », « Ascension », le nom d'un blocage.
 * @param {any} t - i18next.
 * @param {any} fermeture - La fermeture (vue publique : kind, reason, label).
 * @returns {string} Le motif, ou vide.
 */
export const closureMotif = (t, fermeture) => {
  if (!fermeture) return '';
  if (fermeture.kind === 'block') return String(fermeture.label || '').trim();
  return closureName(fermeture) || reasonLabel(t, fermeture.reason).toLocaleLowerCase();
};

/**
 * La phrase de la fermeture qui touche la séance : « Le Gymnase des Tilleuls est fermé ce
 * jour-là (vacances). » (le nom tel quel, comme la planche).
 * @param {any} t - i18next.
 * @param {any} fermeture - La fermeture (vue publique).
 * @param {string | null | undefined} nomDuLieu - Le nom de l'installation.
 * @returns {string} La phrase, ou vide sans fermeture.
 */
export const closedThatDayText = (t, fermeture, nomDuLieu) => {
  if (!fermeture) return '';
  const motif = closureMotif(t, fermeture);
  const nom = String(nomDuLieu || '').trim();
  const valeurs = { ...SANS_ECHAPPEMENT, motif: motif ? ` (${motif})` : '' };
  if (!nom) {
    return t(
      'deplacerSeance.ou.fermeCeJourSansNom',
      'L’installation est fermée ce jour-là{{motif}}.',
      valeurs,
    );
  }
  const lieu = lieuAvecArticle(nom, t);
  const avecLieu = { ...valeurs, lieu: `${lieu.charAt(0).toLocaleUpperCase()}${lieu.slice(1)}` };
  if (genreDuLieu(nom) === 'feminin') {
    return t(
      'deplacerSeance.ou.fermeCeJourFeminin',
      '{{lieu}} est fermée ce jour-là{{motif}}.',
      avecLieu,
    );
  }
  return t('deplacerSeance.ou.fermeCeJour', '{{lieu}} est fermé ce jour-là{{motif}}.', avecLieu);
};

/**
 * La ligne sous le nom d'une place (planche P5v4-deplacer-tel, écran 2) : « Dans ton créneau du
 * vendredi », « Hors des créneaux de ton club », « Plus de place à cette heure », « Vacances, du
 * ven. 16 oct. au lun. 19 oct. ». La Ville ne lit ni créneau ni « hors créneaux » : c'est elle.
 * @param {any} t - i18next.
 * @param {any} place - Une place rendue par le serveur.
 * @param {{ jour?: string | null, viewer?: string }} [contexte] - Le jour (AAAA-MM-JJ), le lecteur.
 * @returns {string} La ligne, ou vide.
 */
export const placeDetail = (t, place, { jour = null, viewer = 'club' } = {}) => {
  if (!place) return '';
  if (place.state === 'ferme') {
    const motif = closureMotif(t, place.closure);
    const jours = place.closure ? closureDaysLabel(t, place.closure) : '';
    const tete = motif ? `${motif.charAt(0).toLocaleUpperCase()}${motif.slice(1)}` : '';
    return [tete, jours].filter(Boolean).join(', ');
  }
  if (place.state === 'complet') {
    return place.reason === 'clubSlotFull'
      ? t('deplacerSeance.detail.creneauPlein', 'Le créneau de ton club est déjà pris')
      : t('deplacerSeance.detail.pleine', 'Plus de place à cette heure');
  }
  if (viewer === 'ville') return '';
  if (place.state === 'villeDecidera') {
    return t('deplacerSeance.detail.horsCreneaux', 'Hors des créneaux de ton club');
  }
  if (place.inClubSlot) {
    return t('deplacerSeance.detail.dansTonCreneau', 'Dans ton créneau du {{jour}}', {
      ...SANS_ECHAPPEMENT,
      jour: weekdayName(jour),
    });
  }
  return '';
};

/**
 * « au Stade municipal », « à la Salle Jean Moulin ».
 * @param {any} t - i18next.
 * @param {string | null | undefined} nom - Le nom de l'installation.
 * @returns {string} Le lieu et sa préposition.
 */
export const placeWithPreposition = (t, nom) => lieuAvecPreposition(nom, t);

/**
 * Le serveur d'AVANT ce lot ne connaît pas la route : 404 sans code du lot. L'écran garde alors
 * la modification de la séance, comme avant (pas de plantage).
 * @param {unknown} erreur - L'erreur de la lecture.
 * @returns {boolean} Vrai si la route n'existe pas sur ce serveur.
 */
export const isRelocationRouteMissing = (erreur) => (
  getErrorStatus(erreur) === 404
    && !String(getServerErrorCode(erreur) || '').startsWith('RELOCATION_')
);

/**
 * Le refus du serveur, en mots (`error.details.code`).
 * @param {any} t - i18next.
 * @param {unknown} erreur - L'erreur de la requête.
 * @param {{ viewer?: string }} [contexte] - « vous » pour la Ville.
 * @returns {string} Le message.
 */
export const relocationErrorMessage = (t, erreur, { viewer = 'club' } = {}) => {
  const ville = viewer === 'ville';
  switch (getServerErrorCode(erreur)) {
    case 'EVENT_FACILITY_CLOSED':
      return t(
        'deplacerSeance.erreurs.fermee',
        'La Ville a fermé cette installation à ce moment-là.',
      );
    case 'RELOCATION_FORBIDDEN':
      return t(
        'deplacerSeance.erreurs.droits',
        'Seuls le club de la séance et la Ville peuvent la déplacer.',
      );
    case 'RELOCATION_INVALID_WINDOW':
      return ville
        ? t(
          'deplacerSeance.erreurs.fenetreVille',
          'Choisissez un moment à venir, la fin après le début.',
        )
        : t('deplacerSeance.erreurs.fenetre', 'Choisis un moment à venir, la fin après le début.');
    case 'RELOCATION_NOT_TOUCHED':
      return t(
        'deplacerSeance.erreurs.pasTouchee',
        'Aucune fermeture ne touche plus cette séance.',
      );
    case 'RELOCATION_PLACE_UNAVAILABLE':
      return ville
        ? t(
          'deplacerSeance.erreurs.placePriseVille',
          'Cette place n’est plus libre. Choisissez-en une autre.',
        )
        : t(
          'deplacerSeance.erreurs.placePrise',
          'Cette place n’est plus libre. Choisis-en une autre.',
        );
    case 'RELOCATION_PROPOSAL_CLOSED':
      return t(
        'deplacerSeance.erreurs.propositionClose',
        'Cette proposition n’attend plus de réponse.',
      );
    case 'RELOCATION_TOO_LATE':
      return t('deplacerSeance.erreurs.tropTard', 'La séance a déjà commencé.');
    default:
      return ville
        ? t(
          'deplacerSeance.erreurs.generiqueVille',
          'Ça n’a pas marché. Vérifiez la connexion, puis réessayez.',
        )
        : t(
          'deplacerSeance.erreurs.generique',
          'Ça n’a pas marché. Vérifie la connexion, puis réessaie.',
        );
  }
};
