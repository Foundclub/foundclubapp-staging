import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetAdminUser, useUpdateAdminUser } from '@/services/admin/adminQueries';
import { useGetRoles } from '@/services/auth/authQueries';

/**
 *
 */
function AdminUserDetail() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
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
      'Confirmer',
      'Voulez-vous sauvegarder les modifications ?',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => {
            updateMutation.mutate(
              {
                data: {
                  blocked: isBlocked,
                  role: selectedRole,
                },
                documentId: userId,
              },
              {
                onError: (err) => {
                  Alert.alert('Erreur', err?.message || 'Une erreur est survenue');
                },
                onSuccess: () => {
                  Alert.alert('Succès', 'Utilisateur mis à jour');
                  navigation.goBack();
                },
              },
            );
          },
          text: 'Sauvegarder',
        },
      ],
    );
  };

  const handleContact = async () => {
    const targetUserDocumentId = String(user?.documentId || user?.id || userId || '').trim();
    const currentUserDocumentId = String(currentUser?.documentId || currentUser?.id || '').trim();

    if (!targetUserDocumentId) {
      Alert.alert('Erreur', 'Document ID utilisateur introuvable pour ouvrir la conversation.');
      return;
    }

    if (targetUserDocumentId === currentUserDocumentId) {
      Alert.alert('Info', 'Tu ne peux pas créer une conversation avec ton propre compte.');
      return;
    }

    setIsContacting(true);
    try {
      const chat = await startWhisperChat([targetUserDocumentId]);
      if (!chat?.documentId) {
        Alert.alert('Erreur', "Impossible d'ouvrir la conversation.");
        return;
      }
      navigation.navigate(RouteNames.Conversation, { chatId: chat.documentId });
    } catch (contactError) {
      Alert.alert('Erreur', contactError?.message || "Impossible d'ouvrir la conversation.");
    } finally {
      setIsContacting(false);
    }
  };

  if (!userId) {
    return (
      <AdminStateView
        actionLabel="Retour"
        description="L'identifiant utilisateur est absent de l'URL."
        onAction={() => navigation.goBack()}
        title="Utilisateur introuvable"
      />
    );
  }

  if (isLoading) {
    return (
      <AdminStateView
        description="Nous chargeons la fiche utilisateur."
        isLoading
        title="Chargement du profil admin"
      />
    );
  }

  if ((userError || rolesError) && !user) {
    return (
      <AdminStateView
        actionLabel="R\u00E9essayer"
        description={userError?.message || rolesError?.message || 'Impossible de charger cet utilisateur.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  if (!user) {
    return (
      <AdminStateView
        actionLabel="Retour"
        description="Le compte demande n'existe pas ou n'est plus accessible."
        onAction={() => navigation.goBack()}
        title="Utilisateur introuvable"
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
            <ProfileAvatar imageUrl={user.avatar?.url} size={80} />
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
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[8]]}>Club Associé</Text>
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <ProfileAvatar imageUrl={user.club.logo?.url} size={40} variant="logo" />
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
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>Rôle</Text>
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
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>Statut du Compte</Text>
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
                ✓ Actif
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
                ✕ Bloqué
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[Alignments.row, Spaces.gap[10]]}>
          <Button
            isLoading={isContacting}
            onPress={handleContact}
            style={{ flex: 1 }}
            title="Contacter"
            variant="Secondary"
          />
          <Button
            isLoading={updateMutation.isPending}
            onPress={handleSave}
            style={{ flex: 1 }}
            title="Sauvegarder"
            variant="Primary"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminUserDetail;
