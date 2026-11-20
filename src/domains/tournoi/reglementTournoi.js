/* eslint-disable max-len */
/**
 * T-JOUEURS / D48 A (17/11/2026, Adel) — LE RÈGLEMENT DU TOURNOI, publié sous les conditions, sur la même page
 * (`/conditions-tournoi#reglement`) : un seul lien donne tout. Source : `pilotage/tournoi-mtp/REGLEMENT.md` (v3,
 * 15/11, dépôt méthode ace3971c du 17/11, qui porte déjà les 2 retouches du chef du tournoi : la phrase sur les
 * points entre crochets retirée, « Murs, rentrées et hauteur du ballon » tranché), recopiée telle quelle, gras et
 * puces retirés. Aucun crochet ne reste. L'adresse du complexe : ADRESSE_DU_COMPLEXE (conditionsTournoi.js).
 * ⚠️ Une virgule changée ici change la page publiée. Témoin : __tests__/D48-reglement-et-autorisation.test.js.
 */

import { ADRESSE_DU_COMPLEXE } from './conditionsTournoi';

/** La ligne de titre du règlement, affichée sous « Règlement du tournoi ». */
export const EN_TETE_DU_REGLEMENT = 'Règlement du tournoi FoundClub x AR Soccer — samedi 19 décembre 2026, à partir de 19 h (v5, 19/11)';

/**
 * Les sections du règlement, dans l'ordre : ses paragraphes et son `titre` (null pour l'introduction).
 * @type {ReadonlyArray<{ paragraphes: ReadonlyArray<string>, titre: string | null }>}
 */
export const SECTIONS_DU_REGLEMENT = Object.freeze([
  {
    paragraphes: [
      `Organisé par FoundClub, à AR Soccer (${ADRESSE_DU_COMPLEXE}), sur 3 terrains en salle. Chaque joueur accepte ce règlement en s'inscrivant.`,
      'Horaire : accueil à 19 h ; briefing des capitaines à 19 h 20 ; premier coup d\'envoi à 19 h 30 ; fin de la phase de ligue vers 22 h 45 (20 équipes) ou 23 h 15 (24 équipes) ; finale vers 23 h 45 (20 équipes) ou 0 h 15 (24 équipes), puis la remise des prix. Fin au plus tard à 1 h. Le planning exact de chaque équipe est publié sur FoundClub avant le tournoi.',
    ],
    titre: null,
  },
  {
    paragraphes: [
      '5 joueurs sur le terrain, gardien compris. Pas de limite de remplaçants : chaque joueur de l\'équipe doit avoir payé sa place.',
      'Une équipe est validée quand 5 de ses joueurs ont payé leur place. On peut s\'inscrire avec son équipe complète, ou seul, ou à 2, 3 ou 4 : FoundClub complète l\'équipe avec d\'autres joueurs inscrits.',
      'Changements illimités et volants, à hauteur de son banc, sans arrêter le jeu (le gardien change à l\'arrêt de jeu).',
      'Il faut 4 joueurs au minimum pour commencer ou continuer un match.',
      'Un joueur ne joue que pour une seule équipe, et seulement s\'il a payé sa place. Un capitaine par équipe, majeur, désigné à l\'inscription ou par l\'organisateur.',
      'La place payée suit le joueur. S\'il change d\'équipe dans le même tournoi, il ne repaie pas : sa place passe dans la nouvelle équipe, et l\'ancienne équipe compte un joueur payé de moins (conditions d\'inscription, § 3). Une équipe validée ne redescend pas : un joueur payé ne peut pas la quitter si elle passe ainsi sous 5 joueurs payés. Il peut partir dès qu\'un 6ᵉ joueur a payé. La même règle vaut quand le capitaine retire un joueur payé.',
      'Âge : 16 ans révolus le 19/12/2026. De 16 à 17 ans, l\'autorisation parentale est obligatoire, sinon le joueur ne joue pas (voir les conditions d\'inscription).',
      'Chaussures de salle ou moulées, pas de crampons. Protège-tibias conseillés. Chaque joueur porte le maillot du tournoi, offert et remis à l’accueil (19 h - 19 h 20), dans la limite des tailles et des stocks ; à défaut, il porte une chasuble de la couleur de son équipe.',
    ],
    titre: '1. L\'équipe',
  },
  {
    paragraphes: [
      'Chaque match dure 12 min, sans mi-temps, phase finale comprise. À 24 équipes, si le premier coup d\'envoi part après 19 h 45, les matchs de la phase de ligue durent 10 min au lieu de 12. La phase finale reste à 12 min. L\'organisateur l\'annonce au briefing des capitaines.',
      'Pas de hors-jeu. Pas de tacle glissé : faute directe. Murs, rentrées et hauteur du ballon : selon les règles d\'AR Soccer, rappelées au briefing des capitaines.',
      'Coup d\'envoi : l\'équipe nommée en premier sur le planning.',
      'Points : victoire 3, nul 1, défaite 0.',
      'L\'arbitre a toujours raison sur un fait de jeu : on ne revient pas sur un but, une faute ou un carton.',
    ],
    titre: '2. Le jeu',
  },
  {
    paragraphes: [
      'Carton jaune = 2 minutes dehors. L\'équipe joue à 4 pendant 2 minutes. Deux jaunes dans un même match = rouge.',
      'Carton rouge = exclu pour le reste du match ET le match suivant. L\'équipe joue à 4 pendant 3 minutes, puis un remplaçant peut entrer.',
      'Violence, insulte, crachat, envers quiconque (arbitre, adversaire, public, organisateur) : exclusion du tournoi, sans remboursement, et l\'équipe peut être exclue avec lui.',
      'Les cartons sont des sanctions sportives ; ils ne comptent pas dans le classement.',
    ],
    titre: '3. Cartons',
  },
  {
    paragraphes: [
      'Toutes les équipes sont dans un seul classement. Chacune joue 4 matchs de ligue, contre 4 adversaires différents, désignés par un tirage au sort fait dans l’app au début du tournoi. Points : victoire 3, nul 1, défaite 0. À égalité de points, dans cet ordre :',
      '1. la différence de buts ;',
      '2. le nombre de buts marqués ;',
      '3. le nombre de victoires ;',
      '4. les points des adversaires rencontrés (le calendrier le plus dur passe devant) ;',
      '5. le tirage au sort : l\'ordre tiré au début du tournoi.',
      'Nombre d\'équipes pair. Le tournoi se joue à un nombre pair d\'équipes (20 ou 24), pour qu\'aucune équipe ne reste au repos pendant toute une journée de ligue. À la clôture des inscriptions (10/12/2026 à 23 h 59), si le nombre d\'équipes validées est impair, FoundClub complète une équipe avec des joueurs inscrits seuls ; à défaut, la dernière équipe validée passe en liste d\'attente, et si elle ne joue pas, ses joueurs sont remboursés comme pour une équipe non validée (conditions d\'inscription, § 5).',
    ],
    titre: '4. Le classement (phase de ligue)',
  },
  {
    paragraphes: [
      'Les 8 premiers jouent les quarts : 1ᵉʳ contre 8ᵉ, 2ᵉ contre 7ᵉ, 3ᵉ contre 6ᵉ, 4ᵉ contre 5ᵉ ; puis demies, petite finale et finale.',
      'Pas de match nul. À égalité à la fin du temps, tirs au but : 3 tireurs par équipe, puis mort subite, par des joueurs différents tant qu\'il en reste. Le vainqueur aux tirs au but est inscrit comme gagnant du match.',
    ],
    titre: '4 bis. La phase finale',
  },
  {
    paragraphes: [
      'Une équipe absente ou incomplète (moins de 4) 5 minutes après l\'heure du match perd 3-0.',
      'Une équipe qui tombe à moins de 4 joueurs en cours de match perd 3-0 (ou sur le score acquis s\'il est plus large).',
      'Deux forfaits, ou un abandon du tournoi : forfait général. Tous ses matchs de ligue, joués ou non, comptent 3-0 pour l\'adversaire. En phase finale, son adversaire passe au tour suivant.',
      'Forfait et remboursement : voir les conditions d\'inscription.',
    ],
    titre: '5. Forfaits et retards',
  },
  {
    paragraphes: [
      'Seul le capitaine réclame, à la table de marque, dans les 10 minutes après la fin du match, et avant le match suivant de l\'une des deux équipes.',
      'Une réclamation ne porte que sur une erreur de feuille de match (score, horaire) ou sur un joueur non inscrit, inscrit dans une autre équipe ou suspendu. Jamais sur l\'arbitrage.',
      'Le jury tranche sur place, sans appel : deux représentants de FoundClub et l\'arbitre principal. Un joueur non autorisé fait perdre le match 3-0.',
    ],
    titre: '6. Réclamations',
  },
  {
    paragraphes: [
      'Les résultats et le classement sont publiés en direct sur FoundClub.',
      'Chacun veille à ses affaires ; l\'organisateur ne garde pas les objets.',
      'Les règles d\'AR Soccer s\'appliquent dans le complexe (vente d\'alcool interdite aux mineurs).',
      'Tout cas non prévu ici est tranché par le jury du § 6.',
    ],
    titre: '7. Le reste',
  },
]);
