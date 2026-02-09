import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Alert, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import Button from '@/components/atoms/button/Button';
import { useGetLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
import { respondToJoinRequest } from '@/services/leagueTeam/leagueTeamService';

const SquadRequestsScreen = ({ navigation, route }) => {
  const { teamId } = route.params;
  const { Colors, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();
  
  const { data: team, refetch, isLoading } = useGetLeagueTeam(teamId);
  const [isProcessing, setIsProcessing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRespond = async (userId, accept) => {
    try {
        setIsProcessing(true);
        await respondToJoinRequest(teamId, userId, accept);
        await refetch();
        Alert.alert(
            t('common.success'), 
            accept ? t('squad.requests.accepted', 'Joueur accepté !') : t('squad.requests.rejected', 'Demande refusée.')
        );
    } catch (error) {
        console.error(error);
        Alert.alert(t('common.error'), t('squad.requests.error', 'Une erreur est survenue.'));
    } finally {
        setIsProcessing(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[
        Alignments.row, 
        Alignments.alignCenter, 
        Alignments.justifySpaceBetween, 
        Spaces.padding[16], 
        Spaces.marginBottom[12],
        { backgroundColor: Colors.neutral800, borderRadius: 12 }
    ]}>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
            <ProfileAvatar imageUrl={item.avatar?.url} size={48} />
            <View>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                    {item.firstname} {item.lastname}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                    @{item.username || 'username'}
                </Text>
            </View>
        </View>

        <View style={[Alignments.row, Spaces.gap[8]]}>
            <TouchableOpacity 
                onPress={() => handleRespond(item.documentId, false)}
                disabled={isProcessing}
                style={{ padding: 8, backgroundColor: Colors.error100, borderRadius: 8 }}
            >
                <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>X</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                onPress={() => handleRespond(item.documentId, true)}
                disabled={isProcessing}
                style={{ padding: 8, backgroundColor: Colors.success100, borderRadius: 8 }}
            >
                 <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>V</Text>
            </TouchableOpacity>
        </View>
    </View>
  );

  return (
    <ScreenContainer bgImage="bg2">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>Retour</Text>
          </TouchableOpacity>
          <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{t('squad.requests.title', 'Demandes')}</Text>
          <View style={{ width: 40 }} />
      </View>
      
      <FlatList
        data={team?.join_requests || []}
        renderItem={renderItem}
        keyExtractor={item => item.documentId}
        contentContainerStyle={[Spaces.padding[16]]}
        ListEmptyComponent={
            <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
                <Text style={[Fonts.p1, { color: Colors.neutral100 }]}>
                    {isLoading ? 'Chargement...' : t('squad.requests.empty', 'Aucune demande en attente.')}
                </Text>
            </View>
        }
      />
    </ScreenContainer>
  );
};

export default SquadRequestsScreen;
