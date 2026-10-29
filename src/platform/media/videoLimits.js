import i18n from '@/theme/strings';

/**
 * MSG-MEDIA (29/10) — LE SEUL ENDROIT QUI DIT COMBIEN DE TEMPS DURE UNE VIDÉO DE MESSAGERIE.
 *
 * Demande d'Adel : « Média » = photo OU vidéo, une minute au plus. Changer la limite, c'est
 * changer CETTE constante : le refus du téléphone, celui du site et le texte affiché la lisent.
 *
 * ⚠️ Ce que la limite ne fait PAS : compresser. `react-native-image-picker` 7.2.3 ne
 * recompresse que ce que la CAMÉRA filme (`videoQuality`, `durationLimit`) ; la galerie
 * (PHPicker iOS, Photo Picker Android) rend l'original, durée comprise (`asset.duration`).
 * Le poids reste donc tenu par le plafond de taille de la messagerie (Conversation.js).
 */
export const VIDEO_MAX_DURATION_SECONDS = 60;

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
 * La limite dite comme on la lit : « 1 min », « 2 min », « 45 s ».
 * @param {number} [maxSeconds]
 * @returns {string}
 */
export const formatVideoLimit = (maxSeconds = VIDEO_MAX_DURATION_SECONDS) => (
  maxSeconds % 60 === 0 ? `${maxSeconds / 60} min` : `${maxSeconds} s`
);

/**
 * Le refus d'une vidéo trop longue, AVANT l'envoi. Une durée inconnue ne refuse rien : on ne
 * refuse pas ce qu'on n'a pas mesuré (même règle que les photos, `photoLimits.js`).
 * @param {unknown} durationSeconds Durée de la vidéo, en secondes.
 * @param {number} [maxSeconds]
 * @returns {string} Le message de refus, ou '' si la vidéo passe.
 */
export const videoDurationRefusal = (durationSeconds, maxSeconds = VIDEO_MAX_DURATION_SECONDS) => {
  const duree = Number(durationSeconds);
  if (!Number.isFinite(duree) || duree <= 0) return '';
  // Une seconde de grâce : la galerie arrondit (60,4 s pour une vidéo filmée « 1 min »).
  if (duree < maxSeconds + 1) return '';
  return i18n.t('conversation.video.tooLong', {
    defaultValue:
      'Vidéo trop longue : {{max}} maximum. Raccourcis-la dans ta galerie, puis renvoie-la.',
    max: formatVideoLimit(maxSeconds),
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
