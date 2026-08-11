import client from '@/services/client';

// Meme deballage que `bootstrapService` : le controleur D76 rend l'objet nu
// (`ctx.send(data)`), mais lire les deux formes coute une ligne et survit a un
// enveloppage futur.
const unwrapResponse = (/** @type {any} */ response) => (
  response?.data?.data || response?.data || null
);

/**
 * D78 — `GET /app/home-summary` (route livree par le lot serveur D76).
 *
 * ⛔ CE SERVICE NE PREND AUCUN PARAMETRE, ET C'EST LE POINT : le serveur deduit
 * le perimetre du porteur du jeton. Un compteur par club ou par equipe
 * multiplierait les appels — l'accueil porte jusqu'a 20 cartes.
 * @returns {Promise<any | null>} Le resume, ou `null` si la reponse est vide.
 */
export const getHomeSummary = async () => {
  const response = await client.get('/app/home-summary');

  return unwrapResponse(response);
};
