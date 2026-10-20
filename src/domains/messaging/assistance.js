/**
 * MSG-SUPPORT (20/10/2026) — LA CONVERSATION « ASSISTANCE FOUNDCLUB », côté app et site.
 *
 * Chaque compte a UNE conversation avec l'équipe FoundClub (serveur : `api/chat/services/
 * assistance.ts`). Elle est épinglée en tête de Messages pour tout le monde, même avant le premier
 * message ; les super-admins la lisent depuis une boîte commune de la console.
 *
 * 🗣️ Une réponse de l'équipe porte la signature `{ nom: 'Assistance FoundClub', voix:
 *    'assistance' }`, et le serveur a déjà remplacé son expéditeur par une identité neutre : le nom
 *    de l'admin n'arrive jamais jusqu'ici. La console le relit à part (« qui a répondu »).
 */

export const ASSISTANCE_CHAT_TYPE = 'assistance';
export const ASSISTANCE_NOM = 'Assistance FoundClub';

/**
 * Ce fil est-il une conversation d'assistance ?
 * @param {any} chat - Le fil (ou son type).
 * @returns {boolean} Vrai pour `assistance`.
 */
export const estFilDAssistance = (chat) => (
  String((typeof chat === 'string' ? chat : chat?.type) || '').trim() === ASSISTANCE_CHAT_TYPE
);

/**
 * Ce message est-il une réponse de l'équipe FoundClub ?
 * @param {any} message - Le message.
 * @returns {boolean} Vrai si sa signature est celle de l'assistance.
 */
export const estReponseDeLAssistance = (message) => (
  String(message?.senderSignature?.voix || '') === 'assistance'
);

/**
 * La liste des conversations, sans la conversation d'assistance (épinglée à part), et celle-ci.
 * @param {any[]} fils - Les fils de la liste.
 * @returns {{ autres: any[], filDAssistance: any | null }} Les deux morceaux.
 */
export const separerLeFilDAssistance = (fils) => {
  const liste = Array.isArray(fils) ? fils : [];
  return {
    autres: liste.filter((fil) => !estFilDAssistance(fil)),
    filDAssistance: liste.find(estFilDAssistance) || null,
  };
};

/**
 * Le titulaire de la conversation (son seul participant).
 * @param {any} chat - Le fil.
 * @returns {any | null} Le compte, ou null.
 */
export const titulaireDuFil = (chat) => (
  Array.isArray(chat?.participants) && chat.participants.length > 0 ? chat.participants[0] : null
);

/**
 * « Sophie A. » — le nom court d'un membre de l'équipe, pour la console.
 * @param {{ firstname?: string, lastname?: string } | null | undefined} personne - L'admin.
 * @returns {string} Le prénom et l'initiale du nom, ou ''.
 */
export const nomCourt = (personne) => {
  const prenom = String(personne?.firstname || '').trim();
  const nom = String(personne?.lastname || '').trim();
  return [prenom, nom ? `${nom[0].toUpperCase()}.` : ''].filter(Boolean).join(' ');
};
