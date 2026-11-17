/* eslint-disable max-len */
/**
 * D48 (17/11/2026, chef FoundClub) — LE MODÈLE D'AUTORISATION PARENTALE PAPIER du tournoi FoundClub x AR Soccer
 * du 19/12/2026, publié sous les conditions et le règlement (`/conditions-tournoi#autorisation`), à imprimer
 * sur une page A4. Les conditions (§ 9) y renvoient : « l'autorisation papier signée (modèle sur la page du
 * tournoi) ». Source : `pilotage/tournoi-mtp/AUTORISATION_PARENTALE_MODELE.md`, recopiée telle quelle, gras retiré
 * (un intertitre reste un intertitre), le commentaire de fin pour le lot exclu. Rien de pré-rempli.
 * L'adresse du complexe : ADRESSE_DU_COMPLEXE (conditionsTournoi.js), seul endroit du code.
 * ⚠️ Une virgule changée ici change la feuille publiée. Témoin : __tests__/D48-reglement-et-autorisation.test.js.
 */
import { ADRESSE_DU_COMPLEXE } from './conditionsTournoi';

/**
 * Une case à cocher dans un texte : la page la dessine (un petit carré bordé). Aucun pictogramme dans le code
 * (SANS-EMOJI, décision d'Adel du 01/10) ; la source en porte 13, autant de marques ici.
 */
export const MARQUE_DE_CASE = '{case}';

/** Le titre de la feuille. */
export const TITRE_DE_L_AUTORISATION = 'Autorisation parentale — Tournoi FoundClub x AR Soccer du 19 décembre 2026';

/**
 * Les blocs de la feuille, dans l'ordre : `genre` = 'note' (en italique), 'intertitre', 'ligne', 'trait'
 * (séparateur) ou 'signature' (la place de la signature) ; `texte` sauf pour 'trait' et 'signature'.
 * @type {ReadonlyArray<{ genre: string, texte?: string }>}
 */
export const BLOCS_DE_L_AUTORISATION = Object.freeze([
  { genre: 'note', texte: 'Pour un joueur de 16 ou 17 ans. À remplir à la main, à signer et à remettre à l\'accueil le soir du tournoi, si l\'autorisation n\'a pas été cochée en ligne sur la page de paiement. Une seule signature d\'un parent ou du représentant légal suffit pour participer.' },
  { genre: 'trait' },
  { genre: 'intertitre', texte: 'Le parent ou le représentant légal' },
  { genre: 'ligne', texte: 'Prénom et nom : ............................................................................................' },
  { genre: 'ligne', texte: 'Lien avec le joueur :  {case} mère   {case} père   {case} représentant légal' },
  { genre: 'ligne', texte: 'Téléphone joignable le soir du 19 décembre : ..................................................' },
  { genre: 'intertitre', texte: 'Le joueur' },
  { genre: 'ligne', texte: 'Prénom et nom : ............................................................................................' },
  { genre: 'ligne', texte: 'Date de naissance : ....... / ....... / ............' },
  { genre: 'intertitre', texte: 'Le tournoi' },
  { genre: 'ligne', texte: `Tournoi de football à 5, sport de contact, avec des joueurs majeurs, organisé par Found Club au complexe AR Soccer, ${ADRESSE_DU_COMPLEXE}, le samedi 19 décembre 2026, de 19 h (accueil) à 1 h au plus tard.` },
  { genre: 'trait' },
  { genre: 'intertitre', texte: 'Je soussigné(e), parent ou représentant légal du joueur ci-dessus :' },
  { genre: 'ligne', texte: '{case} J\'autorise mon enfant à participer au tournoi et à s\'y inscrire.' },
  { genre: 'ligne', texte: '{case} À ma connaissance, mon enfant n\'a pas de contre-indication à la pratique du football.' },
  { genre: 'ligne', texte: '{case} J\'autorise l\'organisateur à appeler les secours et à faire transporter mon enfant à l\'hôpital en cas de besoin. Je serai prévenu sans délai au numéro ci-dessus.' },
  { genre: 'ligne', texte: 'Retour après le tournoi :  {case} mon enfant rentre seul   {case} mon enfant rentre avec : ......................................................  (téléphone : ..................................)' },
  { genre: 'ligne', texte: '{case} J\'ai lu le règlement du tournoi et les conditions d\'inscription (foundclub.app/conditions-tournoi).' },
  { genre: 'trait' },
  { genre: 'intertitre', texte: 'Droit à l\'image (facultatif : ne rien cocher n\'empêche pas de jouer)' },
  { genre: 'ligne', texte: '{case} J\'accepte que mon enfant soit filmé et photographié pendant le tournoi, et que ces images soient publiées par Found Club et AR Soccer sur leurs réseaux, sites et applications, pendant 2 ans.' },
  { genre: 'ligne', texte: 'et  {case} l\'autre parent est d\'accord   ou   {case} j\'exerce seul(e) l\'autorité parentale' },
  { genre: 'ligne', texte: 'Accord du joueur :  {case} j\'accepte aussi (à cocher par le joueur)' },
  { genre: 'note', texte: 'Sans ces trois cases, le joueur porte un signe distinctif et n\'est pas publié là où on le reconnaît.' },
  { genre: 'trait' },
  { genre: 'ligne', texte: 'Fait à .........................................., le ....... / ....... / 2026' },
  { genre: 'ligne', texte: 'Signature du parent ou du représentant légal :' },
  { genre: 'signature' },
  { genre: 'trait' },
  { genre: 'note', texte: 'Found Club, SIREN 940 032 253, 25 boulevard des Dames, 13002 Marseille — contact@foundclubpro.com. Cette autorisation est gardée 10 ans, à accès restreint, comme preuve en cas d\'accident, puis détruite (conditions d\'inscription, § 8). Sans autorisation, le joueur ne joue pas et sa place est remboursée (§ 5).' },
  { genre: 'trait' },
]);
