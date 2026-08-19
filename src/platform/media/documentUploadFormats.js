import { Platform } from 'react-native';

/**
 * app/src/platform/media/documentUploadFormats.js
 *
 * U06 — LES FORMATS ACCEPTES QUAND ON DEPOSE UNE PIECE DEMANDEE PAR LE CLUB.
 *
 * 🗣️ Adel, 18/08 : « j'ai l'impression qu'on est hyper limité dans les formats
 * qu'on peut uploader dans les docs demandés. »
 *
 * 🧨 LA CAUSE, MESUREE — et ce n'est PAS une liste trop courte : les trois
 * ecrans de depot appelaient `pickDocument` avec la chaine passe-partout
 * d'Android (etoile, barre oblique, etoile). C'est un type MIME **Android**.
 * Sur iOS, `@react-native-documents/picker` transmet ces chaines telles quelles
 * a `UIDocumentPickerViewController`, qui attend des **UTI** (`public.item`,
 * `com.adobe.pdf`, …) : la chaine passe-partout d'Android n'en est pas un, et le
 * selecteur de fichiers d'iOS finit par grimer presque tout. D'ou l'impression
 * d'etre « hyper limite » — sur un chemin qui, lui, n'imposait rien du tout.
 *
 * ⛔ ET ON NE MET PAS « TOUT ACCEPTER » A LA PLACE : un televersement sans borne
 * est une porte ouverte. La liste ci-dessous couvre ce qu'un parent envoie
 * vraiment — une photo, une capture d'ecran, un PDF, un document bureautique —
 * et rien de plus. Pas d'archive, pas d'executable, pas de video.
 *
 * 🔗 Le serveur applique LA MEME liste (`license.ts:assertUploadedFileIsAllowed`).
 * Les deux doivent bouger ensemble : c'est toujours le plus strict qui gagne, et
 * en silence.
 */

/** Ce que le SERVEUR accepte, et ce que le navigateur met dans `accept=`. */
export const DOCUMENT_UPLOAD_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
]);

/** Attribut `accept` d'un `<input type="file">` — chemin web uniquement. */
export const DOCUMENT_UPLOAD_ACCEPT = DOCUMENT_UPLOAD_MIME_TYPES.join(',');

/**
 * Android : des types MIME. `image/*` couvre photo, capture d'ecran et HEIC.
 */
const ANDROID_PICKER_TYPES = Object.freeze([
  'application/pdf',
  'image/*',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
]);

/**
 * iOS : des UTI, JAMAIS des types MIME. `public.image` couvre JPEG, PNG, HEIC
 * et les captures d'ecran d'un seul mot.
 */
const IOS_PICKER_TYPES = Object.freeze([
  'com.adobe.pdf',
  'public.image',
  'com.microsoft.word.doc',
  'org.openxmlformats.wordprocessingml.document',
  'org.oasis-open.opendocument.text',
]);

/**
 * Les jetons a passer a `pickDocument({ type })`, dans la langue de la plateforme.
 * @returns {string[]}
 */
export const getDocumentPickerTypes = () => (
  Platform.OS === 'ios' ? [...IOS_PICKER_TYPES] : [...ANDROID_PICKER_TYPES]
);

/**
 * Les options completes du selecteur — un seul endroit a citer chez l'appelant.
 * @returns {{ accept: string, mode: 'open', type: string[] }}
 */
export const getDocumentPickerOptions = () => ({
  accept: DOCUMENT_UPLOAD_ACCEPT,
  mode: 'open',
  type: getDocumentPickerTypes(),
});

export default {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_MIME_TYPES,
  getDocumentPickerOptions,
  getDocumentPickerTypes,
};
