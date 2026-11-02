// REPRISE-ROBUSTESSE (01/11/2026, Adel « 1- B ») — sur le site, les boîtes grises du navigateur
// (window.alert / confirm / prompt, et `Alert.alert` que la doublure du site y renvoyait)
// deviennent la fenêtre de l'app. Ce registre ne dépend de rien : la doublure `Alert` du site
// (web/src/shims/react-native.ts) l'appelle, et l'hôte `FenetreDeLApp.web` s'y inscrit une fois
// posé à la racine du site. Sans hôte (téléphone, jest, page sans racine), chaque appel retombe
// sur le comportement d'avant.

/**
 * @typedef {object} BoutonDeFenetre
 * @property {string} [text]
 * @property {() => void} [onPress]
 * @property {'default' | 'cancel' | 'destructive'} [style]
 * @property {boolean} [isPreferred]
 */

/**
 * @typedef {object} Fenetre
 * @property {string} [title]
 * @property {string} [message]
 * @property {BoutonDeFenetre[]} [buttons]
 * @property {{ defaultValue?: string, onSubmit: (valeur: string | null) => void }} [champ]
 *   Une question à réponse écrite (l'ancien window.prompt).
 */

/** @type {((fenetre: Fenetre) => void) | null} */
let hote = null;

/**
 * Inscrit l'hôte qui dessine les fenêtres.
 * @param {(fenetre: Fenetre) => void} afficher - Ajoute une fenêtre à la file de l'hôte.
 * @returns {() => void} Le retrait de l'inscription.
 */
export const poserHoteDeFenetre = (afficher) => {
  hote = afficher;
  return () => {
    if (hote === afficher) hote = null;
  };
};

/**
 * Ouvre une fenêtre de l'app, si un hôte est posé.
 * @param {Fenetre} fenetre - Le titre, le message, les boutons.
 * @returns {boolean} Vrai si la fenêtre de l'app s'en charge.
 */
export const ouvrirFenetre = (fenetre) => {
  if (!hote) return false;
  hote(fenetre);
  return true;
};

/**
 * Remplace `window.confirm` : la question dans la fenêtre de l'app, réponse oui / non.
 * @param {string} texte - La question, telle que window.confirm la recevait.
 * @returns {Promise<boolean>} Vrai si la personne confirme.
 */
export const confirmerDansLApp = (texte) => new Promise((resolve) => {
  const [title, ...reste] = String(texte ?? '').split('\n\n');
  const prise = ouvrirFenetre({
    buttons: [
      { onPress: () => resolve(false), style: 'cancel' },
      { isPreferred: true, onPress: () => resolve(true) },
    ],
    message: reste.join('\n\n') || undefined,
    title,
  });
  // eslint-disable-next-line no-alert -- le repli voulu quand la fenêtre de l'app n'est pas posée
  if (!prise) resolve(typeof window !== 'undefined' && window.confirm(texte));
});

/**
 * Remplace `window.prompt` : la question et un champ dans la fenêtre de l'app.
 * @param {string} texte - La question.
 * @param {string} [defaultValue] - La valeur proposée.
 * @returns {Promise<string | null>} La réponse, ou null si la personne annule.
 */
export const demanderDansLApp = (texte, defaultValue = '') => new Promise((resolve) => {
  const prise = ouvrirFenetre({ champ: { defaultValue, onSubmit: resolve }, title: texte });
  // eslint-disable-next-line no-alert -- le repli voulu quand la fenêtre de l'app n'est pas posée
  if (!prise) resolve(typeof window !== 'undefined' ? window.prompt(texte, defaultValue) : null);
});
