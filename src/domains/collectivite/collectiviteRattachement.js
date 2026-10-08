import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * 🏛️ VILLE-INVITER-CLUB (07/10/2026) — LE RATTACHEMENT DANS LES DEUX SENS, en fonctions PURES
 * (aucun client HTTP : importables par n'importe quel écran sans casser ses témoins).
 *
 * Décisions d'Adel du 07/10 :
 *   - « club A » : la Ville cherche un club déjà sur FoundClub et lui envoie une demande ; quand
 *     ses dirigeants l'ACCEPTENT, le club est rattaché tout de suite ;
 *   - « lien A » : la demande venue du LIEN de la Ville (un dirigeant la demande) est acceptée ou
 *     refusée par la Ville elle-même.
 * Le serveur rend, pour chaque demande, `kind` (`proposal` : la Ville l'a envoyée ;
 * `attach_request` : le club l'a demandée par le lien) et `state` (`pending`, `accepted`,
 * `refused`, `attached` — rattaché l'emporte). L'app ne déduit rien d'autre.
 * La mairie est VOUVOYÉE, le club TUTOYÉ (TEXTES-COLLECTIVITES, « ton A »).
 */

/** @typedef {(cle: string, defaut?: any, valeurs?: Record<string, unknown>) => string} Traduire */
/**
 * @typedef {'rattache'|'ailleurs'|'aRepondre'|'envoyee'|'refusee'|'sansDirigeant'|'envoyer'}
 *   GesteDeRecherche
 */

/**
 * « la Ville de Montrivage » en SUJET de phrase : « La Ville de Montrivage … ».
 * @param {unknown} nom - Le nom officiel de la collectivité.
 * @returns {string} Le nom précédé de son article, avec sa majuscule.
 */
export const villeSujet = (nom) => {
  const ville = formatCollectiviteOfferedBy(String(nom || ''));
  return ville ? ville.charAt(0).toUpperCase() + ville.slice(1) : '';
};

/**
 * Le geste que propose la ligne d'un club dans la recherche de la Ville.
 * - `rattache` : déjà dans ses clubs ; `ailleurs` : rattaché à une autre collectivité ;
 * - `aRepondre` : le club a DÉJÀ demandé par le lien : la Ville accepte sa demande ;
 * - `envoyee` / `refusee` : la demande de la Ville attend, ou a été refusée (elle ne se
 *   renvoie pas) ;
 * - `sansDirigeant` : personne ne pourrait accepter : l'inviter par le lien ;
 * - `envoyer` : « Envoyer la demande ».
 * @param {any} club - Une ligne de `GET /collectivites/:id/club-search`.
 * @returns {GesteDeRecherche} Le geste.
 */
export const gesteDeRecherche = (club) => {
  if (club?.attached) return 'rattache';
  if (club?.attachedElsewhere) return 'ailleurs';
  if (club?.request?.state === 'pending') return 'aRepondre';
  if (club?.proposal?.state === 'pending') return 'envoyee';
  if (club?.proposal?.state === 'refused') return 'refusee';
  if (!club?.hasLeader) return 'sansDirigeant';
  return 'envoyer';
};

/**
 * VOIE 3 (« collectivité A », 07/10) — la valeur de la rangée « Ma collectivité » du hub du
 * dirigeant : le nom de la Ville qui tient le club ; sinon une Ville lui propose ; sinon sa
 * demande attend ; sinon « Rechercher ». Une lecture absente ou étrange ne fait rien inventer.
 * @param {Traduire} t - La traduction de l'écran.
 * @param {any} ma - `GET /clubs/:id/ma-collectivite` (`{ attached, commune, lead }`).
 * @param {any} demandes - `GET /clubs/:id/collectivite-requests`.
 * @returns {string} La valeur.
 */
export const valeurDeMaCollectivite = (t, ma, demandes) => {
  const tenante = ma && !Array.isArray(ma) ? ma.attached : null;
  if (tenante?.name) return String(tenante.name);
  const lignes = Array.isArray(demandes) ? demandes : [];
  if (lignes.some((demande) => demande?.kind === 'proposal' && demande?.canAnswer)) {
    return t('collectiviteRattachement.ma.rowProposal', 'Une Ville te propose');
  }
  const enAttente = (/** @type {any} */ demande) => (
    demande?.kind === 'attach_request' && demande?.state === 'pending'
  );
  if (lignes.some(enAttente)) {
    return t('collectiviteRattachement.ma.rowPending', 'Demande en cours');
  }
  return t('collectiviteRattachement.ma.rowSearch', 'Rechercher');
};

/**
 * VOIE 3 — le geste que propose au dirigeant une collectivité trouvée :
 * `rattache`, `ailleurs` (son club est rattaché à une autre), `aRepondre` (cette Ville lui
 * propose déjà : il accepte sa demande), `envoyee` / `refusee` (sa demande), ou `demander`.
 * @param {any} ville - Une ligne de `GET /clubs/:id/collectivite-search`.
 * @returns {'rattache'|'ailleurs'|'aRepondre'|'envoyee'|'refusee'|'demander'} Le geste.
 */
export const gesteDuClub = (ville) => {
  if (ville?.attached) return 'rattache';
  if (ville?.attachedElsewhere) return 'ailleurs';
  if (ville?.proposal?.state === 'pending') return 'aRepondre';
  if (ville?.request?.state === 'pending') return 'envoyee';
  if (ville?.request?.state === 'refused') return 'refusee';
  return 'demander';
};

/**
 * Ce que la MAIRIE lit d'une demande de rattachement (les deux sens) : une pastille, son ton et
 * une ligne. Au « vous ».
 * @param {Traduire} t - La traduction de l'écran.
 * @param {any} demande - Une ligne de `GET /collectivites/:id/club-requests`.
 * @returns {{ ligne: string, pastille: string, ton: 'cyan' | 'neutre' | 'rouge' | 'vert' }} L'état.
 */
export const etatDeDemandeVille = (t, demande) => {
  const venueDuClub = demande?.kind === 'attach_request';
  if (demande?.state === 'attached') {
    return {
      ligne: t('collectiviteRattachement.ville.attachedLine', 'Il apparaît dans vos clubs.'),
      pastille: t('collectiviteRattachement.ville.attached', 'Rattaché'),
      ton: 'vert',
    };
  }
  if (demande?.state === 'refused') {
    return {
      ligne: venueDuClub
        ? t('collectiviteRattachement.ville.refusedByYou', 'Vous avez refusé sa demande.')
        : t('collectiviteRattachement.ville.refusedByClub', 'Le club a refusé votre demande.'),
      pastille: t('collectiviteRattachement.ville.refused', 'Refusée'),
      ton: 'rouge',
    };
  }
  if (demande?.state === 'accepted') {
    return {
      ligne: t(
        'collectiviteRattachement.ville.acceptedLine',
        'Acceptée, mais le club n’est pas (ou plus) rattaché.',
      ),
      pastille: t('collectiviteRattachement.ville.accepted', 'Acceptée'),
      ton: 'cyan',
    };
  }
  if (!venueDuClub) {
    return {
      ligne: t(
        'collectiviteRattachement.ville.pendingProposal',
        'Envoyée au club : ses dirigeants acceptent ou refusent.',
      ),
      pastille: t('collectiviteRattachement.ville.pending', 'En attente'),
      ton: 'neutre',
    };
  }
  let ligne = t(
    'collectiviteRattachement.ville.pendingRequest',
    'Le club demande à rejoindre la Ville.',
  );
  if (demande?.attachedElsewhere) {
    ligne = t(
      'collectiviteRattachement.ville.attachedElsewhere',
      'Ce club a été rattaché à une autre collectivité entre-temps.',
    );
  } else if (demande?.outsideCommune === true) {
    const horsCommune = t(
      'collectiviteRattachement.ville.outside',
      'Il n’est pas dans la commune.',
    );
    ligne = `${ligne} ${horsCommune}`;
  }
  return {
    ligne,
    pastille: t('collectiviteRattachement.ville.toAnswer', 'À traiter'),
    ton: 'cyan',
  };
};

/**
 * Ce que le CLUB lit d'une de ses demandes déjà tranchée, ou de celle qu'il a faite par le lien.
 * Au « tu ». (La demande de la Ville EN ATTENTE est une carte à part, avec Accepter / Refuser.)
 * @param {Traduire} t - La traduction de l'écran.
 * @param {any} demande - Une ligne de `GET /clubs/:id/collectivite-requests`.
 * @returns {string} La ligne.
 */
export const ligneDeDemandeDuClub = (t, demande) => {
  const nom = demande?.collectivite?.name;
  // Le nom vient du serveur : i18next ne l'echappe pas (« Ville d'Avray », jamais « d&#39;Avray »).
  const valeurs = {
    sujet: villeSujet(nom),
    ville: formatCollectiviteOfferedBy(String(nom || '')),
    ...SANS_ECHAPPEMENT,
  };
  if (demande?.state === 'attached') {
    return t(
      'collectiviteRattachement.club.attached',
      'Ton club est rattaché à {{ville}}.',
      valeurs,
    );
  }
  if (demande?.kind === 'proposal') {
    if (demande?.state === 'refused') {
      return t(
        'collectiviteRattachement.club.youRefused',
        'Tu as refusé la demande de {{ville}}.',
        valeurs,
      );
    }
    return t(
      'collectiviteRattachement.club.youAccepted',
      'Tu as accepté la demande de {{ville}}.',
      valeurs,
    );
  }
  if (demande?.state === 'refused') {
    return t(
      'collectiviteRattachement.club.refused',
      '{{sujet}} n’a pas accepté ta demande de rattachement.',
      valeurs,
    );
  }
  if (demande?.state === 'accepted') {
    return t('collectiviteRattachement.club.accepted', '{{sujet}} a accepté ta demande.', valeurs);
  }
  return t(
    'collectiviteRattachement.club.pending',
    'Ta demande de rattachement à {{ville}} attend sa réponse.',
    valeurs,
  );
};

/**
 * FINITIONS-VILLE (T20, 08/10) — L'ÉTAT COURANT du rattachement, vu du club : une seule ligne,
 * jamais « ta demande attend » et « tu as refusé » ensemble. Le rattachement qui tient d'abord,
 * sinon la demande qui attend, sinon la plus récente (réponse, puis création).
 * @param {any[]} demandes - Les demandes du club que la carte ne fait pas trancher.
 * @returns {any | null} La demande courante, ou null.
 */
export const demandeCouranteDuClub = (demandes) => {
  const lignes = (Array.isArray(demandes) ? demandes : []).filter(Boolean);
  const quand = (/** @type {any} */ demande) => (
    Date.parse(String(demande?.respondedAt || demande?.createdAt || '')) || 0
  );
  return lignes.find((demande) => demande?.state === 'attached')
    || lignes.find((demande) => demande?.state === 'pending')
    || [...lignes].sort((a, b) => quand(b) - quand(a))[0]
    || null;
};
