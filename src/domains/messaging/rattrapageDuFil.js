import { getChatMessages } from '@/services/chat/chatService';

import { createLogger } from '@/utils/logger/logger';

// MSGNOTIF (20/10) — LE RATTRAPAGE D'UN FIL APRÈS UNE COUPURE.
//
// Le fil d'une conversation vit dans le cache de react-query, tenu à jour par la
// socket (`useMessaging` › `handleNewMessage`). Tant qu'elle est branchée, ce
// cache est juste, et rien ne le relit jamais : `refetchOnMount` et
// `refetchOnWindowFocus` valent false (`chatQueries.js`).
//
// 📱 Mais un iPhone suspend l'app en arrière-plan et coupe la socket : ce qui
// est écrit pendant ce temps n'arrivera JAMAIS par le fil. Avant ce lot, rien
// ne le relisait — ni la notification touchée, ni le retour au premier plan, ni
// le `joined` qui suit la reconnexion (il sautait la relecture dès qu'un cache
// existait). Le message manquait jusqu'à ce qu'on tue l'app (Adel, 19/10).
//
// ⚖️ ON FUSIONNE LA PAGE LA PLUS RÉCENTE, ON NE RELIT PAS TOUT :
//   - une relecture complète REMPLACE le cache : elle effacerait une bulle pas
//     encore partie (`pending`) ou en échec (`failed`) — le texte tapé
//     disparaîtrait sans un mot ;
//   - elle relirait aussi chaque page déjà chargée ; une seule suffit.

const rattrapageLogger = createLogger('messaging-rattrapage');

/** Un rattrapage en vol par fil : la liste ET la conversation reçoivent le même `joined`. */
const rattrapagesEnCours = new Map();
/** Le rattrapage de la liste en vol (tous les crochets le demandent). @type {Promise<void>|null} */
let rattrapageDeLaListe = null;

/**
 * MSGNOTIF2 — relit la liste des fils (aperçus, non-lus, que le serveur seul sait
 * compter) : après une coupure, ou quand un fil rattrapé montre qu'il manquait un
 * message. Toutes les requêtes `['chats']` sont relues, à l'écran ou en veille (la
 * pastille s'affiche hors de la liste) ; une seule relecture en vol à la fois.
 * @param {import('@tanstack/react-query').QueryClient} queryClient Le cache de l'app.
 * @returns {Promise<void>} Quand la liste est relue.
 */
export const rattraperLaListe = (queryClient) => {
  if (!queryClient) return Promise.resolve();
  if (rattrapageDeLaListe) return rattrapageDeLaListe;
  rattrapageDeLaListe = queryClient
    .refetchQueries({ queryKey: ['chats'], type: 'all' }, { cancelRefetch: false })
    .catch(() => {})
    .finally(() => { rattrapageDeLaListe = null; });
  return rattrapageDeLaListe;
};

/**
 * L'identifiant serveur d'un message.
 * @param {any} message Un message du fil.
 * @returns {string} Son identifiant ('' s'il n'en a pas).
 */
const idDuMessage = (message) => String(message?.documentId || message?.id || '').trim();

/**
 * Une bulle que le serveur n'a pas (encore) confirmée.
 * @param {any} message Un message du fil.
 * @returns {boolean} Vrai pour une bulle en attente ou en échec.
 */
const estUneBulleLocale = (message) => Boolean(message?.pending || message?.failed);

/**
 * L'instant d'écriture d'un message.
 * @param {any} message Un message du fil.
 * @returns {number} En millisecondes (0 s'il est inconnu).
 */
const instant = (message) => new Date(message?.createdAt || 0).getTime() || 0;

/**
 * Le jeton d'envoi d'un message (`clientMessageId`).
 * @param {any} message Un message du fil.
 * @returns {string} Le jeton ('' s'il n'en a pas).
 */
const jetonDEnvoi = (message) => String(message?.clientMessageId || '').trim();

/**
 * Fusionne la page la plus récente lue au serveur dans un fil en cache.
 *
 * - les messages déjà en cache ne bougent pas ;
 * - les messages manqués entrent dans la première page, à leur place (du plus
 *   récent au plus ancien, l'ordre du serveur) ;
 * - une bulle locale s'efface seulement si le serveur a son `clientMessageId` ;
 * - si AUCUN message de la page n'était connu, on a manqué plus d'une page :
 *   recoller laisserait un trou, on repart donc de cette page (bulles locales
 *   gardées), et les plus anciennes se rechargent en remontant le fil.
 * @param {any} donnees Les pages en cache (`useInfiniteQuery`).
 * @param {any} pageServeur La page 1, telle que la rend `getChatMessages`.
 * @returns {any} Les pages fusionnées ; `donnees` elles-mêmes s'il n'y a rien de neuf.
 */
export const fusionnerLaDernierePage = (donnees, pageServeur) => {
  if (!Array.isArray(donnees?.pages) || donnees.pages.length === 0) return donnees;
  /** @type {any[]} */
  const recus = (Array.isArray(pageServeur?.data) ? pageServeur.data : []).filter(idDuMessage);
  if (recus.length === 0) return donnees;

  /** @type {any[]} */
  const enCache = donnees.pages.flatMap(
    (/** @type {any} */ page) => (Array.isArray(page?.data) ? page.data : []),
  );
  const connus = new Set(enCache.map(idDuMessage).filter(Boolean));
  const neufs = recus.filter((message) => !connus.has(idDuMessage(message)));
  if (neufs.length === 0) return donnees;

  const confirmes = new Set(neufs.map(jetonDEnvoi).filter(Boolean));
  /**
   * Garde tout, sauf une bulle locale que le serveur vient de confirmer.
   * @param {any} message Un message en cache.
   * @returns {boolean} Faux pour une bulle locale confirmée.
   */
  const aGarder = (message) => !estUneBulleLocale(message) || !confirmes.has(jetonDEnvoi(message));

  if (neufs.length === recus.length) {
    const bulles = enCache.filter((message) => estUneBulleLocale(message) && aGarder(message));
    return {
      pageParams: [pageServeur?.meta?.pagination?.page || 1],
      pages: [{ ...pageServeur, data: [...bulles, ...recus] }],
    };
  }

  const [premiere, ...suivantes] = donnees.pages;
  const dejaLa = (Array.isArray(premiere?.data) ? premiere.data : []).filter(aGarder);
  const premieresDonnees = [...neufs, ...dejaLa]
    .map((message, rang) => ({ message, rang }))
    .sort((a, b) => (instant(b.message) - instant(a.message)) || (a.rang - b.rang))
    .map(({ message }) => message);
  return { ...donnees, pages: [{ ...premiere, data: premieresDonnees }, ...suivantes] };
};

/**
 * Relit la page la plus récente d'un fil et y fait entrer ce qui a été manqué.
 *
 * Sans cache, il n'y a rien à rattraper : l'écran fera sa première lecture.
 * Une clé par taille de page (le site lit par 30, l'app par 20) : chaque cache
 * est rattrapé avec SA taille, sinon la page suivante sauterait des messages.
 * @param {import('@tanstack/react-query').QueryClient} queryClient Le cache de l'app.
 * @param {unknown} chatId Le fil.
 * @returns {Promise<boolean>} Vrai si le serveur a été relu.
 */
export const rattraperLeFil = (queryClient, chatId) => {
  const fil = String(chatId || '').trim();
  if (!queryClient || !fil) return Promise.resolve(false);
  const dejaEnVol = rattrapagesEnCours.get(fil);
  if (dejaEnVol) return dejaEnVol;

  const requetes = queryClient.getQueryCache().findAll({ queryKey: ['chat-messages', fil] })
    .filter((requete) => Array.isArray(/** @type {any} */ (requete.state.data)?.pages));
  if (requetes.length === 0) return Promise.resolve(false);

  const tailleDe = (/** @type {any} */ requete) => requete.queryKey?.[2]?.pageSize;
  const tailles = [...new Set(requetes.map(tailleDe))];
  let aManque = false;
  const enVol = Promise.all(tailles.map(async (taille) => {
    const page = await getChatMessages(fil, 1, taille);
    requetes.filter((requete) => tailleDe(requete) === taille).forEach((requete) => {
      const avant = queryClient.getQueryData(requete.queryKey);
      const apres = fusionnerLaDernierePage(avant, page);
      if (apres === avant) return;
      queryClient.setQueryData(requete.queryKey, apres);
      aManque = true;
    });
  }))
    .then(() => {
      // Ce qui manquait au fil manque aussi à la liste : son aperçu (« dernier
      // message ») et les non-lus, que le serveur seul sait compter. Une relecture,
      // et seulement quand quelque chose manquait vraiment.
      if (aManque) rattraperLaListe(queryClient);
      return true;
    }, (error) => {
      rattrapageLogger.warn('Rattrapage du fil impossible', {
        chatId: fil,
        message: error?.message || error,
      });
      return false;
    })
    .finally(() => { rattrapagesEnCours.delete(fil); });
  rattrapagesEnCours.set(fil, enVol);
  return enVol;
};
