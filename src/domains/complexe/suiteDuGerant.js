import { getUserRoleKey } from '@/domains/auth/authUseCases';
import { suiteApresIdentite } from '@/domains/complexe/arriveeSansRole';
import { lireModeComplexe } from '@/domains/complexe/modeComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { lireMesComplexes } from '@/services/complexe/complexeService';

import { COMPLEXES_GERANT } from '@/config/fonctionsMasquees';

/**
 * GERANT-INSCRIPTION (10/11/2026) — OÙ VA LE GÉRANT D'UN COMPLEXE APRÈS « QUI ES-TU ? »
 * (UserName) ou la déclaration parentale (UserParentalDeclaration) : son complexe s'il en gère un,
 * la fiche du complexe s'il a choisi « Je gère un complexe » (mode complexe) sans l'avoir créé.
 * Seul un compte SANS rôle sportif est concerné : les autres gardent leur parcours.
 *
 * L'âge minimum du gérant (18 ans, Adel « 224- B ») : `AGE_MINIMUM_GERANT`, lu par UserName.
 * ponytail: une lecture de « mes complexes » en panne ramène à la fiche si le mode complexe est
 * allumé (au pire, la fiche d'un gérant qui en a déjà un) ; sinon au parcours habituel.
 * @param {any} compte - Le profil connecté (avant l'envoi : seuls son rôle et son id comptent).
 * @returns {Promise<{ name: string, params?: object } | null>} L'écran suivant, ou null.
 */
const suiteDuGerant = async (compte) => {
  if (!COMPLEXES_GERANT || getUserRoleKey(compte?.role?.type || compte?.role?.name) !== 'new') {
    return null;
  }
  /** @type {any[]} */
  let complexes = [];
  try {
    const corps = await lireMesComplexes();
    complexes = Array.isArray(corps?.data) ? corps.data : [];
  } catch {
    complexes = [];
  }
  const suite = suiteApresIdentite({
    complexesGeres: complexes.length,
    intentionComplexe: lireModeComplexe(compte?.documentId),
  });
  if (suite === 'complexe') {
    return { name: RouteNames.ComplexeEspace, params: { complexeId: complexes[0]?.documentId } };
  }
  if (suite === 'fiche-complexe') return { name: RouteNames.ComplexeDevenirGerant };
  return null;
};

export default suiteDuGerant;
