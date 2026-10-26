import { personneDansLeFil } from '@/domains/messaging/anonymatDeLigue';

/**
 * 🧭 T19-RESTES (08/10) — QUI PORTE QUEL NOM DANS UN FIL : UNE seule règle pour les quatre
 * endroits qui nomment un membre d'après son identifiant (la bulle et le détail d'un sondage, sur
 * le téléphone et sur le site ; la bulle du téléphone s'en sert aussi pour « … écrit »).
 *
 * 🐞 Le défaut (T19, recette) : « Créé par mouri nio » sur un sondage de Karim Benali, et son vote
 * nommé « mouri nio » sur le site. Le serveur garde dans CHAQUE message une copie FIGÉE du nom
 * de son auteur au moment de l'envoi (`lightPayloadSnapshot`) : Karim s'appelait « mouri nio »
 * quand il a écrit ses messages du 28-29/09. Chaque écran inscrivait ses sources dans un ordre où
 * le PLUS VIEUX message passait en dernier — et gagnait, contre le compte connecté et contre les
 * messages récents (journal : `.recette/t19r/JOURNAL_voterDirectory_site.txt`).
 *
 * ✅ La règle : pour chaque identifiant, la PREMIÈRE source qui donne un nom l'emporte, de la
 * plus fraîche à la plus figée :
 *   1. les votants lus au serveur (`poll-voters`) — le nom d'aujourd'hui, « Compte supprimé » ;
 *   2. les participants du fil — lus au serveur à l'ouverture du fil ;
 *   3. le compte connecté — sa fiche sur l'appareil ;
 *   4. l'auteur des messages chargés, du PLUS RÉCENT au plus ancien (copies figées). Un message
 *      sans date (envoi en cours) compte comme le plus récent.
 * L'avatar suit la même règle : la première source qui en a un.
 * Le repli (« Membre ») reste à chaque écran : ici, une personne inconnue n'a pas d'entrée.
 * ANONSITE : donné, `chat` applique l'anonymat d'un fil de ligue (anonymatDeLigue.js) : avant
 * le match, un adversaire est « Joueur Adverse », sans photo, même si le serveur le nomme.
 * @param {{ chat?: any, messages?: any[] | null, participants?: any[] | null, userData?: any,
 *   votants?: Iterable<any> | Map<string, any> | null }} [sources] Les sources de l'écran.
 * @returns {Map<string, any>} La personne retenue (`firstname`, `lastname`, `avatar`…), par
 *   identifiant (`documentId`, sinon `id`).
 */
export default function annuaireDesMembres({
  chat = null, messages = [], participants = [], userData = null, votants = [],
} = {}) {
  const identifiantDe = (/** @type {any} */ personne) => String(
    personne?.documentId || personne?.id || '',
  ).trim();
  const aUnNom = (/** @type {any} */ personne) => Boolean(
    String(personne?.firstname || '').trim() || String(personne?.lastname || '').trim(),
  );
  const dateDe = (/** @type {any} */ message) => {
    const instant = Date.parse(message?.createdAt || '');
    return Number.isNaN(instant) ? Infinity : instant;
  };

  const auteurs = (Array.isArray(messages) ? messages : [])
    .map((message, rang) => ({ date: dateDe(message), rang, sender: message?.sender }))
    .sort((a, b) => (b.date - a.date) || (a.rang - b.rang))
    .map(({ sender }) => sender);
  const sources = [
    ...(votants instanceof Map ? votants.values() : (votants || [])),
    ...(Array.isArray(participants) ? participants : []),
    userData,
    ...auteurs,
  ];

  /** @type {Map<string, { avatar: any, personne: any }>} */
  const retenus = new Map();
  sources.forEach((personne) => {
    const id = identifiantDe(personne);
    if (!id) return;
    const deja = retenus.get(id);
    if (!deja) {
      retenus.set(id, { avatar: personne?.avatar?.url ? personne.avatar : null, personne });
      return;
    }
    if (!aUnNom(deja.personne) && aUnNom(personne)) deja.personne = personne;
    if (!deja.avatar && personne?.avatar?.url) deja.avatar = personne.avatar;
  });

  return new Map([...retenus].map(([id, { avatar, personne }]) => {
    const retenu = { ...personne, avatar: avatar || personne?.avatar || null };
    const montre = personneDansLeFil({
      chat, moiId: String(userData?.documentId || ''), personne: { ...retenu, documentId: id },
    });
    return [id, montre?.anonyme ? montre : retenu];
  }));
}
