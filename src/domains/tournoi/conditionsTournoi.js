/* eslint-disable max-len */
/**
 * T-PARENT (15/11/2026) — LE TEXTE PUBLIÉ des « Conditions d'inscription » du tournoi FoundClub x AR Soccer du
 * 19 décembre 2026, page publique du site `foundclub.app/conditions-tournoi` (web `PublicConditionsTournoiPage`).
 *
 * Source : `pilotage/tournoi-mtp/CGV_INSCRIPTION.md` (dépôt méthode, main ea0047d), PARTIE II « texte à publier »
 * (v3 du 15/11, décisions d'Adel D11 A, D17, D20 A, D21 A, D22 B, D23, D36). Changements de forme seulement : le
 * gras est retiré, le tableau du § 5 devient une ligne par cas (« cas : ce qui se passe »), les puces deviennent
 * des paragraphes. Nom légal « Found Club » (règle « 129- B »). Médiateur de la consommation : CM2C, adhésion de Found Club valable jusqu'au 16/11/2029 (révision de D23, 16/11).
 * ⚠️ Adel relit ce texte avant la prod. Une virgule changée ici change la page publiée.
 */

/** La ligne de version, affichée sous le titre. */
// DEUX-EQUIPES-2 (19/11) : D282 (la place suit le joueur) et D63 ; avant : « Version du 18 novembre 2026 » (D247).
export const VERSION_DES_CONDITIONS = 'Version du 19 novembre 2026';

/**
 * D48 (17/11/2026) — L'ADRESSE DU COMPLEXE, en UN seul endroit du code : lue par les conditions (§ 1), le
 * règlement (reglementTournoi.js) et le modèle d'autorisation parentale (modeleAutorisationParentale.js).
 * ⚠️ À confirmer par Adel le 18/11 (« Rauze basse, 34070 » dans nos textes ; « Rauzé Basse, 34000 » sur le site
 * d'AR Soccer) : changer cette ligne change les trois textes publiés.
 */
export const ADRESSE_DU_COMPLEXE = '119 rue de la Rauze basse, 34070 Montpellier';

/**
 * Les paragraphes, dans l'ordre : le titre, la version, puis chaque titre de partie (« 1. … ») suivi de ses
 * paragraphes.
 * @type {ReadonlyArray<string>}
 */
export const PARAGRAPHES_DES_CONDITIONS = Object.freeze([
  'Conditions d\'inscription au tournoi FoundClub x AR Soccer du 19 décembre 2026',
  VERSION_DES_CONDITIONS,
  '1. Objet',
  `Ces conditions encadrent l'inscription au tournoi de football à 5 organisé par Found Club (SIREN 940 032 253, siège au 25 boulevard des Dames, 13002 Marseille, contact : contact@foundclubpro.com) le samedi 19 décembre 2026, au complexe AR Soccer, ${ADRESSE_DU_COMPLEXE}, en salle, sur 3 terrains. Accueil à 19 h, premier match à 19 h 30, fin au plus tard à 1 h. L'inscription se fait sur FoundClub (site ou application), joueur par joueur. S'inscrire, c'est accepter ces conditions et le règlement du tournoi.`,
  '2. Prix',
  '20 € par joueur (TVA non applicable, art. 293 B du CGI), pour la participation au tournoi : 4 matchs de ligue, et jusqu\'à 3 matchs de phase finale, l\'arbitrage et les récompenses. Le prix ne comprend pas le déplacement ni l\'assurance personnelle du joueur (§ 6).',
  'Le maillot du tournoi est offert, en bonus, que le joueur garde, dans la limite des tailles et des stocks disponibles le jour du tournoi. Il ne fait pas partie du prix : un maillot absent, livré en retard ou d\'une autre taille que celle demandée ne donne lieu à aucun remboursement ni à aucune réduction.',
  '3. Inscription, paiement et validation de l\'équipe',
  'On s\'inscrit avec son équipe (5 joueurs ou plus), seul, ou à 2, 3 ou 4. Chaque joueur reçoit son propre lien de paiement ; sa place peut être payée par lui-même ou par un tiers (un parent, le capitaine, un coéquipier). Le paiement est encaissé par Found Club ; un reçu est envoyé à celui qui paie. Payer pour un autre ne change rien à ses droits : la place reste celle du joueur, et un remboursement éventuel revient sur le moyen de paiement utilisé, donc à celui qui a payé.',
  'Une équipe est validée quand 5 de ses joueurs ont payé. Les équipes sont validées dans l\'ordre où elles atteignent 5 joueurs payés, dans la limite de 24 équipes. Le tournoi se joue à un nombre pair d\'équipes (règlement § 4).',
  'Joueurs seuls ou à 2-4 : Found Club forme des équipes avec les joueurs en attente, dans l\'ordre d\'inscription, par niveau déclaré, dès que 5 joueurs payés peuvent être réunis, en gardant ensemble ceux qui se sont inscrits ensemble.',
  'Condition : l\'inscription d\'un joueur ne vaut que si son équipe compte 5 joueurs payés le 10 décembre 2026 à 23 h 59. À défaut, son inscription est annulée et il est remboursé intégralement, sans frais, sous 14 jours.',
  'La place payée suit le joueur. S\'il change d\'équipe dans le même tournoi, il ne repaie pas : sa place passe dans la nouvelle équipe, et l\'ancienne équipe compte un joueur payé de moins. Une équipe validée ne redescend pas : un joueur payé ne peut pas la quitter si elle passe ainsi sous 5 joueurs payés. Il peut partir dès qu\'un 6ᵉ joueur a payé. La même règle vaut quand le capitaine retire un joueur payé.',
  '4. Pas de droit de rétractation',
  'Le tournoi est une activité de loisir à une date fixée : le délai de rétractation de 14 jours ne s\'applique pas (article L221-28, 12°, du Code de la consommation). Le joueur le confirme avant de payer. Les cas de remboursement sont ceux des § 3 et § 5.',
  '5. Annulation et remboursement',
  'Tout remboursement se fait sur le moyen de paiement utilisé, sous 14 jours.',
  'Found Club annule le tournoi (pas assez d\'équipes le 06/12, complexe indisponible, autre raison) : remboursement intégral. Si le joueur le préfère, report de sa place sur le tournoi suivant.',
  'L\'équipe n\'a pas 5 joueurs payés le 10/12 à 23 h 59 (§ 3) : remboursement intégral.',
  'Nombre d\'équipes impair à la clôture : la dernière équipe validée ne peut pas être complétée et ne joue pas (règlement § 4) : remboursement intégral.',
  'Le joueur change d\'équipe dans le même tournoi (§ 3) : aucun remboursement ; sa place payée passe dans la nouvelle équipe.',
  'Le joueur se retire jusqu\'au 5 décembre 2026 inclus : remboursement intégral.',
  'Le joueur se retire après le 5 décembre, ou ne vient pas : pas de remboursement. Il peut céder sa place à un autre joueur jusqu\'au 17/12, par FoundClub : le nouveau joueur paie sa place et le premier est remboursé.',
  'Un joueur de 16 ou 17 ans sans autorisation parentale à l\'accueil (§ 9) : il ne joue pas ; remboursement intégral.',
  'Maillot absent, en retard ou d\'une autre taille (§ 2) : aucun remboursement ni réduction ; le maillot est offert, il ne fait pas partie du prix.',
  'Exclusion d\'un joueur pour violence (règlement § 3) : pas de remboursement.',
  '6. Responsabilité et assurance',
  'Le tournoi se déroule dans l\'établissement d\'AR Soccer, assuré en responsabilité civile en tant qu\'exploitant d\'un établissement sportif (article L321-7 du Code du sport). Found Club n\'a pas souscrit d\'assurance propre pour ce tournoi. Found Club répond de ses propres manquements dans l\'organisation du tournoi, dans les conditions du droit commun.',
  'Le football est un sport de contact. Le joueur déclare n\'avoir aucune contre-indication connue à sa pratique. Aucun certificat médical n\'est demandé.',
  'Found Club conseille à chaque joueur une assurance individuelle accident qui couvre ses propres blessures ; une licence sportive ou une assurance personnelle peut le faire.',
  'Chacun veille à ses affaires personnelles ; Found Club ne les garde pas.',
  '7. Droit à l\'image (case facultative)',
  'Le tournoi est filmé et photographié par Found Club pour ses réseaux, son site et son application, et pour ceux d\'AR Soccer (vidéo de résumé, photos des équipes, résultats).',
  'Case non cochée par défaut : « J\'accepte d\'être filmé et photographié pendant le tournoi et que ces images soient publiées par Found Club et AR Soccer sur leurs réseaux, sites et applications, pendant 2 ans. »',
  'Refuser n\'empêche pas de jouer : le joueur porte un signe distinctif et n\'est pas publié là où on le reconnaît.',
  'L\'accord se retire à tout moment en écrivant à contact@foundclubpro.com : les nouvelles publications cessent, et les anciennes sont retirées quand c\'est possible.',
  'Joueur de 16 ou 17 ans : il faut son accord et celui de ses parents (article 372-1 du Code civil), donnés dans l\'autorisation parentale (§ 9).',
  '8. Données personnelles',
  'Responsable : Found Club.',
  'Ce qu\'on garde : prénom, nom, e-mail, téléphone (pour joindre le joueur le soir du tournoi) ; date de naissance (pour vérifier l\'âge ; l\'organisateur ne voit que l\'âge) ; taille de maillot ; nom et numéro à imprimer sur le maillot (facultatifs) ; équipe, niveau déclaré, résultats ; pour un joueur de 16 ou 17 ans, l\'autorisation de son parent ; paiement : montant, date, référence. Le numéro de carte n\'est jamais vu ni gardé par Found Club.',
  'Combien de temps : coordonnées, tailles, noms et numéros de maillot jusqu\'au 31 mars 2027, puis effacés ; l\'autorisation parentale, archivée 10 ans, à accès restreint, comme preuve en cas d\'accident ; le nom de l\'équipe et les résultats restent publiés comme palmarès ; les pièces comptables 10 ans (article L123-22 du Code de commerce) ; les images, la durée du § 7.',
  'Base : le contrat (l\'inscription) ; le consentement pour les images et pour les nouvelles de FoundClub ; l\'obligation légale pour la comptabilité ; l\'intérêt légitime pour le favori ci-dessous.',
  'AR Soccer en favori : en s\'inscrivant, le joueur ajoute AR Soccer à ses favoris sur FoundClub ; il voit ses annonces et ses créneaux, et peut le retirer de ses favoris à tout moment, en un geste. AR Soccer ne reçoit ni son téléphone ni son e-mail.',
  'Vos droits : accès, rectification, effacement, opposition, en écrivant à contact@foundclubpro.com. Réclamation possible auprès de la CNIL (cnil.fr).',
  '9. Âge minimum et joueurs de 16 ou 17 ans',
  '16 ans révolus le 19 décembre 2026.',
  'De 16 à 17 ans : un parent (ou le représentant légal) coche l\'autorisation sur la page de paiement de l\'ado, que la place soit payée par le parent, par l\'ado ou par un tiers (capitaine, coéquipier) : un tiers qui paie ne peut pas donner l\'autorisation à la place du parent. Par cette case, le parent autorise son enfant à participer à un tournoi de football à 5, sport de contact, avec des joueurs majeurs, le 19/12/2026 de 19 h à 1 h au plus tard, à AR Soccer ; déclare qu\'à sa connaissance l\'enfant n\'a pas de contre-indication ; autorise l\'appel des secours et le transport à l\'hôpital, et reste joignable au numéro donné ; indique comment l\'enfant rentre ; dit, séparément, s\'il accepte l\'image, avec l\'accord de l\'autre parent.',
  'En secours, l\'autorisation papier signée (modèle sur la page du tournoi) est remise à l\'accueil. Sans autorisation, l\'ado ne joue pas, et il est remboursé (§ 5).',
  'Un bracelet est remis à l\'accueil aux 16-17 ans ; aucune boisson alcoolisée ne leur est servie (article L3342-1 du Code de la santé publique). Aucune pièce d\'identité n\'est demandée en ligne.',
  '10. Réclamations et litiges',
  'Toute réclamation s\'adresse par écrit à contact@foundclubpro.com, avec le nom du joueur et l\'objet de la demande.',
  'Found Club répond sous 15 jours.',
  'Conformément aux dispositions du Code de la consommation concernant le processus de médiation des litiges de la consommation, après nous avoir sollicités et à défaut de réponse vous satisfaisant, vous avez la possibilité de recourir gratuitement à une procédure de médiation de la consommation auprès de : CM2C, 49 rue de Ponthieu, 75008 Paris. Tél : 01 89 47 00 14. Site internet : https://www.cm2c.net/declarer-un-litige.php. Mail : litiges@cm2c.net. Le joueur peut aussi saisir le tribunal compétent.',
  'Ces conditions sont soumises au droit français.',
]);

/**
 * Un titre de partie (« 1. Objet ») ?
 * @param {string} paragraphe - Le paragraphe.
 * @returns {boolean} Vrai pour un titre.
 */
export const estUnTitreDeLaPartie = (paragraphe) => /^\d+\. /.test(paragraphe);
