import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getUserRoleKey, profileFieldToDisplay } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import usePlaces from '@/domains/places/usePlaces';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import Input from '@/components/molecules/input/Input';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
// eslint-disable-next-line max-len
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';
import { useGetMyHistories } from '@/services/userHistory/userHistoryQueries';

import safeJsonParse from '@/utils/safeJsonParse';

// D06 — « voir » et « modifier » ne font plus qu'un (pack design du 2026-08-05,
// composant `ProfilU` de `claude design/export/profil-amical-annonces/
// design_reference/lg-screens2.jsx`).
//
// Cet ecran ne sert QUE le profil de l'utilisateur courant. Le profil de
// quelqu'un d'autre reste rendu par `UserDetails.js`, qui garde ses douze
// points d'entree et son masquage « Prive » — la refonte ne le traverse pas.
//
// Trois regles portent la valeur du lot :
//   1. un champ vide propose « Ajouter » en cyan, au lieu de repeter
//      « Non renseigne » ;
//   2. taper une rangee ouvre une sheet a UN SEUL champ, et la sauvegarde
//      n'envoie QUE ce champ — l'API l'accepte, chaque champ n'est ecrit que
//      s'il est `!== undefined` (`admin/src/api/firebase-auth/controllers/
//      firebase-auth.ts:1120-1136`) ;
//   3. les champs joueur (taille, poids, poste, section) disparaissent pour un
//      dirigeant. Le juge n'est pas reecrit ici : c'est `profileFieldToDisplay`
//      (`src/domains/auth/authUseCases.js:481`), deja utilise par `ProfileEdit`.
//
/**
 * Surfaces translucides de l'ecran. Elles sont CALCULEES depuis les jetons du
 * theme par `withAlpha` — l'unique moyen legitime de teinter un jeton
 * (`src/theme/colors.js:78`) — et non ecrites en `rgba(...)` litteral : le
 * contrat de theme compte ces litteraux, et aucune couleur neuve n'entre ici.
 * @param {any} Colors
 * @returns {Record<string, string>}
 */
const buildSurfaces = (Colors) => ({
  cardBg: withAlpha(Colors.primary800, 0.82),
  cardBorder: withAlpha(Colors.neutral00, 0.12),
  chipRoleBg: withAlpha(Colors.error500, 0.14),
  chipRoleBorder: withAlpha(Colors.error500, 0.45),
  chipVerifiedBg: withAlpha(Colors.success500, 0.14),
  chipVerifiedBorder: withAlpha(Colors.success500, 0.45),
  divider: withAlpha(Colors.neutral00, 0.08),
  iconTile: withAlpha(Colors.primary500, 0.12),
  pencilBg: withAlpha(Colors.primary500, 0.12),
  pencilBorder: withAlpha(Colors.primary500, 0.3),
  sectionBg: withAlpha(Colors.neutral00, 0.04),
  sectionBorder: withAlpha(Colors.neutral00, 0.09),
  // Ecusson d'equipe : gris clair du pack, encre foncee. Les deux existent deja
  // dans la palette (`neutral200`, `primary700`) — pas de hex neuf.
  teamTile: Colors.neutral200,
  teamTileInk: Colors.primary700,
});

// La rampe `Spaces` s'arrete a 0/4/8/12/16/24/32/40/64/80/128/160 : 52 (hauteur
// de rangee), 44 (cible tactile) et 30 (tuile d'icone) n'y sont pas. Ils vivent
// donc en style litteral, comme deja fait dans `Profile.js` et `UserDetails.js`.
const ROW_MIN_HEIGHT = 52;
const ICON_TILE = 30;
const AVATAR_SIZE = 64;

/**
 * Lit un libelle de ville depuis l'adresse stockee (objet ou chaine JSON).
 * @param {any} address
 * @returns {string}
 */
const readCityLabel = (address) => {
  if (!address) return '';
  let raw = address;
  if (typeof raw === 'string') {
    raw = safeJsonParse(raw, raw);
    if (typeof raw === 'string') return raw;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return '';
  return String(raw.city || raw.town || raw.label || raw.address || '').trim();
};

/**
 * Rangee-bouton du pack : tuile d'icone, libelle, valeur a droite, chevron.
 * Une valeur absente devient « Ajouter » en cyan — jamais « Non renseigne ».
 * @param {object} props
 * @param {any} props.Colors
 * @param {any} props.Images
 * @param {any} props.icon
 * @param {string} props.label
 * @param {string} [props.value]
 * @param {(() => void)} [props.onPress]
 * @param {boolean} [props.divider]
 * @param {string} props.addLabel
 * @param {Record<string, string>} props.surfaces
 * @returns {import('react').ReactElement}
 */
function ProfileRow({
  addLabel, Colors, divider, icon, Images, label, onPress, surfaces, value,
}) {
  const isEmpty = !String(value || '').trim();
  const displayedValue = isEmpty ? addLabel : String(value);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={{
        alignItems: 'center',
        borderTopColor: surfaces.divider,
        borderTopWidth: divider ? 1 : 0,
        flexDirection: 'row',
        gap: 12,
        minHeight: ROW_MIN_HEIGHT,
        paddingVertical: 8,
      }}
    >
      <View style={{
        alignItems: 'center',
        backgroundColor: surfaces.iconTile,
        borderRadius: 9,
        height: ICON_TILE,
        justifyContent: 'center',
        width: ICON_TILE,
      }}
      >
        <Image source={icon} style={{ height: 14, tintColor: Colors.primary500, width: 14 }} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: Colors.neutral00, flex: 1, fontFamily: 'Montserrat-Bold', fontSize: 13.5,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: isEmpty ? Colors.primary200 : Colors.neutral400,
          fontFamily: 'Montserrat-Bold',
          fontSize: 12,
          maxWidth: 160,
        }}
      >
        {displayedValue}
      </Text>
      {onPress ? (
        <Image
          source={Images.arrowRight}
          style={{ height: 14, tintColor: Colors.neutral400, width: 14 }}
        />
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * Le profil de l'utilisateur courant : consultation et edition dans le meme ecran.
 * @param {object} props
 * @param {any} props.navigation
 * @returns {import('react').ReactElement}
 */
function SelfProfileUnified({ navigation }) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { getClubInitials } = useClub();
  const { getGeohashForPointAndRadius } = usePlaces();
  const {
    getAuthTokens,
    isCurrentClubVerified,
    refetchUserData,
    userData,
  } = useAuth();
  const { data: histories } = useGetMyHistories();

  /** @type {[any, Function]} */
  const [editedField, setEditedField] = useState(null);
  /** @type {[any, Function]} */
  const [draftValue, setDraftValue] = useState('');

  const surfaces = useMemo(() => buildSurfaces(Colors), [Colors]);
  const allowedFields = useMemo(
    () => profileFieldToDisplay(userData?.role) || [],
    [userData?.role],
  );

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: () => {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'profile.updateError',
          'Impossible d\'enregistrer ton profil pour le moment. Vérifie ta connexion et réessaie.',
        ),
      );
    },
    onSuccess: async (updatedUser) => {
      // Meme motif que `ProfileEdit` : la reponse du PUT EST le profil a jour,
      // on alimente le cache avec — un GET immediat peut encore etre servi
      // perime par un replica serveur.
      const authToken = getAuthTokens?.()?.token || 'no-token';
      queryClient.setQueryData(
        ['get-me', authToken],
        (/** @type {any} */ previous) => (previous ? { ...previous, ...updatedUser } : updatedUser),
      );
      await queryClient.invalidateQueries({
        predicate: (/** @type {any} */ query) => (
          Array.isArray(query.queryKey) && query.queryKey[0] === 'app-bootstrap'
        ),
      });
      setEditedField(null);
    },
  });

  const fullName = `${userData?.firstname || ''} ${userData?.lastname || ''}`.trim();
  // Meme lecture du role que `Profile.js:84` : la chip suit le role reel, elle
  // n'est jamais figee sur « Dirigeant » — cet ecran sert aussi les joueurs et
  // les entraineurs.
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const roleLabel = t(`profile.identity.roles.${roleKey}`, t('profile.identity.roles.new'));
  const addLabel = t('profile.actions.addValue', 'Ajouter');
  const cityLabel = useMemo(() => readCityLabel(userData?.address), [userData?.address]);
  const historyCount = Array.isArray(histories) ? histories.length : 0;
  const coachedTeams = useMemo(
    () => (Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : []),
    [userData?.trainedTeams],
  );

  /**
   * Ouvre la sheet sur un champ, avec sa valeur courante en brouillon.
   * @param {any} field
   * @returns {void}
   */
  const openField = (field) => {
    setDraftValue(field.currentValue ?? '');
    setEditedField(field);
  };

  /**
   * Enregistre le champ en cours — et LUI SEUL.
   * @returns {void}
   */
  const saveEditedField = () => {
    if (!editedField) return;

    if (editedField.key === 'address') {
      // L'adresse voyage avec son geohash : les deux clefs decrivent le meme
      // champ metier, et les dissocier laisserait la recherche geographique
      // pointer sur l'ancienne ville.
      let geohash = null;
      const coords = String(draftValue?.value || '').split('|');
      if (coords.length === 2) {
        geohash = getGeohashForPointAndRadius(
          parseFloat(coords[1]),
          parseFloat(coords[0]),
          0.001,
        );
      }
      updateUserMutation.mutate({ address: draftValue, geohash });
      return;
    }

    updateUserMutation.mutate({ [editedField.key]: draftValue });
  };

  /**
   * Bascule la visibilite du profil : un seul champ, sans sheet.
   * @param {boolean} nextValue
   * @returns {void}
   */
  const toggleVisibility = (nextValue) => {
    updateUserMutation.mutate({ isLookingForClub: nextValue });
  };

  const contactRows = [
    {
      icon: Images.phone,
      key: 'phoneNumber',
      label: t('userDetails.fields.phone', 'Téléphone'),
      // Identifiant de connexion Firebase : affiche, jamais editable ici — le
      // formulaire actuel le rend deja `readOnly`.
      readOnly: true,
      value: userData?.phoneNumber || '',
    },
    {
      icon: Images.envelope,
      key: 'email',
      keyboardType: 'email-address',
      label: t('userDetails.fields.email', 'Email'),
      value: userData?.email || '',
    },
    {
      icon: Images.pin,
      key: 'address',
      kind: 'address',
      label: t('profile.fields.city.label', 'Ville'),
      value: cityLabel,
    },
  ];

  const sportRows = [
    {
      icon: Images.trophy,
      key: 'preferredSport',
      label: t('profile.fields.preferredSport.label', 'Sport de préférence'),
      value: userData?.preferredSport || '',
    },
    {
      icon: Images.users,
      key: 'category',
      label: t('userDetails.fields.category', 'Catégorie'),
      value: userData?.category || '',
    },
    {
      icon: Images.calendar,
      key: 'sportsHistory',
      kind: 'navigate',
      label: t('userDetails.fields.history', 'Historique sportif'),
      onPress: () => navigation.navigate(RouteNames.HistoryWizardCategory, {
        resetContext: true,
        returnRoute: RouteNames.UserDetails,
      }),
      value: t('userDetails.historySummary.count', { count: historyCount }),
    },
    // Les champs joueur ne sont montres qu'a qui les porte : le juge est
    // `profileFieldToDisplay`, jamais une seconde regle ecrite ici.
    ...(allowedFields.includes('position') ? [{
      icon: Images.pin,
      key: 'position',
      label: t('userDetails.fields.position', 'Poste'),
      value: userData?.position || '',
    }] : []),
    ...(allowedFields.includes('height') ? [{
      icon: Images.check,
      key: 'height',
      label: t('userDetails.fields.height', 'Taille (m)'),
      value: userData?.height ? String(userData.height) : '',
    }] : []),
    ...(allowedFields.includes('weight') ? [{
      icon: Images.check,
      key: 'weight',
      label: t('userDetails.fields.weight', 'Poids (kg)'),
      value: userData?.weight ? String(userData.weight) : '',
    }] : []),
  ];

  const sectionLabelStyle = {
    color: Colors.neutral300,
    fontFamily: 'Montserrat-Bold',
    fontSize: 11.5,
    letterSpacing: 0.6,
    marginTop: 4,
    textTransform: /** @type {const} */ ('uppercase'),
  };
  const sectionCardStyle = {
    backgroundColor: surfaces.sectionBg,
    borderColor: surfaces.sectionBorder,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  };

  /**
   * Rend une section titree et sa carte de rangees.
   * @param {{ label: string, rows: any[] }} params
   * @returns {import('react').ReactElement}
   */
  const renderSection = ({ label, rows }) => (
    <View style={{ gap: 10 }}>
      <Text style={sectionLabelStyle}>{label}</Text>
      <View style={sectionCardStyle}>
        {rows.map((row, index) => {
          // Trois natures de rangee, dans cet ordre : en lecture seule (aucune
          // action), navigation vers un autre ecran, ou edition en place.
          let handlePress;
          if (row.readOnly) {
            handlePress = undefined;
          } else if (row.onPress) {
            handlePress = row.onPress;
          } else {
            handlePress = () => openField({
              ...row,
              currentValue: row.kind === 'address' ? userData?.address || null : row.value,
            });
          }

          return (
            <ProfileRow
              addLabel={addLabel}
              Colors={Colors}
              divider={index > 0}
              icon={row.icon}
              Images={Images}
              key={row.key}
              label={row.label}
              onPress={handlePress}
              surfaces={surfaces}
              value={row.value}
            />
          );
        })}
      </View>
    </View>
  );

  /**
   * Rend une pastille : le role de l'utilisateur, ou la certification du club.
   * @param {{ chip: string, tone: 'role' | 'verified' }} params
   * @returns {import('react').ReactElement}
   */
  const renderChip = ({ chip, tone }) => (
    <View style={{
      backgroundColor: tone === 'role' ? surfaces.chipRoleBg : surfaces.chipVerifiedBg,
      borderColor: tone === 'role' ? surfaces.chipRoleBorder : surfaces.chipVerifiedBorder,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    }}
    >
      <Text style={{
        color: tone === 'role' ? Colors.error300 : Colors.success200,
        fontFamily: 'Montserrat-Bold',
        fontSize: 11,
      }}
      >
        {chip}
      </Text>
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[12], Alignments.fill]}
    >
      {/* Titre seul : la fleche de retour est fournie par l'entete natif de la
          stack. En dessiner une ici en afficherait DEUX (defaut du lot D2). */}
      <View style={[Alignments.alignCenter, { paddingBottom: 4 }]}>
        <Text style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Black', fontSize: 21 }}>
          {t('profile.titles.unified', 'Mon profil')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1, gap: 16, paddingBottom: 24, paddingTop: 12,
        }}
        refreshControl={(
          <RefreshControl onRefresh={() => refetchUserData?.()} refreshing={false} />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{
          backgroundColor: surfaces.cardBg,
          borderColor: surfaces.cardBorder,
          borderRadius: 18,
          borderWidth: 1,
          padding: 16,
        }}
        >
          <TouchableOpacity
            accessibilityLabel={t('profile.actions.editIdentity', 'Modifier mon nom et ma photo')}
            accessibilityRole="button"
            onPress={() => navigation.navigate(RouteNames.ProfileEdit)}
            style={{
              alignItems: 'center',
              backgroundColor: surfaces.pencilBg,
              borderColor: surfaces.pencilBorder,
              borderRadius: 999,
              borderWidth: 1,
              height: 34,
              justifyContent: 'center',
              position: 'absolute',
              right: 12,
              top: 12,
              width: 34,
            }}
          >
            <Image
              source={Images.edit}
              style={{ height: 14, tintColor: Colors.primary200, width: 14 }}
            />
          </TouchableOpacity>

          <View style={[Alignments.row, Alignments.alignCenter, { gap: 14 }]}>
            <ProfileAvatar
              imageStyle={{ borderRadius: AVATAR_SIZE }}
              imageUrl={userData?.avatar?.url}
              name={fullName}
              size={AVATAR_SIZE}
            />
            <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
              <Text style={{
                color: Colors.neutral00, fontFamily: 'Montserrat-Black', fontSize: 18,
              }}
              >
                {fullName}
              </Text>
              <View style={[Alignments.row, { gap: 6 }]}>
                {renderChip({ chip: roleLabel, tone: 'role' })}
              </View>
            </View>
          </View>

          {userData?.club ? (
            <View style={[
              Alignments.row,
              Alignments.alignCenter,
              {
                borderTopColor: surfaces.divider,
                borderTopWidth: 1,
                gap: 10,
                marginTop: 14,
                paddingTop: 12,
              },
            ]}
            >
              <ClubLogoMark club={userData.club} name={userData.club?.name} size={ICON_TILE} />
              {/* Le nom complet du club, JAMAIS tronque : ni `numberOfLines`,
                  ni ellipse, ni capitales. Il passe a la ligne. */}
              <Text style={{
                color: Colors.neutral00,
                flex: 1,
                fontFamily: 'Montserrat-Bold',
                fontSize: 12.5,
                lineHeight: 17,
              }}
              >
                {userData.club.name}
              </Text>
              {isCurrentClubVerified
                ? renderChip({
                  chip: t('profile.identity.verified', 'Certifié'), tone: 'verified',
                })
                : null}
            </View>
          ) : null}
        </View>

        {renderSection({ label: t('profile.sections.contact', 'Coordonnées'), rows: contactRows })}
        {renderSection({
          label: t('userDetails.sections.sport', 'Profil sportif'), rows: sportRows,
        })}

        {coachedTeams.length ? (
          <View style={{ gap: 10 }}>
            <Text style={sectionLabelStyle}>
              {t('userDetails.teamGroups.coach', 'Équipes entraînées')}
            </Text>
            <View style={sectionCardStyle}>
              {coachedTeams.map((team, index) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={String(team?.documentId || team?.id || team?.name || index)}
                  onPress={() => navigation.navigate(RouteNames.TeamStack, {
                    params: { teamId: team?.documentId || team?.id },
                    screen: RouteNames.TeamDetails,
                  })}
                  style={{
                    alignItems: 'center',
                    borderTopColor: surfaces.divider,
                    borderTopWidth: index > 0 ? 1 : 0,
                    flexDirection: 'row',
                    gap: 12,
                    minHeight: ROW_MIN_HEIGHT,
                    paddingVertical: 8,
                  }}
                >
                  <View style={{
                    alignItems: 'center',
                    backgroundColor: surfaces.teamTile,
                    borderRadius: 9,
                    height: ICON_TILE,
                    justifyContent: 'center',
                    width: ICON_TILE,
                  }}
                  >
                    <Text style={{
                      color: surfaces.teamTileInk, fontFamily: 'Montserrat-Black', fontSize: 10,
                    }}
                    >
                      {getClubInitials(team?.name || '')}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: Colors.neutral00,
                      flex: 1,
                      fontFamily: 'Montserrat-Bold',
                      fontSize: 13.5,
                    }}
                  >
                    {team?.name}
                  </Text>
                  <Image
                    source={Images.arrowRight}
                    style={{ height: 14, tintColor: Colors.neutral400, width: 14 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Text style={sectionLabelStyle}>{t('profile.sections.visibility', 'Visibilité')}</Text>
          <View style={[sectionCardStyle, { paddingBottom: 12 }]}>
            <View style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: 12,
              minHeight: ROW_MIN_HEIGHT,
            }}
            >
              <View style={{
                alignItems: 'center',
                backgroundColor: surfaces.iconTile,
                borderRadius: 9,
                height: ICON_TILE,
                justifyContent: 'center',
                width: ICON_TILE,
              }}
              >
                <Image
                  source={Images.users}
                  style={{ height: 14, tintColor: Colors.primary500, width: 14 }}
                />
              </View>
              <Text style={{
                color: Colors.neutral00,
                flex: 1,
                fontFamily: 'Montserrat-Bold',
                fontSize: 13.5,
              }}
              >
                {t('profile.fields.isLookingForClub.label', 'Profil visible')}
              </Text>
              <Switch
                onValueChange={toggleVisibility}
                trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
                value={Boolean(userData?.isLookingForClub)}
              />
            </View>
            <Text style={{ color: Colors.neutral300, fontSize: 11, lineHeight: 16 }}>
              {t(
                'profile.fields.isLookingForClub.helper',
                'Ton profil apparaît dans la recherche des clubs et des coachs.',
              )}
            </Text>
          </View>
        </View>
      </ScrollView>

      <BottomModal
        // D31 ① — « le clavier passe au-dessus du champ, je ne vois pas ce que
        // j'ecris » (recette du 07/08 au soir). La feuille ne remontait pas, et
        // la cause est un enchainement de DEUX renoncements :
        //   1. `@gorhom/bottom-sheet` refuse deliberement de deplacer la feuille
        //      quand la plateforme est Android ET le mode `adjustResize`
        //      (`BottomSheet.tsx`, l.826-839 pour la position, l.1656-1673 qui
        //      force `heightWithinContainer = 0`). Il fait confiance a Android
        //      pour redimensionner la fenetre a sa place.
        //   2. Or `adjustResize` n'agit plus depuis qu'Android 15 impose le
        //      bord-a-bord (targetSdk 35) — exactement ce que D23 avait mesure
        //      sur les ecrans du tunnel.
        // Personne ne remontait donc la feuille. En demandant `adjustPan`, on
        // rend la main a l'evitement que la bibliotheque sait deja faire.
        // ⚠️ Prop ANDROID uniquement (`android_keyboardInputMode`) : iOS, ou le
        // mode `interactive` fonctionne deja, n'est pas touche.
        androidKeyboardInputMode="adjustPan"
        close={() => setEditedField(null)}
        hideCloseButton
        isVisible={Boolean(editedField)}
        useSafeAreaBottomInset={false}
      >
        {editedField ? (
          <View style={[Spaces.gap[16], Spaces.paddingVertical[16]]}>
            {/*
              D31 ② — le titre de la feuille dit ce qu'on edite. Le champ etant
              SEUL en dessous, lui redonner le meme mot affichait « Ville »,
              « Email », « Sport de preference »... DEUX FOIS de suite.
              Le libelle visible part, jamais le nom accessible : `Input` le
              reprend en `accessibilityLabel`, et la ligne d'adresse annonce son
              placeholder « Rechercher une ville », rendu en clair par
              `AutocompleteSelect` tant qu'aucune ville n'est choisie.
            */}
            <Text style={[Fonts.p1Bold, Fonts.neutral00, { fontSize: 17 }]}>
              {editedField.label}
            </Text>
            {editedField.kind === 'address' ? (
              <AutocompleteAddressInput
                address={draftValue}
                placeholder={t('profile.fields.city.placeholder', 'Rechercher une ville')}
                setAddress={setDraftValue}
              />
            ) : (
              <Input
                accessibilityLabel={editedField.label}
                keyboardType={editedField.keyboardType}
                onChangeText={setDraftValue}
                value={String(draftValue ?? '')}
              />
            )}
            <Button
              isLoading={updateUserMutation.isPending}
              onPress={saveEditedField}
              title={t('common.save', 'Enregistrer')}
              variant="Primary"
            />
            <TouchableOpacity accessibilityRole="button" onPress={() => setEditedField(null)}>
              <Text style={[Fonts.p2Bold, Fonts.neutral200, { textAlign: 'center' }]}>
                {t('common.cancel', 'Annuler')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </BottomModal>
    </ScreenContainer>
  );
}

export default SelfProfileUnified;
