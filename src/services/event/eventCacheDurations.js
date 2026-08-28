// ⏱️ LES DUREES DE FRAICHEUR DU CACHE D'EVENEMENT — ET POURQUOI ELLES VIVENT ICI.
//
// 🎯 EVEDIT-3. Ce chiffre est lu par DEUX endroits qui doivent absolument
// s'accorder : le LECTEUR de la fiche d'edition (`eventQueries.js`) et son
// PRECHARGEUR (`EventDetails.js`, au toucher de « Modifier »). Quand le
// prechargeur demandait une fraicheur differente — en l'occurrence aucune — il
// repartait au reseau a CHAQUE appui, meme deux secondes apres le precedent.
//
// 🧱 POURQUOI UN FICHIER A LUI SEUL, ET PAS `eventQueries.js` : ce module-la
// importe `eventService`, donc le client HTTP, donc `API_URL` — absente de
// toute copie de travail. Tout temoin qui voudrait lire la constante depuis
// `eventQueries` devrait doubler le module entier, et se retrouverait a
// recopier le chiffre a la main : le jour ou la production changerait, le
// temoin resterait vert sur une valeur qui n'existe plus. Ici, il n'y a AUCUN
// import — la constante est lisible telle quelle, partout.
//
// ⛔ NE PAS RACCOURCIR CES DUREES sans mesure : elles sont ce qui empeche
// l'application de redemander la meme fiche en rafale.

/**
 * Duree pendant laquelle la fiche d'un evenement est consideree fraiche.
 * @type {number}
 */
export const EVENT_DETAIL_STALE_MS = 30_000;

export default EVENT_DETAIL_STALE_MS;
