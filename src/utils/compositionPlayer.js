/**
 * C-F — LES 4 FONCTIONS PARTAGEES, sorties de `views/tactical_v2/`.
 *
 * 🏠 POURQUOI ELLES VIVENT ICI ET PAS DANS `views/`. `ProfileAvatar` — un
 * composant du design system utilise par 64 fichiers — appelle
 * `getCompositionPlayerInitials`. Un composant partage ne doit pas aller
 * chercher son comportement dans l'ecran d'un domaine : c'est ce qui a rendu la
 * suppression de `tactical_v2` impossible pendant tout le chantier composition.
 *
 * Leurs temoins sont dans `__tests__/compositionPlayer.test.js` (E6 : elles
 * n'avaient AUCUN test avant ce lot).
 */

/**
 * Repare le double encodage UTF-8 que le serveur laisse parfois passer sur les
 * prenoms accentues (« JÃ©rÃ´me » au lieu de « Jérôme »).
 *
 * ⚠️ Cette table est volontairement litterale : elle ne couvre que ce qui a ete
 * constate en base. Y ajouter une regle generale reparerait aussi des textes
 * sains.
 * @param {any} value
 * @returns {string}
 */
const repairCommonMojibake = (value) => String(value || '')
  .replace(/Ã‰/g, 'E')
  .replace(/Ã©/g, 'e')
  .replace(/Ã¨/g, 'e')
  .replace(/Ãª/g, 'e')
  .replace(/Ã«/g, 'e')
  .replace(/Ã€/g, 'A')
  .replace(/Ã /g, 'a')
  .replace(/Ã¢/g, 'a')
  .replace(/Ã¹/g, 'u')
  .replace(/Ã»/g, 'u')
  .replace(/Ã´/g, 'o')
  .replace(/Ã®/g, 'i')
  .replace(/Ã¯/g, 'i')
  .replace(/â€™/g, "'")
  .replace(/â€œ/g, '"')
  .replace(/â€\x9d/g, '"')
  .replace(/â€“/g, '-')
  .replace(/â€”/g, '-');

/**
 * Le texte d'une composition, repare et sans espaces de bord.
 * @param {any} value
 * @returns {string}
 */
export const sanitizeCompositionText = (value) => repairCommonMojibake(value).trim();

/**
 * L'identifiant qui sert de cle a un joueur dans toute la composition.
 * `documentId` d'abord (Strapi 5), `id` ensuite.
 * @param {any} player
 * @returns {string} Vide quand le joueur n'a aucun identifiant.
 */
export const getCompositionPlayerId = (player) => sanitizeCompositionText(
  player?.documentId || player?.id || '',
);

/**
 * Le nom affiche d'un joueur. Le repli `name` est la forme des joueurs ajoutes
 * a la main, qui n'ont ni prenom ni nom separes.
 * @param {any} player
 * @returns {string} « Joueur » quand rien n'est renseigne.
 */
export const getCompositionPlayerLabel = (player) => (
  `${sanitizeCompositionText(player?.firstname)} ${sanitizeCompositionText(player?.lastname)}`.trim()
  || sanitizeCompositionText(player?.name)
  || 'Joueur'
);

/**
 * Les initiales affichees quand une personne n'a pas de photo.
 * @param {any} player
 * @returns {string} Deux lettres au plus.
 */
export const getCompositionPlayerInitials = (player) => {
  const label = getCompositionPlayerLabel(player);
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
};
