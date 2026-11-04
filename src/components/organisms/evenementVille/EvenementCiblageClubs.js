import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { clubsPrecisPreview } from '@/domains/collectivite/collectiviteActualites';
import useTheme from '@/theme/themeContext';

import ActualiteCiblageClubs from '@/views/collectivite/components/ActualiteCiblageClubs';

import { useActualiteRecipients } from '@/services/collectivite/collectiviteActualiteQueries';

/**
 * 🏛️ T3-ACTU-CIBLE (décision d'Adel du 03/11/2026) — « Des clubs précis » pour l'actualité d'un
 * événement : le bloc de l'actualité de la Ville, et le nombre de destinataires avant de publier.
 * Un composant à part : le formulaire ne lit ni les clubs ni ce nombre sans cette pastille.
 * @param {{
 *   clubIds: string[];
 *   collectiviteId: string;
 *   onClubIds: (ids: string[]) => void;
 *   onRoles: (roles: string[]) => void;
 *   roles: string[];
 * }} props - Ce qui est coché, et de quoi le changer.
 * @returns {import('react').ReactElement} Le bloc.
 */
function EvenementCiblageClubs({
  clubIds,
  collectiviteId,
  onClubIds,
  onRoles,
  roles,
}) {
  const { t } = useTranslation();
  const { Fonts } = /** @type {any} */ (useTheme());
  const destinataires = useActualiteRecipients(collectiviteId, {
    audience: 'clubs',
    clubIds,
    roles,
  });
  return (
    <View style={{ gap: 12 }}>
      <ActualiteCiblageClubs
        clubIds={clubIds}
        collectiviteId={collectiviteId}
        onClubIds={onClubIds}
        onRoles={onRoles}
        roles={roles}
      />
      <Text style={[Fonts.p3, Fonts.neutral300]} testID="evenement-destinataires">
        {clubsPrecisPreview(t, {
          approximate: destinataires.data?.approximate === true,
          clubsCoches: clubIds.length,
          clubsCount: destinataires.data?.clubsCount,
          personsCount: destinataires.data?.personsCount,
          rolesCoches: roles.length,
        })}
      </Text>
    </View>
  );
}

export default EvenementCiblageClubs;
