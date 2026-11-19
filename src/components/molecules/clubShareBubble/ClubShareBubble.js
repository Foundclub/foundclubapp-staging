import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { useGetClub } from '@/services/club/clubQueries';

// ASSISTANCE-MINEURS-CLUB (19/11/2026, D271) — « Club partagé » : la carte d'un club envoyé
// avec le « + ». Les champs viennent du SERVEUR, qui a relu le club au passage
// (`admin/src/api/chat-message/services/carte-de-club.ts`) : nom, ville, logo, sport. Le club
// est relu à l'affichage : s'il a disparu (404), la carte le dit et ne mène nulle part.

/**
 * Le bas de la carte : « Handball · Aubagne (13) ».
 * @param {any} composition - La carte.
 * @returns {string} La ligne, ou une chaîne vide.
 */
export const ligneDuClub = (composition) => {
  const departement = String(composition?.postcode || '').trim().slice(0, 2);
  const ville = String(composition?.cityName || '').trim();
  const lieu = ville && departement ? `${ville} (${departement})` : ville;
  return [String(composition?.sport || '').trim(), lieu].filter(Boolean).join(' · ');
};

/**
 * La carte d'un club envoyé dans une conversation.
 * @param {object} props - Les propriétés.
 * @param {any} props.composition - `{ type: 'club_share', clubDocumentId, clubName, ... }`.
 * @param {boolean} [props.isMe] - Ma bulle (à droite).
 * @param {(clubDocumentId: string) => void} [props.onPressClub] - Ouvre la fiche du club.
 * @returns {import('react').ReactElement | null} La carte.
 */
function ClubShareBubble({
  composition,
  isMe = false,
  onPressClub,
}) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const clubDocumentId = typeof composition?.clubDocumentId === 'string'
    ? composition.clubDocumentId
    : '';
  const { error } = useGetClub(clubDocumentId, { retry: false, staleTime: 5 * 60_000 });
  if (!composition) return null;

  const statut = /** @type {any} */ (error)?.response?.status;
  const indisponible = !clubDocumentId || statut === 404;
  const nomDuClub = String(composition?.clubName || '').trim()
    || t('clubShareBubble.fallbackName', 'Club');
  const nom = indisponible
    ? t('clubShareBubble.unavailableTitle', "Ce club n'est plus disponible")
    : nomDuClub;
  const ligne = indisponible
    ? t('clubShareBubble.unavailableText', 'Il a été retiré de FoundClub')
    : ligneDuClub(composition);
  const ouvrir = () => {
    if (indisponible || typeof onPressClub !== 'function') return;
    onPressClub(clubDocumentId);
  };

  return (
    <View
      style={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        backgroundColor: withAlpha(Colors.chatSheet, 0.92),
        borderColor: withAlpha(Colors.primary500, 0.35),
        borderRadius: 14,
        borderWidth: 1,
        marginVertical: 6,
        maxWidth: '90%',
        minWidth: 260,
        opacity: indisponible ? 0.75 : 1,
        overflow: 'hidden',
      }}
      testID="bulle-club-partage"
    >
      <View style={{ gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
          {t('clubShareBubble.title', 'Club partagé')}
        </Text>
        <View style={{ alignItems: 'center', flexDirection: 'row' }}>
          <ClubLogoMark
            logoUrl={indisponible ? null : composition?.logoUrl || null}
            name={indisponible ? '?' : composition?.clubName}
            size={48}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <MarqueeText style={[Fonts.p2Bold, { color: Colors.neutral00 }]} text={nom} />
            {ligne ? (
              <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>
                {ligne}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={indisponible}
        onPress={ouvrir}
        style={{
          alignItems: 'center',
          borderTopColor: withAlpha(Colors.neutral00, 0.1),
          borderTopWidth: 1,
          paddingVertical: 10,
        }}
        testID="bulle-club-partage-ouvrir"
      >
        <Text
          style={[Fonts.p3Bold, { color: indisponible ? Colors.neutral300 : Colors.primary500 }]}
        >
          {indisponible
            ? t('clubShareBubble.unavailableAction', 'Indisponible')
            : t('clubShareBubble.open', 'Voir le club')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default ClubShareBubble;
