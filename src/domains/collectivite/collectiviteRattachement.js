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
 * @typedef {'rattache'|'ailleurs'|'aRepondre'|'envoyee'|'attendDirigeant'|'refusee'
 *   |'sansDirigeant'|'envoyer'} GesteDeLaVille
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
 * R17-INVITER (19/10/2026, REC17-009) — le geste que la carte d'un club propose à la Ville, dans
 * la recherche HABITUELLE (qui ne rend que des clubs) : son état se lit dans les demandes de la
 * Ville, et dans le refus du serveur quand elle vient d'appuyer (les 409 existants, en mots).
 * - `rattache` : déjà dans ses clubs ; `ailleurs` : rattaché à une autre collectivité ;
 * - `aRepondre` : le club a DÉJÀ demandé par le lien : la Ville accepte sa demande ;
 * - `envoyee` : la demande de la Ville attend la réponse de ses dirigeants ;
 * - `attendDirigeant` : elle attend le PREMIER dirigeant du club (personne ne le dirige encore) ;
 * - `refusee` : le club a refusé (« refus B » : la Ville peut la renvoyer) ;
 * - `sansDirigeant` : le serveur d'avant R17-INVITER refuse un club sans dirigeant : le lien ;
 * - `envoyer` : « Ce club fait partie de ma collectivité ».
 * @param {any} demandes - `GET /collectivites/:id/club-requests` (les deux sens).
 * @param {string} clubId - documentId du club de la carte.
 * @param {string} [codeDeRefus] - Le code du refus du serveur au dernier appui, s'il y en a un.
 * @returns {GesteDeLaVille} Le geste.
 */
export const gesteDeLaVille = (demandes, clubId, codeDeRefus = '') => {
  if (codeDeRefus === 'COLLECTIVITE_CLUB_ALREADY_ATTACHED') return 'ailleurs';
  if (codeDeRefus === 'COLLECTIVITE_CLUB_WITHOUT_LEADER') return 'sansDirigeant';
  const lignes = (Array.isArray(demandes) ? demandes : [])
    .filter((demande) => demande?.club?.documentId === clubId);
  // P2-11 : la ligne en attente d'abord, puis la refusée, puis n'importe laquelle.
  const parEtat = (kind) => ['pending', 'refused']
    .map((state) => lignes.find((d) => d?.kind === kind && d?.state === state))
    .find(Boolean) || lignes.find((d) => d?.kind === kind);
  const proposition = parEtat('proposal');
  const demandeDuClub = parEtat('attach_request');
  if (lignes.some((demande) => demande?.state === 'attached')) return 'rattache';
  if (lignes.some((demande) => demande?.attachedElsewhere === true)) return 'ailleurs';
  if (demandeDuClub?.state === 'pending') return 'aRepondre';
  if (proposition?.state === 'pending') {
    return proposition.awaitingLeader === true ? 'attendDirigeant' : 'envoyee';
  }
  if (proposition?.state === 'refused') return 'refusee';
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
      // R17-INVITER (19/10) : personne ne dirige encore le club ; le premier qui arrive la reçoit.
      ligne: demande?.awaitingLeader === true
        ? t(
          'collectiviteRattachement.ville.awaitingLeader',
          'Demande enregistrée : elle attend le premier dirigeant du club.',
        )
        : t(
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

/**
 * FINITIONS-VILLE (T20, 08/10) — les MOTIFS FRÉQUENTS d'un refus de rattachement par la Ville,
 * en un appui dans la fenêtre « Refuser la demande » (celle des créneaux), chacun par sa clé.
 */
export const MOTIFS_DE_REFUS_RATTACHEMENT = Object.freeze(['horsCommune', 'inconnu', 'doublon']);

/**
 * R17-INVITER (19/10/2026) — un compte sans rôle sportif : rôle « Authenticated », ou aucun.
 * ponytail: lu ici sans `getUserRoleKey` (authUseCases est doublé par les 15 témoins de la fiche
 * du club, qui lit cette règle) : un nom de rôle INCONNU n'est pas « sans rôle sportif » ici, alors
 * que getUserRoleKey le range en `new` ; voie de sortie : sortir getUserRoleKey dans un module pur.
 * @param {any} role - `userData.role`.
 * @returns {boolean} Vrai sans rôle sportif.
 */
export const estSansRoleSportif = (role) => (
  ['', 'authenticated'].includes(String(role?.type || role?.name || '').trim().toLowerCase())
);

/**
 * R17-INVITER — un compte « Ville seule » vu d'un écran partagé (la fiche du club) : sans rôle
 * sportif, et au moins une collectivité gérée — la règle d'isVilleOnlyAccount
 * (collectiviteAccueil), sans la demande de gestion en cours. Un compte mixte (dirigeant qui gère
 * aussi une Ville) n'en est pas un.
 * @param {any} role - `userData.role`.
 * @param {unknown} villesGerees - `GET /collectivites/mine`.
 * @returns {boolean} Vrai pour un compte Ville seule.
 */
export const estUneVilleSeule = (role, villesGerees) => (
  estSansRoleSportif(role) && Array.isArray(villesGerees) && villesGerees.length > 0
);
