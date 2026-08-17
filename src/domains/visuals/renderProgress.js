/**
 * app/src/domains/visuals/renderProgress.js
 *
 * L'ATTENTE PENDANT QU'UNE AFFICHE SE FABRIQUE — et ce que l'écran a le droit
 * d'en dire.
 *
 * ⛔ IL N'Y A PLUS DE COMPTE À REBOURS, ET C'EST LE SUJET DE CE FICHIER.
 *
 * S07 (2026-08-16) annonçait « encore N s environ », sur une estimation de 3,5 à
 * 4,5 s SUPPOSÉE, jamais mesurée. Adel, recette du 2026-08-17, point 11 : « le
 * décompte n'est vraiment pas réaliste, et ça finit TOUJOURS avec le message
 * [de dépassement] ».
 *
 * 📏 T04 (2026-08-17) — CE QUE LA MESURE A DIT, et elle lui donne raison.
 * Rejeu de la chaîne de rendu RÉELLE (`admin/src/api/visual-asset/services/
 * visual-renderer.ts` : QR → modèle → composition → Chromium), 22 rendus par
 * format, sur un **i7-11800H 16 cœurs**, Chromium déjà chaud :
 *
 *   · `post`  (1080×1350 ×2) — médiane **3,7 à 5,2 s** · min 3,1 s · pire **13,0 s**
 *   · `story` (1080×1920 ×2) — médiane **3,7 à 4,8 s** · pire **5,5 s**
 *   · `a4`    (PDF)          — médiane **2,8 à 3,4 s** · pire **22,9 s**
 *
 * ⚠️ Et ces chiffres sont une **BORNE BASSE** de ce que vit le téléphone : ils
 * excluent les requêtes Strapi, le téléchargement du logo du club (que le
 * serveur va chercher et analyse avec `sharp` AVANT même de regarder son cache
 * — `visual-asset.ts:375`), et le transport des **1,29 Mo** (post) à **1,64 Mo**
 * (story) jusqu'au téléphone. Le serveur, lui, est un **6 vCPU Haswell** partagé
 * entre la prod, la préprod, la base et les tâches planifiées.
 *
 * 🎯 CONCLUSION, ET POURQUOI AUCUN NOMBRE N'EST ÉCRIT ICI : la médiane du format
 * `post` — celui de l'aperçu — dépasse DÉJÀ les 3,5 s annoncées, sur une machine
 * plus rapide que le serveur. Le dépassement ne pouvait donc pas ne pas se
 * déclencher. Et surtout : entre 3,1 s et 22,9 s selon la charge de la machine à
 * cet instant, **aucun nombre n'est vrai plus d'une fois sur deux**. La durée
 * n'est pas une propriété de l'affiche, c'est une propriété de la charge.
 * ⇒ On ne promet plus rien. L'écran dit qu'il travaille ; il ne dit pas combien
 *   de temps. Un compteur qui se trompe toujours apprend à ne plus être lu.
 *
 * 🚫 CE QU'ON NE FERA PAS, et pourquoi c'est écrit :
 *   · pas de barre qui se remplit toute seule — une barre qui avance pendant
 *     qu'on ne sait rien est le mensonge qu'on répare ailleurs ;
 *   · pas de vraie progression venue du serveur : il n'a rien à dire. Le rendu
 *     est un seul POST bloquant qui ne répond qu'à la fin
 *     (`visual-asset.ts:411` puis `ctx.body = result.bytes`) — il faudrait une
 *     file de travaux et une requête de suivi par seconde, ce qu'on s'interdit.
 */

/**
 * Au-delà de ce temps, l'écran change de phrase.
 *
 * ⚠️ CE N'EST PAS UNE PRÉDICTION, c'est un constat sur le temps DÉJÀ écoulé —
 * la seule chose que le téléphone connaisse avec certitude. La valeur est posée
 * JUSTE AU-DESSUS du pire cas mesuré le 2026-08-17 (12 989 ms pour `post`) :
 * en dessous, dire « c'est plus long que d'habitude » serait crier au loup pour
 * une attente que la mesure a vue arriver normalement.
 */
export const LONG_WAIT_MS = 15000;

/**
 * L'attente a-t-elle dépassé tout ce que la mesure a observé ?
 * @param {number} elapsedMs - Temps écoulé depuis le début de l'attente.
 * @returns {boolean} `false` pour un temps absurde (horloge recalée en cours
 *   d'attente) : on ne bascule pas sur un message d'alerte à cause d'une horloge.
 */
export const isLongWait = (elapsedMs) => Number.isFinite(elapsedMs)
  && elapsedMs >= LONG_WAIT_MS;
