import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, ScrollView, Switch, Text, TouchableOpacity, View,
} from 'react-native';

import {
  getClubRoleKey,
  getProfileClubs,
  getUserRoleKey,
  profileFieldToDisplay,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import usePlaces from '@/domains/places/usePlaces';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
// eslint-disable-next-line max-len
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  buildProfileFormValues,
  defaultValues,
  getAgeFromDisplayedBirthdate,
  profileSchema,
} from '@/views/profile/profileFormContract';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';
import { emitCelebrationBanner } from '@/services/celebrations/celebrationRuntime';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetPersonalStats } from '@/services/matchStats/matchStatsQueries';
import {
  buildProfileSaveConfirmation,
  listChangedProfileFields,
} from '@/services/profile/profileSaveConfirmation';
import { useGetSections } from '@/services/section/sectionQueries';
import { useGetMyHistories } from '@/services/userHistory/userHistoryQueries';

import { getFieldError } from '@/utils/form/formUtils';

import { getPositionsForSport } from '@/constants/positions';

// D39 — « Mon profil » du JOUEUR et de l'ENTRAINEUR (pack design
// `claude design/export/design_handoff_profils_joueur_entraineur/`, captures
// `captures_profil_joueur/01a-01c` et `captures_profil_entraineur/01a-01b`).
//
// D06 avait livre l'ecran unifie AU DIRIGEANT SEULEMENT, et pour une raison
// mesuree : lui appliquer la soustraction du pack lui retirait des cases vides,
// alors qu'a un joueur elle aurait retire ses stats, ses retours du coach et
// ses equipes. Ce lot ELARGIT sans rien retirer : chaque bloc que D06 protegeait
// a ici sa destination (stats en rangee compacte, Retours du coach et Mes
// equipes en rangees de « Suivi »).
//
// ⚠️ Le DIRIGEANT n'entre jamais ici : `UserDetails` continue de le rendre par
// `SelfProfileUnified`, inchange. C'est le second temoin d'arret du lot.
//
// La regle d'or du pack, mot pour mot : « le contenu vient du ROLE du compte —
// aucun bloc joueur atteignable sur un profil coach, et inversement ». Le juge
// n'est PAS reecrit ici : c'est `profileFieldToDisplay`
// (`src/domains/auth/authUseCases.js:563`), deja utilise par `ProfileEdit`.

/**
 * Surfaces translucides de l'ecran, CALCULEES depuis les jetons du theme par
 * `withAlpha` — l'unique moyen legitime de teinter un jeton. Aucun `rgba(...)`
 * litteral, aucun hex neuf : le contrat de theme les compte.
 * @param {any} Colors
 * @returns {Record<string, string>}
 */
const buildSurfaces = (Colors) => ({
  cardBg: withAlpha(Colors.primary800, 0.82),
  cardBorder: withAlpha(Colors.neutral00, 0.12),
  chipRoleBg: withAlpha(Colors.primary500, 0.14),
  chipRoleBorder: withAlpha(Colors.primary500, 0.45),
  chipSearchBg: withAlpha(Colors.neutral00, 0.06),
  chipSearchBorder: withAlpha(Colors.neutral00, 0.16),
  divider: withAlpha(Colors.neutral00, 0.08),
  iconTile: withAlpha(Colors.primary500, 0.12),
  outlineBorder: withAlpha(Colors.primary500, 0.55),
  pillActiveBg: Colors.primary500,
  sectionBg: withAlpha(Colors.neutral00, 0.04),
  sectionBorder: withAlpha(Colors.neutral00, 0.09),
});

// La rampe `Spaces` s'arrete a 0/4/8/12/16/24/32/38/40/44/52/64/74/80/128/160 :
// 30 (tuile d'icone) et 34 (pilule) n'y sont pas. Ils vivent donc en style
// litteral, comme deja fait dans `SelfProfileUnified.js` et `UserDetails.js`.
// ⛔ Les index 6, 10 et 14 n'existent PAS dans la rampe : les demander rend
// `undefined`, et React Native ignore le style EN SILENCE.
// (Ecrit en toutes lettres a dessein : le contrat de theme scanne aussi les
// commentaires, un exemple litteral y compterait comme une vraie violation.)
const ROW_MIN_HEIGHT = 52;
const ICON_TILE = 30;
const AVATAR_SIZE = 64;
const TOUCH_TARGET = 44;

// Meme liste que `ProfileEdit` : la categorie ne se reinvente pas d'un ecran
// a l'autre.
const CATEGORY_OPTIONS = [
  'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17',
  'U18', 'U19', 'U20', 'U21', 'U23', 'Senior',
].map((value) => ({ label: value, value }))
  .concat([{ label: 'Vétéran', value: 'Veteran' }]);

/**
 * Rangee-valeur 52 pt de la section « Suivi » : tuile d'icone, libelle, valeur
 * a droite, chevron.
 * @param {object} props
 * @param {any} props.Colors
 * @param {any} props.Images
 * @param {any} props.icon
 * @param {string} props.label
 * @param {string} props.value
 * @param {(() => void)} props.onPress
 * @param {boolean} [props.divider]
 * @param {Record<string, string>} props.surfaces
 * @returns {import('react').ReactElement}
 */
function FollowUpRow({
  Colors, divider, icon, Images, label, onPress, surfaces, value,
}) {
  return (
    <TouchableOpacity
      accessibilityLabel={`${label} : ${value}`}
      accessibilityRole="button"
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
      <Text style={{
        color: Colors.neutral00, flex: 1, fontFamily: 'Montserrat-Bold', fontSize: 13.5,
      }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: Colors.neutral400,
          fontFamily: 'Montserrat-Bold',
          fontSize: 12,
          maxWidth: 160,
        }}
      >
        {value}
      </Text>
      <Image
        source={Images.arrowRight}
        style={{ height: 14, tintColor: Colors.neutral400, width: 14 }}
      />
    </TouchableOpacity>
  );
}

/**
 * Un reglage de la section « Visibilite » : titre, phrase d'aide, interrupteur.
 * @param {object} props
 * @param {any} props.Colors
 * @param {string} props.helper
 * @param {string} props.label
 * @param {(next: boolean) => void} props.onValueChange
 * @param {Record<string, string>} props.surfaces
 * @param {boolean} props.value
 * @returns {import('react').ReactElement}
 */
function VisibilitySetting({
  Colors, helper, label, onValueChange, surfaces, value,
}) {
  return (
    <View style={{
      alignItems: 'center',
      backgroundColor: surfaces.sectionBg,
      borderColor: surfaces.sectionBorder,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: ROW_MIN_HEIGHT,
      padding: 12,
    }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{
          color: Colors.neutral00, fontFamily: 'Montserrat-Bold', fontSize: 13.5,
        }}
        >
          {label}
        </Text>
        <Text style={{ color: Colors.neutral300, fontSize: 11, lineHeight: 16 }}>
          {helper}
        </Text>
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
        value={value}
      />
    </View>
  );
}

/**
 * « Mon profil » pour un JOUEUR ou un ENTRAINEUR : voir et modifier au meme
 * endroit, une seule page, un seul « Enregistrer ».
 * @param {object} props
 * @param {any} props.navigation
 * @returns {import('react').ReactElement}
 */
function SelfProfilePlayerCoach({ navigation }) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    formatBirthdateToDisplay,
    formatBirthdateToSend,
    getAuthTokens,
    userData,
  } = useAuth();
  const { getGeohashForPointAndRadius } = usePlaces();
  const { data: sections } = useGetSections();
  const { data: levels } = useGetLevels();
  const { data: histories } = useGetMyHistories();
  const userId = userData?.documentId || userData?.id;
  const { data: personalStats } = useGetPersonalStats(userId, { enabled: Boolean(userId) });

  const [avatar, setAvatar] = useState(/** @type {any} */ (undefined));
  // AA11 — CE QUI VIENT DE CHANGER, pose juste avant l'envoi et lu seulement
  // apres un succes. Un `ref` et pas un `state` : ecrire un etat ici
  // relancerait un rendu du formulaire au moment ou on le soumet.
  const pendingChangedFieldsRef = useRef(/** @type {string[]} */ ([]));
  const hydratedUserKeyRef = useRef(null);
  const hydratedSignatureRef = useRef('');

  const surfaces = useMemo(() => buildSurfaces(Colors), [Colors]);
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const isPlayer = roleKey === 'player';
  // Le juge du pack. Il n'y en a qu'un, et il n'est pas ecrit ici.
  const allowedFields = useMemo(
    () => profileFieldToDisplay(userData?.role) || [],
    [userData?.role],
  );

  const {
    control,
    formState: { errors: formErrors, isDirty },
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(profileSchema),
    shouldFocusError: false,
  });

  // Meme hydratation que `ProfileEdit` : une saisie en cours n'est jamais
  // ecrasee par un rafraichissement du profil.
  useEffect(() => {
    const nextUserKey = userData?.documentId || userData?.id;
    if (!nextUserKey) return;

    const switchedUser = hydratedUserKeyRef.current !== nextUserKey;
    if (!switchedUser && isDirty) return;

    const nextValues = buildProfileFormValues(userData, formatBirthdateToDisplay);
    const nextSignature = JSON.stringify(nextValues);
    if (!switchedUser && hydratedSignatureRef.current === nextSignature) return;

    reset(nextValues);
    setAvatar(userData?.avatar?.url ? { url: userData.avatar.url } : undefined);
    hydratedUserKeyRef.current = nextUserKey;
    hydratedSignatureRef.current = nextSignature;
  }, [formatBirthdateToDisplay, isDirty, reset, userData]);

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
      // La reponse du PUT EST le profil a jour : on alimente le cache avec, un
      // GET immediat peut encore etre servi perime par un replica serveur.
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
      // 🎉 AA11 — L'ORDRE COMPTE, exactement comme dans Y04 : on n'est ici que
      // si `updateMe` n'a pas leve, donc le profil est REELLEMENT enregistre.
      // ⛔ Rien de tout ceci n'existe dans `onError` : une felicitation sur un
      // echec fait croire que c'est fait alors que ca ne l'est pas.
      // La banniere s'efface toute seule (`AppFeedbackContext`) : on peut
      // modifier trois champs d'affilee sans jamais fermer une fenetre.
      const confirmation = buildProfileSaveConfirmation(pendingChangedFieldsRef.current, t);
      pendingChangedFieldsRef.current = [];
      if (confirmation) {
        emitCelebrationBanner({
          body: confirmation.body,
          dedupeKey: `profile-save:${confirmation.body}`,
          eyebrow: confirmation.eyebrow,
          title: confirmation.title,
          tone: 'success',
          variant: 'banner',
        });
      }
    },
  });

  const watchedBirthdate = watch('birthdate');
  const watchedSport = watch('preferredSport');
  const watchedLooking = watch('isLookingForClub');
  const age = getAgeFromDisplayedBirthdate(watchedBirthdate);
  const birthdateLabel = age == null
    ? t('profile.fields.birthdate.label')
    : `${t('profile.fields.birthdate.label')} · ${t('userDetails.ageValue', {
      count: age,
      defaultValue: `${age} ans`,
    })}`;

  const fullName = `${userData?.firstname || ''} ${userData?.lastname || ''}`.trim();
  const historyCount = Array.isArray(histories) ? histories.length : 0;
  const coachedTeams = useMemo(
    () => (Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : []),
    [userData?.trainedTeams],
  );
  const playerTeams = useMemo(
    () => (Array.isArray(userData?.myTeams) ? userData.myTeams : []),
    [userData?.myTeams],
  );
  const feedbackCount = Array.isArray(personalStats?.recentCoachFeedback)
    ? personalStats.recentCoachFeedback.length
    : 0;

  const sectionOptions = useMemo(
    () => (sections || []).map((/** @type {any} */ section) => ({
      label: section.name,
      value: section.documentId,
    })),
    [sections],
  );
  const levelOptions = useMemo(
    () => (levels || []).map((/** @type {any} */ level) => ({
      label: level.name,
      value: level.name,
    })),
    [levels],
  );

  // Sous-ligne du pack : « Seniors A · Stade Marseillais UC ». L'equipe implique
  // le club — fini « Aucun club renseigne » contredit par la carte Equipes.
  // AA11 (D-26) — TOUS les clubs, pas seulement le premier. La liste vient de
  // `getProfileClubs` : c'est la meme source que `getMemberClubIds`, mais elle
  // garde les OBJETS, seul moyen de dessiner un ecusson et d'ecrire un nom.
  const profileClubs = useMemo(() => getProfileClubs(userData), [userData]);
  const identitySubtitle = useMemo(() => {
    const teamName = (isPlayer ? playerTeams : coachedTeams)[0]?.name || '';
    const clubName = userData?.club?.name || '';
    return [teamName, clubName].filter(Boolean).join(' · ');
  }, [coachedTeams, isPlayer, playerTeams, userData?.club?.name]);

  const statCards = useMemo(() => {
    const overall = personalStats?.overall || {};
    return [
      { label: t('userDetails.stats.matches', 'Matchs'), value: Number(overall.matches || 0) },
      { label: t('userDetails.stats.wins', 'Victoires'), value: Number(overall.wins || 0) },
      { label: t('userDetails.stats.losses', 'Défaites'), value: Number(overall.losses || 0) },
      {
        label: t('userDetails.stats.minutes', 'Minutes'),
        value: Number(overall.minutesPlayed || 0),
      },
      {
        label: t('userDetails.stats.goals', 'Buts'),
        value: Number(overall.football?.goals || 0),
      },
      {
        label: t('userDetails.stats.assists', 'Passes déc.'),
        value: Number(overall.football?.assists || 0),
      },
    ];
  }, [personalStats?.overall, t]);

  const getSportOptions = () => {
    const defaultSports = [
      { label: 'Football', value: 'football' },
      { label: 'Basketball', value: 'basketball' },
      { label: 'Handball', value: 'handball' },
      { label: 'Volleyball', value: 'volleyball' },
      { label: 'Autre', value: 'other' },
    ];
    const current = userData?.preferredSport;
    if (current && !defaultSports.find((sport) => sport.value === current)) {
      defaultSports.unshift({
        label: current.charAt(0).toUpperCase() + current.slice(1),
        value: current,
      });
    }
    return defaultSports;
  };

  /**
   * Enregistre le profil. Chaque champ n'est envoye que s'il est ATTEIGNABLE
   * pour ce role : un coach ne poste jamais un poste ni une taille, meme si la
   * valeur trainait en base.
   * @param {any} data
   * @returns {void}
   */
  const handleFormSubmit = (data) => {
    if (!userData) return;

    let geohash = null;
    const coords = String(data.address?.value || '').split('|');
    if (coords.length === 2) {
      geohash = getGeohashForPointAndRadius(
        parseFloat(coords[1]),
        parseFloat(coords[0]),
        0.001,
      );
    }

    /** @type {any} */
    const payload = {
      address: data.address,
      avatar,
      birthdate: formatBirthdateToSend(data.birthdate || ''),
      email: data.email,
      firstname: data.firstname,
      geohash,
      isLookingForClub: data.isLookingForClub,
      lastname: data.lastname,
      preferredSport: data.preferredSport,
    };
    if (allowedFields.includes('nationality')) payload.nationality = data.nationality;
    if (allowedFields.includes('category')) payload.category = data.category;
    if (allowedFields.includes('bestLevel')) payload.bestLevel = data.bestLevel;
    if (allowedFields.includes('section')) payload.section = data.section;
    if (allowedFields.includes('position')) payload.position = data.position;
    if (allowedFields.includes('height')) payload.height = data.height;
    if (allowedFields.includes('weight')) payload.weight = data.weight;
    if (allowedFields.includes('jerseyNumber')) {
      payload.jerseyNumber = data.jerseyNumber === ''
        ? null
        : Number.parseInt(data.jerseyNumber, 10);
    }

    // AA11 — on compare la charge qui PART aux memes champs tels qu'ils etaient
    // charges. C'est la seule facon de NOMMER ce qui a change sur un ecran qui
    // reposte tout le formulaire a chaque enregistrement (fige par
    // `ProfileEdit.caracterisation.test.js`, premier temoin).
    pendingChangedFieldsRef.current = listChangedProfileFields(
      { ...buildProfileFormValues(userData, formatBirthdateToDisplay), avatar: userData?.avatar },
      { ...payload, birthdate: data.birthdate },
    );
    updateUserMutation.mutate(payload);
  };

  const labelStyle = {
    color: Colors.neutral300,
    fontFamily: 'Montserrat-Bold',
    fontSize: 11.5,
    letterSpacing: 0.6,
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
   * Un champ texte du pack : libelle au-dessus, valeur prechargee dedans.
   * @param {any} params
   * @returns {import('react').ReactElement}
   */
  const renderTextField = ({
    inputMode, keyboardType, label, maxLength, name, nextField, placeholder, readOnly,
  }) => (
    <Controller
      control={control}
      key={name}
      name={name}
      render={({
        field: {
          onBlur, onChange, ref, value,
        },
      }) => (
        <Input
          editable={!readOnly}
          enterKeyHint={nextField ? 'next' : 'done'}
          error={getFieldError({ errors: formErrors, fieldName: name })}
          inputMode={inputMode}
          keyboardType={keyboardType}
          label={label}
          maxLength={maxLength}
          onBlur={onBlur}
          onChangeText={onChange}
          onSubmitEditing={nextField ? () => setFocus(nextField) : undefined}
          placeholder={placeholder}
          readOnly={readOnly}
          ref={ref}
          value={String(value ?? '')}
        />
      )}
    />
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
      keyboardAvoiding
    >
      {/* Titre seul : la fleche de retour vient de l'entete natif de la stack.
          En dessiner une ici en afficherait DEUX (defaut du lot D2). */}
      <View style={[Alignments.alignCenter, { paddingBottom: 4 }]}>
        <Text style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Black', fontSize: 21 }}>
          {t('profile.titles.unified', 'Mon profil')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {/* ── Carte identite ─────────────────────────────────────────── */}
        <View style={{
          backgroundColor: surfaces.cardBg,
          borderColor: surfaces.cardBorder,
          borderRadius: 18,
          borderWidth: 1,
          gap: 12,
          padding: 16,
        }}
        >
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 14 }]}>
            <SelectAvatar
              currentAvatar={avatar}
              onAvatarSelected={setAvatar}
              onDelete={() => setAvatar(undefined)}
              size={AVATAR_SIZE}
            />
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text style={{
                color: Colors.neutral00, fontFamily: 'Montserrat-Black', fontSize: 15.5,
              }}
              >
                {fullName}
              </Text>
              {/* Nom du club JAMAIS tronque : ni `numberOfLines`, ni ellipse. */}
              {identitySubtitle ? (
                <Text style={{
                  color: Colors.neutral300,
                  fontFamily: 'Montserrat-Regular',
                  fontSize: 12.5,
                  lineHeight: 17,
                }}
                >
                  {identitySubtitle}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            <View style={{
              backgroundColor: surfaces.chipRoleBg,
              borderColor: surfaces.chipRoleBorder,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 4,
            }}
            >
              <Text style={{
                color: Colors.primary200, fontFamily: 'Montserrat-Bold', fontSize: 11,
              }}
              >
                {t(`profile.identity.roles.${roleKey}`, t('profile.identity.roles.new'))}
              </Text>
            </View>
            {watchedLooking ? (
              <View style={{
                backgroundColor: surfaces.chipSearchBg,
                borderColor: surfaces.chipSearchBorder,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 4,
              }}
              >
                <Text style={{
                  color: Colors.neutral200, fontFamily: 'Montserrat-Bold', fontSize: 11,
                }}
                >
                  {t('userDetails.badges.lookingForClub', 'En recherche de club')}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── AA11 (D-26) : MES CLUBS ─────────────────────────────────
              « le joueur dans deux clubs, ca marche. Mais quand je regarde
              dans mon profil, je ne vois que le premier club. »
              ⚠️ A PARTIR DE DEUX, et c'est voulu : avec un seul club la
              sous-ligne d'identite le nomme deja deux lignes plus haut, et
              une liste d'un seul element ne serait que du bruit.
              Le role est celui DE CE CLUB-LA (joueur ici, entraineur la) :
              il se deduit des equipes, le serveur n'en envoie aucun. */}
          {profileClubs.length > 1 ? (
            <View style={{ gap: 8 }}>
              <Text style={labelStyle}>{t('profile.clubs.title', 'Mes clubs')}</Text>
              {profileClubs.map((club) => (
                <View
                  key={String(club?.documentId || club?.id || club?.name)}
                  style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}
                >
                  <ClubLogoMark club={club} name={club?.name} size={28} />
                  {/* Nom du club JAMAIS tronque, meme regle qu'au-dessus. */}
                  <Text style={{
                    color: Colors.neutral00,
                    flex: 1,
                    fontFamily: 'Montserrat-Bold',
                    fontSize: 12.5,
                  }}
                  >
                    {club?.name}
                  </Text>
                  <Text style={{
                    color: Colors.neutral300, fontFamily: 'Montserrat-Bold', fontSize: 11,
                  }}
                  >
                    {t(
                      `profile.identity.roles.${getClubRoleKey(userData, club)}`,
                      t('profile.identity.roles.new'),
                    )}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Voir mon profil comme les autres ───────────────────────── */}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.navigate(RouteNames.UserDetails, {
            preview: true,
            userId,
          })}
          style={{
            alignItems: 'center',
            borderColor: surfaces.outlineBorder,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: TOUCH_TARGET,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{
            color: Colors.primary200, fontFamily: 'Montserrat-Bold', fontSize: 13.5,
          }}
          >
            {t('profile.actions.previewPublic', 'Voir mon profil comme les autres')}
          </Text>
        </TouchableOpacity>

        {/* ── Stats de match — JOUEUR uniquement ─────────────────────── */}
        {isPlayer ? (
          <View
            accessibilityLabel={t('userDetails.sections.matchStats', 'Stats de match')}
            style={[sectionCardStyle, {
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 12,
            }]}
          >
            {statCards.map((stat) => (
              <View key={stat.label} style={{ alignItems: 'center', flex: 1, gap: 4 }}>
                <Text style={{
                  color: Colors.neutral00, fontFamily: 'Montserrat-Black', fontSize: 15,
                }}
                >
                  {String(stat.value)}
                </Text>
                <Text
                  style={{
                    color: Colors.neutral300,
                    fontFamily: 'Montserrat-Regular',
                    fontSize: 10.5,
                    textAlign: 'center',
                  }}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Identite ───────────────────────────────────────────────── */}
        {allowedFields.includes('firstname') ? renderTextField({
          label: t('profile.fields.firstname.label'),
          name: 'firstname',
          nextField: 'lastname',
          placeholder: t('profile.fields.firstname.placeholder'),
        }) : null}
        {allowedFields.includes('lastname') ? renderTextField({
          label: t('profile.fields.lastname.label'),
          name: 'lastname',
          nextField: 'birthdate',
          placeholder: t('profile.fields.lastname.placeholder'),
        }) : null}
        {allowedFields.includes('birthdate') ? (
          <Controller
            control={control}
            name="birthdate"
            render={({
              field: {
                onBlur, onChange, ref, value,
              },
            }) => (
              <Input
                error={getFieldError({ errors: formErrors, fieldName: 'birthdate' })}
                inputMode="numeric"
                keyboardType="number-pad"
                // Le pack fusionne la date et l'age : « 10/04/2000 · 26 ans ».
                // L'age se CALCULE, il ne se saisit pas — il vit donc dans le
                // libelle, jamais dans la valeur du champ.
                label={birthdateLabel}
                maxLength={10}
                onBlur={onBlur}
                onChangeText={(text) => onChange(formatBirthdateToDisplay(text))}
                placeholder="JJ/MM/AAAA"
                ref={ref}
                value={String(value ?? '')}
              />
            )}
          />
        ) : null}

        {/* ── Coordonnees ────────────────────────────────────────────── */}
        {renderTextField({
          label: t('profile.fields.phoneNumber.label'),
          name: 'phoneNumber',
          placeholder: t('profile.fields.phoneNumber.placeholder'),
          readOnly: true,
        })}
        {renderTextField({
          inputMode: 'email',
          keyboardType: 'email-address',
          label: t('profile.fields.email.label', 'Email — optionnel'),
          name: 'email',
          placeholder: t('profile.fields.email.placeholder', 'Ajouter un email'),
        })}
        <Controller
          control={control}
          name="address"
          render={({ field: { onChange, value } }) => (
            <AutocompleteAddressInput
              address={value}
              error={getFieldError({ errors: formErrors, fieldName: 'address' })}
              label={t('profile.fields.city.label', 'Ville')}
              placeholder={t('profile.fields.city.placeholder', 'Rechercher une ville')}
              setAddress={onChange}
            />
          )}
        />

        {/* ── Sport ──────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="preferredSport"
          render={({ field: { onBlur, onChange, value } }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'preferredSport' })}
              label={t('profile.fields.preferredSport.label', 'Sport de préférence')}
              onBlur={onBlur}
              options={getSportOptions()}
              placeholder={t('profile.fields.preferredSport.placeholder', 'Sélectionner un sport')}
              setValue={(/** @type {any} */ option) => {
                onChange(option?.value || '');
                setValue('position', '');
              }}
              value={value}
            />
          )}
        />

        {allowedFields.includes('position') ? (
          <Controller
            control={control}
            name="position"
            render={({
              field: {
                onBlur, onChange, ref, value,
              },
            }) => {
              // Meme source que l'inscription (`UserPosition`) : sans ca, le
              // poste choisi a l'inscription ne se retrouve pas ici.
              const positions = getPositionsForSport(watchedSport);
              if (positions.length > 0) {
                return (
                  <AutocompleteSelect
                    error={getFieldError({ errors: formErrors, fieldName: 'position' })}
                    label={t('profile.fields.position.label')}
                    onBlur={onBlur}
                    options={positions}
                    placeholder={t('profile.fields.position.placeholder')}
                    setValue={(/** @type {any} */ option) => onChange(option?.value || '')}
                    value={value}
                  />
                );
              }
              return (
                <Input
                  error={getFieldError({ errors: formErrors, fieldName: 'position' })}
                  label={t('profile.fields.position.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('profile.fields.position.placeholder')}
                  ref={ref}
                  value={String(value ?? '')}
                />
              );
            }}
          />
        ) : null}

        {/* Section EN PILULES (pack 01b) : un seul libelle partout. */}
        {allowedFields.includes('section') && sectionOptions.length ? (
          <Controller
            control={control}
            name="section"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 8 }}>
                <Text style={labelStyle}>{t('profile.fields.section.label')}</Text>
                <View style={[sectionCardStyle, {
                  flexDirection: 'row',
                  gap: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 6,
                }]}
                >
                  {sectionOptions.map((option) => {
                    const isActive = option.value === value;
                    return (
                      <TouchableOpacity
                        accessibilityLabel={option.label}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isActive }}
                        key={option.value}
                        onPress={() => onChange(isActive ? '' : option.value)}
                        style={{
                          alignItems: 'center',
                          backgroundColor: isActive ? surfaces.pillActiveBg : 'transparent',
                          borderRadius: 999,
                          flex: 1,
                          justifyContent: 'center',
                          minHeight: TOUCH_TARGET,
                        }}
                      >
                        <Text style={{
                          color: isActive ? Colors.primary900 : Colors.neutral200,
                          fontFamily: 'Montserrat-Bold',
                          fontSize: 12.5,
                        }}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          />
        ) : null}

        {allowedFields.includes('category') ? (
          <Controller
            control={control}
            name="category"
            render={({ field: { onBlur, onChange, value } }) => (
              <AutocompleteSelect
                error={getFieldError({ errors: formErrors, fieldName: 'category' })}
                isMulti
                label={t('profile.fields.category.label', 'Catégorie')}
                onBlur={onBlur}
                options={CATEGORY_OPTIONS}
                placeholder={t('profile.fields.category.placeholder', 'Sélectionner une catégorie')}
                setValue={(/** @type {any[]} */ options) => {
                  onChange(options?.map((option) => option.value).join(', ') || '');
                }}
                value={value ? value.split(', ') : []}
              />
            )}
          />
        ) : null}

        {allowedFields.includes('bestLevel') ? (
          <Controller
            control={control}
            name="bestLevel"
            render={({ field: { onBlur, onChange, value } }) => (
              <AutocompleteSelect
                error={getFieldError({ errors: formErrors, fieldName: 'bestLevel' })}
                label={t('profile.fields.bestLevel.label', 'Meilleur niveau')}
                onBlur={onBlur}
                options={levelOptions}
                placeholder={t('profile.fields.bestLevel.placeholder', 'Sélectionner un niveau')}
                setValue={(/** @type {any} */ option) => onChange(option?.value || '')}
                value={value}
              />
            )}
          />
        ) : null}

        {allowedFields.includes('jerseyNumber') ? renderTextField({
          inputMode: 'numeric',
          keyboardType: 'number-pad',
          label: t('profile.fields.jerseyNumber.label', 'Numéro de maillot'),
          maxLength: 2,
          name: 'jerseyNumber',
          placeholder: t('profile.fields.jerseyNumber.placeholder', 'Ex. 10 (vide = automatique)'),
        }) : null}

        {allowedFields.includes('nationality') ? renderTextField({
          label: t('profile.fields.nationality.label', 'Nationalité'),
          name: 'nationality',
          placeholder: t('profile.fields.nationality.placeholder', 'Ex. Française, FRA…'),
        }) : null}

        {/* ── Corps : Taille et Poids COTE A COTE (pack 01c) ─────────── */}
        {allowedFields.includes('height') && allowedFields.includes('weight') ? (
          <View style={[Alignments.row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              {renderTextField({
                inputMode: 'decimal',
                keyboardType: 'number-pad',
                label: t('profile.fields.height.label'),
                name: 'height',
                nextField: 'weight',
                placeholder: t('profile.fields.height.placeholder'),
              })}
            </View>
            <View style={{ flex: 1 }}>
              {renderTextField({
                inputMode: 'decimal',
                keyboardType: 'number-pad',
                label: t('profile.fields.weight.label'),
                name: 'weight',
                placeholder: t('profile.fields.weight.placeholder'),
              })}
            </View>
          </View>
        ) : null}

        {/* ── Visibilite ─────────────────────────────────────────────── */}
        <View style={{ gap: 10 }}>
          <Text style={labelStyle}>{t('profile.sections.visibility', 'Visibilité')}</Text>
          {/* 🔴 Le pack dessine DEUX reglages independants. Le serveur n'en
              connait qu'UN : `isLookingForClub` pilote a la fois le filtre de
              recherche (`services/user/userService.js:114`) et le badge public
              (`UserDetails.js:777`). En afficher deux ici serait un mensonge :
              couper l'un couperait l'autre. Un seul, honnete, en attendant le
              champ serveur — signale au chef d'orchestre. */}
          <Controller
            control={control}
            name="isLookingForClub"
            render={({ field: { onChange, value } }) => (
              <VisibilitySetting
                Colors={Colors}
                helper={t(
                  'profile.fields.isLookingForClub.helper',
                  'Ton profil ressort dans les recherches des clubs et des coachs, '
                  + 'avec le badge « En recherche de club ».',
                )}
                label={t('profile.fields.isLookingForClub.label', 'Profil visible')}
                onValueChange={onChange}
                surfaces={surfaces}
                value={Boolean(value)}
              />
            )}
          />
        </View>

        {/* ── Suivi ──────────────────────────────────────────────────── */}
        <View style={{ gap: 10 }}>
          <Text style={labelStyle}>{t('profile.sections.followUp', 'Suivi')}</Text>
          <View style={sectionCardStyle}>
            <FollowUpRow
              Colors={Colors}
              icon={Images.calendar}
              Images={Images}
              label={t('userDetails.fields.history', 'Historique sportif')}
              onPress={() => navigation.navigate(RouteNames.HistoryWizardCategory, {
                resetContext: true,
                returnRoute: RouteNames.UserDetails,
              })}
              surfaces={surfaces}
              value={t('userDetails.historySummary.count', { count: historyCount })}
            />
            {/* Les retours du coach sont une donnee de JOUEUR. Le pack les
                retire du profil coach — ils restent ici, entiers. */}
            {isPlayer ? (
              <FollowUpRow
                Colors={Colors}
                divider
                icon={Images.users}
                Images={Images}
                label={t('userDetails.sections.coachFeedback', 'Retours du coach')}
                onPress={() => navigation.navigate(RouteNames.UserDetails, {
                  preview: true,
                  userId,
                })}
                surfaces={surfaces}
                value={feedbackCount
                  ? String(feedbackCount)
                  : t('userDetails.empty.coachFeedback', 'Aucun')}
              />
            ) : null}
            <FollowUpRow
              Colors={Colors}
              divider
              icon={Images.shield}
              Images={Images}
              label={isPlayer
                ? t('profile.actions.myTeams', 'Mes équipes')
                : t('userDetails.teamGroups.coach', 'Équipes entraînées')}
              onPress={() => navigation.navigate(RouteNames.TeamStack, {
                screen: RouteNames.MyTeamList,
              })}
              surfaces={surfaces}
              value={String((isPlayer ? playerTeams : coachedTeams).length)}
            />
          </View>
        </View>
      </ScrollView>

      {/* ── CTA colle : il ne recouvre jamais un champ (le ScrollView porte
          son propre `paddingBottom`). ──────────────────────────────── */}
      <View style={{ gap: 8, paddingTop: 8 }}>
        <Button
          isLoading={updateUserMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('common.save', 'Enregistrer')}
          variant="Primary"
        />
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={{ alignItems: 'center', justifyContent: 'center', minHeight: TOUCH_TARGET }}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral200]}>
            {t('common.cancel', 'Annuler')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

export default SelfProfilePlayerCoach;
