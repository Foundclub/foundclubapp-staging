import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useDeleteAdminUser, useGetAdminUser, useUpdateAdminUser } from '@/services/admin/adminQueries';
import { useGetRoles } from '@/services/auth/authQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 *
 */
function AdminUserDetail() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { userId } = route.params || {};
  const { userData: currentUser } = useAuth();
  const { startWhisperChat } = useMessaging();

  const {
    data: userData,
    error: userError,
    isLoading,
    refetch,
  } = useGetAdminUser(userId);
  const { data: rolesData, error: rolesError } = useGetRoles();
  const updateMutation = useUpdateAdminUser();

  const user = userData; // users-permissions returns user directly, not wrapped in data
  const roles = rolesData?.roles || rolesData || [];
  const deleteMutation = useDeleteAdminUser();
  const selfDocumentId = String(currentUser?.documentId || currentUser?.id || '').trim();
  // ⚠️ DEUX IDENTIFIANTS, DEUX PORTES.
  // Depuis le 2026-09-08 la liste passe le NUMERO (`item.id`) : c'est ce
  // qu'exige `/api/users/:id`. Mais la SUPPRESSION appelle notre route maison
  // `/superadmin/users/:documentId`, qui veut l'identifiant document.
  // On le lit donc sur la personne CHARGEE, et JAMAIS sur le parametre de
  // navigation : y retomber enverrait un numero a une porte qui attend une
  // chaine, sur un geste irreversible.
  const viewedUserDocumentId = String(user?.documentId || '').trim();
  const isSelfAccount = Boolean(selfDocumentId)
    && (selfDocumentId === viewedUserDocumentId
      || String(currentUser?.id || '') === String(user?.id || userId || ''));

  const [selectedRole, setSelectedRole] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isContacting, setIsContacting] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role?.id || user.role);
      setIsBlocked(user.blocked || false);
    }
  }, [user]);

  const handleSave = () => {
    Alert.alert(
      t('adminUserDetail.confirmTitle', 'Confirmer'),
      t('adminUserDetail.confirmSave', 'Veux-tu sauvegarder les modifications ?'),
      [
        { style: 'cancel', text: t('adminUserDetail.cancel', 'Annuler') },
        {
          onPress: () => {
            updateMutation.mutate(
              {
                data: {
                  blocked: isBlocked,
                  role: selectedRole,
                },
                documentId: viewedUserDocumentId,
              },
              {
                onError: (err) => {
                  Alert.alert(
                    t('adminUserDetail.errorTitle', 'Erreur'),
                    getErrorMessage(err, 'generic'),
                  );
                },
                onSuccess: () => {
                  Alert.alert(
                    t('adminUserDetail.successTitle', 'Succès'),
                    t('adminUserDetail.updated', 'Utilisateur mis à jour'),
                  );
                  navigation.goBack();
                },
              },
            );
          },
          text: t('adminUserDetail.save', 'Sauvegarder'),
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t('adminUserDetail.deleteTitle', 'Supprimer ce compte ?'),
      t(
        'adminUserDetail.deleteMessage',
        'Le compte sera anonymisé et bloqué définitivement. Cette action est irréversible.',
      ),
      [
        { style: 'cancel', text: t('adminUserDetail.cancel', 'Annuler') },
        {
          onPress: () => {
            deleteMutation.mutate(
              {
                documentId: viewedUserDocumentId,
                reason: 'Suppression par un superadmin',
              },
              {
                onError: (err) => {
                  Alert.alert(
                    t('adminUserDetail.errorTitle', 'Erreur'),
                    getErrorMessage(err, 'generic'),
                  );
                },
                onSuccess: () => {
                  Alert.alert(
                    t('adminUserDetail.deletedTitle', 'Compte supprimé'),
                    t('adminUserDetail.deletedMessage', "L'utilisateur a été anonymisé et bloqué."),
                  );
                  navigation.goBack();
                },
              },
            );
          },
          style: 'destructive',
          text: t('adminUserDetail.delete', 'Supprimer'),
        },
      ],
    );
  };

  const handleContact = async () => {
    const targetUserDocumentId = String(user?.documentId || user?.id || userId || '').trim();
    const currentUserDocumentId = String(currentUser?.documentId || currentUser?.id || '').trim();

    if (!targetUserDocumentId) {
      Alert.alert(
        t('adminUserDetail.errorTitle', 'Erreur'),
        t(
          'adminUserDetail.missingDocumentId',
          'Document ID utilisateur introuvable pour ouvrir la conversation.',
        ),
      );
      return;
    }

    if (targetUserDocumentId === currentUserDocumentId) {
      Alert.alert(
        t('adminUserDetail.infoTitle', 'Info'),
        t(
          'adminUserDetail.selfChat',
          'Tu ne peux pas créer une conversation avec ton propre compte.',
        ),
      );
      return;
    }

    setIsContacting(true);
    try {
      const chat = await startWhisperChat([targetUserDocumentId]);
      if (!chat?.documentId) {
        Alert.alert(
          t('adminUserDetail.errorTitle', 'Erreur'),
          t('adminUserDetail.openChatError', "Impossible d'ouvrir la conversation."),
        );
        return;
      }
      navigation.navigate(RouteNames.Conversation, { chatId: chat.documentId });
    } catch (contactError) {
      Alert.alert(
        t('adminUserDetail.errorTitle', 'Erreur'),
        getErrorMessage(contactError, 'generic') || t(
          'adminUserDetail.openChatError',
          "Impossible d'ouvrir la conversation.",
        ),
      );
    } finally {
      setIsContacting(false);
    }
  };

  if (!userId) {
    return (
      <AdminStateView
        actionLabel={t('adminUserDetail.states.back', 'Retour')}
        description={t(
          'adminUserDetail.states.missingId',
          "L'identifiant utilisateur est absent de l'URL.",
        )}
        onAction={() => navigation.goBack()}
        title={t('adminUserDetail.states.notFoundTitle', 'Utilisateur introuvable')}
      />
    );
  }

  if (isLoading) {
    return (
      <AdminStateView
        description={t(
          'adminUserDetail.states.loadingDescription',
          'Nous chargeons la fiche utilisateur.',
        )}
        isLoading
        title={t('adminUserDetail.states.loadingTitle', 'Chargement du profil admin')}
      />
    );
  }

  if ((userError || rolesError) && !user) {
    return (
      <AdminStateView
        actionLabel={t('adminUserDetail.states.retry', 'Réessayer')}
        description={userError?.message || rolesError?.message || t(
          'adminUserDetail.states.errorDescription',
          'Impossible de charger cet utilisateur.',
        )}
        onAction={refetch}
        title={t('adminUserDetail.states.errorTitle', 'Chargement impossible')}
      />
    );
  }

  if (!user) {
    return (
      <AdminStateView
        actionLabel={t('adminUserDetail.states.back', 'Retour')}
        description={t(
          'adminUserDetail.states.notFoundDescription',
          "Le compte demande n'existe pas ou n'est plus accessible.",
        )}
        onAction={() => navigation.goBack()}
        title={t('adminUserDetail.states.notFoundTitle', 'Utilisateur introuvable')}
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView contentContainerStyle={[Spaces.padding[16]]} showsVerticalScrollIndicator={false}>
        {/* User Info Card */}
        <View style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[24],
          Spaces.marginBottom[16],
        ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <ProfileAvatar
              imageUrl={user.avatar?.url}
              name={[user.firstname, user.lastname].filter(Boolean).join(' ')}
              size={80}
            />
            <View style={[Spaces.marginLeft[16], { flex: 1 }]}>
              <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>
                {user.firstname}
                {' '}
                {user.lastname}
              </Text>
              <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>{user.email}</Text>
              {user.phoneNumber && (
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{user.phoneNumber}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Club Info */}
        {user.club && (
        <View style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          Spaces.marginBottom[16],
        ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[8]]}>
            {t('adminUserDetail.club', 'Club Associé')}
          </Text>
          <View style={[Alignments.row, Alignments.alignCenter]}>
            {/* L14 : un CLUB sans logo montre l'ECUSSON, pas le dessin de
                personne que servait ProfileAvatar variant="logo" non garde. */}
            <ClubLogoMark club={user.club} size={40} />
            <Text style={[Fonts.p1, { color: Colors.neutral00 }, Spaces.marginLeft[12]]}>
              {user.club.name}
            </Text>
          </View>
        </View>
        )}

        {/* Role Selection */}
        <View style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          Spaces.marginBottom[16],
        ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
            {t('adminUserDetail.role', 'Rôle')}
          </Text>
          <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
            {Array.isArray(roles) && roles.map((role) => (
              <TouchableOpacity
                key={role.id}
                onPress={() => setSelectedRole(role.id)}
                style={[
                  Spaces.paddingVertical[8],
                  Spaces.paddingHorizontal[12],
                  {
                    backgroundColor: selectedRole === role.id ? Colors.primary500 : 'transparent',
                    borderColor: selectedRole === role.id ? Colors.primary500 : Colors.neutral300,
                    borderRadius: 8,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={{ color: selectedRole === role.id ? 'white' : Colors.neutral300 }}>
                  {role.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Block/Unblock */}
        <View style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          Spaces.marginBottom[24],
        ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>
            {t('adminUserDetail.accountStatus', 'Statut du Compte')}
          </Text>
          <View style={[Alignments.row, Spaces.gap[12]]}>
            <TouchableOpacity
              onPress={() => setIsBlocked(false)}
              style={[
                Spaces.paddingVertical[12],
                Spaces.paddingHorizontal[16],
                {
                  alignItems: 'center',
                  backgroundColor: !isBlocked ? Colors.success500 : 'transparent',
                  borderColor: !isBlocked ? Colors.success500 : Colors.neutral300,
                  borderRadius: 8,
                  borderWidth: 1,
                  flex: 1,
                },
              ]}
            >
              <Text style={{ color: !isBlocked ? 'white' : Colors.neutral300, fontWeight: 'bold' }}>
                {t('adminUserDetail.active', '✓ Actif')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsBlocked(true)}
              style={[
                Spaces.paddingVertical[12],
                Spaces.paddingHorizontal[16],
                {
                  alignItems: 'center',
                  backgroundColor: isBlocked ? Colors.error500 : 'transparent',
                  borderColor: isBlocked ? Colors.error500 : Colors.neutral300,
                  borderRadius: 8,
                  borderWidth: 1,
                  flex: 1,
                },
              ]}
            >
              <Text style={{ color: isBlocked ? 'white' : Colors.neutral300, fontWeight: 'bold' }}>
                {t('adminUserDetail.blocked', '✕ Bloqué')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[Alignments.row, Spaces.gap[10]]}>
          <Button
            isLoading={isContacting}
            onPress={handleContact}
            style={{ flex: 1 }}
            title={t('adminUserDetail.contact', 'Contacter')}
            variant="Secondary"
          />
          <Button
            isLoading={updateMutation.isPending}
            onPress={handleSave}
            style={{ flex: 1 }}
            title={t('adminUserDetail.save', 'Sauvegarder')}
            variant="Primary"
          />
        </View>

        {/* Sans identifiant document, la porte de suppression ne peut pas etre
            visee : on n'offre pas un geste irreversible qu'on ne sait pas adresser. */}
        {!isSelfAccount && Boolean(viewedUserDocumentId) && (
          <TouchableOpacity
            accessibilityLabel={t('adminUserDetail.deleteAccount', 'Supprimer le compte')}
            disabled={deleteMutation.isPending}
            onPress={handleDelete}
            style={[
              Spaces.marginTop[12],
              Spaces.paddingVertical[12],
              {
                alignItems: 'center',
                backgroundColor: Colors.error500,
                borderRadius: 8,
                justifyContent: 'center',
                minHeight: 44,
                opacity: deleteMutation.isPending ? 0.6 : 1,
              },
            ]}
          >
            <Text style={{ color: Colors.neutral00, fontWeight: 'bold' }}>
              {deleteMutation.isPending
                ? t('adminUserDetail.deleting', 'Suppression…')
                : t('adminUserDetail.deleteAccount', 'Supprimer le compte')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminUserDetail;
