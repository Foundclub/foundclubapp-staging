// 🙈 FONCTIONS MASQUÉES — les interrupteurs qui CACHENT une fonction sans la supprimer.
//
// Décisions d'Adel du 2026-09-30 (audit V1) : on retire de l'accueil ce qui n'est
// pas prêt, « on fera plus tard », mais le code RESTE en place. Chaque constante
// ci-dessous est la SEULE ligne à changer pour rallumer sa fonction : passer à
// `true`, relancer les témoins qui la citent, c'est tout.
//
// 📋 Le registre lisible par un humain (qui l'a décidé, ce qui est caché, comment
// le rallumer) : `D:/App/fc/FONCTIONS_MASQUEES.md`, à la racine du dépôt méthode.
//
// ⚠️ Un interrupteur MASQUE, il ne VERROUILLE rien : les écrans restent joignables
// par les notifications et les liens, et le serveur ne change pas. Ce n'est donc
// jamais une protection — seulement une mise en avant retirée.

/**
 * A01 + A02 — FoundClub League sur l'accueil.
 * `false` : la rubrique « FoundClub League » disparaît de l'accueil, le logo en
 * haut à gauche n'est plus un interrupteur (il ramène en haut de l'accueil), et un
 * mode League mémorisé d'un lancement précédent est ignoré au démarrage.
 * @type {boolean}
 */
export const LEAGUE_SUR_ACCUEIL = false;

/**
 * A07 — la case « Réservations » de la rubrique « Rechercher » de l'accueil.
 * `false` : la case est retirée pour tous les rôles. La page « Bientôt disponible »
 * (`SearchHubScreen.js`) et l'onglet grisé de la recherche restent en place.
 * @type {boolean}
 */
export const RESERVATIONS_SUR_ACCUEIL = false;

/**
 * RESA-L5A1 (13/10/2026) — l'espace du GÉRANT DE COMPLEXE (chantier Réservation) :
 *   · l'entrée « Je gère un complexe » de « Mon compte » ;
 *   · la bascule « mode complexe / mode joueur » en tête de l'accueil ;
 *   · l'arrivée en mode complexe au lancement ;
 *   · les écrans du gérant (devenir gérant, accueil, terrains, créneaux, réglages).
 * `false` : rien de tout cela n'est atteignable (les écrans ne sont même pas déclarés dans la
 * navigation) et aucune route du serveur des complexes n'est lue — ce serveur (RESA-L1A / L1B)
 * n'est livré ni en recette ni en production (Adel, 13/10 : « plus tard »).
 * Rallumer : `true` quand le serveur est en ligne, puis `grep -rn COMPLEXES_GERANT src` et
 * relancer les témoins qui l'attendent éteint (RB.bascule.test.js, fonctionsMasquees.test.js).
 * @type {boolean}
 */
export const COMPLEXES_GERANT = false;

/**
 * RESA-L6A (14/10/2026) — la RÉSERVATION D'UN TERRAIN, CÔTÉ JOUEUR (chantier Réservation) :
 *   · le panneau « Réservations » de la recherche (E-P01) au lieu de « Bientôt disponible », et
 *     l'onglet qui s'active au lieu d'expliquer ;
 *   · les écrans du joueur (page du complexe, créneaux, récapitulatif, résultat, ma réservation,
 *     messages d'échec) ;
 *   · l'aiguillage des notifications `complexeReservationJoueur` vers « Ma réservation ».
 * `false` : rien de tout cela n'est atteignable (les écrans ne sont même pas déclarés) et aucune
 * route du serveur des complexes n'est lue — ce serveur (RESA-L1A / L1B / L2A) n'est livré ni en
 * recette ni en production. ⚠️ La case « Réservations » de l'accueil reste gardée par
 * `RESERVATIONS_SUR_ACCUEIL` : la rallumer = GO d'Adel (fonction visible de tous).
 * Rallumer : `true` quand le serveur est en ligne, puis `grep -rn COMPLEXES_JOUEUR src` et relancer
 * les témoins qui l'attendent éteint (fonctionsMasquees.test.js, SearchTypeSwitcher,
 * SearchHubScreen).
 * @type {boolean}
 */
export const COMPLEXES_JOUEUR = false;

/**
 * Les cases de l'accueil que les interrupteurs éteints retirent, par leur clef
 * (`key` des cartes de `HomeHub.js`). Une LISTE NOMMÉE plutôt qu'une garde sur
 * chaque case : même motif que les cases retirées au parent
 * (`CARTES_MASQUEES_AU_PARENT`), et les témoins la lisent ICI au lieu d'en
 * recopier une seconde.
 * @type {ReadonlyArray<string>}
 */
export const CARTES_ACCUEIL_MASQUEES = Object.freeze([
  ...(LEAGUE_SUR_ACCUEIL ? [] : ['league-entry']),
  ...(RESERVATIONS_SUR_ACCUEIL ? [] : ['search-reservations']),
]);
