import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import useClub from '@/domains/club/useClub';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { RouteNames } from '@/navigation/routeNames';
import { getMultisportClubById } from '@/services/multisportClub/multisportClubService';
import { getImageUrl } from '@/utils/imageUrl';

/**
 * MultisportClub details screen component
 * Displays a multisport club with its sections (child clubs)
 */
function MultisportClubDetails({ navigation, route }) {
  const { cmId } = route?.params ?? {};

  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();

  const canEdit = useMemo(() => cm?.admins?.some(admin => admin.documentId === userData?.documentId), [cm, userData]);

  const handleCreateSponsor = useCallback(() => {
    navigation.navigate(RouteNames.AddSponsor, { cmId });
  }, [navigation, cmId]);

  const {
    data: cm,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['multisport-club', cmId],
    queryFn: () => getMultisportClubById(cmId),
    enabled: !!cmId,
  });

  /**
   * Handle section press - navigate to club details
   */
  const handleSectionPress = useCallback((section) => {
    if (section?.documentId) {
      navigation.navigate(RouteNames.ClubStack, {
        screen: RouteNames.Club,
        params: { clubId: section.documentId },
      });
    }
  }, [navigation]);

  /**
   * Handle admin press - navigate to user profile
   */
  const handleAdminPress = useCallback((admin) => {
    if (admin?.documentId) {
      navigation.navigate(RouteNames.ProfileStack, {
        screen: RouteNames.UserDetails,
        params: { userId: admin.documentId },
      });
    }
  }, [navigation]);

  /**
   * Handle featured requests press - navigate to featured requests screen
   */
  const handleFeaturedRequestsPress = useCallback(() => {
    if (cmId) {
      navigation.navigate(RouteNames.FeaturedRequests, { cmId });
    }
  }, [cmId, navigation]);

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
        contentContainerStyle={[
          Spaces.gap[32],
          Spaces.paddingBottom[40],
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading}
          wrapperStyle={[Spaces.gap[32]]}
        >
          {/* Header Card */}
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
              {cm?.admins?.some(admin => admin.documentId === userData?.documentId) ? (
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

          {/* Sponsors */}
          {(cm?.sponsor?.length > 0 || canEdit) && (
            <View style={[Spaces.gap[16]]}>
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.scrollSpaceBetween]}>
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                  Partenaires
                </Text>
                {canEdit && (
                  <Button
                    icon="plus"
                    isOption
                    onPress={handleCreateSponsor}
                    variant="Primary"
                  />
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[Spaces.gap[16]]}
              >
                {cm?.sponsor?.map((sponsor, idx) => (
                  <TouchableOpacity
                    key={sponsor.link || idx}
                    onPress={() => sponsor.link && Linking.openURL(sponsor.link)}
                    style={[Alignments.alignCenter]}
                  >
                    <ProfileAvatar
                      imageUrl={sponsor.logo?.url}
                      size={55}
                      enablePreview={false}
                      style={[
                        ApplicationStyle.borderWidth1,
                        ApplicationStyle.borderColor.neutral00,
                        { borderRadius: 8, width: 110, height: 55 },
                      ]}
                      imageStyle={{ borderRadius: 8, width: 110, height: 55 }}
                    />
                    <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { marginTop: 4, maxWidth: 110, textAlign: 'center' }]}>
                      {sponsor.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Admin Actions - Visible only to CM admins */}
          {cm?.admins?.some(admin => admin.documentId === userData?.documentId) && (
            <TouchableOpacity
              onPress={handleFeaturedRequestsPress}
              style={[
                ApplicationStyle.borderRadius16,
                ApplicationStyle.backgroundColor.primary500,
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifyCenter,
                Spaces.padding[16],
                Spaces.gap[8],
              ]}
            >
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                📢 Gérer les demandes à la une
              </Text>
            </TouchableOpacity>
          )}

          {/* Sections (Child Clubs) */}
          {cm?.sections?.length > 0 && (
            <View style={[Spaces.gap[16]]}>
              <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                Sections ({cm.sections.length})
              </Text>
              <View style={[Spaces.gap[12]]}>
                {cm.sections.map((section) => (
                  <TouchableOpacity
                    key={section.documentId}
                    onPress={() => handleSectionPress(section)}
                    style={[
                      ApplicationStyle.borderRadius16,
                      ApplicationStyle.backgroundColor.primary700,
                      Alignments.row,
                      Alignments.alignCenter,
                      Spaces.padding[16],
                      Spaces.gap[16],
                    ]}
                  >
                    {section.logo?.url ? (
                      <ProfileAvatar
                        imageUrl={section.logo.url}
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
                      {section.activites?.[0] && (
                        <Text style={[Fonts.p2, Fonts.neutral00]}>
                          {section.activites[0].name}
                        </Text>
                      )}
                      {section.teams && (
                        <Text style={[Fonts.p3, Fonts.neutral00]}>
                          {section.teams.length} équipe{section.teams.length > 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                    <Image
                      source={Images.chevronRight}
                      style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Admins (Dirigeants Omnisport) */}
          {cm?.admins?.length > 0 && (
            <View style={[Spaces.gap[16]]}>
              <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                Dirigeants Omnisport
              </Text>
              <View style={[Spaces.gap[12]]}>
                {cm.admins.map((admin) => (
                  <TouchableOpacity
                    key={admin.documentId}
                    onPress={() => handleAdminPress(admin)}
                    style={[
                      ApplicationStyle.borderRadius16,
                      ApplicationStyle.backgroundColor.primary700,
                      Alignments.row,
                      Alignments.alignCenter,
                      Spaces.padding[16],
                      Spaces.gap[16],
                    ]}
                  >
                    <Image
                      source={admin.avatar ? { uri: getImageUrl(admin.avatar?.url) } : Images.roundAvatar}
                      style={[ApplicationStyle.roundIcon40]}
                    />
                    <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                      {`${admin.firstname || ''} ${admin.lastname || ''}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}


        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default MultisportClubDetails;
