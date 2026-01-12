import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import useClub from '@/domains/club/useClub';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { RouteNames } from '@/navigation/routeNames';
import { getMultisportClubById, getCMClubs, deleteCMSection } from '@/services/multisportClub/multisportClubService';

/**
 * CM Dashboard - Main management screen for Dirigeant Omnisport
 */
function CMDashboard({ navigation, route }) {
  const { cmId } = route?.params ?? {};

  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces, Colors,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();

  // Fetch CM details
  const {
    data: cm,
    error: cmError,
    isLoading: cmLoading,
    refetch: refetchCM,
  } = useQuery({
    queryKey: ['multisport-club', cmId],
    queryFn: () => getMultisportClubById(cmId),
    enabled: !!cmId,
  });

  // Fetch sections with stats
  const {
    data: sectionsData,
    error: sectionsError,
    isLoading: sectionsLoading,
    refetch: refetchSections,
  } = useQuery({
    queryKey: ['cm-clubs', cmId],
    queryFn: () => getCMClubs(cmId),
    enabled: !!cmId,
  });

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
    sections.forEach((section) => {
      totalTeams += section.stats?.teams || 0;
      totalMembers += section.stats?.members || 0;
    });
    return {
      sections: sections.length,
      teams: totalTeams,
      members: totalMembers,
    };
  }, [sections]);

  /**
   * @param {object} section
   */
  const handleSectionPress = (section) => {
    navigation.navigate(RouteNames.ClubStack, {
      screen: RouteNames.Club,
      params: { clubId: section.documentId },
    });
  };

  const handleOpenPlanning = () => {
    navigation.navigate(RouteNames.CMPlanning, { cmId });
  };

  const handleCreateSection = () => {
    navigation.navigate(RouteNames.CreateSection, { cmId });
  };

  const deleteMutation = useMutation({
    mutationFn: (sectionId) => deleteCMSection(cmId, sectionId),
    onSuccess: () => {
      refetchSections();
      Alert.alert(t('common.actions.delete'), t('multisport.sectionDeleted'));
    },
    onError: (err) => {
      Alert.alert(t('APIerrors.title'), err.message || t('APIerrors.generic'));
    },
  });

  const handleDeleteSection = (section) => {
    Alert.alert(
      t('multisport.deleteSectionTitle'),
      t('multisport.deleteSectionConfirm', { name: section.name }),
      [
        { text: t('common.actions.cancel'), style: 'cancel' },
        {
          text: t('common.actions.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(section.documentId),
        },
      ],
    );
  };

  const isCmAdmin = cm?.admins?.some(admin => admin.documentId === userData?.documentId);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.column,
        Alignments.fill,
      ]}
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
          ]}>
            {/* Omnisport Badge */}
            <View style={{
              position: 'absolute',
              top: 16,
              left: 16,
              backgroundColor: '#00BCD4',
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 8,
              zIndex: 1,
            }}>
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
                    { right: 16, top: 16, zIndex: 10 }
                  ]}
                >
                  <Image
                     source={Images.edit}
                     style={[
                       ApplicationStyle.icon20,
                       ApplicationStyle.tintColor.primary500
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
                    imageUrl={cm.logo.url}
                    size={80}
                    style={[
                      { borderRadius: 80 },
                    ]}
                    imageStyle={{ borderRadius: 80 }}
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

          {/* Stats Cards */}
          <View style={[Alignments.row, Spaces.gap[12]]}>
            <View style={[
              ApplicationStyle.borderRadius12,
              ApplicationStyle.backgroundColor.primary700,
              Spaces.padding[16],
              Alignments.alignCenter,
              { flex: 1 },
            ]}>
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
            ]}>
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
            ]}>
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
                  onPress={handleOpenPlanning}
                  title="Planning"
                  variant="Secondary"
                  icon="calendar"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  onPress={() => navigation.navigate(RouteNames.FacilityList, { cmId })}
                  title="Installations"
                  variant="Secondary"
                  icon="edit"
                />
              </View>
            </View>
            <Button
              onPress={() => navigation.navigate(RouteNames.FeaturedRequests, { cmId })}
              title="Gérer les demandes à la une"
              variant="Secondary"
              icon="bell"
            />
            {isCmAdmin && (
              <Button
                onPress={handleCreateSection}
                title="Créer une section"
                variant="Primary"
                icon="plus"
              />
            )}
          </View>

          {/* Sections List */}
          <View style={[Spaces.gap[16]]}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              Mes sections ({sections.length})
            </Text>
            <View style={[Spaces.gap[12]]}>
              {sections.map((section) => (
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
                      imageUrl={section.logoUrl}
                      size={50}
                      style={{ borderRadius: 25 }}
                      imageStyle={{ borderRadius: 25 }}
                    />
                  ) : (
                    <TeamShield
                      initials={getClubInitials(section.name)}
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
                        {section.stats?.teams || 0} équipe{(section.stats?.teams || 0) > 1 ? 's' : ''}
                      </Text>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {section.stats?.members || 0} membre{(section.stats?.members || 0) > 1 ? 's' : ''}
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
    </ScreenContainer>
  );
}

export default CMDashboard;
