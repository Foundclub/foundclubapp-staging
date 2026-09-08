/**
 * LE TEXTE QUI VIENT DU SERVEUR PASSE SANS ÊTRE ÉCHAPPÉ — pour UN appel, jamais pour
 * toute l'application.
 *
 * 🐞 LE DÉFAUT, vu à l'écran le 2026-09-08 : l'app affichait
 * « Rotations de hanche assis 90°&#x2F;90° ». Le nom du test est propre en base — c'est
 * i18next qui échappe les valeurs interpolées, et chaque « / » ressort en « &#x2F; ».
 *
 * 🪤 CE PIÈGE EST DÉJÀ CONNU DU DÉPÔT (`TeamDetails.js`, « motif maison »), où il a été
 * contourné par un `.replace('{{date}}', …)` après coup. **Ce fichier fait mieux, et la
 * raison compte** : avec `.replace()`, le jour où un gabarit perd ou renomme son
 * `{{program}}`, la valeur disparaît SANS BRUIT — aucune porte ne le voit. Mesuré :
 * c'est exactement ce qui est arrivé aux témoins de `TrainingEnrolled` le 08/09.
 *
 * ✅ i18next accepte l'option au coup par coup, et elle ne déborde pas. Vérifié :
 *
 *     t('r', { program: 'Foot 90°/90°' })                         → « Foot 90°&#x2F;90° »
 *     t('r', { program: 'Foot 90°/90°', ...SANS_ECHAPPEMENT })    → « Foot 90°/90° »
 *     t('s', { x: 'a/b' })  (l'appel SUIVANT)                     → « a&#x2F;b »
 *
 * ⛔ SURTOUT PAS `escapeValue: false` dans `src/theme/strings/index.js` : là, il
 * s'appliquerait à TOUTES les interpolations de l'application, d'un coup.
 *
 * 🔒 POURQUOI C'EST SANS DANGER ICI. L'échappement HTML protège d'un texte injecté qui
 * serait ensuite interprété comme du balisage. React Native n'interprète JAMAIS de
 * balisage : `<Text>` affiche des caractères, point. L'échappement n'y protège de rien
 * et n'y produit que ce défaut d'affichage. (Le portail `web` compile les mêmes
 * sources : `react-native-web` rend `<Text>` en `<span>` via React, qui échappe de
 * lui-même le contenu textuel — la protection reste donc entière de ce côté aussi.)
 */

/** À étaler dans les options d'un `t()` qui affiche du texte venu du serveur. */
const SANS_ECHAPPEMENT = { interpolation: { escapeValue: false } };

export default SANS_ECHAPPEMENT;
