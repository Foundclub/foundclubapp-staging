import PastilleDEtat from '@/views/profile/parent/PastilleDEtat';

import { useMesReservations } from '@/services/complexe/complexeJoueurQueries';

/**
 * LE NOMBRE DE RÉSERVATIONS À VENIR — RESA-L6B-1 (19/10/2026), planche EP10 état 5 : la rangée
 * « Mes réservations » de « Mon compte » le porte ; « 0 » ne s'écrit jamais (comme « Mes
 * enfants »).
 * Monté seulement l'interrupteur `COMPLEXES_JOUEUR` allumé (la rangée n'existe pas sinon) : éteint,
 * rien n'est lu.
 * @returns {import('react').ReactElement | null} La pastille, ou rien.
 */
function NombreAVenir() {
  const lecture = useMesReservations('a-venir');
  const nombre = Array.isArray(lecture?.data) ? lecture.data.length : 0;
  if (nombre <= 0) return null;
  return <PastilleDEtat testID="mesReservations-nombre" texte={String(nombre)} ton="compte" />;
}

export default NombreAVenir;
