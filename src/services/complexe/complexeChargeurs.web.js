/**
 * LES DEUX DÉPENDANCES DE complexeService.js — pour le SITE. RESA-L7-1 (20/10/2026).
 *
 * Jumeau de `complexeChargeurs.js` (mêmes exports, même forme : une fonction qui rend le module)
 * que Vite prend à sa place (web/vite.config.ts, `resolve.extensions`). Le serveur de dev du site
 * n'a pas `require` (« ReferenceError: require is not defined », mémoire
 * piege-require-module-js-casse-le-site) : ici, tout est importé en tête. Le site a toujours
 * l'adresse de son serveur, la raison du chargement à l'appel (les témoins sans `.env`) ne le
 * concerne pas.
 */
import clientDuSite from '../client';
import * as servicesDesFermetures from '../facilityClosure/facilityClosureService';

/**
 * Le client HTTP du site.
 * @returns {any} Le client axios.
 */
export const client = () => clientDuSite;

/**
 * Le service des fermetures.
 * @returns {any} Le module.
 */
export const fermetures = () => servicesDesFermetures;
