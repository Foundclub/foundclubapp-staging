import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { deleteCMSection, getCMClubs, getMultisportClubById } from '@/services/multisportClub/multisportClubService';

/**
 * @typedef {{ url?: string }} ImageAsset
 * @typedef {{ documentId?: string }} CMAdmin
 * @typedef {{ title?: string; link?: string; logo?: ImageAsset }} CMSponsor
 * @typedef {{ teams?: number; members?: number }} CMSectionStats
 * @typedef {{ documentId?: string; name?: string; sport?: string; logoUrl?: string; stats?: CMSectionStats }} CMSectionRow
 * @typedef {{ documentId?: string; name?: string; logo?: ImageAsset; addressDetails?: string; phoneNumber?: string; email?: string; sponsor?: CMSponsor[]; admins?: CMAdmin[] }} CMMultisport
 */

/**
 * CM Dashboard - Main management screen for Dirigeant Omnisport
 * @param {{ navigation: any; route: { params?: { cmId?: string } } }} props
 */
function CMDashboard({ navigation, route }) {
  const { cmId } = route?.params ?? {};

  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();

  // Fetch CM details
  const {
    data: cmData,
    error: cmError,
    isLoading: cmLoading,
    refetch: refetchCM,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => {
      if (!cmId) return Promise.resolve(null);
      return getMultisportClubById(cmId);
    },
    queryKey: ['multisport-club', cmId],
  });

  // Fetch sections with stats
  const {
    data: sectionsDataRaw,
    error: sectionsError,
    isLoading: sectionsLoading,
    refetch: refetchSections,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => {
      if (!cmId) return Promise.resolve({ data: [] });
      return getCMClubs(cmId);
    },
    queryKey: ['cm-clubs', cmId],
  });

  const cm = /** @type {CMMultisport | null | undefined} */ (cmData);
  const sectionsData = /** @type {{ data?: CMSectionRow[] } | undefined} */ (sectionsDataRaw);
  const sections = sectionsData?.data || [];
  const isLoading = cmLoading || sectionsLoading;
  const error = cmError || sectionsError;

  const refetch = useCallback(() => {
    refetchCM();
    refetchSections();
  }, [refetchCM, refetchSections]);

  // Calculate global stats
  const globalStats = useMemo(() => {
    let totalTeams = 0;
    let totalMembers = 0;
    sections.forEach((/** @type {CMSectionRow} */ section) => {
      totalTeams += section.stats?.teams || 0;
      totalMembers += section.stats?.members || 0;
    });
    return {
      members: totalMembers,
      sections: sections.length,
      teams: totalTeams,
    };
  }, [sections]);

  /**
   * @param {CMSectionRow} section
   */
  const handleSectionPress = (section) => {
    if (!section?.documentId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: section.documentId },
      screen: RouteNames.Club,
    });
  };

  const handleOpenPlanning = () => {
    navigation.navigate(RouteNames.CMPlanning, { cmId });
  };

  const handleCreateSection = () => {
    navigation.navigate(RouteNames.CreateSection, { cmId });
  };

  const deleteMutation = useMutation({
    mutationFn: (/** @type {string} */ sectionId) => {
      if (!cmId) throw new Error('Missing cmId');
      return deleteCMSection(cmId, sectionId);
    },
    onError: (err) => {
      Alert.alert(t('APIerrors.title'), err.message || t('APIerrors.generic'));
    },
    onSuccess: () => {
      refetchSections();
      Alert.alert(t('common.actions.delete'), t('multisport.sectionDeleted'));
    },
  });

  const handleCreateSponsor = useCallback(() => {
    navigation.navigate(RouteNames.AddSponsor, { cmId });
  }, [navigation, cmId]);

  const handleDeleteSection = (/** @type {CMSectionRow} */ section) => {
    Alert.alert(
      t('multisport.deleteSectionTitle'),
      t('multisport.deleteSectionConfirm', { name: section.name }),
      [
        { style: 'cancel', text: t('common.actions.cancel') },
        {
          onPress: () => {
            if (section.documentId) {
              deleteMutation.mutate(section.documentId);
            }
          },
          style: 'destructive',
          text: t('common.actions.delete'),
        },
      ],
    );
  };

  const isCmAdmin = cm?.admins?.some((admin) => admin.documentId === userData?.documentId);

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.MY_TEAMS}
      userId={userData?.documentId}
    >
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingVertical[24],
          Alignments.column,
          Alignments.fill,
        ]}
      >
        <OnboardingWrapper
          description="Gerez vos sections omnisport, ouvrez les equipes et suivez les indicateurs du club."
          id="cm-dashboard-main-content"
          order={1}
          spotlight={{
            borderRadius: 16,
            maxHeight: 280,
            overlayOpacity: 0.4,
            paddingX: 2,
            paddingY: 2,
          }}
          style={{ flex: 1 }}
          title="Gestion des equipes"
        >
          <ScrollView
            contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[40]]}
            refreshControl={
              <RefreshControl onRefresh={refetch} refreshing={isLoading} />
            }
            showsVerticalScrollIndicator={false}
          >
            <WithDataWrapper
              error={error?.message}
              isLoading={isLoading}
              wrapperStyle={[Spaces.gap[24]]}
            >
              {/* Header */}
              <View style={[
                ApplicationStyle.borderRadius24,
                ApplicationStyle.backgroundColor.primary700,
                Alignments.alignCenter,
                Spaces.gap[16],
                Spaces.paddingHorizontal[24],
                Spaces.paddingBottom[40],
                Spaces.marginTop[24],
                { overflow: 'visible' },
              ]}
              >
                {/* Omnisport Badge */}
                <View style={{
                  backgroundColor: '#00BCD4',
                  borderRadius: 8,
                  left: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  position: 'absolute',
                  top: 16,
                  zIndex: 1,
                }}
                >
                  <Text style={[Fonts.p2Bold, { color: '#FFFFFF' }]}>
                    OMNISPORT
                  </Text>
                </View>

                {/* Edit Action - Visible only to CM admins */}
                {isCmAdmin ? (
                  <TouchableOpacity
                    onPress={() => navigation.navigate(RouteNames.MultisportClubEdit, { cmId })}
                    style={[
                      Alignments.absolute,
                      Alignments.row,
                      Alignments.alignCenter,
                      Spaces.gap[8],
                      { right: 16, top: 16, zIndex: 10 },
                    ]}
                  >
                    <Image
                      source={Images.edit}
                      style={[
                        ApplicationStyle.icon20,
                        ApplicationStyle.tintColor.primary500,
                      ]}
                    />
                    <Text style={[Fonts.p1Bold, Fonts.primary500]}>
                      Modifier
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <View style={{ marginTop: -32, zIndex: 1 }}>
                  {cm?.logo?.url ? (
                    <ProfileAvatar
                      imageStyle={{ borderRadius: 80 }}
                      imageUrl={cm.logo.url}
                      size={80}
                      style={[
                        { borderRadius: 80 },
                      ]}
                    />
                  ) : (
                    <TeamShield
                      initials={cm?.name ? getClubInitials(cm?.name) : ''}
                    />
                  )}
                </View>

                <View style={[Spaces.gap[4], Alignments.alignCenter]}>
                  <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
                    {cm?.name}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {cm?.addressDetails || ''}
                  </Text>
                </View>

                {/* Contact Info */}
                <View style={[Spaces.gap[4], Alignments.alignCenter]}>
                  {cm?.phoneNumber && (
                  <View style={[Alignments.row, Spaces.gap[4]]}>
                    <Image source={Images.phone} style={[ApplicationStyle.icon20]} />
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${cm.phoneNumber}`)}>
                      <Text style={[Fonts.p2, Fonts.primary100, Fonts.underlineText]}>
                        {cm.phoneNumber}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  )}
                  {cm?.email && (
                  <View style={[Alignments.row, Spaces.gap[4]]}>
                    <Image source={Images.envelope} style={[ApplicationStyle.icon20]} />
                    <TouchableOpacity onPress={() => Linking.openURL(`mailto:${cm.email}`)}>
                      <Text style={[Fonts.p2, Fonts.primary100, Fonts.underlineText]}>
                        {cm.email}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  )}
                </View>
              </View>

              {/* Sponsors */}
              {((cm?.sponsor?.length ?? 0) > 0 || isCmAdmin) && (
              <View style={[Spaces.gap[16]]}>
                <View style={[Alignments.row, Alignments.alignCenter, Alignments.scrollSpaceBetween]}>
                  <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                    Partenaires
                  </Text>
                  {isCmAdmin && (
                  <Button
                    icon="plus"
                    isOption
                    onPress={handleCreateSponsor}
                    variant="Primary"
                  />
                  )}
                </View>
                <ScrollView
                  contentContainerStyle={[Spaces.gap[16]]}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {cm?.sponsor?.map((/** @type {CMSponsor} */ sponsor, idx) => (
                    <SponsorLogoTile
                      height={55}
                      imageUrl={sponsor.logo?.url}
                      key={sponsor.link || idx}
                      link={sponsor.link}
                      title={sponsor.title}
                      titleStyle={[Fonts.p2Bold, Fonts.neutral00, { marginTop: 4, textAlign: 'center' }]}
                      width={110}
                    />
                  ))}
                </ScrollView>
              </View>
              )}

              {/* Stats Cards */}
              <View style={[Alignments.row, Spaces.gap[12]]}>
                <View style={[
                  ApplicationStyle.borderRadius12,
                  ApplicationStyle.backgroundColor.primary700,
                  Spaces.padding[16],
                  Alignments.alignCenter,
                  { flex: 1 },
                ]}
                >
                  <Text style={[Fonts.h2Black, Fonts.primary500]}>
                    {globalStats.sections}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral00]}>Sections</Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate(RouteNames.CMTeams, { cmId })}
                  style={[
                    ApplicationStyle.borderRadius12,
                    ApplicationStyle.backgroundColor.primary700,
                    Spaces.padding[16],
                    Alignments.alignCenter,
                    { flex: 1 },
                  ]}
                >
                  <Text style={[Fonts.h2Black, Fonts.primary500]}>
                    {globalStats.teams}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral00]}>Équipes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate(RouteNames.CMMembers, { cmId })}
                  style={[
                    ApplicationStyle.borderRadius12,
                    ApplicationStyle.backgroundColor.primary700,
                    Spaces.padding[16],
                    Alignments.alignCenter,
                    { flex: 1 },
                  ]}
                >
                  <Text style={[Fonts.h2Black, Fonts.primary500]}>
                    {globalStats.members}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral00]}>Membres</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Actions */}
              <View style={[Spaces.gap[12]]}>
                <View style={[Alignments.row, Spaces.gap[12]]}>
                  <View style={{ flex: 1 }}>
                    <Button
                      icon="calendar"
                      onPress={handleOpenPlanning}
                      title="Planning"
                      variant="Secondary"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      icon="edit"
                      onPress={() => navigation.navigate(RouteNames.FacilityList, { cmId })}
                      title="Installations"
                      variant="Secondary"
                    />
                  </View>
                </View>
                <Button
                  icon="bell"
                  onPress={() => navigateToRequestsHub(navigation, {
                    initialFilter: 'featured',
                    source: 'cm_dashboard',
                  })}
                  title="Gérer les demandes à la une"
                  variant="Secondary"
                />
                {isCmAdmin && (
                <Button
                  icon="plus"
                  onPress={handleCreateSection}
                  title="Créer une section"
                  variant="Primary"
                />
                )}
              </View>

              {/* Sections List */}
              <View style={[Spaces.gap[16]]}>
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                  Mes sections (
                  {sections.length}
                  )
                </Text>
                <View style={[Spaces.gap[12]]}>
                  {sections.map((/** @type {CMSectionRow} */ section) => (
                    <TouchableOpacity
                      key={section.documentId}
                      onPress={() => handleSectionPress(section)}
                      style={[
                        ApplicationStyle.borderRadius12,
                        ApplicationStyle.backgroundColor.primary700,
                        Alignments.row,
                        Alignments.alignCenter,
                        Spaces.padding[12],
                        Spaces.gap[12],
                      ]}
                    >
                      {section.logoUrl ? (
                        <ProfileAvatar
                          imageStyle={{ borderRadius: 25 }}
                          imageUrl={section.logoUrl}
                          size={50}
                          style={{ borderRadius: 25 }}
                        />
                      ) : (
                        <TeamShield
                          initials={getClubInitials(section.name || '')}
                          isSmall
                        />
                      )}
                      <View style={[Spaces.gap[4], { flex: 1 }]}>
                        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                          {section.name}
                        </Text>
                        {section.sport && (
                        <Text style={[Fonts.p2, Fonts.primary500]}>
                          {section.sport}
                        </Text>
                        )}
                        <View style={[Alignments.row, Spaces.gap[16]]}>
                          <Text style={[Fonts.p3, Fonts.neutral200]}>
                            {section.stats?.teams || 0}
                            {' '}
                            équipe
                            {(section.stats?.teams || 0) > 1 ? 's' : ''}
                          </Text>
                          <Text style={[Fonts.p3, Fonts.neutral200]}>
                            {section.stats?.members || 0}
                            {' '}
                            membre
                            {(section.stats?.members || 0) > 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>

                      {/* Delete Action */}
                      {isCmAdmin && (
                      <TouchableOpacity
                        onPress={() => handleDeleteSection(section)}
                        style={[Spaces.padding[8]]}
                      >
                        <Image
                          source={Images.trash}
                          style={[
                            ApplicationStyle.icon20,
                            ApplicationStyle.tintColor.error500 || { tintColor: '#FF5252' },
                          ]}
                        />
                      </TouchableOpacity>
                      )}

                      <Image
                        source={Images.arrowRight}
                        style={[
                          ApplicationStyle.icon16,
                          ApplicationStyle.tintColor.neutral00,
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

            </WithDataWrapper>
          </ScrollView>
        </OnboardingWrapper>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default CMDashboard;
