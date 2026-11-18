import localeDesFormats from '@/theme/strings/localeDesFormats';

import { getItem, removeItem, setItem } from '@/platform/storage';

/**
 * T-PAGES-6b (18/11/2026, points 5 et 6 de T-PAGES-6) — LE TOURNOI RETENU PENDANT LA
 * CRÉATION DU COMPTE, téléphone et site. Le visiteur vient d'un tournoi (le bouton de sa fiche, ou
 * l'aperçu d'un lien d'équipe) : l'écran du numéro (Register) et celui du rôle (UserRole) le lui
 * rappellent par un bandeau. Ils le LISENT sans l'effacer (on peut revenir en arrière dans le
 * tunnel) ; le retour au
 * tournoi l'efface (useLiensEnAttente, l'invitation ouverte avec un compte, l'accueil du site).
 * Rangé : l'identifiant, le nom et la date du tournoi, le nom de l'équipe s'il y en a une — jamais
 * une personne.
 * ponytail: retenu par APPAREIL et borné à 1 h, comme retourAuTournoi.js ; un tunnel repris plus
 * tard n'a plus de bandeau, il reste le même tunnel. Sortie : allonger la durée si la recette le
 * demande.
 * Témoin : src/domains/tournoi/__tests__/T-PAGES-6b.inscriptionEnCours.test.js.
 */

const CLE = 'inscription-au-tournoi';

export const DUREE_DE_L_INSCRIPTION_AU_TOURNOI_MS = 60 * 60 * 1000;

/**
 * Un texte court, nettoyé ; vide sinon.
 * @param {unknown} valeur - Une valeur reçue.
 * @returns {string} Le texte.
 */
const texte = (valeur) => (typeof valeur === 'string' ? valeur.trim() : '');

/**
 * Retient le tournoi (la fiche du visiteur, l'aperçu d'un lien d'équipe).
 * @param {{ equipe?: unknown, event: any }} entree - Le tournoi et l'équipe rejointe, s'il y en a.
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {void}
 */
export const retenirLInscriptionAuTournoi = ({ equipe, event }, maintenant = Date.now()) => {
  const eventId = texte(event?.documentId) || String(event?.id || '').trim();
  const nom = texte(event?.name);
  if (!eventId || !nom) return;
  try {
    setItem(CLE, JSON.stringify({
      at: maintenant, date: texte(event?.date), equipe: texte(equipe), eventId, nom,
    }));
  } catch {
    // Sans rangement, le tunnel reste celui de tout le monde.
  }
};

/**
 * Lit le tournoi retenu, SANS l'effacer.
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {{ date: string, equipe: string | null, eventId: string, nom: string } | null}
 */
export const lireLInscriptionAuTournoi = (maintenant = Date.now()) => {
  try {
    const retenu = JSON.parse(getItem(CLE) || 'null');
    const age = maintenant - Number(retenu?.at);
    const frais = Number.isFinite(age) && age >= 0 && age < DUREE_DE_L_INSCRIPTION_AU_TOURNOI_MS;
    const eventId = texte(retenu?.eventId);
    const nom = texte(retenu?.nom);
    if (!frais || !eventId || !nom) return null;
    return {
      date: texte(retenu?.date), equipe: texte(retenu?.equipe) || null, eventId, nom,
    };
  } catch {
    return null;
  }
};

/**
 * Efface le tournoi retenu (le retour au tournoi).
 * @returns {void}
 */
export const oublierLInscriptionAuTournoi = () => {
  try {
    removeItem(CLE);
  } catch {
    // Rien à effacer.
  }
};

/**
 * Ce que dit le bandeau : le tournoi, son jour (« Sam. 19 déc. ») et l'équipe rejointe.
 * @param {ReturnType<typeof lireLInscriptionAuTournoi>} retenu - Le tournoi retenu.
 * @param {string} [locale] - Les formats de l'appareil.
 * @returns {{ equipe: string | null, jour: string, tournoi: string } | null}
 */
export const decrireLInscriptionAuTournoi = (retenu, locale = localeDesFormats()) => {
  if (!retenu) return null;
  const date = new Date(retenu.date);
  const jour = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale, {
    day: 'numeric', month: 'short', weekday: 'short',
  });
  return {
    equipe: retenu.equipe,
    jour: jour ? jour.charAt(0).toUpperCase() + jour.slice(1) : '',
    tournoi: retenu.nom,
  };
};
