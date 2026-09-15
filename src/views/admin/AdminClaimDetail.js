/* eslint-disable no-underscore-dangle, react/jsx-one-expression-per-line, no-nested-ternary */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import Button from '@/components/atoms/button/Button';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
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

/**
 *
 */
function AdminClaimDetail() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
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

  const requestDate = request?.createdAt
    ? new Date(request.createdAt).toLocaleDateString()
    : '-';

  const clubLabel = request?.club?.name || request?.clubName || '-';

  const runPrimaryAction = () => {
    if (!requestId) return;

    if (isAffiliationHelp) {
      processHelpMutation.mutate(
        { adminNote: adminNote.trim(), documentId: requestId },
        {
          onError: (error) => {
            Alert.alert(t(
              'adminClaimDetail.errorTitle',
              'Erreur',
            ), getErrorMessage(error, 'generic'));
          },
          onSuccess: () => {
            Alert.alert(
              t('adminClaimDetail.successTitle', 'Succès'),
              t('adminClaimDetail.success.processed', 'Demande traitee.'),
            );
            navigation.goBack();
          },
        },
      );
      return;
    }

    approveMutation.mutate(requestId, {
      onError: (error) => {
        Alert.alert(t('adminClaimDetail.errorTitle', 'Erreur'), getErrorMessage(error, 'generic'));
      },
      onSuccess: () => {
        Alert.alert(
          t('adminClaimDetail.successTitle', 'Succès'),
          t('adminClaimDetail.success.accepted', 'Demande acceptée.'),
        );
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
            Alert.alert(t(
              'adminClaimDetail.errorTitle',
              'Erreur',
            ), getErrorMessage(error, 'generic'));
          },
          onSuccess: () => {
            Alert.alert(
              t('adminClaimDetail.successTitle', 'Succès'),
              t('adminClaimDetail.success.declined', 'Demande refusée.'),
            );
            navigation.goBack();
          },
        },
      );
      return;
    }

    refuseClaimMutation.mutate(requestId, {
      onError: (error) => {
        Alert.alert(t('adminClaimDetail.errorTitle', 'Erreur'), getErrorMessage(error, 'generic'));
      },
      onSuccess: () => {
        Alert.alert(
          t('adminClaimDetail.successTitle', 'Succès'),
          t('adminClaimDetail.success.rejected', 'Demande rejetée.'),
        );
        navigation.goBack();
      },
    });
  };

  const handleApprove = () => {
    Alert.alert(
      t('adminClaimDetail.confirm.title', 'Confirmer'),
      isAffiliationHelp
        ? t('adminClaimDetail.confirm.processBody', 'Traiter cette demande superadmin ?')
        : t(
          'adminClaimDetail.confirm.acceptBody',
          "Veux-tu vraiment accepter cette demande ? L'utilisateur deviendra propriétaire du club.",
        ),
      [
        { style: 'cancel', text: t('adminClaimDetail.cancel', 'Annuler') },
        {
          onPress: runPrimaryAction,
          text: isAffiliationHelp
            ? t('adminClaimDetail.process', 'Traiter')
            : t('adminClaimDetail.accept', 'Accepter'),
        },
      ],
    );
  };

  const handleRefuse = () => {
    Alert.alert(
      t('adminClaimDetail.decline', 'Refuser'),
      t('adminClaimDetail.confirm.rejectBody', 'Veux-tu rejeter cette demande ?'),
      [
        { style: 'cancel', text: t('adminClaimDetail.cancel', 'Annuler') },
        {
          onPress: runSecondaryAction,
          style: 'destructive',
          text: t('adminClaimDetail.decline', 'Refuser'),
        },
      ],
    );
  };

  if (!requestId) {
    return (
      <AdminStateView
        actionLabel={t('adminClaimDetail.back', 'Retour')}
        description={t(
          'adminClaimDetail.states.missingId',
          "L'identifiant de la demande est absent de l'URL.",
        )}
        onAction={() => navigation.goBack()}
        title={t('adminClaimDetail.states.notFound', 'Demande introuvable')}
      />
    );
  }

  if (isLoading) {
    return (
      <AdminStateView
        description={t(
          'adminClaimDetail.states.loadingDescription',
          'Nous chargeons le detail de la demande.',
        )}
        isLoading
        title={t('adminClaimDetail.states.loadingTitle', 'Chargement de la demande')}
      />
    );
  }

  if (error && !request) {
    return (
      <AdminStateView
        actionLabel={t('adminClaimDetail.states.retry', 'Réessayer')}
        description={getErrorMessage(error, 'generic') || t(
          'adminClaimDetail.states.errorDescription',
          'Impossible de charger cette demande.',
        )}
        onAction={refetch}
        title={t('adminClaimDetail.states.errorTitle', 'Chargement impossible')}
      />
    );
  }

  if (!request) {
    return (
      <AdminStateView
        actionLabel={t('adminClaimDetail.back', 'Retour')}
        description={t(
          'adminClaimDetail.states.unavailable',
          "La demande demandée n'existe pas ou n'est plus accessible.",
        )}
        onAction={() => navigation.goBack()}
        title={t('adminClaimDetail.states.notFound', 'Demande introuvable')}
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={Spaces.padding[16]}
      title={t('adminClaimDetail.screenTitle', 'Detail demande')}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
          <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
            {t('adminClaimDetail.requester', 'Demandeur')}
          </Text>
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <ProfileAvatar
              imageUrl={typeof requester?.avatar === 'string'
                ? requester.avatar
                : requester?.avatar?.url}
              name={[requester.firstname, requester.lastname].filter(Boolean).join(' ').trim()}
              size={60}
            />
            <View style={[Spaces.marginLeft[16], { flex: 1 }]}>
              <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
                {[requester.firstname, requester.lastname].filter(Boolean).join(' ').trim() || t(
                  'adminClaimDetail.userFallback',
                  'Utilisateur',
                )}
              </Text>
              {requester?.email ? (
                <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>{requester.email}</Text>
              ) : null}
              <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>{requester.phoneNumber || '-'}</Text>
            </View>
          </View>
          <View style={[Spaces.marginTop[12]]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('adminClaimDetail.forClub', 'Pour le club :')}{' '}
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{clubLabel}</Text>
            </Text>
          </View>
        </View>

        {isAffiliationHelp ? (
          <>
            {isClubCreation ? (
              <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
                <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
                  {t('adminClaimDetail.managerToContact', 'Dirigeant à contacter')}
                </Text>
                <View style={[Spaces.gap[10]]}>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {t('adminClaimDetail.fields.name', 'Nom:')}{' '}
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                      {[managerContact.firstname, managerContact.lastname].filter(Boolean).join(' ').trim() || '-'}
                    </Text>
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {t('adminClaimDetail.fields.phone', 'Telephone:')}{' '}
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
                {isClubCreation ? t('adminClaimDetail.clubToOnboard', 'Club à onboarder') : t(
                  'adminClaimDetail.affiliationRequest',
                  'Demande affiliation',
                )}
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
                  {t('adminClaimDetail.fields.screen', 'Ecran:')}{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request?.searchContext?.screen || '-'}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Role:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request?.searchContext?.role || '-'}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  {t('adminClaimDetail.fields.target', 'Cible:')}{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request?.searchContext?.target || '-'}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  {t('adminClaimDetail.fields.initialSearch', 'Recherche initiale:')}{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {request?.searchContext?.currentQuery || request?.searchContext?.clubId || '-'}
                  </Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Date:{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{requestDate}</Text>
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  {t('adminClaimDetail.fields.comment', 'Commentaire:')}{' '}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{request.comment || '-'}</Text>
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
              {t('adminClaimDetail.claimedClub', 'Club revendique')}
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter]}>
              {/* L14 : un CLUB sans logo montre l'ECUSSON, pas le dessin de
                  personne que servait ProfileAvatar variant="logo" non garde. */}
              <ClubLogoMark club={request?.club} size={60} />
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
              label={t('adminClaimDetail.adminNote.label', 'Note admin (optionnelle)')}
              multiline
              numberOfLines={3}
              onChangeText={setAdminNote}
              placeholder={t(
                'adminClaimDetail.adminNote.placeholder',
                'Ajoute un contexte visible par le demandeur',
              )}
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
              ? (processHelpMutation.isPending ? t(
                'adminClaimDetail.processing',
                'Traitement...',
              ) : t(
                'adminClaimDetail.processRequest',
                'Traiter la demande',
              ))
              : (approveMutation.isPending ? t('adminClaimDetail.processing', 'Traitement...') : t(
                'adminClaimDetail.acceptRequest',
                'Accepter la demande',
              ))}
            variant="Primary"
          />

          <Button
            disabled={refuseClaimMutation.isPending || refuseHelpMutation.isPending}
            onPress={handleRefuse}
            style={{ borderColor: Colors.error500 }}
            textStyle={[Fonts.button, { color: Colors.error500 }]}
            title={t('adminClaimDetail.decline', 'Refuser')}
            variant="Secondary"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminClaimDetail;
