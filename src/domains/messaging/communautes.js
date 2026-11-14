/**
 * COMMUNAUTES-L2 (13/11/2026, demande D76 d'Adel, maquette v3 validée le 12/11) — les règles des
 * premiers
 * écrans des communautés, sans React : qui voit l'entrée, qui voit « Nouveau groupe », ce qui part
 * au serveur.
 *
 * La serrure reste le serveur (`POST /communautes/:genre/:id/groupes` rejuge tout) : ici, on
 * n'affiche que ce
 * que le serveur dit (`peutCreer`) et on n'envoie que ce que l'écran a réglé.
 */

/** Les 6 thèmes de la maquette (écran 3), dans son ordre ; mêmes valeurs que le serveur. */
export const THEMES_COMMUNAUTE = [
  'equipe',
  'parents',
  'covoiturage',
  'staff',
  'evenement',
  'libre',
];

/** Les icônes proposées (glyphes de l'app : aucun emoji, décision du 01/10). */
export const ICONES_COMMUNAUTE = [
  'users',
  'flag',
  'locationPin',
  'shieldCheck',
  'camera',
  'chartSimpleHorizontal',
];

/**
 * Les genres où l'on crée dès L2. La Ville invite (270 C) : sa création attend le lot L7 (le
 * serveur répond 409).
 */
export const GENRES_CREABLES = ['club', 'omnisport', 'complexe'];

/** Au moins 2 autres membres : un groupe compte au moins 3 personnes (règle de createGroupChat). */
export const MEMBRES_MINIMUM = 2;

/**
 * L'entrée « Communautés » de la messagerie n'existe que si le serveur rend au moins une
 * communauté.
 * Un serveur d'avant le socle (404), une erreur ou une liste vide : la messagerie reste celle
 * d'aujourd'hui.
 * @param {unknown} communautes - La réponse de `GET /communautes/mine`, ou null.
 * @returns {boolean} Vrai si l'entrée s'affiche.
 */
export const afficherEntreeCommunautes = (communautes) => (
  Array.isArray(communautes) && communautes.length > 0
);

/**
 * « Nouveau groupe » : le serveur a dit oui, et le genre se crée déjà.
 * @param {{ genre?: string, peutCreer?: boolean } | null | undefined} communaute
 * @returns {boolean} Vrai si le bouton s'affiche.
 */
export const peutCreerDans = (communaute) => (
  communaute?.peutCreer === true && GENRES_CREABLES.includes(String(communaute?.genre || ''))
);

/**
 * La Ville : le gestionnaire voit sa communauté, et une phrase dit que ses groupes arrivent avec
 * les invitations.
 * @param {{ genre?: string, peutCreer?: boolean } | null | undefined} communaute
 * @returns {boolean} Vrai pour un gestionnaire de Ville.
 */
export const creationEnAttente = (communaute) => (
  communaute?.peutCreer === true && communaute?.genre === 'ville'
);

/**
 * Étape 1 terminée : un nom et un thème connu.
 * @param {{ nom?: string, theme?: string }} reglages
 * @returns {boolean} Vrai si « Suivant » s'active.
 */
export const etapeUnPrete = ({ nom, theme }) => (
  String(nom || '').trim().length > 0 && THEMES_COMMUNAUTE.includes(String(theme || ''))
);

/**
 * Coche ou décoche un membre.
 * @param {string[]} choisis
 * @param {string} id
 * @returns {string[]} La nouvelle liste.
 */
export const basculerMembre = (choisis, id) => (
  choisis.includes(id) ? choisis.filter((x) => x !== id) : [...choisis, id]
);

/**
 * « Tout sélectionner » : tous les candidats que le serveur a rendus (il a déjà écarté les moins de
 * 13 ans, les
 * mineurs d'un groupe d'adultes, les comptes supprimés). Si tout est déjà coché, on décoche tout.
 * @param {string[]} choisis
 * @param {{ documentId: string }[]} candidats
 * @returns {string[]} La nouvelle liste.
 */
export const toutSelectionner = (choisis, candidats) => {
  const tous = (candidats || []).map((m) => m.documentId).filter(Boolean);
  return tous.length > 0 && tous.every((id) => choisis.includes(id)) ? [] : tous;
};

/**
 * Filtre « Chercher un membre » : sur le prénom et le nom, sans accents ni majuscules.
 * @template {{ firstname?: string, lastname?: string }} C
 * @param {C[]} candidats
 * @param {string} recherche
 * @returns {C[]} Les candidats qui correspondent.
 */
export const filtrerCandidats = (candidats, recherche) => {
  const plat = (/** @type {unknown} */ s) => String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const q = plat(recherche).trim();
  if (!q) return candidats || [];
  return (candidats || []).filter((m) => plat(`${m.firstname} ${m.lastname}`).includes(q));
};

/**
 * Le corps de `POST /communautes/:genre/:id/groupes` (contrôleur du socle) : `data.{nom, theme,
 * icone, quiEcrit,
 * membres}`. L'icône n'est envoyée que si elle est choisie.
 * @param {{ nom: string, theme: string, icone?: string | null, quiEcrit: 'tous' | 'admins',
 * membres: string[] }} r
 * @returns {{ data: object }} Le corps.
 */
export const corpsDeCreation = ({
  icone, membres, nom, quiEcrit, theme,
}) => ({
  data: {
    ...(icone ? { icone } : {}),
    membres: [...new Set(membres || [])],
    nom: String(nom || '').trim(),
    quiEcrit: quiEcrit === 'admins' ? 'admins' : 'tous',
    theme,
  },
});
