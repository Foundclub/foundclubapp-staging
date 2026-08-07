/**
 * app/src/domains/visuals/eventShowcaseTemplate.js
 *
 * QUEL GABARIT D'AFFICHE POUR QUEL TYPE D'EVENEMENT (D28, 2026-08-07).
 *
 * 🧨 LE DEFAUT CORRIGE ICI EST UN DEFAUT DE SILENCE, PAS DE CALCUL.
 * `EventPublishedShowcase.js` lisait `params.template || 'affiche-detection'`, et
 * AUCUN des deux appelants du monde evenement (`EventWizardRecap` apres
 * publication, `EventDetails` depuis le detail) ne passait `template`. Un
 * entrainement, un match, un tournoi, un stage recevaient donc l'affiche de
 * DETECTION — avec sa promesse « Viens montrer ce que tu vaux ». Le choix
 * n'etait pas mauvais : il n'etait PAS FAIT.
 *
 * ⛔ CE QUI N'EST PAS CORRIGE ICI, ET POURQUOI : il n'y a qu'UN SEUL gabarit de
 * sujet `event` cote serveur (`admin/.../visualModel.ts` VISUAL_TEMPLATES :
 * `affiche-club` = club, `avis-de-recherche` = annonce, `post-story-detection`
 * = ancien gabarit absent du catalogue de l'app). Dessiner une affiche de match
 * ou d'entrainement est un travail de DESIGN — accroche, hierarchie, variantes —
 * qui vient du studio, pas d'ici. La carte des manques est dans le compte rendu
 * D28 ; elle sert de brief au prochain pack.
 *
 * ⚠️ CE QUE FAIT CE MODULE EN ATTENDANT : il rend le choix EXPLICITE. Une
 * detection demande `affiche-detection` parce qu'elle la veut ; les autres types
 * la recoivent parce que c'est le REPLI ASSUME — une affiche imparfaite vaut
 * mieux qu'un ecran vide. Les deux chemins rendent aujourd'hui la meme valeur,
 * et c'est VOULU : le jour ou le repli change, ou ou un gabarit « match »
 * arrive, la detection ne bouge pas et le nouveau type se branche ici, en un
 * seul endroit.
 *
 * ⛔ Le gabarit se choisit sur le TYPE, jamais sur le titre saisi : le titre est
 * libre. Et la reconnaissance de type n'est pas reecrite ici — `is*EventType`
 * est deja exporte par le domaine evenement (§1 bis, barreau 2).
 */

import { isDetectionEventType } from '@/domains/event/eventUseCases';

/**
 * Le gabarit servi aux types qui n'ont pas encore le leur.
 *
 * Ce n'est pas un defaut technique, c'est une DECISION : tant que le studio n'a
 * pas dessine l'affiche du match / de l'entrainement / du tournoi / du stage,
 * ces evenements gardent celle de la detection plutot que de n'avoir aucune
 * affiche a partager. Sa promesse est fausse pour eux — c'est le prix assume,
 * et c'est le premier point du brief design.
 */
export const EVENT_SHOWCASE_FALLBACK_TEMPLATE = 'affiche-detection';

/**
 * Le gabarit d'affiche d'un evenement, decide par son type.
 *
 * Rend TOUJOURS une cle de gabarit connue de `SHOWCASE_TEMPLATES`
 * (`useEventShowcase.js`) : un type inconnu, absent, ou servi sous un nom que
 * personne n'a prevu ne casse pas la generation, il tombe sur le repli.
 * @param {string} [typeName] Nom du type tel que le serveur le sert (« Match »,
 *   « Detection / Seance d'essai »… — accents et casse indifferents).
 * @returns {string} Cle du gabarit a passer a `EventPublishedShowcase`.
 */
export const getEventShowcaseTemplate = (typeName) => {
  // La detection a SON gabarit : elle le demande nommement, elle ne compte plus
  // sur le repli. C'est toute la difference entre un choix et un accident.
  if (isDetectionEventType(typeName)) return 'affiche-detection';

  // Match · Entrainement · Tournoi · Stage · Autre · Reservation, et tout type
  // que le serveur ajouterait demain : aucun gabarit dedie n'existe encore.
  return EVENT_SHOWCASE_FALLBACK_TEMPLATE;
};
