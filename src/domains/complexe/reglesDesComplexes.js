/* eslint-disable max-len */
/**
 * REGLES-COMPLEXES (10/11/2026, « 225- A », M0855) — LE TEXTE PUBLIÉ des « Règles d’utilisation des complexes ».
 *
 * Source : le §1 de `docs/RESERVATION_REGLES_COMPLEXES_2026-10-14.md` (dépôt méthode), validé par Adel le 14/10
 * (« Règles ok »). Trois changements seulement, sans toucher au sens (chef, 10/11 : « 2 B ») : « FoundClub » devient
 * « Found Club » (règle « 129- B » des textes légaux), « Version 1 — [date de publication] » devient
 * « Version du 10 novembre 2026 », et les marques de gras du document sont retirées.
 *
 * ⛔ Une virgule changée ici = un autre texte : le serveur garde l’empreinte (sha256) de CE texte sous la version
 * `VERSION_DES_REGLES` (admin `COMPLEXE_RULES_VERSIONS`). Changer le texte, c’est une nouvelle version, ici ET
 * côté serveur ; le témoin `reglesDesComplexes.test.js` rougit sinon.
 */

/** La version que la case fait accepter (`rulesVersion` de « Créer mon complexe »). */
export const VERSION_DES_REGLES = '2026-11-10';

/**
 * Les paragraphes, dans l’ordre : le titre, la version, l’introduction, puis chaque titre de partie (« 1. … »)
 * suivi de ses articles (« 1.1 … »), et la dernière ligne.
 * @type {ReadonlyArray<string>}
 */
export const PARAGRAPHES_DES_REGLES = Object.freeze([
  'Règles d\'utilisation des complexes',
  'Version du 10 novembre 2026',
  'Ces règles s\'appliquent à toute personne qui crée ou gère un complexe sur Found Club : un centre de foot à 5, de padel, de tennis ou d\'un autre sport, dont les terrains se réservent. Elles complètent les conditions générales d\'utilisation et la politique de confidentialité de Found Club, qui restent valables. En cochant « J\'accepte les règles d\'utilisation des complexes », vous les acceptez.',
  '1. Créer un complexe',
  '1.1 Vous créez votre complexe depuis votre compte Found Club, ou en vous inscrivant directement « pour un complexe ». Une bascule vous fait passer du mode complexe au mode joueur, et inversement.',
  '1.2 Un compte gère un seul complexe.',
  '1.3 Vous exploitez réellement ce complexe, ou son exploitant vous a chargé de le gérer. Vous ne créez pas la page d\'un complexe qui n\'est pas le vôtre.',
  '1.4 Votre complexe est visible dès sa création : Found Club ne le vérifie pas avant. C\'est pour cela que ces règles comptent.',
  '2. Vos engagements',
  '2.1 Vos terrains, vos horaires, vos créneaux et vos prix correspondent à la réalité, et vous les tenez à jour. Une fermeture (travaux, météo, jour férié) se déclare dans l\'application : les joueurs concernés sont prévenus.',
  '2.2 Une réservation confirmée est honorée. Si vous devez l\'annuler, vous le faites dans l\'application, avec un motif : le joueur est prévenu.',
  '2.3 Pour un terrain en validation manuelle, vous répondez aux demandes. Une demande restée sans réponse à l\'heure limite expire, et le joueur est prévenu.',
  '2.4 Le prix affiché est indicatif et se règle sur place. Found Club n\'encaisse rien et n\'intervient pas dans le paiement. Le prix et le délai d\'annulation d\'une réservation restent ceux qui étaient affichés quand elle a été faite.',
  '2.5 Ce que vous publiez (nom, photos, description, mot aux joueurs, messages de votre canal) est exact et respecte la loi.',
  '2.6 Found Club met en relation votre complexe et des joueurs. Found Club n\'organise pas les parties, ne contrôle pas vos installations et ne garantit pas la venue des joueurs.',
  '3. Les données des joueurs',
  '3.1 Pour une réservation faite dans l\'application, vous voyez le nom de la personne qui a réservé, et vous pouvez lui écrire par la messagerie de Found Club.',
  '3.2 Vous ne voyez son numéro de téléphone que si elle a accepté de vous le donner pour cette réservation. Jamais celui d\'un joueur de moins de 18 ans, jamais celui des personnes qu\'elle invite.',
  '3.3 Ces informations servent uniquement à la réservation concernée. Vous ne les utilisez ni pour de la publicité ni pour du démarchage ; vous ne les vendez pas, ne les louez pas et ne les transmettez à personne.',
  '3.4 Si vous recopiez des informations de joueurs en dehors de Found Club (cahier, logiciel de caisse), vous en êtes responsable.',
  '3.5 Le numéro de téléphone de votre complexe, lui, est public : il s\'affiche sur sa page, y compris pour les personnes qui n\'ont pas de compte.',
  '4. Les mineurs',
  '4.1 Vous fixez l\'âge minimum pour réserver chez vous, entre 13 et 18 ans (18 ans si vous ne changez rien). En dessous de cet âge, un joueur ne peut ni réserver chez vous, ni rejoindre une partie chez vous par un lien ou par une annonce ; un compte sans date de naissance non plus. Exception : quand un encadrant majeur réserve pour son équipe, l\'âge minimum ne s\'applique qu\'à lui.',
  '4.2 Un joueur mineur qui a cet âge peut échanger avec vous dans la messagerie, uniquement au sujet de sa réservation. Il ne peut pas vous donner son numéro par l\'application, et vous ne lui demandez pas de moyen de le joindre en dehors de Found Club.',
  '5. Réservations non honorées et bannissement',
  '5.1 Quand personne n\'est venu pour une réservation confirmée, vous pouvez la marquer « non honorée ». Vous le faites seulement quand c\'est vrai.',
  '5.2 Après le nombre de réservations non honorées que vous choisissez (3 si vous ne changez rien, ou « jamais »), le joueur ne peut plus réserver chez vous.',
  '5.3 Vous pouvez aussi bannir un joueur pour une raison qui vous est propre. Elle reste privée : le joueur lit seulement qu\'il ne peut plus réserver chez vous. Cette raison ne peut jamais tenir à l\'un des motifs de discrimination interdits par la loi (origine, sexe, religion, handicap…).',
  '5.4 Un bannissement ne vaut que dans votre complexe : ailleurs sur Found Club, rien ne change pour le joueur. Vous pouvez le lever à tout moment.',
  '6. Ce que Found Club peut faire',
  '6.1 Toute personne peut signaler un complexe depuis sa page. Found Club examine chaque signalement.',
  '6.2 Si votre complexe ne respecte pas ces règles, Found Club peut le suspendre : il n\'apparaît plus, ni dans l\'application ni sur le site. Vous en êtes prévenu, avec le motif.',
  '6.3 En cas de manquement grave, Found Club peut retirer votre complexe définitivement. Ses réservations à venir sont alors annulées, et les joueurs prévenus.',
  '6.4 Found Club peut aussi suspendre votre compte, comme celui de tout utilisateur qui ne respecte pas les conditions générales.',
  '6.5 Pour contester une décision, écrivez à contact@foundclubpro.com.',
  '7. Le prix',
  '7.1 Found Club est gratuit pour les complexes, y compris l\'affichage de votre logo et de vos partenaires.',
  '7.2 Si une offre payante était un jour proposée aux complexes, vous en seriez prévenu à l\'avance, et rien ne vous serait facturé sans que vous l\'ayez choisi.',
  '8. Évolution de ces règles',
  '8.1 Ces règles peuvent évoluer avec le service. Leur version et leur date figurent en haut de cette page. En cas de changement important, vous en êtes prévenu dans l\'application.',
  'Une question : contact@foundclubpro.com.',
]);

/** Le texte publié tel que la page l’affiche : les paragraphes séparés par une ligne vide. */
export const TEXTE_DES_REGLES = PARAGRAPHES_DES_REGLES.join('\n\n');

/**
 * Un titre de partie (« 1. Créer un complexe »), par opposition à un article (« 1.1 … »).
 * @param {string} paragraphe - Un paragraphe.
 * @returns {boolean} Vrai pour un titre de partie.
 */
export const estUnTitreDePartie = (paragraphe) => /^\d+\. /.test(paragraphe);
