import { useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import {
  Alert, Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetAdminClub } from '@/services/admin/adminQueries';
import { updateAdminUser } from '@/services/admin/adminService';

/**
 *
 */
function AdminClubDetail() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { clubId } = route.params || {};

  const { data: clubData, isLoading, refetch } = useGetAdminClub(clubId);

  const club = clubData?.data || clubData;
  const members = club?.members || [];

  if (isLoading) return <Loader />;

  if (!club) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.alignCenter, Alignments.justifyCenter, { flex: 1 }]}>
          <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>Club introuvable</Text>
        </View>
      </ScreenContainer>
    );
  }

  const handleRemoveMember = (member) => {
    Alert.alert(
      'Retirer le membre',
      `Voulez-vous vraiment retirer ${member.firstname} ${member.lastname} du club ?`,
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: async () => {
            try {
              await updateAdminUser(member.documentId, { club: null });
              Alert.alert('Succès', 'Membre retiré du club');
              refetch();
            } catch (err) {
              Alert.alert('Erreur', err?.message || 'Une erreur est survenue');
            }
          },
          style: 'destructive',
          text: 'Retirer',
        },
      ],
    );
  };

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView contentContainerStyle={Spaces.padding[16]} showsVerticalScrollIndicator={false}>
        {/* Club Header */}
        <View style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[24],
          Spaces.marginBottom[16],
        ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter]}>
            {/* Club Logo */}
            <View style={[
              {
                backgroundColor: Colors.neutral700, borderRadius: 12, height: 80, overflow: 'hidden', width: 80,
              },
              Alignments.alignCenter,
              Alignments.justifyCenter,
            ]}
            >
              {club.logo?.url ? (
                <Image
                  resizeMode="contain"
                  source={{ uri: club.logo.url }}
                  style={{ height: 80, width: 80 }}
                />
              ) : (
                <Text style={{ fontSize: 32 }}>🏟️</Text>
              )}
            </View>

            <View style={[Spaces.marginLeft[16], { flex: 1 }]}>
              <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>{club.name}</Text>
              {club.city && (
              <Text style={[Fonts.p1, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                📍
                        {' '}
                {club.city}
              </Text>
              )}
              {club.sport && (
              <View style={[
                Spaces.paddingHorizontal[8],
                Spaces.paddingVertical[4],
                Spaces.marginTop[8],
                { alignSelf: 'flex-start', backgroundColor: `${Colors.primary500}30`, borderRadius: 4 },
              ]}
              >
                <Text style={{ color: Colors.primary500, fontSize: 12 }}>
                      {club.sport.name}
                    </Text>
              </View>
              )}
            </View>
          </View>
        </View>

        {/* Club Stats */}
        <View style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          Spaces.marginBottom[16],
        ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>Informations</Text>

          {club.description && (
          <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginBottom[12]]}>
            {club.description}
          </Text>
          )}

          <View style={[Alignments.row, Spaces.gap[16]]}>
            <View style={[Alignments.alignCenter, { flex: 1 }]}>
              <Text style={[Fonts.h2, { color: Colors.primary500 }]}>{members.length}</Text>
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>Membres</Text>
            </View>
          </View>
        </View>

        {/* Members List */}
        <View style={[Spaces.marginBottom[16]]}>
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
            Membres (
            {members.length}
            )
          </Text>

          {members.length > 0 ? (
            members.map((member) => (
              <View
                key={member.documentId || member.id}
                style={[
                  ApplicationStyle.backgroundColor.neutral800,
                  ApplicationStyle.borderRadius16,
                  Spaces.padding[12],
                  Spaces.marginBottom[8],
                  Alignments.row,
                  Alignments.alignCenter,
                ]}
              >
                <ProfileAvatar imageUrl={member.avatar?.url} size={40} />
                <View style={[Spaces.marginLeft[12], { flex: 1 }]}>
                  <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
                        {member.firstname}
                        {' '}
                        {member.lastname}
                      </Text>
                  <Text style={[Fonts.p2, { color: Colors.neutral300, fontSize: 12 }]}>{member.email}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveMember(member)}>
                  <Text style={{ color: Colors.error500, fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={[
              ApplicationStyle.backgroundColor.neutral800,
              ApplicationStyle.borderRadius16,
              Spaces.padding[16],
              Alignments.alignCenter,
            ]}
            >
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>Aucun membre</Text>
            </View>
          )}
        </View>

        {/* Sponsors */}
        {club.sponsor && club.sponsor.length > 0 && (
        <View style={[Spaces.marginBottom[24]]}>
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
            Sponsors (
            {club.sponsor.length}
            )
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {club.sponsor.map((sponsor, index) => (
              <View
                key={index}
                style={[
                      ApplicationStyle.backgroundColor.neutral800,
                      ApplicationStyle.borderRadius16,
                      Spaces.padding[12],
                      Spaces.marginRight[12],
                      Alignments.alignCenter,
                    ]}
              >
                <SponsorLogoTile
                      height={50}
                      imageUrl={sponsor.logo?.url}
                      link={sponsor.link}
                      title={sponsor.title || sponsor.name}
                      titleStyle={[Fonts.p2, { color: Colors.neutral300 }]}
                      width={100}
                    />
              </View>
            ))}
          </ScrollView>
        </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminClubDetail;
