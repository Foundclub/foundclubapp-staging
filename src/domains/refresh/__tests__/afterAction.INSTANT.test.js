import fs from 'fs';
import path from 'path';

import { QueryClient } from '@tanstack/react-query';

import {
  invalidateAfterAction,
  MEMBERSHIP_NOTIFICATION_TYPES,
  resolveNotificationRefreshAction,
} from '../afterAction';

/**
 * LOT INSTANT — « une demande acceptee doit se voir TOUT DE SUITE ».
 *
 * Constat d'Adel du 2026-08-27 : « les demandes pour rejoindre un club, une
 * equipe ou un evenement mettent trop de temps a se detecter et a jour, ce qui
 * cree des bugs. » Le bug, toujours le meme : rien ne bouge, donc on ré-appuie,
 * et le serveur repond « tu as deja une demande en cours ».
 *
 * TROIS GESTES, TROIS TEMOINS, et chacun etait ROUGE avant ce lot :
 *
 *  · R1 — L'ETIQUETTE MANQUANTE. Le serveur envoie QUATRE etiquettes d'adhesion,
 *    l'app n'en reconnaissait que trois. Celle qui manquait, `clubRequest`, est
 *    justement celle que recoit la personne ACCEPTEE
 *    (admin, club-membership-request/services/notification.ts:119, parametre
 *    `userId` = le demandeur). `clubMembershipRequest`, elle, part chez les
 *    DIRIGEANTS quand la demande arrive (meme fichier, :52, destinataires
 *    `findLivingClubManagers`). Deux noms voisins, deux destinataires opposes.
 *    ⇒ la cloche sonnait, l'ecran ne bougeait pas.
 *
 *  · R3 — LES RECETTES QUI DORMENT. `joinClub`, `joinTeam` et la reponse a un
 *    evenement depuis une LISTE etaient ecrites dans le registre et n'avaient
 *    AUCUN appelant. Du code complet, teste, que personne n'appelle.
 *
 *  · R3 bis — LE DEFAUT DU SITE WEB, et c'est le plus vicieux. Sur `TeamDetails`
 *    le rafraichissement etait pose dans le `onPress` du bouton « OK » d'une
 *    `Alert` — or `Alert.alert()` est une FONCTION VIDE sur le web
 *    (react-native-web, exports/Alert/index.js : `static alert() {}`). Le bouton
 *    restait donc « Rejoindre » pour toujours. Le rafraichissement doit partir
 *    du SUCCES de la demande, pas d'un bouton que personne ne verra.
 *
 * ⚠️ CE QUE CES TEMOINS NE PROUVENT PAS : Jest ne fait tourner ni le serveur ni
 * le navigateur. Les temoins de cablage lisent la SOURCE — ils prouvent que
 * l'appel est au bon endroit, pas que l'ecran se repeint. Cela se constate a la
 * recette.
 */

const RACINE_SOURCES = path.resolve(__dirname, '../../..');

/**
 * Lit un fichier de production, pour prouver qu'un appel est bien cable.
 * @param {string} cheminRelatif - Chemin depuis `src/`.
 * @returns {string} Le contenu du fichier de production.
 */
const lireSource = (cheminRelatif) => fs.readFileSync(
  path.join(RACINE_SOURCES, ...cheminRelatif.split('/')),
  'utf8',
);

/**
 * Decoupe le bloc d'une mutation, du `const <nom>` jusqu'au `const` suivant.
 *
 * ⚠️ Lire le fichier ENTIER ferait passer le temoin pour une occurrence posee
 * ailleurs dans l'ecran : ces deux fiches font plus de 3 000 lignes et portent
 * une dizaine de mutations.
 * @param {string} source - Le fichier de production.
 * @param {string} nomMutation - Le nom de la constante a isoler.
 * @param {string} nomSuivant - Le nom de la constante qui la suit.
 * @returns {string} Le bloc isole.
 */
const bloc = (source, nomMutation, nomSuivant) => {
  const debut = source.indexOf(`const ${nomMutation}`);
  const fin = source.indexOf(`const ${nomSuivant}`, debut + 1);
  expect({ debutTrouve: debut >= 0, finTrouvee: fin > debut })
    .toEqual({ debutTrouve: true, finTrouvee: true });
  return source.slice(debut, fin);
};

/**
 * Dit si une query posee dans le cache a bien ete marquee perimee.
 * @param {QueryClient} queryClient - Le client de test.
 * @param {string[]} queryKey - La cle a controler.
 * @returns {boolean} true si la query a ete marquee perimee.
 */
const estPerimee = (queryClient, queryKey) => Boolean(
  queryClient.getQueryCache().find({ exact: true, queryKey })?.state?.isInvalidated,
);

describe('INSTANT / R1 — l\'etiquette qui manquait a la demande de club', () => {
  /** @type {QueryClient} */
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('R1 — la notification « ta demande de club est acceptee » declenche tout', () => {
    // 🔴 AVANT CE LOT : rendait '', donc `useNotifications.js:357` sortait et
    // seule la cloche etait relue. C'est le defaut n°1 decrit par Adel.
    expect(resolveNotificationRefreshAction('clubRequest')).toBe('membershipChanged');
  });

  it('R1 — et l\'appartenance est reellement relue, pas juste l\'etiquette lue', async () => {
    ['clubMembershipRequests', 'clubs', 'club', 'teams', 'app-bootstrap', 'home-summary']
      .forEach((racine) => queryClient.setQueryData([racine], { valeur: 'lue' }));

    const action = resolveNotificationRefreshAction('clubRequest');
    await invalidateAfterAction(queryClient, action);

    // `clubs` et `club` ne sont PAS dans `membershipChanged` : le temoin le dit
    // franchement plutot que de laisser croire a une couverture qu'il n'a pas.
    ['clubMembershipRequests', 'teams', 'app-bootstrap', 'home-summary'].forEach((racine) => {
      expect({ perimee: estPerimee(queryClient, [racine]), racine })
        .toEqual({ perimee: true, racine });
    });
  });

  it('R1 — le commentaire du registre ne raconte plus le contraire du code', () => {
    const source = lireSource('domains/refresh/afterAction.js');
    const entete = source.slice(0, source.indexOf('MEMBERSHIP_NOTIFICATION_TYPES = Object.freeze'));

    // 🪤 LE PIEGE PAYE ICI : le commentaire affirmait que `clubRequest` etait
    // une demande qui ARRIVE chez un encadrant. C'est vrai de `teamRequest`,
    // c'est FAUX de `clubRequest`. Un commentaire faux est un piege pour le
    // prochain qui lira ce fichier — il coute plus cher que pas de commentaire.
    expect(entete).not.toMatch(/`teamRequest` et `clubRequest` n'y sont PAS/);
    expect(entete).toMatch(/clubRequest/);
  });

  it('R1 — le garde-fou : `teamRequest` reste DEHORS, et les messages ordinaires aussi', () => {
    // `teamRequest` part chez l'encadrant quand une demande d'equipe arrive
    // (admin, team-membership-request/services/notification.ts:64) : son
    // appartenance a lui ne change pas. L'y mettre ferait payer dix requetes
    // reseau pour rien a chaque demande recue.
    ['teamRequest', 'newTeamMessage', 'eventInvitation', '', undefined].forEach((type) => {
      expect({ rendu: resolveNotificationRefreshAction(/** @type {any} */ (type)), type })
        .toEqual({ rendu: '', type });
    });
  });

  it('R1 — les QUATRE etiquettes d\'adhesion, et rien de plus', () => {
    expect([...MEMBERSHIP_NOTIFICATION_TYPES].sort()).toEqual([
      'addToTeam',
      'clubMembershipRequest',
      'clubRequest',
      'teamMembershipRequest',
    ]);
  });
});

describe('INSTANT / R3 — les recettes de rafraichissement qui dormaient', () => {
  it('R3a — demander a rejoindre un CLUB passe par le registre', () => {
    const source = lireSource('views/club/ClubDetails.js');
    const mutation = bloc(
      source,
      'createClubMembershipRequestMutation',
      'createTeamMembershipRequestMutation',
    );

    // 🔴 AVANT CE LOT : zero `invalidateQueries` dans tout l'ecran. La demande
    // partait, et « Demandes » / « Accueil » / « Mes equipes » n'en savaient
    // rien tant que l'ecran restait ouvert.
    expect(mutation).toContain("invalidateAfterAction(queryClient, 'joinClub')");
  });

  it('R3b — demander a rejoindre une EQUIPE passe par le registre', () => {
    const source = lireSource('views/team/TeamDetails.js');
    const mutation = bloc(
      source,
      'createTeamMembershipRequestMutation',
      'answerInvitationMutation',
    );

    expect(mutation).toContain("invalidateAfterAction(queryClient, 'joinTeam')");
  });

  it('R3b — 🌐 LE DEFAUT DU SITE : le rafraichissement est HORS du bouton de l\'alerte', () => {
    const source = lireSource('views/team/TeamDetails.js');
    const mutation = bloc(
      source,
      'createTeamMembershipRequestMutation',
      'answerInvitationMutation',
    );

    // ⚠️ PAS `indexOf('Alert.alert(')` : le commentaire de production CITE
    // `Alert.alert()` pour expliquer le defaut, et le temoin prenait cette
    // mention pour l'appel. On ne retient qu'une ligne qui COMMENCE par lui.
    const positionAlerte = mutation.search(/^ *Alert\.alert\(/m);
    expect(positionAlerte).toBeGreaterThan(0);

    // 🔴 AVANT CE LOT : `refetchUserData()` et `refetch()` vivaient dans le
    // `onPress` du bouton « OK ». Sur le web ce bouton n'existe pas — la
    // bibliotheque y rend une fonction vide — donc le rafraichissement ne
    // partait JAMAIS et le bouton restait « Rejoindre » jusqu'au rechargement
    // de la page. Tout ce qui rafraichit doit donc etre AVANT l'alerte.
    [
      "invalidateAfterAction(queryClient, 'joinTeam')",
      'refetchUserData()',
      'refetch()',
    ].forEach((appel) => {
      const position = mutation.indexOf(appel);
      expect({ appel, trouve: position >= 0 }).toEqual({ appel, trouve: true });
      expect({ appel, avantAlerte: position < positionAlerte })
        .toEqual({ appel, avantAlerte: true });
    });
  });
});
