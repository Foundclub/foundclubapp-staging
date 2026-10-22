// @ts-nocheck
/**
 * app/src/platform/media/enregistrerLImage.web.js
 *
 * Jumeau WEB de `enregistrerLImage.native.js` (MSGIMG) : sur le site, « Enregistrer »
 * TELECHARGE l'image — c'est le navigateur qui la range (dossier Telechargements, ou la
 * question « Enregistrer sous » selon ses reglages).
 *
 * 🧩 Le geste est celui de `downloadRemoteFile.web.js` et `saveTextFile.web.js` :
 * fichier lu -> Blob -> URL objet -> `<a download>`. Un simple `<a download>` vers
 * l'adresse de l'image ne suffit PAS : les images vivent sur le stockage (Cloudflare R2),
 * un AUTRE domaine que le site, et le navigateur ignore `download` d'un autre domaine —
 * il ouvrirait l'image au lieu de la telecharger.
 *
 * 🛟 SI LE STOCKAGE REFUSE LA LECTURE (CORS non ouvert pour le site) : `fetch` echoue par
 * une `TypeError`. On ne laisse pas la personne sans rien — l'image s'ouvre alors dans un
 * nouvel onglet, d'ou on l'enregistre (issue `ouverte`, l'ecran le dit). Une erreur HTTP
 * (404, 403…) n'ouvre rien : l'onglet n'aurait rien a montrer.
 *
 * La forme de retour et les raisons d'echec sont IDENTIQUES au jumeau natif.
 */

import { extensionDeLUrl } from '@/platform/media/downloadRemoteFile';

/** Meme vocabulaire d'echec que le jumeau natif. */
export const ECHECS_D_ENREGISTREMENT = {
  HTTP: 'http_error',
  PERMISSION: 'permission_refusee',
  SANS_ADRESSE: 'no_url',
};

/**
 * Une erreur qui porte sa raison.
 * @param {string} raison Une valeur de ECHECS_D_ENREGISTREMENT.
 * @param {string} message Le message, pour les journaux.
 * @returns {Error} L'erreur.
 */
const echec = (raison, message) => {
  const erreur = new Error(message);
  erreur.reason = raison;
  return erreur;
};

/**
 * Clique un lien jetable.
 * @param {Record<string, string>} attributs Les attributs du lien.
 */
const cliquerUnLien = (attributs) => {
  const lien = document.createElement('a');
  Object.entries(attributs).forEach(([nom, valeur]) => lien.setAttribute(nom, valeur));
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
};

/**
 * Telecharge l'image (ou, a defaut, l'ouvre dans un nouvel onglet).
 * @param {string} url L'adresse de l'image.
 * @returns {Promise<{ issue: 'telechargee' | 'ouverte' }>} L'issue.
 */
export const enregistrerLImage = async (url) => {
  const adresse = String(url || '').trim();
  if (!adresse) {
    throw echec(ECHECS_D_ENREGISTREMENT.SANS_ADRESSE, 'Aucune adresse d image a enregistrer.');
  }
  const nom = `foundclub-image.${extensionDeLUrl(adresse, 'jpg')}`;

  let reponse;
  try {
    reponse = await fetch(adresse, { mode: 'cors' });
  } catch {
    cliquerUnLien({ href: adresse, rel: 'noopener', target: '_blank' });
    return { issue: 'ouverte' };
  }
  if (!reponse.ok) {
    const erreur = echec(
      ECHECS_D_ENREGISTREMENT.HTTP,
      `Le serveur a refuse l image (${reponse.status}).`,
    );
    erreur.status = reponse.status;
    throw erreur;
  }

  const objet = URL.createObjectURL(await reponse.blob());
  try {
    cliquerUnLien({ download: nom, href: objet, rel: 'noopener' });
  } finally {
    // Laisse le navigateur amorcer le telechargement avant de revoquer l'adresse.
    setTimeout(() => URL.revokeObjectURL(objet), 10000);
  }
  return { issue: 'telechargee' };
};

export default { ECHECS_D_ENREGISTREMENT, enregistrerLImage };
