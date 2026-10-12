import { getAuthTokens } from '@/domains/auth/authUseCases';

import client from '@/services/client';

/**
 * MSG1BA (§3.15, §3.16) — LA PHOTO D'UN GROUPE (contrat MESSAGERIE-1B §4).
 *
 * `POST /api/chats/:id/group-photo` : multipart, UN fichier dans le champ `photo` (jpeg, png,
 * gif, webp ; 5 Mo au plus) ; droits : admin du groupe, ou membre si `membersCanEditPhoto`.
 * 200 = le groupe, avec `groupPhoto: { url }`. Le serveur n'accepte jamais l'identifiant d'un
 * fichier deja televerse : on envoie l'image elle-meme.
 *
 * Meme chemin d'envoi que l'avatar du profil (`authService.updateMe`) : `fetch` natif, jeton
 * en en-tete, sans `Content-Type` (le moteur pose la frontiere du formulaire) — le client HTTP
 * de l'app a des soucis connus avec un `FormData` sur Android. Si la requete n'a pas pu PARTIR
 * (exception reseau), un 2e essai passe par le client HTTP, comme les pieces jointes de la
 * messagerie. Une reponse en erreur garde son statut (`response.status`) : un 404 = serveur
 * d'avant 1B (`estUneRouteAbsente`).
 * @param {string} chatId
 * @param {any} photo - `{ uri, name, type }` au telephone, un `File` sur le site.
 * @returns {Promise<any>} Le groupe mis a jour.
 */
export const setGroupPhoto = async (chatId, photo) => {
  const formulaire = new FormData();
  if (typeof File !== 'undefined' && photo instanceof File) {
    formulaire.append('photo', photo, photo.name || 'photo.jpg');
  } else {
    formulaire.append('photo', /** @type {any} */ (photo));
  }
  const chemin = `/chats/${chatId}/group-photo`;
  const base = String(client?.defaults?.baseURL || '').replace(/\/$/, '');
  const jeton = getAuthTokens()?.token;

  let reponse;
  try {
    reponse = await fetch(`${base}${chemin}`, {
      body: formulaire,
      headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
      method: 'POST',
    });
  } catch {
    const secours = await client.post(chemin, formulaire, { timeout: 45000 });
    return secours?.data?.data ?? secours?.data;
  }

  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const message = corps?.error?.message || `HTTP ${reponse.status}`;
    const erreur = /** @type {any} */ (new Error(message));
    erreur.response = { data: corps, status: reponse.status };
    throw erreur;
  }
  return corps?.data ?? corps;
};

/**
 * MSG1BA (§3.16) — RETIRER LA PHOTO D'UN GROUPE (`DELETE /api/chats/:id/group-photo`, memes
 * droits ; sans photo : 200, rien ne change).
 * @param {string} chatId
 * @returns {Promise<any>} Le groupe mis a jour (`groupPhoto: null`).
 */
export const removeGroupPhoto = async (chatId) => {
  const reponse = await client.delete(`/chats/${chatId}/group-photo`);
  return reponse?.data?.data ?? reponse?.data;
};
