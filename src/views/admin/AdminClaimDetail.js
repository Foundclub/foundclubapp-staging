/* eslint-disable no-underscore-dangle, react/jsx-one-expression-per-line, no-nested-ternary */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import Button from '@/components/atoms/button/Button';
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

import { getErrorMessage } from '@/utils/errors/displayError';

const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();

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

  const {
    data: requestResponse,
    error,
    isLoading,
    refetch,
  } = useGetClubClaimRequest(requestId, requestType);
  const approveMutation = useApproveClubClaim();
  const refuseClaimMutation = useRefuseClubClaim();
  const processHelpMutation = useProcessAffiliationHelpRequest();
  const refuseHelpMutation = useRefuseAffiliationHelpRequest();

  const request = requestResponse?.data;
  const isAffiliationHelp = !!request?.__isAffiliationHelp;
  const isClubCreation = request?.requestKind === 'club_creation';
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    if (!request?.adminNote) return;
    setAdminNote((currentValue) => (currentValue || request.adminNote));
  }, [request?.adminNote]);

  const requester = useMemo(() => {
    const user = request?.user || {};
    const fallbackToHolder = !isClubCreation;
    return {
      avatar: user?.avatar?.url,
      email: user?.email || (fallbackToHolder ? request?.holderEmail || '' : ''),
      firstname: user?.firstname || (fallbackToHolder ? request?.holderFirstname || '' : ''),
      lastname: user?.lastname || (fallbackToHolder ? request?.holderLastname || '' : ''),
      phoneNumber: user?.phoneNumber || (fallbackToHolder ? request?.holderPhone || '' : ''),
    };
  }, [isClubCreation, request]);

  const managerContact = useMemo(() => ({
    email: request?.holderEmail || '',
    firstname: request?.holderFirstname || '',
    lastname: request?.holderLastname || '',
    phoneNumber: request?.holderPhone || '',
  }), [request]);

  const shouldShowRequesterCard = useMemo(() => {
    if (!isAffiliationHelp) return true;
    if (!isClubCreation) return true;
    if (!request?.user) return false;

    const sameName = normalizeComparableValue(requester.firstname) === normalizeComparableValue(managerContact.firstname)
      && normalizeComparableValue(requester.lastname) === normalizeComparableValue(managerContact.lastname);
    const samePhone = normalizeComparableValue(requester.phoneNumber) === normalizeComparableValue(managerContact.phoneNumber);
    const sameEmail = normalizeComparableValue(requester.email) === normalizeComparableValue(managerContact.email);

    return !(sameName && samePhone && sameEmail);
  }, [isAffiliationHelp, isClubCreation, managerContact, request?.user, requester.email, requester.firstname, requester.lastname, requester.phoneNumber]);

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
            Alert.alert('Erreur', getErrorMessage(error, 'generic'));
          },
          onSuccess: () => {
            Alert.alert('Succes', 'Demande traitee.');
            navigation.goBack();
          },
        },
      );
      return;
    }

    approveMutation.mutate(requestId, {
      onError: (error) => {
        Alert.alert('Erreur', getErrorMessage(error, 'generic'));
      },
      onSuccess: () => {
        Alert.alert('Succes', 'Demande acceptee.');
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
            Alert.alert('Erreur', getErrorMessage(error, 'generic'));
          },
          onSuccess: () => {
            Alert.alert('Succes', 'Demande refusee.');
            navigation.goBack();
          },
        },
      );
      return;
    }

    refuseClaimMutation.mutate(requestId, {
      onError: (error) => {
        Alert.alert('Erreur', getErrorMessage(error, 'generic'));
      },
      onSuccess: () => {
        Alert.alert('Succes', 'Demande rejetee.');
        navigation.goBack();
      },
    });
  };

  const handleApprove = () => {
    Alert.alert(
      'Confirmer',
      isAffiliationHelp
        ? 'Traiter cette demande superadmin ?'
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

  if (!requestId) {
    return (
      <AdminStateView
        actionLabel="Retour"
        description="L'identifiant de la demande est absent de l'URL."
        onAction={() => navigation.goBack()}
        title="Demande introuvable"
      />
    );
  }

  if (isLoading) {
    return (
      <AdminStateView
        description="Nous chargeons le detail de la demande."
        isLoading
        title="Chargement de la demande"
      />
    );
  }

  if (error && !request) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(error, 'generic') || 'Impossible de charger cette demande.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  if (!request) {
    return (
      <AdminStateView
        actionLabel="Retour"
        description="La demande demandee n'existe pas ou n'est plus accessible."
        onAction={() => navigation.goBack()}
        title="Demande introuvable"
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={Spaces.padding[16]}
      title="Detail demande"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {!isAffiliationHelp || shouldShowRequesterCard ? (
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
        ) : null}

        {isAffiliationHelp ? (
          <>
            {isClubCreation ? (
              <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
                <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
                  Dirigeant a contacter
                </Text>
                <View style={[Spaces.gap[10]]}>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    Nom:{' '}
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                      {[managerContact.firstname, managerContact.lastname].filter(Boolean).join(' ').trim() || '-'}
                    </Text>
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    Telephone:{' '}
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{managerContact.phoneNumber || '-'}</Text>
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    Email:{' '}
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{managerContact.email || '-'}</Text>
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
              <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
                {isClubCreation ? 'Club a onboarder' : 'Demande affiliation'}
              </Text>
              <View style={[Spaces.gap[10]]}>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Type:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request.__typeLabel}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Club:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request.clubName || '-'}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Source:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request.source || '-'}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Ecran:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request?.searchContext?.screen || '-'}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Role:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request?.searchContext?.role || '-'}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Cible:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request?.searchContext?.target || '-'}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Recherche initiale:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {request?.searchContext?.currentQuery || request?.searchContext?.clubId || '-'}
                  </Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Date:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{requestDate}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Commentaire:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request.comment || '-'}</Text>
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
              Club revendique
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter]}>
              <ProfileAvatar imageUrl={request?.club?.logo?.url} size={60} variant="logo" />
              <View style={Spaces.marginLeft[16]}>
                <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{request?.club?.name}</Text>
                <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>
                  {request?.club?.city}
                  {' '}
                  ({request?.club?.postalCode})
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
            textStyle={Fonts.button}
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
