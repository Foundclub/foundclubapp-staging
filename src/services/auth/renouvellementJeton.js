import {
  dispatchAuthRuntimeAction,
  getAuthRuntimeSnapshot,
} from '@/store/authRuntime';

// T3-SESSION-B (03/11/2026, fiche 25, option B) : sans ce renouvellement, un jeton meurt
// 30 jours après la connexion, même si l'on vient chaque jour. Ce module ne déconnecte jamais
// par lui-même : un échec garde l'ancien jeton. Seul un 401 reste une déconnexion, par
// l'intercepteur, comme pour tout autre appel.
const AGE_AVANT_RENOUVELLEMENT_S = 7 * 24 * 3600;
const PAUSE_APRES_ECHEC_MS = 3600 * 1000;
const CLES_LIEES_AU_JETON = ['get-me', 'app-bootstrap'];
const ALPHABET_BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

let renouvellementEnCours = false;
let prochainEssaiMs = 0;
/** @type {any} */
let cacheDesSessions;

// Le cache porte `get-me` et `app-bootstrap` sous le jeton : sans recopie, le site repasse par
// son écran de chargement, qui démonte un formulaire en cours.
export const enregistrerCacheDesSessions = (/** @type {any} */ queryClient) => {
  cacheDesSessions = queryClient;
};

export const reinitialiserRenouvellementJeton = () => {
  renouvellementEnCours = false;
  prochainEssaiMs = 0;
};

// ponytail: décodage à la main, parce que `atob` n'est pas prouvé dans Hermes et qu'un manque
// ici couperait en silence le renouvellement du téléphone. Limite : du JSON ASCII seulement,
// ce qu'est `iat`.
const decoderBase64Url = (/** @type {string} */ texte) => {
  let bits = 0;
  let nombreDeBits = 0;
  let sortie = '';
  Array.from(texte).forEach((caractere) => {
    bits = (bits % 256) * 64 + ALPHABET_BASE64URL.indexOf(caractere);
    nombreDeBits += 6;
    if (nombreDeBits >= 8) {
      nombreDeBits -= 8;
      sortie += String.fromCharCode(Math.floor(bits / 2 ** nombreDeBits) % 256);
    }
  });
  return sortie;
};

const aRenouveler = (/** @type {any} */ jeton, /** @type {number} */ maintenantMs) => {
  try {
    const { iat } = JSON.parse(decoderBase64Url(String(jeton).split('.')[1]));
    return Number.isFinite(iat) && maintenantMs / 1000 - iat >= AGE_AVANT_RENOUVELLEMENT_S;
  } catch {
    return false;
  }
};

const recopierDonneesDuCompte = (/** @type {string} */ ancien, /** @type {string} */ jeton) => {
  CLES_LIEES_AU_JETON.forEach((cle) => {
    const donnees = cacheDesSessions?.getQueryData([cle, ancien]);
    if (donnees !== undefined) cacheDesSessions.setQueryData([cle, jeton], donnees);
  });
};

const renouvelerUnJeton = async (/** @type {any} */ client, /** @type {string} */ ancienJeton) => {
  const reponse = await client.post('/firebase-auth/me/renew-token', undefined, {
    headers: { Authorization: `Bearer ${ancienJeton}` },
  });
  const jeton = reponse?.data?.jwt;
  if (typeof jeton !== 'string' || !jeton) return false;
  if (/** @type {any} */ (getAuthRuntimeSnapshot())?.auth?.token === ancienJeton) {
    recopierDonneesDuCompte(ancienJeton, jeton);
  }
  dispatchAuthRuntimeAction({ payload: { ancienJeton, jeton }, type: 'RENEW_SESSION_TOKEN' });
  return true;
};

/**
 * Appelé après chaque réponse réussie : c'est l'usage qui prolonge la session. Ne rejette jamais.
 * @param {any} client - Le client HTTP de la plateforme.
 */
export const renouvelerJetonsSiBesoin = (client) => {
  const maintenantMs = Date.now();
  if (renouvellementEnCours || maintenantMs < prochainEssaiMs) return;

  const { auth, authSessions } = /** @type {any} */ (getAuthRuntimeSnapshot()) || {};
  const jetons = [...new Set([auth, ...(authSessions || [])].map((session) => session?.token))]
    .filter((jeton) => jeton && aRenouveler(jeton, maintenantMs));
  if (!jetons.length) return;

  renouvellementEnCours = true;
  Promise.allSettled(jetons.map((jeton) => renouvelerUnJeton(client, jeton)))
    .then((resultats) => {
      if (resultats.some((resultat) => resultat.status === 'rejected' || !resultat.value)) {
        prochainEssaiMs = maintenantMs + PAUSE_APRES_ECHEC_MS;
      }
      renouvellementEnCours = false;
    });
};
