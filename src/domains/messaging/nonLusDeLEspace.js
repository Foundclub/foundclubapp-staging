/**
 * T3-PASTILLE (03/11/2026, Adel « 8- A ») — LA PASTILLE NE COMPTE QUE L'ESPACE OÙ L'ON EST.
 *
 * `meta.unreadTotal` compte tous les fils, et la liste arrive par pages de 20 : le menu de la Ville
 * disait 19 quand sa liste n'en montrait aucun. Le serveur donne donc `meta.unreadVille`, le détail
 * des fils de la Ville qui ont des non-lus, et on y applique la règle de la liste
 * (`filsDeLaMessagerie`) : la pastille et la liste ne peuvent plus se contredire.
 * Un fil qui n'est pas de la Ville est montré partout hors de la Ville : le total suffit.
 */
import { estFilDeLaVille, filsDeLaMessagerie } from '@/domains/collectivite/collectiviteCanaux';

const somme = (/** @type {any[]} */ fils) => fils.reduce(
  (total, fil) => total + Math.max(0, Number(fil?.unreadCount) || 0),
  0,
);

/**
 * Le compte de l'espace de la Ville.
 * @param {any[]} filsVille - `meta.unreadVille`.
 * @param {string | null} collectiviteId - La Ville.
 * @returns {number} Les non-lus que montre sa liste.
 */
export const nonLusDansLaVille = (filsVille, collectiviteId) => somme(
  filsDeLaMessagerie(filsVille, { collectiviteId, espaceVille: true }),
);

/**
 * Le compte des autres espaces : le total, moins ce que leur liste cache.
 * ponytail: le total est borné à 100 par le serveur ; au-delà, retirer un fil caché peut afficher
 * un peu moins que « 99+ ». Sortie : un total non borné dans la réponse si ça gêne un jour.
 * @param {number} total - `meta.unreadTotal`.
 * @param {any[]} filsVille - `meta.unreadVille`.
 * @param {{ mineur?: boolean, monClubId?: string | null }} compte - Le compte qui regarde.
 * @returns {number} Les non-lus que montre sa liste.
 */
export const nonLusHorsDeLaVille = (total, filsVille, { mineur = false, monClubId = null }) => {
  const caches = somme(filsVille) - somme(filsDeLaMessagerie(filsVille, { mineur, monClubId }));
  return Math.max(0, total - caches);
};

/**
 * La meta d'une page après la lecture d'un fil, ou son marquage « non lu ».
 * @param {any} meta - La meta de la page.
 * @param {string} chatId - Le fil.
 * @param {number} compte - Son nouveau compte.
 * @param {any[]} [chats] - Les fils de la page, pour un fil qui entre dans le détail.
 * @returns {any} La meta, détail à jour ; la même si elle n'en a pas.
 */
export const metaApresLecture = (meta, chatId, compte, chats = []) => {
  const fils = meta?.unreadVille;
  if (!Array.isArray(fils)) return meta;

  if (fils.some((fil) => fil?.documentId === chatId)) {
    return {
      ...meta,
      unreadVille: compte > 0
        ? fils.map((fil) => (fil?.documentId === chatId ? { ...fil, unreadCount: compte } : fil))
        : fils.filter((fil) => fil?.documentId !== chatId),
    };
  }

  const chat = compte > 0 ? chats.find((fil) => fil?.documentId === chatId) : null;
  if (!estFilDeLaVille(chat)) return meta;
  return { ...meta, unreadVille: [...fils, { ...chat, unreadCount: compte }] };
};
