import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import i18next from 'i18next';
import {
  useCallback, useLayoutEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  RefreshControl,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { formatOpeningHours } from '@/domains/collectivite/collectiviteDisplay';
import {
  clubSlotParts,
  groupClubInstallations,
  ouvrirDemandeALaVille,
} from '@/domains/seasonSlot/clubInstallations';
import {
  capitalize,
  formatDay,
  momentLabel,
  timeRange,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import {
  extractSubscriptionDecisionFromError,
  formatCollectiviteOfferedBy,
} from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import SubscriptionPaywallSheet
  from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import SeasonSlotForm from '@/components/organisms/seasonSlot/SeasonSlotForm';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { navigateToStackScreenOrScreen } from '@/navigation/navigationAvailability';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useCollectiviteInstallations } from '@/services/collectivite/collectiviteQueries';
import { useClubFacilityContext } from '@/services/facility/facilityQueries';
import {
  decideClubSession,
  deleteFacility,
  getFacilitySections,
} from '@/services/facility/facilityService';
import { useInstallationsWeekSummary } from '@/services/seasonSlot/seasonSlotQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { FACILITY_CONFLICT_MODES, getFacilityConflictMode } from '@/utils/facilityConflictMode';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import { getFacilityTypeLabel } from '@/utils/facilityTypes';

import { useIsDesktop } from '@/responsive';

const getAddressLabel = (address, fallback = i18next.t(
  'facilityList.noAddress',
  'Adresse non renseignée',
)) => {
  if (!address) return fallback;
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    return address?.description || address?.label || fallback;
  }
  return fallback;
};

const getAddressCoordinates = (address) => {
  if (!address || typeof address !== 'object') return null;
  const coordinates = address?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
};

// D34 ecran 03 : la couleur du planning devient un LISERE, plus un habillage.
// 4 pt est la valeur du pack, nommee ici pour qu'on sache pourquoi elle existe.
const FACILITY_ACCENT_WIDTH = 4;

const getFacilityKey = (item, index) => (item.documentId || item.id?.toString() || `${item?.name || 'facility'}-${index}`);

// COLL-C2B (02/10) — design P4 : sur ordinateur, les cartes de la Ville vont en grille de 3, et
// l ajout est la DERNIERE case de la grille (D34 : une seule grammaire d ajout, en pointille).
const CASE_AJOUT = { documentId: '__ajout__', isAddCard: true };
// COLL-C2C (02/10) — design P8v2 : un groupe « Au club » vide garde sa ligne et « Ajouter ».
const GROUPE_VIDE = { documentId: '__groupe_vide__', isEmptyGroup: true };
const COLONNES_ORDINATEUR = 3;
const SQUELETTES = ['a', 'b'];

/**
 * Facility list screen.
 * @returns {import('react').ReactElement}
 */
function FacilityList() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { userData } = useAuth();
  const { sceneBottomInset } = useBottomDockLayout();

  // 🏛️ COLLECTIVITES 1c — MODE COLLECTIVITE (route CollectiviteInstallations) : la liste est
  // celle des installations de LA collectivite (GET /collectivites/:id/installations, juge :
  // is-gestionnaire-collectivite), jamais celles du club du compte. Sans `collectiviteId`,
  // l ecran est celui d avant, a l identique.
  const routeParams = /** @type {any} */ (route.params) || {};
  const collectiviteId = routeParams.collectiviteId || null;
  const isCollectiviteMode = Boolean(collectiviteId);
  const contextClubId = isCollectiviteMode
    ? null
    : routeParams.clubId || userData?.club?.documentId || userData?.club?.id;
  const contextCmId = isCollectiviteMode ? null : routeParams.cmId
    || (!routeParams.clubId ? userData?.club?.parentMultisport?.documentId || null : null);
  const collectiviteInstallations = useCollectiviteInstallations(collectiviteId);
  const clubFacilities = useClubFacilityContext({
    clubId: contextClubId,
    cmId: contextCmId,
  }, {
    // COLL-C2C (02/10) — et les creneaux du club, pour les 3 groupes (design P8v2).
    includeClubSlots: Boolean(contextClubId),
    // COLL1B (29/09) — l onglet Installations montre aussi celles de la collectivite du
    // club (SPEC §3), en lecture seule. Le serveur en juge (is-member-of-club).
    includeCollectivite: Boolean(contextClubId),
  });
  const {
    data: facilityContext,
    error,
    isLoading: loading,
    isRefetching: refreshing,
    refetch: refetchFacilities,
  } = /** @type {any} */ (isCollectiviteMode ? collectiviteInstallations : clubFacilities);
  const facilities = useMemo(() => {
    if (!isCollectiviteMode) return facilityContext?.allFacilities || [];
    // Les installations de la collectivite, modifiables par SON gestionnaire.
    const rows = Array.isArray(facilityContext) ? facilityContext : [];
    return rows.map((/** @type {any} */ row) => ({
      ...row,
      isReadOnly: false,
      isShared: false,
      ownerType: 'collectivite-gestionnaire',
    }));
  }, [facilityContext, isCollectiviteMode]);
  const resolvedCmId = facilityContext?.cmId || contextCmId || null;
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  const isDesktop = useIsDesktop();

  // COLL-C2B (02/10) — design P4 (« un seul titre », REPRIS e8 n°5) : en mairie, la PAGE porte
  // « Installations de la Ville » ; l en-tete de navigation se tait (le bouton retour reste).
  useLayoutEffect(() => {
    if (!isCollectiviteMode) return;
    /** @type {any} */ (navigation).setOptions?.({ headerTitle: '' });
  }, [isCollectiviteMode, navigation]);
  // « Cette semaine : 9 seances · complet jeu. 18:00 – 19:30 » : la semaine de chaque
  // installation de la Ville, lue dans son planning. Cote club, rien n est lu.
  const semaines = useInstallationsWeekSummary(isCollectiviteMode ? facilities : []);
  // Le menu « Plus d actions » d une carte de la Ville : l installation ouverte, ou null.
  const [menuInstallation, setMenuInstallation] = useState(/** @type {any} */ (null));

  useFocusEffect(
    useCallback(() => {
      refetchFacilities();
    }, [refetchFacilities]),
  );

  const onRefresh = useCallback(() => {
    refetchFacilities();
  }, [refetchFacilities]);

  const handleDelete = useCallback((id, name) => {
    if (!id) return;

    Alert.alert(
      t('facilityList.alerts.delete.title', 'Supprimer l\'installation'),
      t(
        'facilityList.alerts.delete.description',
        `Veux-tu supprimer "${name || 'cette installation'}" ? Cette action est irréversible.`,
      ),
      [
        {
          style: 'cancel',
          text: t('common.cancel', 'Annuler'),
        },
        {
          onPress: async () => {
            try {
              await deleteFacility(id);
              refetchFacilities();
            } catch (deleteError) {
              const subscriptionDecision = extractSubscriptionDecisionFromError(deleteError);
              if (subscriptionDecision) {
                setSubscriptionPaywallDecision(subscriptionDecision);
                return;
              }

              Alert.alert(
                t('common.error', 'Erreur'),
                deleteError?.message || t(
                  'facilityList.alerts.delete.error',
                  "Impossible de supprimer l'installation pour le moment.",
                ),
              );
            }
          },
          style: 'destructive',
          text: t('common.delete', 'Supprimer'),
        },
      ],
    );
  }, [refetchFacilities, t]);

  // COLL-C2C (02/10) — D32 : la seance posee au-dela de la place des creneaux du club attend le
  // DIRIGEANT. Lui seul la voit ici (`canManageClubSlots`, juge par le serveur), et decide ; le
  // serveur previent l entraineur. Refuser l annule : on le confirme d abord.
  const [decisionEnCours, setDecisionEnCours] = useState(/** @type {string | null} */ (null));
  // COLL-C2C (02/10) — D32 : le dirigeant repartit ses creneaux de la Ville entre ses equipes,
  // avec le panneau de C2B (mode `repartition` : seule l equipe change).
  const [creneauARepartir, setCreneauARepartir] = useState(/** @type {any} */ (null));
  const peutRepartir = !isCollectiviteMode && Boolean(facilityContext?.canManageClubSlots);
  const seancesEnAttente = !isCollectiviteMode
    && facilityContext?.canManageClubSlots
    && Array.isArray(facilityContext?.pendingClubSessions)
    ? facilityContext.pendingClubSessions
    : [];
  const deciderSeance = useCallback(async (
    /** @type {any} */ seance,
    /** @type {'approve' | 'refuse'} */ decision,
  ) => {
    setDecisionEnCours(seance?.documentId || null);
    try {
      await decideClubSession(seance?.documentId, decision);
      refetchFacilities();
    } catch (decisionError) {
      Alert.alert(t('common.error', 'Erreur'), getErrorMessage(decisionError));
    } finally {
      setDecisionEnCours(null);
    }
  }, [refetchFacilities, t]);
  const refuserSeance = (/** @type {any} */ seance) => Alert.alert(
    t('clubInstallations.attente.refuserTitre', 'Refuser la séance ?'),
    t('clubInstallations.attente.refuserTexte', 'Elle est annulée, et son entraîneur est prévenu.'),
    [
      { style: 'cancel', text: t('common.cancel', 'Annuler') },
      {
        onPress: () => deciderSeance(seance, 'refuse'),
        style: 'destructive',
        text: t('clubInstallations.attente.refuser', 'Refuser'),
      },
    ],
  );

  const handleEdit = useCallback((facility) => {
    if (isCollectiviteMode) {
      /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteInstallationForm, {
        collectiviteId,
        facility,
        facilityId: facility?.documentId,
      });
      return;
    }
    navigation.navigate(RouteNames.FacilityForm, {
      clubId: contextClubId,
      cmId: resolvedCmId,
      facility,
    });
  }, [collectiviteId, contextClubId, isCollectiviteMode, navigation, resolvedCmId]);

  const handleCreate = useCallback(() => {
    if (isCollectiviteMode) {
      /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteInstallationForm, {
        collectiviteId,
      });
      return;
    }
    navigation.navigate(RouteNames.FacilityForm, {
      clubId: contextClubId,
      cmId: resolvedCmId,
    });
  }, [collectiviteId, contextClubId, isCollectiviteMode, navigation, resolvedCmId]);

  // D34 ecran 03 : « Voir le planning » n'ouvre PAS un ecran neuf — le planning
  // du club est un onglet de `ClubDetails` (hors lot). On y revient donc en
  // passant l'installation a selectionner en parametre de route, plutot que
  // d'ajouter une route pour un ecran qui existe deja ailleurs.
  const handleOpenPlanning = useCallback((facility) => {
    const facilityId = facility?.documentId || facility?.id;
    if (!facilityId) return;

    // COLL1B : l installation de la collectivite a SON planning (tous les clubs qui
    // l utilisent, « club · equipe ») ; le planning du club ne montre que le sien.
    if (facility?.ownerType === 'collectivite' || isCollectiviteMode) {
      navigation.navigate(RouteNames.PlanningWeekFullscreen, {
        contextDetailLabel: facility?.name || null,
        facilityId,
        sourceType: 'facility',
      });
      return;
    }

    // NAVMORTE : l ecran est aussi monte a la RACINE, ou Club n existe pas.
    navigateToStackScreenOrScreen(navigation, {
      params: {
        clubId: contextClubId,
        planningFacilityId: facilityId,
        planningScope: facility?.isShared ? 'shared' : 'club',
      },
      screen: RouteNames.Club,
      stack: RouteNames.ClubStack,
    });
  }, [contextClubId, isCollectiviteMode, navigation]);

  // COLL-C2B (02/10) — design P4v2-creneaux : toute la carte d une installation de la Ville
  // ouvre l installation, sur son onglet « Creneaux » ; son planning est dans le menu « Plus
  // d actions » et dans l onglet « Planning ».
  const ouvrirInstallation = useCallback((/** @type {any} */ facility) => {
    if (!facility?.documentId) return;
    /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteInstallation, {
      collectiviteId,
      facilityId: facility.documentId,
    });
  }, [collectiviteId, navigation]);

  const handleOpenFacilityMap = useCallback((facility) => {
    const addressLabel = getAddressLabel(facility?.address, '').trim() || facility?.name || '';
    if (!addressLabel) return;

    const coordinates = getAddressCoordinates(facility?.address);
    const encodedAddress = encodeURIComponent(addressLabel);
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    const nativeUrl = coordinates
      ? Platform.select({
        android: `geo:${coordinates.lat},${coordinates.lng}?q=${coordinates.lat},${coordinates.lng}(${encodedAddress})`,
        default: fallbackUrl,
        ios: `maps:${coordinates.lat},${coordinates.lng}?q=${encodedAddress}`,
      })
      : Platform.select({
        android: `geo:0,0?q=${encodedAddress}`,
        default: fallbackUrl,
        ios: `maps:0,0?q=${encodedAddress}`,
      });

    if (!nativeUrl) {
      Linking.openURL(fallbackUrl).catch(() => {});
      return;
    }

    Linking.canOpenURL(nativeUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(nativeUrl);
        }
        return Linking.openURL(fallbackUrl);
      })
      .catch(() => {
        Linking.openURL(fallbackUrl).catch(() => {});
      });
  }, []);

  // COLL-C2C (02/10) — design P8v2 (D32) : cote club, des qu il y a une installation de la Ville,
  // 3 groupes dans l ordre ou le dirigeant s en sert : au club ; tes creneaux de la Ville ; a
  // demander. « Pretees par la Ville » disparait. Sans installation de la Ville : l ecran d avant.
  const groupes = useMemo(
    () => groupClubInstallations(isCollectiviteMode ? [] : facilities),
    [facilities, isCollectiviteMode],
  );
  const enGroupes = !isCollectiviteMode && groupes.hasVille;
  const villeNommee = capitalize(formatCollectiviteOfferedBy(groupes.collectiviteName));
  const sections = useMemo(() => {
    if (isCollectiviteMode) return facilities.length ? [{ data: facilities, title: '' }] : [];
    if (enGroupes) {
      return [
        {
          data: groupes.auClub.length ? groupes.auClub : [GROUPE_VIDE],
          key: 'auClub',
          kind: 'auClub',
          title: '',
        },
        ...(groupes.avecCreneaux.length
          ? [{
            data: groupes.avecCreneaux, key: 'avecCreneaux', kind: 'avecCreneaux', title: '',
          }]
          : []),
        ...(groupes.aDemander.length
          ? [{
            data: groupes.aDemander, key: 'aDemander', kind: 'aDemander', title: '',
          }]
          : []),
      ];
    }
    return getFacilitySections(facilityContext?.allFacilities || [], {
      clubTitle: t('facilityList.sections.club', 'Installations du club'),
      sharedTitle: t('facilityList.sections.shared', 'Installations partagées'),
    });
  }, [enGroupes, facilities, facilityContext, groupes, isCollectiviteMode, t]);
  const hasMultipleSections = sections.length > 1;
  const isMissingContext = !isCollectiviteMode && !contextClubId && !contextCmId;

  const renderMetaChip = useCallback((label, tone = 'primary') => {
    const chipStyleByTone = {
      neutral: {
        backgroundColor: Colors.neutral800,
        borderColor: Colors.neutral500,
        textColor: Colors.neutral200,
      },
      primary: {
        backgroundColor: `${Colors.primary500}1F`,
        borderColor: Colors.primary500,
        textColor: Colors.primary500,
      },
      warning: {
        backgroundColor: `${Colors.warning500}1F`,
        borderColor: Colors.warning500,
        textColor: Colors.warning500,
      },
    };

    const chipStyle = chipStyleByTone[tone] || chipStyleByTone.primary;

    return (
      <View
        style={[
          ApplicationStyle.borderRadius12,
          Spaces.paddingHorizontal[8],
          Spaces.paddingVertical[4],
          {
            backgroundColor: chipStyle.backgroundColor,
            borderColor: chipStyle.borderColor,
            borderWidth: 1,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            Fonts.p3Bold,
            { color: chipStyle.textColor },
          ]}
        >
          {label}
        </Text>
      </View>
    );
  }, [
    ApplicationStyle.borderRadius12,
    Colors,
    Fonts.p3Bold,
    Spaces.paddingHorizontal,
    Spaces.paddingVertical,
  ]);

  const renderItem = useCallback(({ item }) => {
    const teams = Number(item?.maxSlots || 1);
    const capacityLabel = `${teams} ${teams > 1
      ? t('facilityList.capacity.teamPlural', 'équipes simultanées')
      : t('facilityList.capacity.teamSingular', 'équipe simultanée')}`;
    const addressLabel = getAddressLabel(
      item?.address,
      t('facilityList.defaults.addressMissing', 'Adresse non renseignée'),
    );
    const hasAddress = Boolean(getAddressLabel(item?.address, '').trim());
    const planningColor = resolveFacilityPlanningColor(item);
    const isEditable = !item?.isReadOnly;
    // D34 ecran 03 : le type, la capacite et l'adresse tenaient sur trois
    // lignes (deux chips + une ligne d'adresse). Ils tiennent desormais sur une
    // seule meta, comme « Terrain · 1 equipe simultanee · 21 rue Fortia ».
    // D51 : le type est requis a la creation, mais des installations plus
    // anciennes n'en portent pas. Le segment disparait alors, au lieu
    // d'afficher un repli qui sonne comme une panne pour un simple champ vide.
    // COLL1C : en mode collectivite, les horaires d ouverture entrent dans la ligne.
    // COLL1D : cote club aussi (restes du lot 1b : recus, jamais affiches) ; une
    // installation sans horaires n en montre pas. Le type se lit par son libelle.
    const metaLabel = [
      getFacilityTypeLabel(item?.type),
      capacityLabel,
      formatOpeningHours(item?.openingTime, item?.closingTime),
      hasAddress ? addressLabel : null,
    ].filter(Boolean).join(' · ');
    const sharedOwnerLabel = item?.ownerName || t('facilityList.badges.multisport', 'Multisport');
    const isCollectiviteFacility = item?.ownerType === 'collectivite';
    const conflictMode = getFacilityConflictMode(item);
    const accessibilityEditLabel = t(
      'facilityList.accessibility.editCard',
      `Modifier l'installation ${item?.name || ''}`.trim(),
    );

    return (
      <View
        style={[
          ApplicationStyle.borderRadius24,
          Spaces.padding[16],
          Spaces.gap[12],
          {
            backgroundColor: withAlpha(Colors.primary800, 0.6),
            borderColor: withAlpha(Colors.neutral00, 0.13),
            borderLeftColor: planningColor,
            borderLeftWidth: FACILITY_ACCENT_WIDTH,
            borderWidth: 1,
            marginBottom: 12,
            overflow: 'hidden',
            position: 'relative',
          },
        ]}
      >
        <TouchableOpacity
          accessibilityLabel={isEditable ? accessibilityEditLabel : undefined}
          accessibilityRole={isEditable ? 'button' : undefined}
          activeOpacity={isEditable ? 0.9 : 1}
          disabled={!isEditable}
          onPress={isEditable ? () => handleEdit(item) : undefined}
          style={[Spaces.gap[12]]}
        >
          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[12],
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              {/* MARQUEE — le nom de l installation se lit en entier */}
              <MarqueeText
                style={[Fonts.p1Black, Fonts.neutral00]}
                text={item?.name || t('facilityList.defaults.facilityName', 'Installation')}
              />
              <Text
                numberOfLines={2}
                style={[Fonts.p3, Fonts.neutral400, Spaces.marginTop[4]]}
              >
                {metaLabel}
              </Text>
            </View>
            {/* La couleur du planning se lit en pastille ETIQUETEE, pas en */}
            {/* habillage de la carte : rouge = erreur, jamais decoration. */}
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <View
                style={{
                  backgroundColor: planningColor || Colors.primary500,
                  borderColor: withAlpha(Colors.neutral00, 0.4),
                  borderRadius: 999,
                  borderWidth: 1,
                  height: 12,
                  width: 12,
                }}
              />
              <Text style={[Fonts.p3Bold, Fonts.neutral400]}>
                {t('facilityList.labels.planning', 'Planning')}
              </Text>
            </View>
          </View>

          <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, Spaces.gap[8]]}>
            {renderMetaChip(
              conflictMode === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY
                ? t('facilityList.badges.overflowAllowed', 'Conflits : autoriser et notifier')
                : t('facilityList.badges.overflowBlocked', 'Conflits : demande à valider'),
              'neutral',
            )}
            {item?.isReadOnly ? renderMetaChip(t('facilityList.badges.shared', 'Partagée'), 'neutral') : null}
            {item?.isReadOnly ? renderMetaChip(
              isCollectiviteFacility
                ? sharedOwnerLabel
                : t('facilityList.badges.multisport', 'Multisport'),
              'warning',
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <View style={{ flex: 1 }}>
            <Button
              onPress={() => handleOpenPlanning(item)}
              title={t('facilityList.actions.openPlanning', 'Voir le planning')}
              variant="Primary"
            />
          </View>
          {isEditable ? (
            <Button
              onPress={() => handleEdit(item)}
              title={t('common.actions.edit', 'Modifier')}
              variant="Secondary"
            />
          ) : null}
          {/* COLL-C2C (02/10) — planche P8-installations-tel : le « Supprimer » rouge ne se voit
              plus sur la carte ; il est range dans « Plus d actions » (le menu de C2B). */}
          {isEditable && !isCollectiviteMode ? (
            <TouchableOpacity
              accessibilityLabel={t(
                'collectiviteCreneaux.liste.plusActions',
                'Plus d’actions pour {{nom}}',
                { nom: item?.name || '', ...SANS_ECHAPPEMENT },
              )}
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => setMenuInstallation(item)}
              style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
            >
              <SvgIcon color={Colors.primary200} height={20} name="dots-horizontal" width={20} />
            </TouchableOpacity>
          ) : null}
        </View>

        {hasAddress ? (
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
            <Image
              source={Images.pin}
              style={[
                ApplicationStyle.icon16,
                ApplicationStyle.tintColor.primary200,
              ]}
            />
            <Button
              onPress={() => handleOpenFacilityMap(item)}
              size="small"
              style={{ alignSelf: 'flex-start' }}
              title={t('common.actions.openInGps', 'Ouvrir dans le GPS')}
              variant="Secondary"
            />
          </View>
        ) : null}

        {item?.isReadOnly ? (
          <View style={[Spaces.gap[4]]}>
            {isCollectiviteFacility ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {/* TEXTES-COLLECTIVITES : « de Ville de Montrivage » manquait son article. */}
                {t(
                  'facilityList.collectiviteOwnerHint',
                  'Installation gérée par {{ownerName}} : planning en lecture seule.',
                  {
                    ownerName: formatCollectiviteOfferedBy(sharedOwnerLabel),
                    ...SANS_ECHAPPEMENT,
                  },
                )}
              </Text>
            ) : (
              <>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t(
                    'facilityList.sharedOwnerHint',
                    'Installation partagée du multisport {{ownerName}}. Lecture seule côté club.',
                    { ownerName: sharedOwnerLabel, ...SANS_ECHAPPEMENT },
                  )}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t(
                    'facilityList.readOnlyHint',
                    'Installation partagée, modification depuis le multisport uniquement.',
                  )}
                </Text>
              </>
            )}
          </View>
        ) : null}
      </View>
    );
  }, [
    Alignments.alignCenter,
    Alignments.justifyCenter,
    Alignments.row,
    Alignments.wrap,
    ApplicationStyle.borderRadius24,
    ApplicationStyle.icon16,
    ApplicationStyle.tintColor.primary200,
    Colors.neutral00,
    Colors.primary200,
    Colors.primary500,
    Colors.primary800,
    Fonts.neutral00,
    Fonts.neutral300,
    Fonts.neutral400,
    Fonts.p1Black,
    Fonts.p3,
    Fonts.p3Bold,
    Images.pin,
    Spaces.gap,
    Spaces.marginTop,
    Spaces.padding,
    handleEdit,
    handleOpenFacilityMap,
    handleOpenPlanning,
    isCollectiviteMode,
    renderMetaChip,
    t,
  ]);
  // COLL-C2B (02/10) — design P4-liste et P4-ordi : la carte d une installation de la VILLE.
  // REPRIS e8 : toute la carte ouvre le planning (n°1) ; le nom sur 2 lignes, sans defilement
  // (n°3) ; plus de pastille « demande a valider », le reglage par defaut (n°4) ; « Modifier »
  // et « GPS » dans le menu « Plus d actions » (3 boutons par carte debordaient, capture C1).
  // AMELIORE e8 n°2 : « Cette semaine », lu dans le planning. La carte du CLUB est `renderItem`,
  // inchangee.
  const renderCollectiviteItem = useCallback((/** @type {{ item: any }} */ { item }) => {
    if (item?.isAddCard) {
      return (
        <View style={isDesktop ? { flex: 1 / COLONNES_ORDINATEUR, padding: 6 } : null}>
          <TouchableOpacity
            accessibilityLabel={t('facilityList.empty.action', 'Ajouter une installation')}
            accessibilityRole="button"
            onPress={handleCreate}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: withAlpha(Colors.primary500, 0.06),
                borderColor: withAlpha(Colors.primary500, 0.4),
                borderRadius: isDesktop ? 24 : 16,
                borderStyle: 'dashed',
                borderWidth: 1.5,
                minHeight: isDesktop ? 140 : 52,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary200]}>
              {`+ ${t('facilityList.empty.action', 'Ajouter une installation')}`}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const nom = item?.name || t('facilityList.defaults.facilityName', 'Installation');
    const equipes = Math.max(1, Number(item?.maxSlots || 1));
    const meta = [
      getFacilityTypeLabel(item?.type),
      t('collectiviteCreneaux.liste.capacite', {
        count: equipes,
        defaultValue_one: '{{count}} équipe à la fois',
        defaultValue_other: '{{count}} équipes à la fois',
      }),
      formatOpeningHours(item?.openingTime, item?.closingTime),
    ].filter(Boolean).join(' · ');
    const adresse = getAddressLabel(item?.address, '').trim();
    const semaine = semaines[item?.documentId];
    let ligneSemaine = null;
    if (semaine && !semaine.count) {
      ligneSemaine = t('collectiviteCreneaux.liste.semaineAucune', 'Cette semaine : aucune séance');
    } else if (semaine) {
      const seances = t('collectiviteCreneaux.liste.semaine', {
        count: semaine.count,
        defaultValue_one: 'Cette semaine : {{count}} séance',
        defaultValue_other: 'Cette semaine : {{count}} séances',
      });
      ligneSemaine = semaine.full
        ? [seances, t('collectiviteCreneaux.liste.complet', 'complet {{moment}}', {
          moment: momentLabel(semaine.full),
          ...SANS_ECHAPPEMENT,
        })].join(' · ')
        : seances;
    }

    return (
      <View style={isDesktop ? { flex: 1 / COLONNES_ORDINATEUR, padding: 6 } : null}>
        <View
          style={[
            ApplicationStyle.borderRadius24,
            Spaces.padding[16],
            {
              backgroundColor: withAlpha(Colors.primary800, 0.6),
              borderColor: withAlpha(Colors.neutral00, 0.13),
              borderLeftColor: resolveFacilityPlanningColor(item) || Colors.primary500,
              borderLeftWidth: FACILITY_ACCENT_WIDTH,
              borderWidth: 1,
              marginBottom: isDesktop ? 0 : 12,
            },
          ]}
        >
          <View style={[Alignments.row, { alignItems: 'flex-start', gap: 8 }]}>
            <TouchableOpacity
              accessibilityLabel={t(
                'collectiviteCreneaux.liste.ouvrir',
                '{{nom}} : ses créneaux et son planning',
                { nom, ...SANS_ECHAPPEMENT },
              )}
              accessibilityRole="button"
              onPress={() => ouvrirInstallation(item)}
              style={{ flex: 1, gap: 4, minWidth: 0 }}
            >
              <Text numberOfLines={2} style={[Fonts.h5Bold, Fonts.neutral00]}>{nom}</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>{meta}</Text>
              {adresse ? <Text style={[Fonts.p3, Fonts.neutral300]}>{adresse}</Text> : null}
              {ligneSemaine ? (
                <Text
                  style={semaine?.full
                    ? [Fonts.p3Bold, Fonts.warning500]
                    : [Fonts.p3, Fonts.neutral300]}
                >
                  {ligneSemaine}
                </Text>
              ) : null}
              {getFacilityConflictMode(item) === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY ? (
                <View style={[Alignments.row, Spaces.marginTop[4]]}>
                  {renderMetaChip(
                    t('facilityList.badges.overflowAllowed', 'Conflits : autoriser et notifier'),
                    'neutral',
                  )}
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t(
                'collectiviteCreneaux.liste.plusActions',
                'Plus d’actions pour {{nom}}',
                { nom, ...SANS_ECHAPPEMENT },
              )}
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => setMenuInstallation(item)}
              style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
            >
              <SvgIcon color={Colors.primary200} height={20} name="dots-horizontal" width={20} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [
    Alignments,
    ApplicationStyle.borderRadius24,
    Colors.neutral00,
    Colors.primary200,
    Colors.primary500,
    Colors.primary800,
    Fonts,
    Spaces.marginTop,
    Spaces.padding,
    handleCreate,
    isDesktop,
    ouvrirInstallation,
    renderMetaChip,
    semaines,
    t,
  ]);

  // Le menu « Plus d actions » : les gestes secondaires, ranges. Pas de « Supprimer » pour la
  // mairie (decision du 29/09) ; pas de GPS pour une installation sans adresse.
  /**
   * @type {Array<{
   *   cle: string, danger?: boolean, icone: string, libelle: string, onPress: () => void
   * }>}
   */
  const menuGestes = [];
  if (menuInstallation && isCollectiviteMode) {
    menuGestes.push({
      cle: 'planning',
      icone: 'calendar',
      libelle: t('facilityList.actions.openPlanning', 'Voir le planning'),
      onPress: () => handleOpenPlanning(menuInstallation),
    }, {
      cle: 'modifier',
      icone: 'edit',
      libelle: t('collectiviteCreneaux.liste.modifier', 'Modifier l’installation'),
      onPress: () => handleEdit(menuInstallation),
    });
    if (getAddressLabel(menuInstallation?.address, '').trim()) {
      menuGestes.push({
        cle: 'gps',
        icone: 'location-pin-alt-1',
        libelle: t('common.actions.openInGps', 'Ouvrir dans le GPS'),
        onPress: () => handleOpenFacilityMap(menuInstallation),
      });
    }
  }
  const fermerMenu = () => setMenuInstallation(null);
  // COLL-C2C (02/10) — cote club, le menu range le geste qu on ne doit pas faire par megarde.
  if (menuInstallation && !isCollectiviteMode) {
    menuGestes.push({
      cle: 'supprimer',
      danger: true,
      icone: 'trash',
      libelle: t('clubInstallations.actions.supprimer', 'Supprimer l’installation'),
      onPress: () => handleDelete(
        menuInstallation?.documentId || menuInstallation?.id,
        menuInstallation?.name,
      ),
    });
  }
  const menuDesInstallations = (
    <BottomModal close={fermerMenu} isVisible={Boolean(menuInstallation)} webPresentation="dialog">
      {menuInstallation ? (
        <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16], { gap: 8 }]}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {menuInstallation?.name}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginBottom[8]]}>
            {[
              getFacilityTypeLabel(menuInstallation?.type),
              t('collectiviteCreneaux.liste.capacite', {
                count: Math.max(1, Number(menuInstallation?.maxSlots || 1)),
                defaultValue_one: '{{count}} équipe à la fois',
                defaultValue_other: '{{count}} équipes à la fois',
              }),
            ].filter(Boolean).join(' · ')}
          </Text>
          {menuGestes.map((geste) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={geste.cle}
              onPress={() => {
                fermerMenu();
                geste.onPress();
              }}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.paddingHorizontal[16],
                {
                  backgroundColor: withAlpha(Colors.neutral00, 0.04),
                  borderColor: withAlpha(Colors.neutral00, 0.1),
                  borderRadius: 14,
                  borderWidth: 1,
                  gap: 12,
                  minHeight: 52,
                },
              ]}
            >
              <SvgIcon
                color={geste.danger ? Colors.error500 : Colors.primary200}
                name={geste.icone}
              />
              <Text
                style={[Fonts.p2Bold, geste.danger ? { color: Colors.error500 } : Fonts.neutral00]}
              >
                {geste.libelle}
              </Text>
            </TouchableOpacity>
          ))}
          <Button onPress={fermerMenu} title={t('common.close', 'Fermer')} variant="Ghost" />
        </View>
      ) : null}
    </BottomModal>
  );

  const renderSectionHeader = useCallback(({ section }) => (
    hasMultipleSections ? (
      <View style={[Spaces.marginBottom[8], Spaces.marginTop[4]]}>
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>
          {section.title}
        </Text>
      </View>
    ) : null
  ), [Fonts.p2Bold, Fonts.primary200, Spaces.marginBottom, Spaces.marginTop, hasMultipleSections]);

  // COLL-C2C (02/10) — l ajout en pointille (D34) : en pied de liste, ou sous « Au club ».
  const boutonAjouter = (
    <TouchableOpacity
      accessibilityLabel={t('facilityList.empty.action', 'Ajouter une installation')}
      accessibilityRole="button"
      disabled={isMissingContext}
      onPress={handleCreate}
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        Spaces.marginTop[12],
        {
          backgroundColor: withAlpha(Colors.primary500, 0.06),
          borderColor: withAlpha(Colors.primary500, 0.4),
          borderRadius: 16,
          borderStyle: 'dashed',
          borderWidth: 1.5,
          minHeight: 52,
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.primary200]}>
        {`+ ${t('facilityList.empty.action', 'Ajouter une installation')}`}
      </Text>
    </TouchableOpacity>
  );

  // COLL-C2C — la tete d un groupe : son titre, son nombre, puis UNE ligne : ce qu on y fait.
  // La Ville n est nommee qu une fois (design P8v2).
  const renderSectionHeaderGroupes = (/** @type {{ section: any }} */ { section }) => {
    const groupe = /** @type {'aDemander' | 'auClub' | 'avecCreneaux'} */ (section.kind);
    const nombre = section.data.filter((/** @type {any} */ item) => !item?.isEmptyGroup).length;
    const titres = {
      aDemander: t('clubInstallations.groupes.aDemander', 'À demander à la Ville'),
      auClub: t('clubInstallations.groupes.auClub', 'Au club'),
      avecCreneaux: t('clubInstallations.groupes.avecCreneaux', 'Tes créneaux de la Ville'),
    };
    const dits = {
      aDemander: groupes.avecCreneaux.length
        ? t(
          'clubInstallations.groupes.aDemanderDit',
          'Ton club n’y a pas de créneau : regarde les heures libres et demande.',
        )
        : t(
          'clubInstallations.groupes.aDemanderDitVille',
          '{{ville}} : ton club n’y a pas de créneau. Regarde les heures libres et demande.',
          {
            ville: villeNommee,
            ...SANS_ECHAPPEMENT,
          },
        ),
      auClub: nombre
        ? t('clubInstallations.groupes.auClubDit', 'À ton club : tu gères son planning.')
        : null,
      avecCreneaux: t(
        'clubInstallations.groupes.avecCreneauxDit',
        '{{ville}} t’a attribué ces créneaux pour la saison.',
        {
          ville: villeNommee,
          ...SANS_ECHAPPEMENT,
        },
      ),
    };
    return (
      <View style={[Spaces.marginBottom[8], Spaces.marginTop[12], { gap: 2 }]}>
        <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.primary200]}>
          {nombre
            ? `${titres[groupe]} ${t('clubInstallations.groupes.nombre', '({{count}})', {
              count: nombre,
            })}`
            : titres[groupe]}
        </Text>
        {dits[groupe] ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>{dits[groupe]}</Text>
        ) : null}
      </View>
    );
  };

  // COLL-C2C — la carte d une installation de la Ville, cote club : son nom ; ce qu elle est ; les
  // creneaux du club (« U15 · chaque mardi 17:30 – 19:00 ») ; « Voir le planning » et « Demander ».
  const renderCarteVille = (/** @type {any} */ item, /** @type {string} */ kind) => {
    const nom = item?.name || t('facilityList.defaults.facilityName', 'Installation');
    const equipes = Math.max(1, Number(item?.maxSlots || 1));
    const couleur = resolveFacilityPlanningColor(item) || Colors.primary500;
    const meta = [
      getFacilityTypeLabel(item?.type),
      t('collectiviteCreneaux.liste.capacite', {
        count: equipes,
        defaultValue_one: '{{count}} équipe à la fois',
        defaultValue_other: '{{count}} équipes à la fois',
      }),
      kind === 'aDemander'
        ? formatOpeningHours(item?.openingTime, item?.closingTime)
        : getAddressLabel(item?.address, '').trim(),
    ].filter(Boolean).join(' · ');
    return (
      <View
        style={[
          ApplicationStyle.borderRadius24,
          Spaces.padding[16],
          {
            backgroundColor: withAlpha(Colors.primary800, 0.6),
            borderColor: withAlpha(Colors.neutral00, 0.13),
            borderLeftColor: couleur,
            borderLeftWidth: FACILITY_ACCENT_WIDTH,
            borderWidth: 1,
            gap: 10,
            marginBottom: 12,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityLabel={t('clubInstallations.actions.ouvrir', '{{nom}} : voir le planning', {
            nom,
            ...SANS_ECHAPPEMENT,
          })}
          accessibilityRole="button"
          onPress={() => handleOpenPlanning(item)}
          style={{ gap: 4 }}
        >
          <Text numberOfLines={2} style={[Fonts.h5Bold, Fonts.neutral00]}>{nom}</Text>
          {meta ? <Text style={[Fonts.p3, Fonts.neutral200]}>{meta}</Text> : null}
        </TouchableOpacity>
        {kind === 'avecCreneaux' ? (
          <View style={{ gap: 2 }}>
            {item.clubSeasonSlots.map((/** @type {any} */ creneau) => {
              const morceaux = clubSlotParts(creneau);
              // COLL-FIX2 (T10) : la période, quand le créneau ne couvre pas toute la saison.
              const ligne = t(
                morceaux.period
                  ? 'clubInstallations.creneau.lignePeriode'
                  : 'clubInstallations.creneau.ligne',
                morceaux.period
                  ? '{{team}} · chaque {{day}} {{hours}} · {{periode}}'
                  : '{{team}} · chaque {{day}} {{hours}}',
                {
                  day: morceaux.day,
                  hours: morceaux.hours,
                  periode: morceaux.period,
                  team: morceaux.team
                    || t('clubInstallations.creneau.toutLeClub', 'Tout le club'),
                  ...SANS_ECHAPPEMENT,
                },
              );
              return (
                <View
                  key={creneau.documentId}
                  style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}
                >
                  <View style={{
                    backgroundColor: couleur, borderRadius: 3, height: 6, width: 6,
                  }}
                  />
                  <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{ligne}</Text>
                  {peutRepartir ? (
                    <TouchableOpacity
                      accessibilityLabel={t(
                        'clubInstallations.repartir.ouvrir',
                        'Répartir : {{ligne}}',
                        { ligne, ...SANS_ECHAPPEMENT },
                      )}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setCreneauARepartir(creneau)}
                    >
                      <Text style={[Fonts.p3Bold, Fonts.primary300]}>
                        {t('clubInstallations.repartir.action', 'Répartir')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
        <View style={[Alignments.row, { gap: 8 }]}>
          <View style={{ flex: 1 }}>
            <Button
              onPress={() => handleOpenPlanning(item)}
              size="sm"
              title={t('facilityList.actions.openPlanning', 'Voir le planning')}
              variant="Secondary"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              onPress={() => ouvrirDemandeALaVille(navigation, {
                clubId: contextClubId,
                facility: item,
              })}
              size="sm"
              title={kind === 'avecCreneaux'
                ? t('clubInstallations.actions.demanderHeure', 'Demander une heure')
                : t('clubInstallations.actions.demanderCreneau', 'Demander un créneau')}
              variant={kind === 'avecCreneaux' ? 'Secondary' : 'Primary'}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderItemGroupes = (/** @type {{ item: any, section: any }} */ { item, section }) => {
    if (item?.isEmptyGroup) {
      return (
        <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginBottom[4]]}>
          {t(
            'clubInstallations.groupes.auClubVide',
            'Aucune installation à ton club pour l’instant.',
          )}
        </Text>
      );
    }
    if (section.kind === 'auClub') return renderItem({ item });
    return renderCarteVille(item, section.kind);
  };

  const renderSectionFooterGroupes = (/** @type {{ section: any }} */ { section }) => (
    section.kind === 'auClub' ? boutonAjouter : null
  );

  const blocEnAttente = seancesEnAttente.length ? (
    <View style={[Spaces.gap[8], Spaces.marginBottom[16]]}>
      <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.warning500]}>
        {t('clubInstallations.attente.titre', 'Séances à valider ({{count}})', {
          count: seancesEnAttente.length,
        })}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'clubInstallations.attente.dit',
          'Tes créneaux sont déjà pleins à ces heures : accepte ou refuse.',
        )}
      </Text>
      {seancesEnAttente.map((/** @type {any} */ seance) => (
        <View
          key={seance.documentId}
          style={[
            Spaces.padding[12],
            Spaces.gap[8],
            {
              backgroundColor: withAlpha(Colors.warning500, 0.08),
              borderColor: withAlpha(Colors.warning500, 0.4),
              borderRadius: 16,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('clubInstallations.attente.ligne', '{{team}} · {{day}} {{hours}}', {
              day: formatDay(seance.date, { withYear: false }),
              hours: timeRange(seance.startTime, seance.endTime),
              team: seance.team?.name || t('clubInstallations.creneau.toutLeClub', 'Tout le club'),
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
          {seance.facility?.name ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>{seance.facility.name}</Text>
          ) : null}
          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
            <Button
              disabled={decisionEnCours === seance.documentId}
              onPress={() => deciderSeance(seance, 'approve')}
              size="small"
              title={t('clubInstallations.attente.accepter', 'Accepter')}
              variant="Primary"
            />
            <Button
              disabled={decisionEnCours === seance.documentId}
              onPress={() => refuserSeance(seance)}
              size="small"
              title={t('clubInstallations.attente.refuser', 'Refuser')}
              variant="Secondary"
            />
          </View>
        </View>
      ))}
    </View>
  ) : null;

  const etatVide = (
    <EmptyState
      actionLabel={t('facilityList.empty.action', 'Ajouter une installation')}
      description={isCollectiviteMode
        ? t(
          'facilityList.collectiviteEmpty',

          'Ajoutez les gymnases, terrains et salles de la Ville : les clubs verront leur planning.',
        )
        : t(
          'facilityList.empty.description',
          'Ajoute les terrains, gymnases ou salles de ton club.',
        )}
      onAction={handleCreate}
      title={t('facilityList.empty.title', 'Aucune installation')}
    />
  );

  // COLL-C2B (02/10) — la Ville : une liste (une colonne sur telephone, trois sur ordinateur),
  // l ajout en derniere case. Le club garde sa liste a sections, ci-dessous.
  let content = isCollectiviteMode ? (
    <FlatList
      contentContainerStyle={[
        { paddingBottom: sceneBottomInset },
        facilities.length === 0 && Alignments.fill,
        facilities.length === 0 && Alignments.mainCenter,
      ]}
      data={facilities.length ? [...facilities, CASE_AJOUT] : []}
      key={isDesktop ? 'grille' : 'liste'}
      keyExtractor={getFacilityKey}
      ListEmptyComponent={etatVide}
      numColumns={isDesktop ? COLONNES_ORDINATEUR : 1}
      refreshControl={(
        <RefreshControl
          colors={[Colors.primary500]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={Colors.primary500}
        />
      )}
      renderItem={renderCollectiviteItem}
      showsVerticalScrollIndicator={false}
    />
  ) : (
    <SectionList
      contentContainerStyle={[
        { paddingBottom: sceneBottomInset },
        facilities.length === 0 && Alignments.fill,
        facilities.length === 0 && Alignments.mainCenter,
      ]}
      keyExtractor={getFacilityKey}
      ListEmptyComponent={etatVide}
      ListFooterComponent={!enGroupes && facilities.length > 0 ? boutonAjouter : null}
      ListHeaderComponent={blocEnAttente}
      refreshControl={(
        <RefreshControl
          colors={[Colors.primary500]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={Colors.primary500}
        />
      )}
      renderItem={enGroupes ? renderItemGroupes : renderItem}
      renderSectionFooter={enGroupes ? renderSectionFooterGroupes : undefined}
      renderSectionHeader={enGroupes ? renderSectionHeaderGroupes : renderSectionHeader}
      sections={sections}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
    />
  );

  if (isMissingContext) {
    content = (
      <View style={[Alignments.fill, Alignments.mainCenter, Spaces.gap[12]]}>
        <Text style={[Fonts.h4Black, Fonts.neutral00]}>
          {t('facilityList.missingClub.title', 'Club introuvable')}
        </Text>
        <Text style={[Fonts.p2, Fonts.primary100]}>
          {t(
            'facilityList.missingClub.body',
            'Impossible de determiner pour quel club afficher les installations.',
          )}
        </Text>
        <Button
          onPress={() => navigateToStackScreenOrScreen(navigation, {
            screen: RouteNames.TeamList,
            stack: RouteNames.TeamStack,
          })}
          title={t('facilityList.missingClub.back', 'Retour aux équipes')}
          variant="Secondary"
        />
      </View>
    );
  } else if (loading && !refreshing && isCollectiviteMode) {
    // COLL-C2B (02/10) — design P4, etat 4 : le titre reste, les cartes en squelette.
    content = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }}>
        {SQUELETTES.map((cle) => (
          <View
            key={cle}
            style={[
              ApplicationStyle.borderRadius24,
              Spaces.padding[16],
              {
                backgroundColor: withAlpha(Colors.primary800, 0.6),
                borderColor: withAlpha(Colors.neutral00, 0.13),
                borderLeftColor: Colors.neutral700,
                borderLeftWidth: FACILITY_ACCENT_WIDTH,
                borderWidth: 1,
                gap: 8,
              },
            ]}
            testID="installation-squelette"
          >
            {['60%', '85%', '50%'].map((largeur, index) => (
              <View
                key={largeur}
                style={{
                  backgroundColor: withAlpha(Colors.neutral00, 0.08),
                  borderRadius: 8,
                  height: index === 0 ? 22 : 14,
                  width: /** @type {import('react-native').DimensionValue} */ (largeur),
                }}
              />
            ))}
          </View>
        ))}
      </View>
    );
  } else if (loading && !refreshing) {
    content = <Loader />;
  } else if (error) {
    content = (
      <View style={[Alignments.fill, Alignments.mainCenter, Spaces.gap[12]]}>
        <Text style={[Fonts.h4Black, Fonts.neutral00]}>
          {t('facilityList.loadError', 'Impossible de charger les installations')}
        </Text>
        <Text style={[Fonts.p2, Fonts.primary100]}>
          {getErrorMessage(error, 'generic')}
        </Text>
        <Button
          onPress={() => refetchFacilities()}
          title={t('facilityList.retry', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  }

  // TEXTES-COLLECTIVITES (01/10) — cote club, « Tes installations · 4 » comptait celles de
  // la Ville comme celles du club : les deux nombres se disent separement.
  const collectiviteFacilities = isCollectiviteMode
    ? []
    : facilities.filter((/** @type {any} */ facility) => facility?.ownerType === 'collectivite');
  // COLL-C2C (02/10) — design P8v2 : « 1 au club · 1 avec tes creneaux de la Ville · 2 a
  // demander ».
  const sousTitreGroupes = enGroupes
    ? [
      t('clubInstallations.compte.auClub', '{{count}} au club', { count: groupes.auClub.length }),
      groupes.avecCreneaux.length
        ? t('clubInstallations.compte.avecCreneaux', '{{count}} avec tes créneaux de la Ville', {
          count: groupes.avecCreneaux.length,
        })
        : null,
      groupes.aDemander.length
        ? t('clubInstallations.compte.aDemander', '{{count}} à demander', {
          count: groupes.aDemander.length,
        })
        : null,
    ].filter(Boolean).join(' · ')
    : null;
  const listSubtitle = sousTitreGroupes || (collectiviteFacilities.length > 0
    ? [
      t('facilityList.count.club', {
        count: facilities.length - collectiviteFacilities.length,
        defaultValue_one: '{{count}} installation du club',
        defaultValue_other: '{{count}} installations du club',
      }),
      t('facilityList.count.collectivite', {
        count: collectiviteFacilities.length,
        defaultValue_one: '{{count}} gérée par {{who}}',
        defaultValue_other: '{{count}} gérées par {{who}}',
        who: formatCollectiviteOfferedBy(collectiviteFacilities[0]?.ownerName),
        ...SANS_ECHAPPEMENT,
      }),
    ].join(' · ')
    // TEXTES-COLLECTIVITES : « 1 installation » etait ecrit en dur, en francais.
    : t('facilityList.count.total', {
      count: facilities.length,
      defaultValue_one: '{{count}} installation',
      defaultValue_other: '{{count}} installations',
    }));
  let listTitle = t('facilityList.title', 'Tes installations');
  if (isCollectiviteMode) {
    // COLL-C2B (02/10) — design P4 : « Ma collectivite » au-dessus, « Installations de la
    // Ville » en titre, UNE fois (l en-tete de navigation se tait, voir plus haut). Le nom de
    // la Ville (TEXTES-COLLECTIVITES) n est plus le titre : le menu du site le porte deja.
    listTitle = t('facilityList.collectiviteTitle', 'Installations de la Ville');
  }
  const surtitre = isCollectiviteMode
    ? t('collectiviteCreneaux.liste.surtitre', 'Ma collectivité')
    : null;

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Spaces.paddingHorizontal[16],
        Alignments.fill,
      ]}
    >
      <View
        style={[
          Spaces.marginBottom[24],
          Alignments.row,
          Alignments.justifySpaceBetween,
          Alignments.alignCenter,
          Spaces.gap[12],
        ]}
      >
        <View style={{ flex: 1 }}>
          {surtitre ? (
            <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
              {surtitre}
            </Text>
          ) : null}
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {listTitle}
          </Text>
          <Text style={[Fonts.p2, Fonts.primary100]}>
            {listSubtitle}
          </Text>
        </View>
        {/* D34 : une SEULE grammaire d'ajout — le bouton plein de l'en-tete a */}
        {/* laisse la place au pointille en pied de liste (ListFooterComponent). */}
      </View>

      {content}

      {menuDesInstallations}

      {peutRepartir ? (
        <BottomModal
          close={() => setCreneauARepartir(null)}
          isVisible={Boolean(creneauARepartir)}
          webPresentation="dialog"
        >
          {creneauARepartir ? (
            <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16], { gap: 8 }]}>
              <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
                {t('clubInstallations.repartir.titre', 'Quelle équipe sur ce créneau ?')}
              </Text>
              <SeasonSlotForm
                onCancel={() => setCreneauARepartir(null)}
                onDone={() => {
                  setCreneauARepartir(null);
                  refetchFacilities();
                }}
                repartition
                slot={creneauARepartir}
              />
            </View>
          ) : null}
        </BottomModal>
      ) : null}

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={contextClubId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </ScreenContainer>
  );
}

export default FacilityList;
