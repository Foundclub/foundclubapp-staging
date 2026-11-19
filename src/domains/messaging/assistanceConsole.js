// ASSISTANCE-MINEURS-CLUB (19/11/2026, D271, partie A) — « Contacter » depuis la console.
//
// Décisions d'Adel du 19/11 (« A1 A / A2 A ») : l'équipe écrit à un mineur par le fil d'ASSISTANCE
// du compte (signé « Assistance FoundClub », nom de l'admin gardé côté serveur), jamais par un
// tête-à-tête sous son nom réel. Le serveur refuse ce tête-à-tête (MINOR_DIRECT_CHAT_FORBIDDEN) ;
// sur ce refus, la console ouvre le fil d'assistance (`POST /assistance/conversations/pour/:id`).
// Un majeur, ou un ado dont l'admin est vraiment l'entraîneur : le tête-à-tête, comme avant.

/**
 * Ce refus est-il celui du garde-fou des mineurs ?
 * @param {any} error - L'erreur du client.
 * @returns {boolean} Vrai pour MINOR_DIRECT_CHAT_FORBIDDEN.
 */
export const estUnRefusMineur = (error) => String(
  error?.response?.data?.error?.details?.code
  || error?.details?.code
  || error?.code
  || '',
).trim() === 'MINOR_DIRECT_CHAT_FORBIDDEN';

/**
 * Ouvre la conversation avec ce compte depuis la console.
 * @param {string} cible - Le compte (documentId).
 * @param {object} gestes - Les appels (passés par l'écran : ce module reste sans service).
 * @param {(ids: string[]) => Promise<any>} gestes.startWhisperChat - Le tête-à-tête.
 * @param {(id: string) => Promise<any>} gestes.ouvrirPour - Le fil d'assistance de ce compte.
 * @returns {Promise<{ chatId: string, chatType?: string } | null>} Le fil à ouvrir, ou null.
 */
export const contacterDepuisLaConsole = async (cible, { ouvrirPour, startWhisperChat }) => {
  try {
    const chat = await startWhisperChat([cible]);
    return chat?.documentId ? { chatId: chat.documentId } : null;
  } catch (error) {
    if (!estUnRefusMineur(error)) throw error;
    const fil = await ouvrirPour(cible);
    return fil?.documentId ? { chatId: fil.documentId, chatType: 'assistance' } : null;
  }
};
