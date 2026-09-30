import { act } from 'react-test-renderer';

// LISTE-ANNONCES (audit V1, A09) — l'outillage du témoin « choix du sport », partagé par les
// témoins de chaque filtre de sport de la recherche (clubs, événements, annonces, profils,
// réservations, pastille de l'annuaire).
//
// Décision d'Adel (30/09) : « les sports populaires en haut (football, basketball, handball,
// rugby, volleyball), puis une recherche à la main dans tous les sports ».

/** Une base de sports en petit : les 5 populaires, des sports hors liste, des accents. */
export const SPORTS_A09 = Object.freeze([
  { documentId: 'a-athle', name: 'Athlétisme' },
  { documentId: 'a-basket', name: 'Basketball' },
  { documentId: 'a-echecs', name: 'Échecs' },
  { documentId: 'a-equit', name: 'Équitation' },
  { documentId: 'a-1', name: 'Football' },
  { documentId: 'a-hand', name: 'Handball' },
  { documentId: 'a-rugby', name: 'Rugby' },
  { documentId: 'a-rugby13', name: 'Rugby à XIII' },
  { documentId: 'a-tennis', name: 'Tennis' },
  { documentId: 'a-volley', name: 'Volleyball' },
]);

/** Ce qu'on lit en ouvrant le choix, sans sport choisi : les populaires, dans l'ordre d'Adel. */
export const POPULAIRES_EN_TETE = Object.freeze([
  'Tous les sports', 'Football', 'Basketball', 'Handball', 'Rugby', 'Volleyball',
]);

const ROLES_DE_LIGNE = ['radio', 'checkbox'];

/**
 * Les lignes de choix de sport affichées, dans l'ordre de l'écran (un nœud hôte par ligne :
 * `TouchableOpacity` en expose deux, seul l'hôte est compté).
 * @param {any} tree L'arbre rendu.
 * @returns {string[]} Les libellés.
 */
export const lignesDeSport = (tree) => tree.root.findAll(
  (/** @type {any} */ n) => typeof n.type === 'string'
    && ROLES_DE_LIGNE.includes(n.props?.accessibilityRole),
).map((/** @type {any} */ n) => n.props.accessibilityLabel);

/**
 * Tape dans la recherche du choix du sport.
 * @param {any} tree L'arbre rendu.
 * @param {string} texte Le texte tapé.
 * @returns {Promise<void>} Rien.
 */
export const chercherUnSport = async (tree, texte) => {
  const champ = tree.root.findAll(
    (/** @type {any} */ n) => n.props?.placeholder === 'Rechercher un sport'
      && typeof n.props?.onChangeText === 'function',
  )[0];
  if (!champ) throw new Error('Aucun champ « Rechercher un sport »');
  await act(async () => { champ.props.onChangeText(texte); });
};

/**
 * Touche la ligne d'un sport.
 * @param {any} tree L'arbre rendu.
 * @param {string} nom Le nom du sport.
 * @returns {Promise<void>} Rien.
 */
export const choisirLeSport = async (tree, nom) => {
  const ligne = tree.root.findAll(
    (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
      && ROLES_DE_LIGNE.includes(n.props?.accessibilityRole)
      && n.props?.accessibilityLabel === nom,
  )[0];
  if (!ligne) throw new Error(`Aucune ligne de sport « ${nom} »`);
  await act(async () => { ligne.props.onPress(); });
};
