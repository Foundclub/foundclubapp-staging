import { texteHeure } from '@/domains/complexe/complexeTerrain';
import { texteJourLong } from '@/domains/complexe/reserverTerrain';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getZonedDateParts } from '@/utils/parisTime';

/**
 * 🏟️ RESA-PARTAGER (23/10/2026, A-G32, plan E-G05 / E-G12) — L'ANNONCE « IL ME MANQUE DES
 * JOUEURS » PARTAGÉE DANS LE CANAL DU COMPLEXE.
 *
 * Le serveur (admin `canal.partagerAnnonce`) pose dans le canal une ligne SANS expéditeur :
 * `message`
 * porte la phrase lue par une app d'avant, `systemNotice` la carte (liste blanche de
 * `chat/services/group-notices.js`, `toSafeAnnonceNotice`) :
 *   { version: 1, kind: 'complexe_annonce', annonce: { documentId, places, joined, level },
 *     complexe: { documentId, name }, partie: { startsAt, terrain } }
 * Une notice d'une autre sorte, ou sans annonce : rien (la phrase du serveur reste).
 * ponytail: « n places » est celui du moment du partage (le serveur ne relit pas la carte) ; la
 * page de l'annonce (E-P09) dit l'état vrai. Sortie : relire l'annonce à l'affichage.
 */
export const NOTICE_ANNONCE_COMPLEXE = 'complexe_annonce';

/** @typedef {any} Traduire - La traduction (TFunction d'i18next). */

/**
 * @typedef {object} CarteDAnnonce
 * @property {string} annonceId - L'annonce à ouvrir (E-P09).
 * @property {string} complexe - Le nom du complexe.
 * @property {string} heure - « 19 h ».
 * @property {string} jour - « Jeudi 30 octobre ».
 * @property {string} libelle - Ce que dit le lecteur d'écran sur le bouton.
 * @property {string} places - « 2 places ».
 * @property {string} terrain - « Terrain 1 ».
 */

/**
 * La carte d'une ligne `complexe_annonce`, ou null.
 * @param {Traduire} t - Traduction.
 * @param {any} notice - `systemNotice` du message.
 * @returns {CarteDAnnonce | null} La carte.
 */
export const carteDAnnonce = (t, notice) => {
  if (!notice || notice.kind !== NOTICE_ANNONCE_COMPLEXE) return null;
  const annonceId = String(notice.annonce?.documentId || '');
  if (!annonceId) return null;
  const restantes = Math.max(
    0,
    (Number(notice.annonce?.places) || 0) - (Number(notice.annonce?.joined) || 0),
  );
  const instant = new Date(String(notice.partie?.startsAt || ''));
  let jour = '';
  let heure = '';
  if (notice.partie?.startsAt && !Number.isNaN(instant.getTime())) {
    const parts = getZonedDateParts(instant);
    const deux = (/** @type {number} */ nombre) => String(nombre).padStart(2, '0');
    jour = texteJourLong(t, `${parts.year}-${deux(parts.month)}-${deux(parts.day)}`);
    heure = texteHeure(`${deux(parts.hour % 24)}:${deux(parts.minute)}`);
  }
  const places = t('complexeCanal.annonce.places', '{{count}} places', {
    count: restantes,
    defaultValue_one: '{{count}} place',
    defaultValue_other: '{{count}} places',
  });
  const quand = [jour, heure].filter(Boolean).join(', ');
  return {
    annonceId,
    complexe: String(notice.complexe?.name || ''),
    heure,
    jour,
    libelle: t('complexeCanal.annonce.voirLibelle', 'Voir l’annonce : {{quand}}, {{places}}', {
      places,
      quand,
      ...SANS_ECHAPPEMENT,
    }),
    places,
    terrain: String(notice.partie?.terrain || ''),
  };
};

/**
 * « Partager dans mon canal » se propose-t-il pour cette réservation (E-G05, E-G12) ? Une
 * réservation de l'app, confirmée, à venir. Si le serveur dit son annonce (`annonce`, `null` sans
 * annonce), seulement quand elle est OUVERTE ; s'il ne la dit pas (champ absent), le bouton est là
 * et le serveur répond (409 « pas d'annonce ouverte »).
 * ponytail: champ absent = serveur sans `annonce` dans la fiche du gérant ; sortie : le serveur
 * l'ajoute (`toManagerView`, `toManagerListItem`), rien ne change ici.
 * @param {any} reservation - La fiche ou la ligne du gérant.
 * @param {number} [maintenant] - L'instant de référence (ms).
 * @returns {boolean} Vrai si le geste se propose.
 */
export const peutPartagerLAnnonce = (reservation, maintenant = Date.now()) => {
  if (reservation?.source !== 'app' || reservation?.status !== 'confirmee') return false;
  const debut = new Date(String(reservation?.startsAt || '')).getTime();
  if (Number.isNaN(debut) || debut <= maintenant) return false;
  if (reservation.annonce === undefined) return true;
  return reservation.annonce?.status === 'ouverte';
};

/**
 * Ce que le gérant lit après le geste : partagée, ou déjà partagée.
 * @param {Traduire} t - Traduction.
 * @param {any} reponse - `{ data: { dejaPartagee } }`.
 * @returns {string} Le message.
 */
export const messageDuPartage = (t, reponse) => (reponse?.data?.dejaPartagee
  ? t('complexeCanal.partager.deja', 'Annonce déjà partagée dans ton canal.')
  : t('complexeCanal.partager.fait', 'Annonce partagée dans ton canal.'));
