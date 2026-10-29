import { Platform } from 'react-native';

import { getItem, setItem } from '@/platform/storage';

// NOTIF-PREDEMANDE (29/10/2026, decision d'Adel « 2- A ») — NOTRE ECRAN AVANT LA FENETRE
// SYSTEME DES NOTIFICATIONS.
//
// Avant : sur iPhone, la fenetre systeme partait des la connexion, avant meme « Quel est
// ton statut ? », et un refus y est definitif. Mesure prod du 29/10 : 8 des 38
// inscriptions non finies seulement avaient un jeton push.
// Maintenant : la fenetre systeme ne s'ouvre qu'apres « Activer » sur notre ecran. Il est
// propose juste apres « Qui es-tu ? », puis revient aux moments cles (demande d'adhesion
// envoyee, convocation, message recu) : jamais deux fois en moins de 7 jours, et plus du
// tout apres 3 reports (SUPPOSE raisonnable, a confirmer par Adel).
// La memoire est celle du TELEPHONE, pas du compte : la permission aussi.

const CLE_MEMOIRE = 'notif_predemande_v1';
export const DELAI_ENTRE_DEUX_AFFICHAGES_MS = 7 * 24 * 60 * 60 * 1000;
export const REPORTS_MAX = 3;

/**
 * @typedef {{ dernierAffichage: number, refusDefinitif: boolean, reports: number }}
 *   MemoirePreDemande
 */

/**
 * Lit la memoire du telephone ; une valeur illisible vaut un telephone neuf.
 * @returns {MemoirePreDemande} - Ce que le telephone sait deja.
 */
export const lireMemoirePreDemande = () => {
  try {
    const brut = JSON.parse(getItem(CLE_MEMOIRE) || '{}') || {};
    return {
      dernierAffichage: Number(brut.dernierAffichage) || 0,
      refusDefinitif: brut.refusDefinitif === true,
      reports: Number(brut.reports) || 0,
    };
  } catch {
    return { dernierAffichage: 0, refusDefinitif: false, reports: 0 };
  }
};

/**
 * Ecrit quelques champs, garde les autres.
 * @param {Partial<MemoirePreDemande>} changements - Les champs a ecrire.
 * @returns {void}
 */
const ecrireMemoire = (changements) => {
  setItem(CLE_MEMOIRE, JSON.stringify({ ...lireMemoirePreDemande(), ...changements }));
};

/**
 * La regle : moins de 3 reports, et 7 jours depuis le dernier affichage.
 * @param {MemoirePreDemande} memoire - La memoire du telephone.
 * @param {number} maintenant - L'instant present.
 * @returns {boolean} - Vrai si notre ecran peut s'ouvrir maintenant.
 */
export const peutProposerPreDemande = (memoire, maintenant) => (
  memoire.reports < REPORTS_MAX
  && (!memoire.dernierAffichage
    || maintenant - memoire.dernierAffichage >= DELAI_ENTRE_DEUX_AFFICHAGES_MS)
);

/**
 * Retient l'instant ou l'ecran s'est ouvert.
 * @param {number} maintenant - L'instant de l'affichage.
 * @returns {void}
 */
export const noterAffichagePreDemande = (maintenant) => ecrireMemoire({
  dernierAffichage: maintenant,
});
export const noterReportPreDemande = () => ecrireMemoire({
  reports: lireMemoirePreDemande().reports + 1,
});
// Android ne dit pas « refuse » avant d'avoir demande : seul le « ne plus demander »
// rendu par la fenetre systeme le prouve, on le retient donc ici.
export const noterRefusDefinitifAndroid = () => ecrireMemoire({ refusDefinitif: true });

/** @type {Set<(moment: string) => void>} */
const ecouteurs = new Set();

/**
 * S'abonne aux moments cles (l'ecran, dans NotificationBootstrap).
 * @param {(moment: string) => void} ecouteur - Appele a chaque moment cle.
 * @returns {() => void} - Se desabonner.
 */
export const ecouterPreDemande = (ecouteur) => {
  ecouteurs.add(ecouteur);
  return () => { ecouteurs.delete(ecouteur); };
};

/**
 * Un moment cle vient d'arriver : l'ecran decidera s'il s'ouvre (regle ci-dessus).
 * Sans effet sur le site, qui n'a pas cet ecran.
 * @param {'inscription' | 'adhesion' | 'convocation' | 'message'} moment - Lequel.
 * @returns {void}
 */
export const proposerPreDemandeNotifications = (moment) => {
  if (Platform.OS === 'web') return;
  ecouteurs.forEach((ecouteur) => ecouteur(moment));
};

const TYPES_CONVOCATION = ['eventConvocationPublished'];
const TYPES_MESSAGE = [
  'newClubMessage', 'newGroupMessage', 'newLeagueMatchMessage', 'newTeamMessage', 'newWhisper',
];

/**
 * Les pages d'une requete en cache, qu'elle soit paginee ou non.
 * @param {any} donnees - Une requete en cache, paginee ou non.
 * @returns {any[]} - Ses pages.
 */
const pages = (donnees) => (Array.isArray(donnees?.pages) ? donnees.pages : [donnees]);

/**
 * Lit dans une requete en cache un moment cle que le telephone n'a pas pu signaler
 * par une notification (puisqu'elles sont coupees) : un message non lu dans la liste
 * des conversations, une convocation ou un message non lu dans la cloche.
 * ponytail: la cloche n'est lue que quand on l'ouvre ; la convocation n'est donc vue
 * qu'a ce moment-la. Sortie : lire aussi le compteur des convocations s'il en existe un.
 * @param {unknown[]} cle - La cle de la requete.
 * @param {any} donnees - Ses donnees.
 * @returns {'convocation' | 'message' | null} - Le moment cle, ou rien.
 */
export const momentCleDansLeCache = (cle, donnees) => {
  if (cle.length === 1 && cle[0] === 'chats') {
    const nonLu = pages(donnees).some((page) => (
      Number(page?.meta?.unreadTotal) > 0
      || (Array.isArray(page?.data) && page.data.some((fil) => Number(fil?.unreadCount) > 0))
    ));
    return nonLu ? 'message' : null;
  }
  if (cle.length === 1 && cle[0] === 'notifications') {
    const types = pages(donnees)
      .flatMap((page) => (Array.isArray(page?.data) ? page.data : []))
      .filter((notification) => notification?.read !== true)
      .map((notification) => notification?.type);
    if (types.some((type) => TYPES_CONVOCATION.includes(type))) return 'convocation';
    if (types.some((type) => TYPES_MESSAGE.includes(type))) return 'message';
  }
  return null;
};
