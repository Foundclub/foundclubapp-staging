import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import Input from '@/components/molecules/input/Input';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  useApproveClubClaim,
  useGetClubClaimRequest,
  useProcessAffiliationHelpRequest,
  useRefuseAffiliationHelpRequest,
  useRefuseClubClaim,
} from '@/services/admin/adminQueries';

/**
 *
 */
function AdminClaimDetail() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { requestId, requestType } = route.params || {};

  const { data: requestResponse, isLoading } = useGetClubClaimRequest(requestId, requestType);
  const approveMutation = useApproveClubClaim();
  const refuseClaimMutation = useRefuseClubClaim();
  const processHelpMutation = useProcessAffiliationHelpRequest();
  const refuseHelpMutation = useRefuseAffiliationHelpRequest();

  const request = requestResponse?.data;
  const isAffiliationHelp = !!request?.__isAffiliationHelp;
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    if (!request?.adminNote) return;
    setAdminNote((currentValue) => (currentValue || request.adminNote));
  }, [request?.adminNote]);

  const requester = useMemo(() => {
    const user = request?.user || {};
    const firstname = user?.firstname || request?.holderFirstname || '';
    const lastname = user?.lastname || request?.holderLastname || '';
    return {
      avatar: user?.avatar?.url,
      email: user?.email || '',
      firstname,
      lastname,
      phoneNumber: user?.phoneNumber || request?.holderPhone || '',
    };
  }, [request]);

  const requestDate = request?.createdAt
    ? new Date(request.createdAt).toLocaleDateString()
    : '-';

  const runPrimaryAction = () => {
    if (!requestId) return;

    if (isAffiliationHelp) {
      processHelpMutation.mutate(
        { adminNote: adminNote.trim(), documentId: requestId },
        {
          onError: (error) => {
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
          },
          onSuccess: () => {
            Alert.alert('Succès', 'Demande traitée.');
            navigation.goBack();
          },
        },
      );
      return;
    }

    approveMutation.mutate(requestId, {
      onError: (error) => {
        Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
      },
      onSuccess: () => {
        Alert.alert('Succès', 'Demande acceptée.');
        navigation.goBack();
      },
    });
  };

  const runSecondaryAction = () => {
    if (!requestId) return;

    if (isAffiliationHelp) {
      refuseHelpMutation.mutate(
        { adminNote: adminNote.trim(), documentId: requestId },
        {
          onError: (error) => {
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
          },
          onSuccess: () => {
            Alert.alert('Succès', 'Demande refusée.');
            navigation.goBack();
          },
        },
      );
      return;
    }

    refuseClaimMutation.mutate(requestId, {
      onError: (error) => {
        Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
      },
      onSuccess: () => {
        Alert.alert('Succès', 'Demande rejetée.');
        navigation.goBack();
      },
    });
  };

  const handleApprove = () => {
    Alert.alert(
      'Confirmer',
      isAffiliationHelp
        ? 'Traiter cette demande introuvable ?'
        : "Voulez-vous vraiment accepter cette demande ? L'utilisateur deviendra proprietaire du club.",
      [
        { style: 'cancel', text: 'Annuler' },
        { onPress: runPrimaryAction, text: isAffiliationHelp ? 'Traiter' : 'Accepter' },
      ],
    );
  };

  const handleRefuse = () => {
    Alert.alert(
      'Refuser',
      'Voulez-vous rejeter cette demande ?',
      [
        { style: 'cancel', text: 'Annuler' },
        { onPress: runSecondaryAction, style: 'destructive', text: 'Refuser' },
      ],
    );
  };

  if (isLoading) {
    return <Loader />;
  }

  if (!request) {
    return (
      <ScreenContainer>
        <View style={Alignments.center}>
          <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>Demande introuvable</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={Spaces.padding[16]}
      title="Detail demande"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
          <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
            Demandeur
          </Text>
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <ProfileAvatar imageUrl={requester?.avatar} size={60} />
            <View style={Spaces.marginLeft[16]}>
              <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
                {[requester.firstname, requester.lastname].filter(Boolean).join(' ').trim() || 'Utilisateur'}
              </Text>
              {requester?.email ? (
                <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>{requester.email}</Text>
              ) : null}
              <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>{requester.phoneNumber || '-'}</Text>
            </View>
          </View>
        </View>

        {isAffiliationHelp ? (
          <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
              Demande affiliation
            </Text>
            <View style={[Spaces.gap[10]]}>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Type: 
{' '}
<Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request.__typeLabel}</Text>
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Nom recherché: 
{' '}
<Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request.clubName || '-'}</Text>
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Source: 
{' '}
<Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request.source || '-'}</Text>
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Recherche initiale: 
{' '}
<Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {request?.searchContext?.currentQuery || '-'}
                                      </Text>
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Date: 
{' '}
<Text style={[Fonts.p2Bold, Fonts.neutral00]}>{requestDate}</Text>
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Commentaire: 
{' '}
<Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request.comment || '-'}</Text>
              </Text>
            </View>
          </View>
        ) : (
          <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
              Club revendiqué
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter]}>
              <ProfileAvatar imageUrl={request?.club?.logo?.url} size={60} variant="logo" />
              <View style={Spaces.marginLeft[16]}>
                <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{request?.club?.name}</Text>
                <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>
                    {request?.club?.city}
                    {' '}
                    (
{request?.club?.postalCode}
                    )
                        </Text>
              </View>
            </View>
          </View>
        )}

        {isAffiliationHelp ? (
          <View style={[Spaces.marginBottom[16]]}>
            <Input
              label="Note admin (optionnelle)"
              multiline
              numberOfLines={3}
              onChangeText={setAdminNote}
              placeholder="Ajoutez un contexte visible par le demandeur"
              textAlignVertical="top"
              value={adminNote}
            />
          </View>
        ) : null}

        <View style={Spaces.marginTop[12]}>
          <Button
            disabled={approveMutation.isPending || processHelpMutation.isPending}
            onPress={handleApprove}
            style={[Spaces.marginBottom[12], isAffiliationHelp ? null : { backgroundColor: Colors.success500 }]}
            textStyle={[Fonts.button, { color: Colors.neutral00 }]}
            title={isAffiliationHelp
              ? (processHelpMutation.isPending ? 'Traitement...' : 'Traiter la demande')
              : (approveMutation.isPending ? 'Traitement...' : 'Accepter la demande')}
            variant="Primary"
          />

          <Button
            disabled={refuseClaimMutation.isPending || refuseHelpMutation.isPending}
            onPress={handleRefuse}
            style={{ borderColor: Colors.error500 }}
            textStyle={[Fonts.button, { color: Colors.error500 }]}
            title="Refuser"
            variant="Secondary"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminClaimDetail;
