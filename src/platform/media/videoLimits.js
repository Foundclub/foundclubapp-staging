import i18n from '@/theme/strings';

import { BYTES_PER_MB } from '@/platform/media/photoLimits';

/**
 * MSG-MEDIA (29/10) — LE SEUL ENDROIT QUI DIT COMBIEN PÈSE AU PLUS UNE VIDÉO DE MESSAGERIE.
 *
 * Décision d'Adel (29/10) : pas de limite de durée, une limite de TAILLE. Changer la limite,
 * c'est changer CETTE constante : le refus du téléphone, celui du site et le texte affiché la
 * lisent. 150 Mo en attendant la valeur d'Adel ; le serveur accepte jusqu'à 250 Mo
 * (admin config/plugins.ts).
 *
 * ⚠️ Ce que la limite ne fait PAS : compresser. `react-native-image-picker` 7.2.3 ne
 * recompresse que ce que la CAMÉRA filme (`videoQuality`) ; la galerie (PHPicker iOS, Photo
 * Picker Android) rend l'original. Recompresser demanderait une bibliothèque (TestFlight native).
 */
export const VIDEO_MAX_BYTES = 150 * BYTES_PER_MB;

/**
 * Le fichier est-il une vidéo ?
 * @param {unknown} mime
 * @returns {boolean}
 */
export const isVideoMime = (mime) => String(mime || '').trim().toLowerCase().startsWith('video/');

/**
 * « 0:42 », « 1:00 », « 12:05 ».
 * @param {unknown} seconds
 * @returns {string} '' si la durée est inconnue.
 */
export const formatVideoDuration = (seconds) => {
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) return '';
  const minutes = Math.floor(total / 60);
  const reste = total % 60;
  return `${minutes}:${String(reste).padStart(2, '0')}`;
};

/**
 * Le refus d'une vidéo trop lourde, AVANT l'envoi. Une taille inconnue ne refuse rien : on ne
 * refuse pas ce qu'on n'a pas mesuré (même règle que les photos, `photoLimits.js`).
 * @param {unknown} sizeInBytes Taille du fichier, en octets.
 * @param {number} [maxBytes]
 * @returns {string} Le message de refus, ou '' si la vidéo passe.
 */
export const videoSizeRefusal = (sizeInBytes, maxBytes = VIDEO_MAX_BYTES) => {
  const taille = Number(sizeInBytes);
  if (!Number.isFinite(taille) || taille <= 0 || taille <= maxBytes) return '';
  return i18n.t('conversation.video.tooLarge', {
    defaultValue: 'Vidéo trop lourde : {{max}} Mo maximum.',
    max: Math.round(maxBytes / BYTES_PER_MB),
  });
};

/**
 * Le texte d'un message vidéo : « Vidéo · 0:42 » (« Vidéo » si la durée manque).
 * La durée voyage DANS LE TEXTE, pas dans une `composition` : une composition d'un type
 * inconnu s'affiche en carte « Composition » cassée sur les versions déjà installées, alors
 * que ce texte s'y lit tel quel (bulle texte, appui = ouverture du fichier), et sert
 * d'aperçu aux notifications sans une ligne côté serveur.
 * @param {unknown} mime Type du fichier envoyé.
 * @param {unknown} durationSeconds Durée rendue par le sélecteur.
 * @returns {string} '' si ce n'est pas une vidéo.
 */
export const videoMessageText = (mime, durationSeconds) => {
  if (!isVideoMime(mime)) return '';
  const libelle = i18n.t('conversation.video.label', 'Vidéo');
  const duree = formatVideoDuration(durationSeconds);
  return duree ? `${libelle} · ${duree}` : libelle;
};

const TEXTE_AUTO = /^\S+(?: · (\d+):(\d{2}))?$/u;

/**
 * Relit la durée posée par {@link videoMessageText}.
 * @param {unknown} text Le texte du message.
 * @returns {{ auto: boolean, durationSeconds?: number }} `auto` : le texte est celui de l'envoi
 * (le mot « Vidéo » de la langue de l'expéditeur, suivi ou non de la durée), donc à ne pas
 * répéter sous la tuile.
 */
export const readVideoMessageText = (text) => {
  const brut = String(text || '').trim();
  const trouve = TEXTE_AUTO.exec(brut);
  if (!brut || !trouve) return { auto: !brut };
  if (!trouve[1]) return { auto: brut === i18n.t('conversation.video.label', 'Vidéo') };
  return { auto: true, durationSeconds: (Number(trouve[1]) * 60) + Number(trouve[2]) };
};
