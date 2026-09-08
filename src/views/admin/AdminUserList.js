import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetAdminUsers } from '@/services/admin/adminQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Les roles reellement poses en base, releves en production le 2026-09-08 :
 * joueur (74) · authenticated (46) · dirigeant (14) · entraineur (2) ·
 * parent (2) · superadmin (1). `authenticated` est le role d un compte qui n a
 * pas encore choisi : il merite sa pastille, c est lui qu on veut relancer.
 * @type {{ label: string, type: string }[]}
 */
const ROLES_FILTRABLES = [
  { label: 'Dirigeant', type: 'dirigeant' },
  { label: 'Entraineur', type: 'entraineur' },
  { label: 'Joueur', type: 'joueur' },
  { label: 'Parent', type: 'parent' },
  { label: 'Sans rôle', type: 'authenticated' },
  { label: 'SuperAdmin', type: 'superadmin' },
];

/**
 * La date d inscription, en francais et courte.
 * @param {string | null | undefined} valeur - La date brute.
 * @returns {string} La date lisible, ou '' si elle est absente ou illisible.
 */
const formatInscription = (valeur) => {
  if (!valeur) return '';
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return '';
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}/${date.getFullYear()}`;
};

/**
 *
 */
function AdminUserList() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Demandes d'Adel du 2026-09-08, apres essai de la 2.6.36 : voir les derniers
  // inscrits d'abord, et pouvoir filtrer au moins par role.
  const [roleFilter, setRoleFilter] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);

  // Simple debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useGetAdminUsers({
    q: debouncedSearch,
    role: roleFilter,
    sort: [newestFirst ? 'createdAt:desc' : 'createdAt:asc'],
  });

  const users = data?.data || data || [];

  // 🪝 CES DEUX BLOCS DOIVENT RESTER AU-DESSUS DES SORTIES ANTICIPEES CI-DESSOUS.
  //
  // Le 2026-09-08, `renderItem` vivait APRES les deux `if (...) return`. Au premier rendu
  // la liste chargeait, la sortie etait prise, et `useCallback` n etait jamais appele. Au
  // rendu suivant les donnees arrivaient, la sortie n etait plus prise, et le crochet
  // s executait : React comptait UN crochet de plus qu au tour precedent et JETAIT.
  // Sentry REACT-NATIVE-4, version des magasins 2.6.35+1221 — l ecran plantait entierement.
  //
  // La regle n a pas d exception : dans un composant, TOUS les crochets s appellent AVANT
  // le premier return, toujours, et dans le meme ordre.
  // Temoin : src/views/admin/__tests__/AdminUserList.crochetApresRetour.test.js
  const getRoleBadgeColor = (roleType) => {
    switch (roleType) {
      case 'admin': return Colors.error500;
      case 'dirigeant': return Colors.primary500;
      // ⚠️ « entraineur » N'A PAS D'ACCENT en base (releve en production le
      // 2026-09-08 : up_roles.type vaut bien `entraineur`). Le code cherchait
      // « entraîneur » : cette pastille n'a JAMAIS pris sa couleur.
      case 'entraineur': return Colors.warning500;
      case 'joueur': return Colors.success500;
      case 'parent': return Colors.primary300;
      case 'superadmin': return Colors.error500;
      default: return Colors.neutral300;
    }
  };

  const renderItem = useCallback(({ item }) => {
    const { role } = item;
    const { club } = item;
    const nomComplet = [item.firstname, item.lastname].filter(Boolean).join(' ').trim()
      || 'Personne sans nom';

    return (
      <TouchableOpacity
        accessibilityLabel={`Ouvrir la fiche de ${nomComplet}`}
        // 🐛 LE NUMERO, PAS L IDENTIFIANT DOCUMENT.
        // On passait `item.documentId`, et la fiche appelle `/api/users/:id`.
        // Cette route du greffon users-permissions cherche par NUMERO
        // (services/user.js:88, `where: { $and: [{ id }] }`) : PostgreSQL
        // recevait une chaine la ou il attend un entier et refusait tout.
        // Sentry SERVEUR-STRAPI-7 le 2026-09-08, 6 fois en 14 secondes.
        // ⚠️ La SUPPRESSION, elle, passe par notre route `/superadmin/users/
        // :documentId` : la fiche relit `user.documentId` une fois chargee.
        onPress={() => navigation.navigate(RouteNames.AdminUserDetail, {
          userId: item.id,
        })}
        style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          Spaces.marginBottom[12],
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter]}>
          <ProfileAvatar
            imageUrl={item.avatar?.url}
            name={[item.firstname, item.lastname].filter(Boolean).join(' ')}
            size={50}
          />

          <View style={[Spaces.marginLeft[12], { flex: 1 }]}>
            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
              {item.firstname}
              {' '}
              {item.lastname}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral300 }]}>
              {item.email}
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.marginTop[4], Spaces.gap[8]]}>
              {role && (
              <View
                accessibilityLabel={`Role ${role.name}`}
                style={[
                  Spaces.paddingHorizontal[8],
                  Spaces.paddingVertical[4],
                  { backgroundColor: getRoleBadgeColor(role.type), borderRadius: 4 },
                ]}
              >
                <Text style={[Fonts.p2, { color: 'white', fontSize: 12 }]}>{role.name}</Text>
              </View>
              )}
              {/* LA DATE D INSCRIPTION. Sans elle, l ordre de la liste est
                  invisible : Adel demandait « les derniers d abord » alors que
                  le tri etait deja bon — il ne pouvait simplement pas le voir. */}
              {formatInscription(item.createdAt) ? (
                <Text style={[Fonts.p2, { color: Colors.neutral300, fontSize: 12 }]}>
                  {`📅 ${formatInscription(item.createdAt)}`}
                </Text>
              ) : null}
              {club && (
              <Text style={[Fonts.p2, { color: Colors.neutral300, fontSize: 12 }]}>
                🏟️
                      {' '}
                {club.name}
              </Text>
              )}
            </View>
          </View>

          <Text style={{ color: Colors.neutral300, fontSize: 20 }}>›</Text>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, Colors, Fonts, Spaces, ApplicationStyle, Alignments]);

  if (isLoading && !users.length) {
    return (
      <AdminStateView
        description="Nous chargeons la liste des utilisateurs."
        isLoading
        title="Chargement des utilisateurs"
      />
    );
  }

  if (error && !users.length) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(error, 'generic') || 'Impossible de charger les utilisateurs.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }


  return (
    <ScreenContainer bgImage="bg2">
      {/* Header */}
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginTop[16]]}>
        <Text style={[Fonts.h2, Fonts.neutral00]}>Gestion Utilisateurs</Text>
      </View>

      {/* Search Bar */}
      <View style={[Spaces.padding[16]]}>
        <View style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[8],
        ]}
        >
          <Text style={{ color: Colors.neutral300, marginRight: 8 }}>🔍</Text>
          <TextInput
            onChangeText={setSearchQuery}
            placeholder="Rechercher un utilisateur..."
            placeholderTextColor={Colors.neutral300}
            style={[
              Fonts.p1,
              { color: Colors.neutral00, flex: 1 },
            ]}
            value={searchQuery}
          />
          {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ color: Colors.neutral300, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TRI ET ROLES — demande d'Adel du 2026-09-08. Une seule rangee qui
          defile : le bouton de tri d'abord, puis les six roles reellement
          presents en base. Appuyer deux fois sur un role le retire. */}
      <ScrollView
        contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.gap[8], Alignments.row]}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[Spaces.marginBottom[12], { flexGrow: 0 }]}
      >
        <TouchableOpacity
          accessibilityLabel="Trier par date d inscription"
          onPress={() => setNewestFirst((valeur) => !valeur)}
          style={[
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            {
              backgroundColor: Colors.primary500,
              borderRadius: 999,
            },
          ]}
        >
          <Text style={[Fonts.p2, { color: 'white', fontSize: 12 }]}>
            {newestFirst ? '↓ Derniers inscrits' : '↑ Plus anciens'}
          </Text>
        </TouchableOpacity>

        {ROLES_FILTRABLES.map((entree) => {
          const actif = roleFilter === entree.type;
          return (
            <TouchableOpacity
              accessibilityLabel={`Filtrer sur le role ${entree.label}`}
              key={entree.type}
              onPress={() => setRoleFilter((valeur) => (valeur === entree.type ? '' : entree.type))}
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: actif ? getRoleBadgeColor(entree.type) : Colors.neutral800,
                  borderColor: getRoleBadgeColor(entree.type),
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p2, { color: 'white', fontSize: 12 }]}>{entree.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        contentContainerStyle={[Spaces.paddingHorizontal[16]]}
        data={users}
        keyExtractor={(item) => item.id?.toString()}
        ListEmptyComponent={
                    !isLoading ? (
                      <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
                        <Text style={[Fonts.h4, { color: Colors.neutral200 }]}>Aucun utilisateur trouvé</Text>
                        <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8], { textAlign: 'center' }]}>
                          {searchQuery ? 'Essaie une autre recherche' : 'Les utilisateurs apparaîtront ici'}
                        </Text>
                      </View>
                    ) : null
                }
        refreshControl={
          <RefreshControl onRefresh={refetch} refreshing={isLoading} tintColor={Colors.primary500} />
                }
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

export default AdminUserList;
