// ASSISTANCE-MINEURS-CLUB (19/11/2026, D271) — envoyer un club dans une conversation
// (téléphone et site).
//
// L'app n'envoie que l'identifiant du club : le serveur relit le club en base et réécrit la
// carte (nom, ville, logo, sport), puis remplace le texte par « Club : <nom> »
// (`admin/src/api/chat-message/services/carte-de-club.ts`). Le texte envoyé ici n'est donc que
// l'aperçu affiché avant la réponse du serveur.

export const CLUB_SHARE_TYPE = 'club_share';

/**
 * La composition envoyée : l'identifiant, plus le nom pour l'aperçu local.
 * @param {{ documentId?: string, name?: string } | null | undefined} club - Le club choisi.
 * @returns {{ type: string, clubDocumentId: string, clubName: string }} La composition.
 */
export const compositionDuClubPartage = (club) => ({
  clubDocumentId: String(club?.documentId || '').trim(),
  clubName: String(club?.name || '').trim(),
  type: CLUB_SHARE_TYPE,
});

/**
 * Le texte du message, le même que celui que le serveur écrit.
 * @param {(key: string, fallback: string, options?: object) => string} t - La traduction.
 * @param {string | undefined} nom - Le nom du club.
 * @returns {string} « Club : <nom> ».
 */
export const texteDuClubPartage = (t, nom) => t(
  'conversation.shareClub.messageText',
  'Club : {{name}}',
  { interpolation: { escapeValue: false }, name: String(nom || '').trim() },
);

/**
 * Les clubs proposés par `ConversationClubPicker` : 40 au plus, sans doublon.
 * ponytail: les omnisports (`_type: 'multisport'`) sont écartés, la carte serveur ne lit que
 * les clubs ; sortie : lire aussi `api::multisport-club` dans `carte-de-club.ts`.
 * @param {string} texte - Ce que la personne a tapé (rien sous 2 lettres).
 * @param {any[]} pages - Les pages de résultats de `/search/clubs`.
 * @param {(page: any) => any[]} lireLaPage - `mapSearchPayload`, passé par l'écran.
 * @returns {any[]} Les clubs.
 */
export const clubsAProposer = (texte, pages, lireLaPage) => {
  if (String(texte || '').trim().length < 2) return [];
  const vus = new Set();
  return (Array.isArray(pages) ? pages : [])
    .flatMap((page) => lireLaPage(page) || [])
    .filter((club) => {
      const documentId = String(club?.documentId || '').trim();
      const omnisport = Reflect.get(club || {}, '_type') === 'multisport';
      if (!documentId || vus.has(documentId) || omnisport) return false;
      vus.add(documentId);
      return true;
    })
    .slice(0, 40);
};
