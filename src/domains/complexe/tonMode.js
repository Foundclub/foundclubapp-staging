/**
 * LA BASCULE « TON MODE » — RESA-BASCULE (20/10/2026), planche RB-3 validée par Adel
 * (« parent-gérant A », 20/10 vers 13 h 05 ; « ok c'est bon on suit tes reco », 13 h 40, T2 A).
 *
 * UN seul contrôle, au même endroit, pour un compte qui GÈRE UN COMPLEXE : il ne montre que les
 * modes que le compte possède, dans un ordre FIXE — Complexe · Dirigeant (ou Coach) · Joueur ·
 * Parent. La position choisie est en cyan. La bascule change ce qu'on voit, JAMAIS ce qu'on a le
 * droit de faire : les deux réglages gardés sur le téléphone (le mode d'affichage,
 * `domains/auth/playerMode.js`, et le mode complexe, `modeComplexe.js`) ne changent pas, rien ne
 * part au serveur.
 *
 * Ce fichier ne touche ni le réseau ni un écran : les règles, que les témoins lisent sans rien
 * monter. Témoin : `tonMode.test.js`.
 */

/** @typedef {'complexe' | 'dirigeant' | 'coach' | 'joueur' | 'parent'} CleDePosition */
/** @typedef {'player' | 'parent' | null} ModeDAffichage */
/**
 * Une position : sa clé, et le mode d'affichage qu'elle pose en dehors du complexe (rien = le rôle
 * du compte).
 * @typedef {{ cle: CleDePosition, mode: ModeDAffichage }} Position
 */

/** L'ordre fixe de la planche : Complexe · Dirigeant (ou Coach) · Joueur · Parent. */
export const ORDRE_DES_POSITIONS = Object.freeze(
  /** @type {CleDePosition[]} */ (['complexe', 'dirigeant', 'coach', 'joueur', 'parent']),
);

/** La position que porte chaque rôle du COMPTE (le super admin et un compte neuf n'en ont pas). */
const POSITION_DU_ROLE = Object.freeze(/** @type {Record<string, CleDePosition>} */ ({
  coach: 'coach',
  parent: 'parent',
  player: 'joueur',
  president: 'dirigeant',
}));

/**
 * Les positions d'un compte, dans l'ordre de la planche.
 *   · Complexe : s'il gère un complexe ;
 *   · la position de son rôle (Dirigeant, Coach, Joueur ou Parent), qui ne pose AUCUN mode ;
 *   · Joueur : un dirigeant ou un coach qui joue dans une équipe (le mode joueur, LOT RÔLES) ;
 *   · Parent : un joueur, un coach ou un dirigeant qui a des enfants (le mode parent, PAR-L12).
 * @param {{
 *   aDesEnfants: boolean,
 *   aUnComplexe: boolean,
 *   peutJouer: boolean,
 *   roleDuCompte: string,
 * }} compte - Ce que l'app sait déjà du compte.
 * @returns {Position[]} Les positions (une seule = pas de contrôle).
 */
export const positionsDuCompte = ({
  aDesEnfants, aUnComplexe, peutJouer, roleDuCompte,
}) => {
  const role = String(roleDuCompte || '');
  const positionDuRole = POSITION_DU_ROLE[role];
  const encadre = role === 'president' || role === 'coach';
  /** @type {Position[]} */
  const positions = [];
  if (aUnComplexe) positions.push({ cle: 'complexe', mode: null });
  if (positionDuRole) positions.push({ cle: positionDuRole, mode: null });
  if (encadre && peutJouer) positions.push({ cle: 'joueur', mode: 'player' });
  if (positionDuRole && role !== 'parent' && aDesEnfants) {
    positions.push({ cle: 'parent', mode: 'parent' });
  }
  return positions.sort((a, b) => (
    ORDRE_DES_POSITIONS.indexOf(a.cle) - ORDRE_DES_POSITIONS.indexOf(b.cle)
  ));
};

/**
 * La position allumée : Complexe dans l'espace du complexe, sinon le mode d'affichage actif, sinon
 * le rôle du compte.
 * @param {{
 *   dansLeComplexe: boolean,
 *   modeAffiche: ModeDAffichage,
 *   roleDuCompte: string,
 * }} etat - Où l'on est, et ce qu'on voit.
 * @returns {CleDePosition | null} La position, ou rien.
 */
export const positionActive = ({ dansLeComplexe, modeAffiche, roleDuCompte }) => {
  if (dansLeComplexe) return 'complexe';
  if (modeAffiche === 'player') return 'joueur';
  if (modeAffiche === 'parent') return 'parent';
  return POSITION_DU_ROLE[String(roleDuCompte || '')] || null;
};

/** Mesuré sur la planche (Montserrat 13 px gras, « Complexe » 68 px) : 90 px par position. */
export const LARGEUR_D_UNE_POSITION = 90;

/** L'écart entre deux positions (`.piste`, 8 px). */
const ECART = 8;

/**
 * Combien de positions par rangée : 2 ou 3 sur une ligne, 4 en deux rangées de deux (T2 A) ; et UNE
 * par rangée dès qu'un libellé ne tiendrait plus en entier (texte très agrandi, planche 4c).
 * @param {{ echelleDuTexte?: number, largeur?: number, nombre: number }} mesure - Le nombre de
 *   positions, la largeur disponible (rien tant qu'elle n'est pas mesurée), l'échelle du texte.
 * @returns {number} Le nombre de colonnes.
 */
export const colonnesDuTonMode = ({ echelleDuTexte = 1, largeur, nombre }) => {
  if (nombre <= 1) return 1;
  const voulues = nombre >= 4 ? 2 : nombre;
  if (!largeur) return voulues;
  const parPosition = (largeur - ECART * (voulues - 1)) / voulues;
  return parPosition >= LARGEUR_D_UNE_POSITION * Math.max(1, echelleDuTexte) ? voulues : 1;
};

/** À partir de cette largeur, le site montre ses menus latéraux (index.css, 1 024 px). */
export const LARGEUR_DES_MENUS_DU_SITE = 1024;

/**
 * Sur le site, à partir de 1 024 px, la bascule vit EN BAS DU MENU quand l'espace en a un : le
 * complexe, et le club d'un dirigeant ou d'un coach (`web/src/layout/menuDuClub.ts`) ; l'accueil ne
 * la répète pas. Un joueur ou un parent n'a pas de menu latéral : la bascule reste en tête de son
 * accueil, sur une ligne (planche O2).
 * @param {{
 *   dansLeComplexe: boolean,
 *   largeur: number,
 *   plateforme: string,
 *   roleDuCompte: string,
 * }} ecran - L'écran, et le compte.
 * @returns {boolean} Vrai si la bascule est dans le menu.
 */
export const dansLeMenuDuSite = ({
  dansLeComplexe, largeur, plateforme, roleDuCompte,
}) => plateforme === 'web'
  && largeur >= LARGEUR_DES_MENUS_DU_SITE
  && (dansLeComplexe || roleDuCompte === 'president' || roleDuCompte === 'coach');

// L'ANNONCE D'ARRIVÉE (planche 5b) : la bascule vers le complexe la demande, l'espace du complexe
// la prend en s'ouvrant (« Mode complexe. Tu gères … », puis le curseur sur le nom). Un drapeau à
// un coup : un lancement de l'app sur le complexe, lui, n'annonce rien.
let annonceDArrivee = false;

/** La bascule vers le complexe vient d'être choisie. */
export const demanderLAnnonceDArrivee = () => {
  annonceDArrivee = true;
};

/**
 * L'espace du complexe s'ouvre : faut-il annoncer l'arrivée ? (le drapeau retombe)
 * @returns {boolean} Vrai une seule fois après chaque demande.
 */
export const prendreLAnnonceDArrivee = () => {
  const annoncer = annonceDArrivee;
  annonceDArrivee = false;
  return annoncer;
};
