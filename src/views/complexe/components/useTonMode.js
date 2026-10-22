import { useCallback, useMemo } from 'react';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import {
  canUseParentMode,
  canUsePlayerMode,
  resolveDisplayRoleKey,
  useDisplayModeRequest,
  writeDisplayModeRequest,
} from '@/domains/auth/playerMode';
import { complexeChoisi, complexesOuvrables } from '@/domains/complexe/complexeGerant';
import { ecrireModeComplexe } from '@/domains/complexe/modeComplexe';
import { positionActive, positionsDuCompte } from '@/domains/complexe/tonMode';

import { peutAvoirDesEnfants } from '@/views/profile/parent/mesEnfantsEnBref';
import useMesEnfantsEnBref from '@/views/profile/parent/useMesEnfantsEnBref';

import { useMesComplexes } from '@/services/complexe/complexeQueries';

/** @typedef {import('@/domains/complexe/tonMode').Position} Position */

/**
 * LA BASCULE « TON MODE », vue de l'espace du complexe et du menu du site — RESA-BASCULE
 * (20/10/2026), planche RB-3. Elle compose ses positions avec ce que l'app sait déjà : le rôle du
 * compte, le mode joueur permis, ses enfants (les lectures de « Mes enfants », mêmes clés), son
 * complexe. Elle ne lit que les MAGASINS des deux réglages gardés sur le téléphone (mode
 * d'affichage, mode complexe), jamais `useAuth` ni la navigation : le menu du site
 * (`web/src/layout/AppShell.tsx`) vit hors des écrans, où `useAuth` de l'app lancerait ses effets
 * et où la navigation n'existe pas. L'hôte navigue lui-même.
 * @param {object} options - Le compte et l'endroit.
 * @param {any} options.compte - Le profil (`documentId`, `role`, `myTeams`).
 * @param {string | null} [options.complexeId] - Le complexe de l'adresse, sinon le premier.
 * @param {boolean} [options.dansLeComplexe] - L'écran est dans l'espace du complexe.
 * @param {boolean} [options.lire] - Faux : rien n'est lu (interrupteur éteint, menu caché).
 * @param {string} [options.roleDuCompte] - Le rôle du compte quand l'hôte le connaît déjà.
 * @returns {{
 *   actif: import('@/domains/complexe/tonMode').CleDePosition | null,
 *   choisirHorsDuComplexe: (position: Position) => void,
 *   complexe: any,
 *   nomDuComplexe: string,
 *   positions: Position[],
 *   prenoms: string[],
 *   roleDuCompte: string,
 *   versLeComplexe: () => void,
 * }} Ce que la pièce affiche, et les deux réglages à écrire.
 */
export default function useTonMode({
  complexeId = null, compte, dansLeComplexe = false, lire = true, roleDuCompte: roleConnu,
}) {
  const roleDuCompte = roleConnu || getUserRoleKey(compte?.role?.type || compte?.role?.name);
  const compteId = compte?.documentId || null;
  const lu = Boolean(lire && compteId);
  const demande = useDisplayModeRequest(compteId);
  const affichage = resolveDisplayRoleKey({
    accountRoleKey: roleDuCompte, displayModeRequest: demande, userData: compte,
  });
  /** @type {'player' | 'parent' | null} */
  let modeAffiche = null;
  if (affichage === 'player' && roleDuCompte !== 'player') modeAffiche = 'player';
  else if (affichage === 'parent' && roleDuCompte !== 'parent') modeAffiche = 'parent';

  const mes = useMesComplexes({ enabled: lu });
  const complexe = lu ? complexeChoisi(complexesOuvrables(mes.data), complexeId) : null;
  const enfants = useMesEnfantsEnBref({ actif: lu && peutAvoirDesEnfants(roleDuCompte) });
  const prenoms = useMemo(() => enfants.lignes.map((ligne) => ligne.prenom), [enfants.lignes]);
  const positions = positionsDuCompte({
    aDesEnfants: canUseParentMode(roleDuCompte) && enfants.total > 0,
    // Dans l'espace du complexe, la position Complexe est sûre avant même la lecture (5b).
    aUnComplexe: dansLeComplexe || Boolean(complexe),
    peutJouer: canUsePlayerMode(roleDuCompte, compte),
    roleDuCompte,
  });

  // Quitter le complexe pour l'accueil de l'app dans ce mode ; le téléphone oublie le complexe.
  const choisirHorsDuComplexe = useCallback((/** @type {Position} */ position) => {
    ecrireModeComplexe(compteId, false);
    writeDisplayModeRequest(compteId, position.mode);
  }, [compteId]);
  // Vers le complexe : l'app s'y rouvrira au prochain lancement.
  const versLeComplexe = useCallback(() => {
    ecrireModeComplexe(compteId, true);
  }, [compteId]);

  return {
    actif: positionActive({ dansLeComplexe, modeAffiche, roleDuCompte }),
    choisirHorsDuComplexe,
    complexe,
    nomDuComplexe: String(complexe?.name || ''),
    positions,
    prenoms,
    roleDuCompte,
    versLeComplexe,
  };
}
