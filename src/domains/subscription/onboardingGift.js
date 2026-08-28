/**
 * ============================================================================
 * LA DUREE DU CADEAU DE BIENVENUE, COTE APP — ELLE SE REGLE ICI, SUR CETTE LIGNE.
 * ============================================================================
 * Lot CADEAU-2, 2026-08-28. La page cadeau doit annoncer sa duree : sans elle,
 * « un abonnement club illimite » se lit comme un abonnement DEFINITIF.
 *
 * ⛔ CE NOMBRE NE SE RECOPIE JAMAIS DANS UNE PHRASE. Les libelles portent
 * `{{count}}` et recoivent cette constante ; un « 7 » ecrit dans un texte
 * resterait a 7 le jour ou la duree changerait, et l'ecran mentirait sans que
 * rien ne le signale. Le temoin
 * `views/subscription/__tests__/cadeau2PageCadeauSoignee.test.js` remplace
 * cette valeur par 30 et exige que l'ecran affiche 30.
 *
 * 🪞 C'EST UN MIROIR, PAS LA SOURCE — et c'est une limite assumee, pas un
 * oubli. La source de verite vit sur le serveur
 * (`admin/src/api/subscription/services/subscription-trial.ts`,
 * `ONBOARDING_GIFT_DURATION_DAYS`) : c'est elle qui calcule la date de fin des
 * droits. Le serveur ne publie cette duree dans AUCUNE reponse avant le clic
 * (elle n'apparait qu'au journal, a l'octroi), donc l'app ne peut pas la lire.
 * ⇒ Changer la duree demande DEUX lignes, une par depot, et elles portent le
 * meme nom exprès pour se retrouver l'une l'autre.
 * @type {number}
 */
export const ONBOARDING_GIFT_DURATION_DAYS = 7;
