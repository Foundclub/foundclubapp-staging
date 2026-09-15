import { useNavigation, useRoute } from '@react-navigation/native';
import i18next from 'i18next';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import {
  CLUB_TABS,
  formatJsonPreview,
  getAddressObject,
  getClubActivityLabel,
  getClubAddressLabel,
  getClubCity,
  getClubCoordinates,
  getClubInitials,
  getClubRelationLabel,
  getDocumentId,
  normalizeRelationArray,
  normalizeSingleRelation,
  normalizeText,
} from '@/services/admin/adminClubContentModel';
import {
  useDeleteAdminClubContent,
  useGetAdminClubContent,
  useSearchAdminClubRelations,
  useUpdateAdminClubRelation,
} from '@/services/admin/adminClubContentQueries';
import { useVerifyAdminClub } from '@/services/admin/adminQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const RELATION_CONFIGS = [
  {
    field: 'activites',
    isMany: true,
    get label() {
      return i18next.t('adminClubDetail.relations.activities', 'Activites');
    },
    targetUid: 'api::activity.activity',
  },
  {
    field: 'members',
    isMany: true,
    get label() {
      return i18next.t('adminClubDetail.relations.members', 'Membres');
    },
    targetUid: 'plugin::users-permissions.user',
  },
  {
    field: 'teams',
    isMany: true,
    get label() {
      return i18next.t('adminClubDetail.relations.teams', 'Equipes');
    },
    targetUid: 'api::team.team',
  },
  {
    field: 'clubMembershipRequests',
    isMany: true,
    get label() {
      return i18next.t('adminClubDetail.relations.requests', 'Demandes');
    },
    targetUid: 'api::club-membership-request.club-membership-request',
  },
  {
    field: 'evenements',
    isMany: true,
    get label() {
      return i18next.t('adminClubDetail.relations.events', 'Evenements');
    },
    targetUid: 'api::event.event',
  },
  {
    field: 'facilities',
    isMany: true,
    get label() {
      return i18next.t('adminClubDetail.relations.facilities', 'Terrains');
    },
    targetUid: 'api::facility.facility',
  },
  {
    field: 'parentMultisport',
    isMany: false,
    get label() {
      return i18next.t('adminClubDetail.relations.parentMultisport', 'Club multisport parent');
    },
    targetUid: 'api::multisport-club.multisport-club',
  },
];

const getRelationItems = (club, config) => (
  config.isMany
    ? normalizeRelationArray(club?.[config.field])
    : [normalizeSingleRelation(club?.[config.field])].filter(Boolean)
);

const getBadgeColors = (tone, colors) => {
  if (tone === 'success') {
    return {
      backgroundColor: colors.success100,
      borderColor: colors.success500,
      textColor: colors.success700,
    };
  }

  if (tone === 'primary') {
    return {
      backgroundColor: `${colors.primary500}22`,
      borderColor: colors.primary500,
      textColor: colors.primary200,
    };
  }

  return {
    backgroundColor: colors.primary900,
    borderColor: colors.primary700,
    textColor: colors.neutral100,
  };
};

const formatAuditDate = (value) => {
  const safeValue = normalizeText(value);
  if (!safeValue) return '-';

  const date = new Date(safeValue);
  if (Number.isNaN(date.getTime())) return safeValue;

  return new Intl.DateTimeFormat(localeDesFormats(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

function AdminClubDetail() {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const route = useRoute();
  const navigation = useNavigation();
  const { clubId } = route.params || {};
  const [activeTab, setActiveTab] = useState('overview');
  const [isActionsVisible, setIsActionsVisible] = useState(false);
  const [relationConfig, setRelationConfig] = useState(null);
  const [relationQuery, setRelationQuery] = useState('');
  const [relationResults, setRelationResults] = useState([]);
  const [relationReason, setRelationReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleteVisible, setIsDeleteVisible] = useState(false);

  const {
    data: clubData,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useGetAdminClubContent(clubId);
  const relationSearchMutation = useSearchAdminClubRelations();
  const updateRelationMutation = useUpdateAdminClubRelation();
  const deleteMutation = useDeleteAdminClubContent();
  const verifyClubMutation = useVerifyAdminClub();

  const club = clubData?.data || clubData;

  // Vérifier / dé-vérifier le club en un clic (endpoint dédié minimal, pas le formulaire).
  const handleToggleVerification = useCallback(() => {
    if (!clubId || verifyClubMutation.isPending) return;
    const nextVerified = !(club?.clubVerified === true);
    verifyClubMutation.mutate(
      { documentId: clubId, verified: nextVerified },
      {
        onError: (err) => Alert.alert(
          t('adminClubDetail.errorTitle', 'Erreur'),
          getErrorMessage(err, 'generic'),
        ),
        onSuccess: () => {
          refetch?.();
          Alert.alert(
            nextVerified
              ? t('adminClubDetail.verifiedTitle', 'Club certifié')
              : t('adminClubDetail.unverifiedTitle', 'Certification retirée'),
            nextVerified
              ? t('adminClubDetail.verifiedMessage', 'Le club est maintenant certifié.')
              : t('adminClubDetail.unverifiedMessage', 'Le club n’est plus certifié.'),
          );
        },
      },
    );
  }, [clubId, club?.clubVerified, verifyClubMutation, refetch, t]);
  const isCompactScreen = screenWidth <= 360;
  const contentHorizontalPadding = isCompactScreen ? 8 : 10;
  const members = useMemo(() => normalizeRelationArray(club?.members), [club?.members]);
  const teams = useMemo(() => normalizeRelationArray(club?.teams), [club?.teams]);
  const requests = useMemo(() => normalizeRelationArray(club?.clubMembershipRequests), [club?.clubMembershipRequests]);
  const events = useMemo(() => normalizeRelationArray(club?.evenements), [club?.evenements]);
  const facilities = useMemo(() => normalizeRelationArray(club?.facilities), [club?.facilities]);
  const parentMultisport = normalizeSingleRelation(club?.parentMultisport);
  const address = useMemo(() => getAddressObject(club), [club]);
  const coordinates = useMemo(() => getClubCoordinates(club), [club]);
  const city = getClubCity(club);
  const activityLabel = getClubActivityLabel(club);
  const addressLabel = getClubAddressLabel(club);

  const stats = useMemo(() => ([
    { label: t('adminClubDetail.stats.members', 'Membres'), value: members.length },
    { label: t('adminClubDetail.stats.teams', 'Equipes'), value: teams.length },
    { label: t('adminClubDetail.stats.events', 'Evenements'), value: events.length },
    { label: t('adminClubDetail.stats.facilities', 'Terrains'), value: facilities.length },
    { label: t('adminClubDetail.stats.requests', 'Demandes'), value: requests.length },
    {
      label: t('adminClubDetail.stats.sponsors', 'Sponsors'),
      value: Array.isArray(club?.sponsor) ? club.sponsor.length : 0,
    },
  ]), [club?.sponsor, events.length, facilities.length, members.length, requests.length, t, teams.length]);

  const heroBadges = useMemo(() => ([
    {
      label: club?.clubPartner
        ? t('adminClubDetail.badges.partner', 'Partenaire')
        : t('adminClubDetail.badges.standard', 'Standard'),
      tone: club?.clubPartner ? 'primary' : 'neutral',
    },
    {
      label: club?.isReservationProvider
        ? t('adminClubDetail.badges.reservationOn', 'Réservation active')
        : t('adminClubDetail.badges.reservationOff', 'Pas réservation'),
      tone: club?.isReservationProvider ? 'primary' : 'neutral',
    },
    {
      label: club?.clubVerified
        ? t('adminClubDetail.badges.verified', 'Certifié')
        : t('adminClubDetail.badges.notVerified', 'Non certifié'),
      tone: club?.clubVerified ? 'success' : 'neutral',
    },
  ]), [club?.clubPartner, club?.clubVerified, club?.isReservationProvider, t]);

  const panelStyle = useMemo(() => ([
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius16,
    styles.panel,
    { borderColor: Colors.primary500, borderWidth: 1 },
  ]), [ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Colors.primary500]);

  const openRelationModal = useCallback((config) => {
    setRelationConfig(config);
    setRelationQuery('');
    setRelationResults([]);
    setRelationReason('');
  }, []);

  const closeRelationModal = useCallback(() => {
    if (relationSearchMutation.isPending || updateRelationMutation.isPending) return;
    setRelationConfig(null);
    setRelationQuery('');
    setRelationResults([]);
    setRelationReason('');
  }, [relationSearchMutation.isPending, updateRelationMutation.isPending]);

  const searchRelations = useCallback(async () => {
    if (!relationConfig) return;

    try {
      const response = await relationSearchMutation.mutateAsync({
        payload: {
          page: 1,
          pageSize: 20,
          q: relationQuery,
        },
        targetUid: relationConfig.targetUid,
      });
      setRelationResults(Array.isArray(response?.data) ? response.data : []);
    } catch (searchError) {
      Alert.alert(
        t('adminClubDetail.searchFailed', 'Recherche impossible'),
        getErrorMessage(searchError, 'generic'),
      );
    }
  }, [relationConfig, relationQuery, relationSearchMutation, t]);

  const mutateRelation = useCallback(async (action, target) => {
    if (!relationConfig || !clubId) return;

    const targetDocumentId = getDocumentId(target);
    const reason = normalizeText(relationReason) || `${action} ${relationConfig.label}`;
    if (!targetDocumentId) return;

    try {
      await updateRelationMutation.mutateAsync({
        action,
        documentId: clubId,
        field: relationConfig.field,
        isMany: relationConfig.isMany,
        reason,
        targetDocumentId,
      });
      closeRelationModal();
      refetch();
    } catch (mutationError) {
      Alert.alert(
        t('adminClubDetail.relationFailed', 'Relation impossible'),
        getErrorMessage(mutationError, 'generic'),
      );
    }
  }, [closeRelationModal, clubId, refetch, relationConfig, relationReason, t, updateRelationMutation]);

  const confirmDelete = useCallback(async () => {
    const reason = normalizeText(deleteReason);
    if (reason.length < 3) {
      Alert.alert(
        t('adminClubDetail.reasonRequiredTitle', 'Raison requise'),
        t('adminClubDetail.reasonRequiredMessage', "Ajoute une raison d'au moins 3 caractères."),
      );
      return;
    }

    try {
      await deleteMutation.mutateAsync({ documentId: clubId, reason });
      setIsDeleteVisible(false);
      navigation.goBack();
    } catch (deleteError) {
      Alert.alert(
        t('adminClubDetail.deleteFailed', 'Suppression impossible'),
        getErrorMessage(deleteError, 'generic'),
      );
    }
  }, [clubId, deleteMutation, deleteReason, navigation, t]);

  const renderInfoRows = useCallback((items) => items.map((item, index) => {
    const isLast = index === items.length - 1;
    return (
      <View
        key={item.label}
        style={[
          Spaces.paddingVertical[12],
          !isLast ? styles.infoRow : null,
          !isLast ? { borderBottomColor: `${Colors.primary500}33` } : null,
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>
          {item.label}
        </Text>
        <Text
          selectable={item.selectable !== false}
          style={[
            item.compact ? Fonts.p3Bold : Fonts.p2Bold,
            { color: Colors.neutral00 },
            Spaces.marginTop[6],
            styles.infoValue,
          ]}
        >
          {normalizeText(item.value) || '-'}
        </Text>
      </View>
    );
  }), [Colors.neutral00, Colors.primary200, Colors.primary500, Fonts.p2Bold, Fonts.p3Bold, Spaces.marginTop, Spaces.paddingVertical]);

  const renderStat = useCallback((stat) => (
    <View
      key={stat.label}
      style={[
        panelStyle,
        Spaces.padding[16],
        styles.statCard,
      ]}
    >
      <Text style={[Fonts.h2Bold, { color: Colors.primary500 }]}>
        {stat.value}
      </Text>
      <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[6]]}>
        {stat.label}
      </Text>
    </View>
  ), [Colors.neutral300, Colors.primary500, Fonts.h2Bold, Fonts.p2, Spaces.marginTop, Spaces.padding, panelStyle]);

  const renderRelationList = useCallback((config) => {
    const items = getRelationItems(club, config);

    return (
      <View
        key={config.field}
        style={[
          panelStyle,
          Spaces.padding[16],
          styles.sectionCard,
          Spaces.gap[12],
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[10]]}>
          <View style={styles.flexFill}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {config.label}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              {items.length}
              {' '}
              {t('adminClubDetail.itemsCount', 'element(s)')}
            </Text>
          </View>
          <Button
            onPress={() => openRelationModal(config)}
            size="sm"
            title={t('adminClubDetail.add', 'Ajouter')}
          />
        </View>

        <View style={Spaces.gap[8]}>
          {items.slice(0, 6).map((item) => (
            <View key={getDocumentId(item)} style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
              {config.field === 'members' ? (
                <ProfileAvatar
                  imageUrl={item?.avatar?.url}
                  name={[item?.firstname, item?.lastname].filter(Boolean).join(' ')}
                  size={32}
                />
              ) : null}
              <Text numberOfLines={2} style={[Fonts.p2, { color: Colors.neutral100, flex: 1 }]}>
                {getClubRelationLabel(item)}
              </Text>
              <TouchableOpacity onPress={() => mutateRelation('disconnect', item)}>
                <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>
                  {t('adminClubDetail.remove', 'Retirer')}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          {items.length > 6 ? (
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              +
              {items.length - 6}
              {' '}
              {t('adminClubDetail.moreItems', 'autres éléments')}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }, [
    Alignments,
    Colors.error500,
    Colors.neutral100,
    Colors.neutral300,
    Fonts.h4Bold,
    Fonts.neutral00,
    Fonts.p2,
    Fonts.p3,
    Fonts.p3Bold,
    Spaces.gap,
    Spaces.marginTop,
    Spaces.padding,
    club,
    mutateRelation,
    openRelationModal,
    panelStyle,
    t,
  ]);

  if (!clubId) {
    return (
      <AdminStateView
        actionLabel={t('adminClubDetail.states.back', 'Retour')}
        description={t(
          'adminClubDetail.states.missingId',
          "L'identifiant club est absent de l'URL.",
        )}
        onAction={() => navigation.goBack()}
        title={t('adminClubDetail.states.notFoundTitle', 'Club introuvable')}
      />
    );
  }

  if (isLoading && !club) {
    return (
      <AdminStateView
        description={t(
          'adminClubDetail.states.loadingDescription',
          'Nous chargeons la fiche Club depuis le Content Manager.',
        )}
        isLoading
        title={t('adminClubDetail.states.loadingTitle', 'Chargement du club')}
      />
    );
  }

  if (error && !club) {
    return (
      <AdminStateView
        actionLabel={t('adminClubDetail.states.retry', 'Reessayer')}
        description={getErrorMessage(error, 'generic') || t(
          'adminClubDetail.states.errorDescription',
          'Impossible de charger ce club.',
        )}
        onAction={refetch}
        title={t('adminClubDetail.states.errorTitle', 'Chargement impossible')}
      />
    );
  }

  if (!club) {
    return (
      <AdminStateView
        actionLabel={t('adminClubDetail.states.back', 'Retour')}
        description={t(
          'adminClubDetail.states.notFoundDescription',
          "Le club demande n'existe pas ou n'est plus accessible.",
        )}
        onAction={() => navigation.goBack()}
        title={t('adminClubDetail.states.notFoundTitle', 'Club introuvable')}
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[
          Spaces.paddingBottom[32],
          {
            gap: 18,
            paddingHorizontal: contentHorizontalPadding,
            paddingTop: 14,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            panelStyle,
            styles.heroPanel,
            {
              paddingBottom: 18,
              paddingHorizontal: 16,
              paddingTop: 16,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 14 }]}>
            <View
              style={[
                Alignments.center,
                styles.heroAvatar,
                {
                  backgroundColor: Colors.primary900,
                  borderColor: `${Colors.primary500}55`,
                  borderWidth: 1,
                  overflow: 'hidden',
                },
              ]}
            >
              {club.logo?.url ? (
                <Image resizeMode="cover" source={{ uri: club.logo.url }} style={styles.heroAvatar} />
              ) : (
                <Text style={[Fonts.h3Bold, { color: Colors.primary200 }]}>{getClubInitials(club)}</Text>
              )}
            </View>

            <View style={styles.heroContent}>
              <Text numberOfLines={2} style={[Fonts.h2Bold, Fonts.neutral00]}>
                {club.name || t('adminClubDetail.unnamedClub', 'Club sans nom')}
              </Text>
              <Text numberOfLines={2} style={[Fonts.p2, { color: Colors.neutral300, marginTop: 8 }]}>
                {[city, activityLabel].filter(Boolean).join(' - ') || t(
                  'adminClubDetail.noLocation',
                  'Aucune information de localisation',
                )}
              </Text>

              <View style={[Alignments.row, styles.heroBadges, { marginTop: 12 }]}>
                {heroBadges.map((badge) => {
                  const badgeColors = getBadgeColors(badge.tone, Colors);
                  return (
                    <View
                      key={badge.label}
                      style={[
                        ApplicationStyle.borderRadius12,
                        Spaces.paddingHorizontal[10],
                        Spaces.paddingVertical[5],
                        styles.badge,
                        {
                          backgroundColor: badgeColors.backgroundColor,
                          borderColor: badgeColors.borderColor,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p3Bold, { color: badgeColors.textColor }]}>
                        {badge.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={[Alignments.row, styles.heroActions, { marginTop: 16 }]}>
            <Button
              onPress={() => navigation.navigate(RouteNames.AdminClubForm, { clubId })}
              size="sm"
              style={isCompactScreen ? styles.fullWidthButton : styles.flexButton}
              title={t('adminClubDetail.edit', 'Modifier')}
            />
            <Button
              isLoading={verifyClubMutation.isPending}
              onPress={handleToggleVerification}
              size="sm"
              style={isCompactScreen ? styles.fullWidthButton : styles.flexButton}
              title={club?.clubVerified
                ? t('adminClubDetail.unverify', 'Retirer la vérif.')
                : t('adminClubDetail.verify', 'Vérifier le club')}
              variant={club?.clubVerified ? 'Secondary' : 'Primary'}
            />
            <Button
              onPress={() => setIsActionsVisible(true)}
              size="sm"
              style={isCompactScreen ? styles.fullWidthButton : styles.flexButton}
              title={t('adminClubDetail.actions', 'Actions')}
              variant="Secondary"
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.tabsContent}
          directionalLockEnabled
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroller}
        >
          {CLUB_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                ApplicationStyle.borderRadius12,
                styles.compactTabButton,
                {
                  backgroundColor: activeTab === tab.key ? Colors.primary500 : Colors.primary700,
                  borderColor: Colors.primary500,
                  borderWidth: 1,
                  minHeight: 44,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  Fonts.p3Bold,
                  styles.compactTabLabel,
                  { color: activeTab === tab.key ? Colors.neutral00 : Colors.primary200 },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {activeTab === 'overview' ? (
          <View style={styles.sectionStack}>
            <View style={styles.statsGrid}>
              {stats.map(renderStat)}
            </View>
            <View style={[panelStyle, Spaces.padding[18], styles.sectionCard]}>
              {renderInfoRows([
                { compact: true, label: 'DocumentId', value: getDocumentId(club) },
                {
                  label: t('adminClubDetail.info.updatedAt', 'Dernière mise à jour'),
                  value: formatAuditDate(club.updatedAt),
                },
                {
                  label: t('adminClubDetail.info.createdAt', 'Creation'),
                  value: formatAuditDate(club.createdAt),
                },
              ])}
            </View>
          </View>
        ) : null}

        {activeTab === 'info' ? (
          <View style={[panelStyle, Spaces.padding[18], styles.sectionCard]}>
            {renderInfoRows([
              { label: t('adminClubDetail.info.name', 'Nom'), value: club.name },
              { label: 'Email', value: club.email },
              {
                label: t('adminClubDetail.info.phone', 'Telephone'),
                value: club.phoneNumber,
              },
              {
                label: t('adminClubDetail.info.partnership', 'Partenariat'),
                value: club.clubPartner
                  ? t('adminClubDetail.yes', 'Oui')
                  : t('adminClubDetail.no', 'Non'),
              },
              {
                label: t('adminClubDetail.info.verified', 'Club certifié'),
                value: club.clubVerified
                  ? t('adminClubDetail.yes', 'Oui')
                  : t('adminClubDetail.no', 'Non'),
              },
              {
                label: t('adminClubDetail.info.reservation', 'Reservation'),
                value: club.isReservationProvider
                  ? t('adminClubDetail.yes', 'Oui')
                  : t('adminClubDetail.no', 'Non'),
              },
              {
                label: t('adminClubDetail.info.parentMultisport', 'Multisport parent'),
                value: getClubRelationLabel(parentMultisport),
              },
            ])}
            <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[12]]}>
              {t(
                'adminClubDetail.info.subscriptionsNote',
                // eslint-disable-next-line max-len
                'Les abonnements, entitlements et capacités Team sont pilotes depuis les opérations abonnements, plus depuis la fiche club.',
              )}
            </Text>
          </View>
        ) : null}

        {activeTab === 'relations' ? (
          <View style={styles.sectionStack}>
            {RELATION_CONFIGS.map(renderRelationList)}
          </View>
        ) : null}

        {activeTab === 'media' ? (
          <View style={[panelStyle, Spaces.padding[18], styles.sectionCard]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Logo</Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
              {club.logo?.url || t('adminClubDetail.media.noLogo', 'Aucun logo')}
            </Text>
            <Button
              onPress={() => navigation.navigate(RouteNames.AdminClubForm, { clubId })}
              style={Spaces.marginTop[14]}
              title={t('adminClubDetail.media.replaceLogo', 'Remplacer le logo')}
              variant="Secondary"
            />
          </View>
        ) : null}

        {activeTab === 'sponsors' ? (
          <View style={styles.sectionStack}>
            {Array.isArray(club.sponsor) && club.sponsor.length > 0 ? club.sponsor.map((sponsor) => (
              <View
                key={String(sponsor.documentId || sponsor.id || sponsor.logo?.url || sponsor.link || sponsor.title || sponsor.name)}
                style={[panelStyle, Spaces.padding[16], styles.sectionCard]}
              >
                <SponsorLogoTile
                  height={54}
                  imageUrl={sponsor.logo?.url}
                  link={sponsor.link}
                  title={sponsor.title || sponsor.name}
                  titleStyle={[Fonts.p2, { color: Colors.neutral300 }]}
                  width={120}
                />
              </View>
            )) : (
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                {t('adminClubDetail.media.noSponsor', 'Aucun sponsor configure.')}
              </Text>
            )}
            <Button
              onPress={() => navigation.navigate(RouteNames.AdminClubForm, { clubId })}
              title={t('adminClubDetail.media.editSponsors', 'Modifier les sponsors')}
              variant="Secondary"
            />
          </View>
        ) : null}

        {activeTab === 'geo' ? (
          <View style={[panelStyle, Spaces.padding[18], styles.sectionCard]}>
            {renderInfoRows([
              {
                label: t('adminClubDetail.location.address', 'Adresse'),
                value: addressLabel,
              },
              { label: t('adminClubDetail.location.city', 'Ville'), value: city },
              { compact: true, label: 'Geohash', value: club.geohash },
              { label: 'Latitude', value: coordinates.lat },
              { label: 'Longitude', value: coordinates.lng },
            ])}
            <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[12]]}>
              {formatJsonPreview(address, 1600)}
            </Text>
          </View>
        ) : null}

        {activeTab === 'requests' ? (
          <View style={styles.sectionStack}>
            {requests.length ? requests.map((request) => (
              <View key={getDocumentId(request)} style={[panelStyle, Spaces.padding[14], styles.sectionCard]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{getClubRelationLabel(request)}</Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                  {request.state || request.status || '-'}
                </Text>
              </View>
            )) : (
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                {t('adminClubDetail.noRequest', 'Aucune demande liée.')}
              </Text>
            )}
          </View>
        ) : null}

        {activeTab === 'history' ? (
          <View style={[panelStyle, Spaces.padding[18], styles.sectionCard]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('adminClubDetail.history.title', 'Historique')}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
              {t(
                'adminClubDetail.history.description',
                // eslint-disable-next-line max-len
                'Les actions sensibles passent par les mutations SuperAdmin et alimentent l audit backend.',
              )}
            </Text>
          </View>
        ) : null}

        {activeTab === 'danger' ? (
          <View style={[panelStyle, Spaces.padding[18], styles.sectionCard, { borderColor: Colors.error500 }]}>
            <Text style={[Fonts.h4Bold, { color: Colors.error500 }]}>Danger zone</Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
              {t(
                'adminClubDetail.danger.description',
                // eslint-disable-next-line max-len
                'Suppression definitive du club dans le Content Manager. Cette action doit être utilisée avec prudence.',
              )}
            </Text>
            <Button
              onPress={() => setIsDeleteVisible(true)}
              style={Spaces.marginTop[14]}
              title={t('adminClubDetail.danger.deleteClub', 'Supprimer ce club')}
              variant="SecondaryLight"
            />
          </View>
        ) : null}

        {isFetching ? (
          <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
            {t('adminClubDetail.syncing', 'Synchronisation...')}
          </Text>
        ) : null}
      </ScrollView>

      <BottomModal close={() => setIsActionsVisible(false)} isVisible={isActionsVisible} snapPoints={['34%']}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>
          {t('adminClubDetail.actionsTitle', 'Actions Club')}
        </Text>
        <View style={[Spaces.gap[10], Spaces.marginTop[14]]}>
          <Button
            onPress={() => {
              setIsActionsVisible(false);
              navigation.navigate(RouteNames.AdminClubForm, { duplicateFrom: clubId });
            }}
            title={t('adminClubDetail.duplicate', 'Dupliquer le club')}
            variant="Secondary"
          />
          <Button
            onPress={() => {
              setIsActionsVisible(false);
              setActiveTab('danger');
            }}
            title={t('adminClubDetail.openDanger', 'Ouvrir la Danger zone')}
            variant="SecondaryLight"
          />
        </View>
      </BottomModal>

      <BottomModal close={closeRelationModal} isVisible={Boolean(relationConfig)} snapPoints={['82%']}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>
          {t('adminClubDetail.add', 'Ajouter')}
          {' '}
          {relationConfig?.label || ''}
        </Text>
        <TextInput
          onChangeText={setRelationQuery}
          placeholder={t('adminClubDetail.relationSearchPlaceholder', 'Rechercher une entrée')}
          placeholderTextColor={Colors.neutral300}
          style={[
            panelStyle,
            Fonts.p1,
            Spaces.marginTop[12],
            Spaces.padding[12],
            { color: Colors.neutral00 },
          ]}
          value={relationQuery}
        />
        <TextInput
          onChangeText={setRelationReason}
          placeholder={t('adminClubDetail.auditReasonPlaceholder', "Raison d'audit")}
          placeholderTextColor={Colors.neutral300}
          style={[
            panelStyle,
            Fonts.p1,
            Spaces.marginTop[10],
            Spaces.padding[12],
            { color: Colors.neutral00 },
          ]}
          value={relationReason}
        />
        <Button
          isLoading={relationSearchMutation.isPending}
          onPress={searchRelations}
          style={Spaces.marginTop[12]}
          title={t('adminClubDetail.search', 'Rechercher')}
        />
        <View style={[Spaces.gap[10], Spaces.marginTop[14]]}>
          {relationResults.map((item) => (
            <View key={getDocumentId(item)} style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
              <Text numberOfLines={2} style={[Fonts.p2, { color: Colors.neutral100, flex: 1 }]}>
                {getClubRelationLabel(item)}
              </Text>
              <Button
                isLoading={updateRelationMutation.isPending}
                onPress={() => mutateRelation('connect', item)}
                size="sm"
                title={t('adminClubDetail.add', 'Ajouter')}
              />
            </View>
          ))}
        </View>
      </BottomModal>

      <BottomModal close={() => setIsDeleteVisible(false)} isVisible={isDeleteVisible} snapPoints={['46%']}>
        <Text style={[Fonts.h3, { color: Colors.error500 }]}>
          {t('adminClubDetail.delete.title', 'Supprimer le club')}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
          {t(
            'adminClubDetail.delete.description',
            'Cette action est irreversible. Ajoute une raison pour l audit.',
          )}
        </Text>
        <TextInput
          multiline
          onChangeText={setDeleteReason}
          placeholder={t('adminClubDetail.delete.reasonPlaceholder', 'Raison obligatoire')}
          placeholderTextColor={Colors.neutral300}
          style={[
            panelStyle,
            Fonts.p1,
            Spaces.marginTop[14],
            Spaces.padding[12],
            styles.reasonInput,
            { color: Colors.neutral00 },
          ]}
          value={deleteReason}
        />
        <View style={[Spaces.gap[10], Spaces.marginTop[14]]}>
          <Button
            isLoading={deleteMutation.isPending}
            onPress={confirmDelete}
            title={t('adminClubDetail.delete.confirm', 'Confirmer la suppression')}
          />
          <Button
            onPress={() => setIsDeleteVisible(false)}
            title={t('adminClubDetail.cancel', 'Annuler')}
            variant="Secondary"
          />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
  },
  compactTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  compactTabLabel: {
    textAlign: 'center',
  },
  flexButton: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
    minWidth: 0,
  },
  fullWidthButton: {
    width: '100%',
  },
  heroActions: {
    flexWrap: 'wrap',
    gap: 10,
  },
  heroAvatar: {
    borderRadius: 16,
    height: 72,
    width: 72,
  },
  heroBadges: {
    flexWrap: 'wrap',
    gap: 10,
  },
  heroContent: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
  },
  heroPanel: {
    marginBottom: 8,
  },
  infoRow: {
    borderBottomWidth: 1,
  },
  infoValue: {
    flexShrink: 1,
  },
  panel: {
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  reasonInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  sectionCard: {
    marginBottom: 6,
  },
  sectionStack: {
    gap: 18,
  },
  statCard: {
    marginBottom: 16,
    minHeight: 110,
    width: '48.2%',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tabsContent: {
    paddingRight: 4,
  },
  tabsScroller: {
    marginBottom: 14,
    marginTop: 2,
  },
});

export default AdminClubDetail;
