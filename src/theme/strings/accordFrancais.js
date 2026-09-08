/**
 * L'ACCORD DU ZÉRO — l'adaptateur qui rend le pluriel juste sur le téléphone.
 *
 * 🐞 LE DÉFAUT, vu à l'écran le 2026-09-08 : l'app affichait « 0 séances faites sur 8 »,
 * « 0 tests faits », « 0 faites sur 5 ». **En français, zéro prend le singulier.** Le
 * pack de design l'écrit d'ailleurs correctement : « 0 test sur … », « 1 séance faite ».
 *
 * 🔎 LA CAUSE, MESURÉE. Les clés `_one` / `_other` sont bonnes et `count` est bien
 * passé — la même configuration donne la bonne réponse hors de l'app :
 *
 *     i18next 25.4.1, lng 'fr', compatibilityJSON 'v4', sous Node :
 *       count=0 → « 0 séance faite »   ✅
 *       count=1 → « 1 séance faite »   ✅
 *       count=2 → « 2 séances faites » ✅
 *
 * Sur l'appareil, c'est la règle de l'ANGLAIS qui s'applique (0 → pluriel) : le moteur
 * JavaScript embarqué ne résout pas `Intl.PluralRules` pour le français, et l'app
 * n'embarque aucun complément (`intl-pluralrules` n'est pas dans les dépendances).
 *
 * ✅ CE QUE FAIT CET ADAPTATEUR. Les deux règles ne diffèrent que sur **zéro** :
 *
 *     français : 0 → singulier · 1 → singulier · 2+ → pluriel
 *     anglais  : 0 → PLURIEL   · 1 → singulier · 2+ → pluriel
 *
 * On donne donc `1` à i18next quand le nombre vaut zéro : les deux moteurs choisissent
 * alors le singulier, qui est la forme française juste. Le nombre AFFICHÉ n'est pas
 * touché — il voyage à part, dans `{{done}}`, `{{tests}}`, etc.
 *
 * 🚪 LA VOIE DE SORTIE, pour le jour où on la prendra : installer `intl-pluralrules`
 * (une ligne dans `src/theme/strings/index.js`) réparerait l'app ENTIÈRE d'un coup —
 * pas seulement l'entraînement. C'est un ajout de dépendance dans `app` : geste à GO
 * (règle R4 n° 6). Ce fichier disparaîtra ce jour-là, et rien ne cassera : donner 1
 * au lieu de 0 reste juste sous la règle française.
 *
 * ponytail: adaptateur assumé, plafond nommé (le zéro), sortie nommée (le complément).
 */

/**
 * Le nombre à donner à i18next pour qu'il choisisse la forme française.
 * @param {number} nombre le compte réel
 * @returns {number} le même nombre, sauf zéro qui devient 1
 */
const accordFrancais = (nombre) => (Number(nombre) === 0 ? 1 : Number(nombre) || 0);

export default accordFrancais;
