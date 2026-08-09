import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import {
  useDeleteHistory,
  useGetMyHistories,
  useGetUserHistories,
} from '@/services/userHistory/userHistoryQueries';

/**
 * @typedef {{
 *   id?: string | number;
 *   documentId?: string;
 *   isCurrentlyActive?: boolean;
 *   startYear?: number | string;
 *   endYear?: number | string;
 *   customClubName?: string;
 *   club?: { name?: string; logo?: { url?: string } };
 *   multisport_club?: { name?: string; logo?: { url?: string } };
 *   category?: { name?: string };
 *   level?: { name?: string };
 * }} UserHistoryItem
 */

/**
 * @param {object} props
 * @param {string} [props.userId]
 * @param {boolean} props.isOwnProfile
 * @param {() => void} [props.onAddPress]
 * @param {(item: UserHistoryItem) => void} [props.onEditPress]
 * @param {string} [props.bestLevel]
 * @param {string} [props.preferredSport]
 * @returns {import('react').ReactElement}
 */
function UserHistorySection({
  bestLevel,
  isOwnProfile = false,
  onAddPress,
  onEditPress,
  preferredSport,
  userId,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const shouldUseUserHistory = Boolean(userId);

  const { data: myHistoriesData, isLoading: isLoadingMyHistories } = useGetMyHistories({
    enabled: !shouldUseUserHistory,
  });
  const { data: userHistoriesData, isLoading: isLoadingUserHistories } = useGetUserHistories(
    userId || '',
    {
      enabled: shouldUseUserHistory,
    },
  );

  const historiesData = shouldUseUserHistory ? userHistoriesData : myHistoriesData;
  const isLoading = shouldUseUserHistory ? isLoadingUserHistories : isLoadingMyHistories;
  const sortedHistories = useMemo(() => {
    const source = Array.isArray(historiesData) ? historiesData : [];
    return [...source].sort((left, right) => {
      const leftActive = left?.isCurrentlyActive ? 1 : 0;
      const rightActive = right?.isCurrentlyActive ? 1 : 0;
      if (leftActive !== rightActive) return rightActive - leftActive;

      const leftStart = Number(left?.startYear || 0);
      const rightStart = Number(right?.startYear || 0);
      if (leftStart !== rightStart) return rightStart - leftStart;

      const leftEnd = Number(left?.endYear || 0);
      const rightEnd = Number(right?.endYear || 0);
      return rightEnd - leftEnd;
    });
  }, [historiesData]);

  const deleteHistoryMutation = useDeleteHistory();

  const handleDelete = (/** @type {string | number | undefined} */ historyId) => {
    if (!historyId) return;

    Alert.alert(
      t('common.actions.delete', 'Supprimer'),
      t('profile.history.deleteConfirmation', 'Veux-tu vraiment supprimer cette expérience ?'),
      [
        {
          style: 'cancel',
          text: t('common.actions.cancel', 'Annuler'),
        },
        {
          onPress: () => deleteHistoryMutation.mutate(historyId),
          style: 'destructive',
          text: t('common.actions.delete', 'Supprimer'),
        },
      ],
    );
  };

  const formatYearRange = (/** @type {UserHistoryItem} */ item) => {
    const start = String(item?.startYear || '').trim();
    const end = String(item?.endYear || '').trim();

    if (item?.isCurrentlyActive && start) {
      return `${start} - Aujourd'hui`;
    }
    if (start && end) {
      return start === end ? start : `${start} - ${end}`;
    }
    if (start) return start;
    if (end) return end;
    return t('profile.history.periodNotSet', 'Période non renseignée');
  };

  const getClubName = (/** @type {UserHistoryItem} */ item) => {
    if (item?.club?.name) return item.club.name;
    if (item?.multisport_club?.name) return item.multisport_club.name;
    return item?.customClubName || t('profile.history.unknownClub', 'Club inconnu');
  };

  const renderClubLogo = (/** @type {UserHistoryItem} */ item) => {
    const clubName = item?.club?.name || item?.multisport_club?.name || item?.customClubName || '';

    return (
      <ClubLogoMark
        club={item?.club || item?.multisport_club}
        logoStyle={{
          backgroundColor: `${Colors.primary700}A6`,
          borderColor: `${Colors.primary500}66`,
          borderRadius: 12,
          borderWidth: 1,
        }}
        name={clubName}
        size={44}
      />
    );
  };

  const infoPills = [
    preferredSport ? {
      label: t('userDetails.fields.sport', 'Sport'),
      value: preferredSport,
    } : null,
    bestLevel ? {
      label: t('profile.history.bestLevel', 'Meilleur niveau'),
      value: bestLevel,
    } : null,
  ].filter(Boolean);

  if (isLoading) {
    return (
      <View style={[Spaces.padding[16], Alignments.alignCenter]}>
        <ActivityIndicator color={Colors.primary500} />
      </View>
    );
  }

  // D54 — L'UNIQUE grammaire d'ajout du pack : une carte pointillee CYAN.
  // Elle remplace le bouton rond « + », et surtout elle est desormais rendue
  // AUSSI en pied de liste : avant, elle n'existait que dans l'etat vide, donc
  // des qu'on avait une experience le bouton rond etait le SEUL ajout possible.
  // Retirer le rond sans elle aurait supprime la fonction, pas un doublon.
  const bordureCartePointillee = {
    borderColor: Colors.primary500,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
  };

  const carteAjoutPointillee = isOwnProfile ? (
    <TouchableOpacity
      onPress={() => onAddPress?.()}
      style={[
        Spaces.padding[16],
        Alignments.alignCenter,
        { backgroundColor: Colors.neutral800, ...bordureCartePointillee },
      ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.primary500]}>
        +
        {' '}
        {t('profile.history.add', 'Ajouter une expérience')}
      </Text>
    </TouchableOpacity>
  ) : null;

  return (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        Spaces.gap[16],
        {
          backgroundColor: `${Colors.primary700}73`,
          borderColor: `${Colors.primary500}80`,
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <View style={[Spaces.gap[4], { flex: 1, paddingRight: 12 }]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('profile.history.title', 'Historique sportif')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('profile.history.count', '{{count}} expérience(s)', { count: sortedHistories.length })}
          </Text>
        </View>

        {/* D54 — le bouton rond « + » a disparu : le pack ne veut QU'UNE
            grammaire d'ajout, la carte pointillee cyan en pied de liste
            (`carteAjoutPointillee`), qui est desormais rendue dans les deux
            etats — liste vide ET liste remplie. */}
      </View>

      <View
        style={[
          ApplicationStyle.separator,
          { backgroundColor: `${Colors.primary500}3D` },
        ]}
      />

      {infoPills.length > 0 ? (
        <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
          {infoPills.map((item) => (
            <View
              key={item.label}
              style={{
                backgroundColor: `${Colors.primary500}20`,
                borderColor: `${Colors.primary500}66`,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {item.label}
                {' '}
                :
                {' '}
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{item.value}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {sortedHistories.length === 0 ? (
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.p1, Fonts.neutral00, { textAlign: 'center' }]}>
            {isOwnProfile
              ? t('profile.history.empty', 'Ajoute ton parcours sportif pour enrichir ton profil')
              : t('profile.history.emptyOther', 'Aucun historique renseigne')}
          </Text>

          {/* D54 — la MEME carte qu'en pied de liste. L'ancienne version
              enfermait la phrase et le lien dans un cadre pointille GRIS et
              collait au lien un `Spaces.marginTop[14]` : 14 n'existe pas dans
              la rampe, la marge etait donc perdue en silence. */}
          {carteAjoutPointillee}
        </View>
      ) : (
        <View style={[Spaces.gap[16]]}>
          {sortedHistories.map((/** @type {UserHistoryItem} */ item) => (
            <TouchableOpacity
              disabled={!isOwnProfile}
              key={item.documentId || item.id}
              onPress={() => {
                if (isOwnProfile) onEditPress?.(item);
              }}
              style={[
                Spaces.padding[12],
                Spaces.gap[12],
                {
                  backgroundColor: `${Colors.primary700}8F`,
                  borderColor: `${Colors.primary500}66`,
                  borderRadius: 12,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.alignStart, Spaces.gap[12]]}>
                {renderClubLogo(item)}
                <View style={[Alignments.fill, Spaces.gap[4]]}>
                  <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { lineHeight: 22 }]}>
                    {getClubName(item)}
                  </Text>
                  <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                    {formatYearRange(item)}
                  </Text>
                </View>
                {item?.isCurrentlyActive ? (
                  <View
                    style={{
                      backgroundColor: `${Colors.primary500}20`,
                      borderColor: `${Colors.primary500}66`,
                      borderRadius: 999,
                      borderWidth: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.primary500]}>Actif</Text>
                  </View>
                ) : null}
              </View>

              <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8], Spaces.marginTop[4]]}>
                {item?.category?.name ? (
                  <View
                    style={{
                      backgroundColor: `${Colors.neutral700}55`,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={[Fonts.p3, Fonts.neutral100]}>
                      {t('userDetails.fields.category', 'Catégorie')}
                      {' '}
                      :
                      {' '}
                      {item.category.name}
                    </Text>
                  </View>
                ) : null}
                {item?.level?.name ? (
                  <View
                    style={{
                      backgroundColor: `${Colors.neutral700}55`,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={[Fonts.p3, Fonts.neutral100]}>
                      {t('userDetails.fields.bestLevel', 'Niveau')}
                      {' '}
                      :
                      {' '}
                      {item.level.name}
                    </Text>
                  </View>
                ) : null}
              </View>

              {isOwnProfile ? (
                <View
                  style={[
                    Alignments.row,
                    Alignments.justifySpaceBetween,
                    Alignments.alignCenter,
                    Spaces.marginTop[4],
                  ]}
                >
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {t('profile.history.tapToEdit', 'Touche la carte pour modifier')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.documentId || item.id)}
                    style={[Spaces.paddingHorizontal[8], Spaces.paddingVertical[4]]}
                  >
                    <Image
                      resizeMode="contain"
                      source={Images.trash}
                      style={{
                        height: 20,
                        tintColor: '#FF4D4D',
                        width: 20,
                      }}
                    />
                  </TouchableOpacity>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}

          {/* D54 — l'ajout EN PIED DE LISTE, ce qui manquait : sans lui, retirer
              le bouton rond « + » aurait laisse un profil deja rempli sans
              aucun moyen d'ajouter une experience de plus. */}
          {carteAjoutPointillee}
        </View>
      )}
    </View>
  );
}

export default UserHistorySection;
