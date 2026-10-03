/**
 * 🖱️ COLL-C4A3 (03/10/2026) — LE GLISSER-DÉPOSER DE FICHIERS SUR LE SITE (première zone : publier
 * une actualité, planche P3b-actu-ordi, « ou glissez un fichier ici »).
 *
 * Une vue du site ne transmet pas les événements de glisser (react-native-web les filtre) : on
 * écoute l'élément du navigateur lui-même, que l'écran obtient par sa `ref`. Au téléphone, il n'y
 * a pas d'élément du navigateur : rien n'est écouté.
 *   · seul un glisser qui porte des FICHIERS est pris : du texte ou un lien reste au navigateur ;
 *   · `preventDefault` au survol ET au dépôt : sans lui, le navigateur OUVRIRAIT le fichier, et la
 *     saisie en cours serait perdue ;
 *   · le survol se compte (entrer dans un enfant fait sortir du parent) : il ne s'éteint qu'à la
 *     vraie sortie, ou au dépôt.
 * @param {any} element - La zone, côté navigateur (`null` ou une vue native : rien n'est écouté).
 * @param {{ onFichiers: (fichiers: any[]) => void, onSurvol: (actif: boolean) => void }} rappels
 *   - Ce qu'on fait des fichiers lâchés, et du survol.
 * @returns {() => void} Arrête l'écoute.
 */
export const ecouterLeDepot = (element, { onFichiers, onSurvol }) => {
  if (!element || typeof element.addEventListener !== 'function') return () => {};
  let profondeur = 0;
  const porteDesFichiers = (/** @type {any} */ evenement) => Array
    .from(evenement?.dataTransfer?.types || [])
    .includes('Files');
  /** @type {Record<string, (evenement: any) => void>} */
  const ecouteurs = {
    dragenter: (evenement) => {
      if (!porteDesFichiers(evenement)) return;
      evenement.preventDefault();
      profondeur += 1;
      if (profondeur === 1) onSurvol(true);
    },
    dragleave: (evenement) => {
      if (!porteDesFichiers(evenement)) return;
      profondeur = Math.max(0, profondeur - 1);
      if (profondeur === 0) onSurvol(false);
    },
    dragover: (evenement) => {
      if (!porteDesFichiers(evenement)) return;
      evenement.preventDefault();
      // eslint-disable-next-line no-param-reassign -- c'est ainsi que le navigateur l'attend
      evenement.dataTransfer.dropEffect = 'copy';
    },
    drop: (evenement) => {
      if (!porteDesFichiers(evenement)) return;
      evenement.preventDefault();
      profondeur = 0;
      onSurvol(false);
      onFichiers(Array.from(evenement.dataTransfer.files || []));
    },
  };
  Object.entries(ecouteurs).forEach(([nom, ecouteur]) => element.addEventListener(nom, ecouteur));
  return () => Object.entries(ecouteurs)
    .forEach(([nom, ecouteur]) => element.removeEventListener(nom, ecouteur));
};

export default ecouterLeDepot;
