// @ts-nocheck
/**
 * ProfileCardThumb — CARTECODE Q2 B (registre des mineurs ligne 44) : la carte d'un AUTRE joueur
 * en tête de son profil, seulement s'il est majeur, que son compte n'est pas privé, et pour un
 * membre connecté. Jamais pour un mineur. Elle ne montre que ce que le profil public rend déjà :
 * ni numéro, ni nationalité, ni ville (le serveur ne les rend pas), aucune case vide.
 * RATTRAPAGE (149 A, 150 A) : la rareté compte le parcours et les matchs que l'écran du profil a
 * déjà chargés. ponytail: les 3 cases cachées et les matchs refusés (403 hors encadrants) restent
 * hors du compte, la vignette peut donc rester sous la vraie rareté ; sortie : le serveur rend la
 * rareté calculée sur le profil complet (question au chef, lot RATTRAPAGE).
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { canShowCardOnProfile } from '@/domains/playerCard/cardConsent';
import { buildPlayerCardModel } from '@/domains/playerCard/cardModel';
import { buildPlayerCardProps } from '@/domains/playerCard/cardProps';

import PlayerCard from '@/components/organisms/playerCard/PlayerCard';

import { buildCardQrTarget } from '@/services/playerCard/cardQrTarget';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * La vignette, ou rien quand la règle Q2 B ne l’autorise pas.
 * @param {{ histories?: object[], matchCount?: number, profile?: object,
 *   viewer?: object | null, width: number }} props
 * @returns {import('react').ReactElement | null}
 */
function ProfileCardThumb({
  histories = [], matchCount = 0, profile, viewer, width,
}) {
  const { t } = useTranslation();
  const visible = canShowCardOnProfile({ profile, viewer });
  const props = useMemo(() => {
    if (!visible) return null;
    const qr = buildCardQrTarget({ user: profile });
    const model = buildPlayerCardModel({
      histories, matchCount, qrUrl: qr.url, user: profile,
    });
    const {
      nationalite, numero, ville, ...carte
    } = buildPlayerCardProps({
      imageUrl: getImageUrl,
      labels: {
        now: t('playerCard.nowShort', 'AUJ.'),
        yearsUnit: t('playerCard.field.yearsUnit', 'ans'),
      },
      model,
      qr,
    });
    return { ...carte, age: `${profile.age} ${t('playerCard.field.yearsUnit', 'ans')}` };
  }, [histories, matchCount, profile, t, visible]);

  if (!props) return null;
  return (
    <View style={{ alignItems: 'center' }} testID="profile-card-thumb">
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <PlayerCard {...props} mode="image" width={width} />
    </View>
  );
}

export default ProfileCardThumb;
