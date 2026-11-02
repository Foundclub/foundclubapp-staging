/**
 * CORR-MESSAGERIE point 114 (décision d'Adel « B », 30/10/2026) — UN COMPTE À DEUX CASQUETTES.
 *
 * Un gérant de complexe qui dirige aussi un club, une Ville qui gère aussi un club : leurs
 * conversations et leurs notifications se mêlaient sans qu'on sache de quelle casquette elles
 * relèvent. Tout reste affiché ; chaque ligne porte « Club », « Complexe » ou « Ville » — mais
 * seulement quand la liste MÊLE au moins deux casquettes (les autres comptes ne voient rien
 * de neuf).
 *
 * Le classement se lit sur le type du fil ou de la notification : une conversation privée
 * (`whisper`) ou l'assistance n'a pas de casquette, aucune donnée ne la rattache.
 */
import { estFilDeLaVille } from '@/domains/collectivite/collectiviteCanaux';
import { estTypeDuGerant } from '@/domains/complexe/notificationsDuComplexe';
import { estUnCanalDeComplexe } from '@/domains/messaging/habillageDuFil';

/** @typedef {'club' | 'complexe' | 'ville'} Casquette */

const TYPES_DU_CLUB = new Set(['club', 'friendly_match', 'league_match', 'multisport', 'team']);

/**
 * La casquette d'un fil.
 * @param {any} chat - Le fil.
 * @returns {Casquette | null} Sa casquette, ou rien (fil privé, assistance, groupe libre).
 */
export const casquetteDuFil = (chat) => {
  if (estFilDeLaVille(chat)) return 'ville';
  if (estUnCanalDeComplexe(chat)) return 'complexe';
  if (TYPES_DU_CLUB.has(chat?.type)) return 'club';
  return null;
};

/**
 * FIN-MESSAGERIE p88 (02/11) — l'avis d'un message de la Ville porte le type de son fil
 * (`chatType`, serveur `sendNotificationCollectivite`). Le titre seul ne suffit pas : « · » se
 * trouve aussi dans un groupe libre de club, un groupe de complexe, l'assistance.
 * Les avis plus anciens n'ont pas ce type. Repli strict : signés au nom de la Ville (un nom sans
 * nom de famille) ET ce nom est un morceau entier du titre, « Ville de … · club » ou « Toute la
 * ville · Ville de … ».
 * ponytail: un compte sans nom de famille qui écrit dans un groupe contenant son prénom comme
 *   morceau
 * (« Foot · U11 » signé « Foot ») passerait ; le repli ne sert qu'aux avis d'avant le déploiement,
 * à retirer quand ils auront disparu de la cloche.
 * @param {any} notification - La notification.
 * @returns {boolean} Vrai pour un message d'un fil de la Ville.
 */
const estUnMessageDeLaVille = (notification) => {
  if (notification?.type !== 'newGroupMessage') return false;
  const {
    chatType, firstname, groupName, lastname,
  } = notification?.data || {};
  if (chatType) return String(chatType).startsWith('collectivite');
  const morceaux = String(groupName || '').split(' · ');
  return Boolean(firstname) && !lastname && morceaux.length > 1 && morceaux.includes(firstname);
};

/**
 * La casquette d'une notification.
 * @param {any} notification - La notification.
 * @returns {Casquette} Sa casquette : la Ville et le complexe par leur type, le club sinon.
 */
export const casquetteDeLaNotification = (notification) => {
  const type = String(notification?.type || '');
  if (type.startsWith('collectivite') || estUnMessageDeLaVille(notification)) return 'ville';
  if (estTypeDuGerant(type)) return 'complexe';
  return 'club';
};

/**
 * Le libellé d'une casquette, « Club », « Complexe » ou « Ville ».
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {Casquette | null} casquette - La casquette.
 * @returns {string} Son libellé (vide sans casquette).
 */
export const libelleDeCasquette = (t, casquette) => {
  if (casquette === 'ville') return t('messaging.casquette.ville', 'Ville');
  if (casquette === 'complexe') return t('messaging.casquette.complexe', 'Complexe');
  if (casquette === 'club') return t('messaging.casquette.club', 'Club');
  return '';
};

/**
 * La liste mêle-t-elle au moins deux casquettes ?
 * @param {Array<Casquette | null>} casquettes - Celles des lignes.
 * @returns {boolean} Vrai dès deux casquettes différentes.
 */
export const casquettesMelees = (casquettes) => new Set(casquettes.filter(Boolean)).size >= 2;
