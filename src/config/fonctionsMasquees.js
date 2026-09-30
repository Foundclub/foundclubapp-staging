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
