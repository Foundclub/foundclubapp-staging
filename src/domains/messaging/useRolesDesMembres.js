import { useQuery } from '@tanstack/react-query';

import { getUserRolesByIds } from '@/services/user/userService';

// MSG1BA — le crochet vit a part de `roleDuMembre.js` : « Infos du groupe » n'importe que le
// libelle, et ses temoins n'ont pas a charger le client HTTP (`.env` absent des copies).

/**
 * MSG1BA (§3.1) — LES ROLES DES MEMBRES D'UN GROUPE, lus a la demande.
 *
 * Un groupe n'a pas de contexte de club : le serveur 1B ne lui donne aucun `staffRoles`
 * (contrat §2.2, §10) et ses `participants` ne portent que le nom et l'avatar. On lit donc le
 * role de chaque membre par la route `/users` deja utilisee par « Nouvelle discussion ».
 * En echec (reseau, refus) : `{}`, et chacun reste « Membre » — rien ne s'affiche en rouge.
 * @param {string[]} ids - Les identifiants des membres.
 * @param {{ enabled?: boolean }} [options] - `enabled` : seulement quand la page est ouverte.
 * @returns {Record<string, string>} documentId -> nom du role (brut).
 */
const useRolesDesMembres = (ids, { enabled = true } = {}) => {
  const uniques = Array.from(new Set((ids || []).map((id) => String(id || '').trim())))
    .filter(Boolean)
    .sort();
  const { data } = useQuery({
    enabled: enabled && uniques.length > 0,
    queryFn: () => getUserRolesByIds(uniques),
    queryKey: ['roles-des-membres', uniques.join(',')],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  return data || {};
};

export default useRolesDesMembres;
