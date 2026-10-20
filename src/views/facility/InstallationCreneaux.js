import { useNavigation, useRoute } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatOpeningHours } from '@/domains/collectivite/collectiviteDisplay';
import { closuresOfBanner } from '@/domains/facilityClosure/facilityClosureDisplay';
import {
  finDuCreneau,
  formatDay,
  fromMinutes,
  fullRangesOfSlots,
  groupSlotsByWeekday,
  overCapacityPreviewOf,
  seasonSlotErrorMessage,
  seasonYears,
  slotShape,
  slotWho,
  timeRange,
  toMinutes,
  weekdayName,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { formeEnMots } from '@/domains/seasonSlot/seasonSlotWhen';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import FacilityClosureBanner from '@/components/molecules/facilityClosure/FacilityClosureBanner';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import FacilityClosureList from '@/components/organisms/facilityClosure/FacilityClosureList';
import FacilityReportPanel from '@/components/organisms/facilityReport/FacilityReportPanel';
import FacilitySecurityTab from '@/components/organisms/facilityReport/FacilitySecurityTab';
import SeasonSlotDatesBand from '@/components/organisms/seasonSlot/SeasonSlotDatesBand';
import SeasonSlotForm, {
  HAUTEUR_DE_LA_FEUILLE,
} from '@/components/organisms/seasonSlot/SeasonSlotForm';
import SeasonSlotManage from '@/components/organisms/seasonSlot/SeasonSlotManage';
import SeasonSlotWeekGrid from '@/components/organisms/seasonSlot/SeasonSlotWeekGrid';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteClubs,
  useCollectiviteInstallations,
} from '@/services/collectivite/collectiviteQueries';
import { useFacilityClosures } from '@/services/facilityClosure/facilityClosureQueries';
import { useCachedFacilityOpenReportsCount } from '@/services/facilityReport/facilityReportQueries';
import {
  useFacilitySeasonSlots,
  useRestoreSeasonSlot,
} from '@/services/seasonSlot/seasonSlotQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { FACILITY_CONFLICT_MODES, getFacilityConflictMode } from '@/utils/facilityConflictMode';
import { assignClubPlanningColors, legendeDesClubs } from '@/utils/facilityPlanningColor';
import { getFacilityTypeLabel } from '@/utils/facilityTypes';

import { useIsDesktop } from '@/responsive';

/** Les trois onglets d une installation (design P4v2-creneaux). */
const LIGNE_D_INFO = /** @type {const} */ ({
  flexDirection: 'row', gap: 12, justifyContent: 'space-between',
});
const LIGNE_DE_SAISON = /** @type {const} */ ({ gap: 8, justifyContent: 'space-between' });
// COLL-C4B (02/10) : + « Fermetures » (design P4v3-fermer, ecran 6).
// R17-SIGNALER-1 (19/10, REC17-011) : + « Sécurité et suivi », le 5ᵉ, pour la Ville seule.
const ONGLETS = {
  creneaux: 'creneaux',
  fermetures: 'fermetures',
  infos: 'infos',
  planning: 'planning',
  securite: 'securite',
};
// La notification d un signalement et l accueil ouvrent directement ces onglets.
const ONGLETS_D_ENTREE = [ONGLETS.fermetures, ONGLETS.securite];

/**
 * Un jour civil « AAAA-MM-JJ » en « 1 sept. » (pour « du 1 sept. au 30 juin »).
 * @param {string | null | undefined} jour - Le jour.
 * @returns {string} Le jour court.
 */
const jourCourt = (jour) => (jour
  ? format(parseISO(jour), 'd MMM', { locale: localeDesFormats() === 'en-GB' ? enGB : fr })
  : '');

/**
 * Un creneau RETIRE, avec « Retablir » (contrat C2A §4.7). La place est recomptee : un 409 de
 * capacite propose « Retablir quand meme » (`confirmOverCapacity`).
 * @param {{ slot: any }} props
 * @returns {import('react').ReactElement} La ligne.
 */
function CreneauRetire({ slot }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const retablir = useRestoreSeasonSlot();
  const [conflit, setConflit] = useState(/** @type {any} */ (null));
  const [erreur, setErreur] = useState(/** @type {string | null} */ (null));

  const envoyer = async (/** @type {boolean} */ quandMeme) => {
    setErreur(null);
    try {
      await retablir.mutateAsync({
        data: quandMeme ? { confirmOverCapacity: true } : {},
        slotId: slot.documentId,
      });
      setConflit(null);
    } catch (refus) {
      const apercu = overCapacityPreviewOf(refus);
      if (apercu) {
        setConflit(apercu);
        return;
      }
      setErreur(seasonSlotErrorMessage(t, refus) || getErrorMessage(/** @type {any} */ (refus)));
    }
  };

  return (
    <View
      style={[
        Spaces.padding[12],
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.03),
          borderColor: withAlpha(Colors.neutral00, 0.1),
          borderRadius: 14,
          borderStyle: 'dashed',
          borderWidth: 1,
          gap: 6,
        },
      ]}
      testID={`creneau-retire-${slot.documentId}`}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral200]}>{slotWho(slot)}</Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {[
          `${weekdayName(slot.weekday)} ${timeRange(slot.startTime, slot.endTime)}`,
          slot.withdrawnFrom
            ? t('collectiviteCreneaux.creneaux.retireLe', 'retiré à partir du {{date}}', {
              date: formatDay(slot.withdrawnFrom, { withYear: false }),
              ...SANS_ECHAPPEMENT,
            })
            : null,
        ].filter(Boolean).join(' · ')}
      </Text>
      {conflit ? (
        <Text style={[Fonts.p3Bold, Fonts.warning500]}>
          {t(
            'collectiviteCreneaux.creneaux.retablirComplet',
            'Le rétablir met {{count}} équipes pour {{capacite}} places.',
            {
              capacite: Number(conflit.capacity) || 1,
              count: Number(conflit.teamsAfter) || 0,
            },
          )}
        </Text>
      ) : null}
      {erreur ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>{erreur}</Text>
      ) : null}
      <Button
        isLoading={retablir.isPending}
        onPress={() => envoyer(Boolean(conflit))}
        size="small"
        title={conflit
          ? t('collectiviteCreneaux.creneaux.retablirQuandMeme', 'Rétablir quand même')
          : t('collectiviteCreneaux.creneaux.retablir', 'Rétablir')}
        variant="Secondary"
      />
    </View>
  );
}

/**
 * 📐 COLL-C2B (02/10) — L INSTALLATION DE LA VILLE et son onglet « Creneaux » (design HY521H1,
 * « P4v2-creneaux-tel » et « P4v2-creneaux-ordi » ; contrat C2A §4).
 *
 * La semaine type de la saison, jour par jour : chaque creneau revient chaque semaine. La mairie
 * attribue (place libre pendant la saisie), gere, modifie « a partir du », retire (D67) et
 * retablit. Les onglets : Creneaux · Planning (le planning plein ecran de l installation) · Infos.
 * Sur ordinateur, la semaine se lit en 7 colonnes et le panneau s ouvre a droite.
 * COLL-C2B-BIS (03/10) — planche 23 : sur ordinateur, ces 7 colonnes sont A L ECHELLE DES HEURES
 * (la colonne des heures de la planche, `SeasonSlotWeekGrid`) ; une case vide ouvre « Attribuer »,
 * deja rempli du jour ET de l heure.
 *
 * Le serveur est le seul juge des droits (`meta.canManage`) : sans lui, AUCUN geste d ecriture
 * (ni « Attribuer », ni « Modifier », ni « Retirer », ni « Retablir »).
 * « Reconduire la saison precedente » : PLUS TARD (design) — pas de bouton mort.
 * @returns {import('react').ReactElement} L ecran.
 */
function InstallationCreneaux() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const isDesktop = useIsDesktop();
  const insets = useSafeAreaInsets();
  const params = /** @type {any} */ (route.params) || {};
  const collectiviteId = params.collectiviteId || null;
  const facilityId = params.facilityId || null;

  // COLL-C4B : l accueil de la Ville (« Fermeture a venir ») ouvre l onglet « Fermetures ».
  const [onglet, setOnglet] = useState(
    ONGLETS_D_ENTREE.includes(params.onglet) ? params.onglet : ONGLETS.creneaux,
  );
  // Ce qui est ouvert : « attribuer » (avec un jour pre-rempli), « gerer » ou « modifier ».
  const [panneau, setPanneau] = useState(/** @type {any} */ (null));
  const panneauMobileOuvert = !isDesktop && Boolean(panneau);
  // IPH09 FC-001 : la navigation du fond ne concurrence pas la vue active.
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: !panneauMobileOuvert, headerTitle: '' });
    return () => navigation.setOptions?.({ headerShown: true });
  }, [navigation, panneauMobileOuvert]);

  const installations = useCollectiviteInstallations(collectiviteId);
  const actifs = useFacilitySeasonSlots(facilityId, 'active');
  const meta = actifs.data?.meta || {};
  const canManage = meta.canManage === true;
  const retires = useFacilitySeasonSlots(facilityId, 'withdrawn', { enabled: canManage });
  const clubs = useCollectiviteClubs(canManage ? collectiviteId : null);
  // R17-SIGNALER-1 (P10-securite-ordi A) : la pastille de l onglet, SANS lecture de plus (le
  // compte deja en cache : la liste de l onglet, ou le resume lu par la liste des installations).
  const signalementsOuverts = useCachedFacilityOpenReportsCount(
    canManage ? facilityId : null,
    collectiviteId,
  );
  // COLL-C4B (02/10) — le bandeau de la fiche, tant que la fermeture dure ou approche (P3b).
  const fermeturesDeLInstallation = useFacilityClosures(facilityId);
  // FINITIONS13-COLL (04/10) : toutes les fermetures annoncées, la plus proche d'abord.
  const bandeaux = closuresOfBanner(fermeturesDeLInstallation.data?.meta);

  const ligne = (Array.isArray(installations.data) ? installations.data : [])
    .find((installation) => installation?.documentId === facilityId) || null;
  const installation = { ...(meta.facility || {}), ...(ligne || {}) };
  const nom = installation.name || meta.facility?.name || '';
  const capacite = Math.max(1, Number(installation.maxSlots) || 1);
  const creneaux = Array.isArray(actifs.data?.data) ? actifs.data.data : [];
  // 🎨 COLL-R-A6 (13/10, COL-019, décision d'Adel D13 = A) : chaque créneau à la couleur de SON
  // club — son rang dans la liste des clubs de la Ville, la même règle et la même liste que
  // « Planning » : un club a la même couleur sur toutes les installations. Légende au-delà de 2.
  const creneauxColores = assignClubPlanningColors(
    creneaux,
    Array.isArray(clubs.data) ? clubs.data : null,
  );
  const legende = legendeDesClubs(creneauxColores);
  const creneauxRetires = canManage && Array.isArray(retires.data?.data) ? retires.data.data : [];
  const clubsRattaches = (Array.isArray(clubs.data) ? clubs.data : [])
    .filter((club) => club?.documentId && club?.name)
    .map((club) => ({
      documentId: club.documentId, logoUrl: club.logo?.url || null, name: club.name,
    }));
  const annees = seasonYears(meta.season);

  const fermer = () => setPanneau(null);
  const ouvrirLePlanning = () => {
    navigation.navigate(RouteNames.PlanningWeekFullscreen, {
      contextDetailLabel: nom || null,
      // FINITIONS16 · POINT 18 (T15) — l'installation de la Ville : sur le site, le menu de la
      // Ville reste sur son planning (`espace=ville` dans l'adresse, AppShell).
      ...(collectiviteId ? { espace: 'ville' } : {}),
      facilityId,
      sourceType: 'facility',
    });
  };
  const choisirOnglet = (/** @type {string} */ valeur) => {
    // « Planning » ouvre le planning plein ecran de l installation (P5) ; l onglet reste ici.
    if (valeur === ONGLETS.planning) {
      ouvrirLePlanning();
      return;
    }
    // R17-SIGNALER-1 (P10-securite-ordi B) : le panneau d un signalement appartient a son onglet.
    setPanneau((/** @type {any} */ avant) => (avant?.type === 'signalement' ? null : avant));
    setOnglet(valeur);
  };

  // COLL-C4B (02/10) — fermer, bloquer, modifier : le formulaire plein ecran (P4v3-fermer).
  const ouvrirLaFermeture = (/** @type {Record<string, any>} */ extra) => {
    navigation.navigate(RouteNames.CollectiviteFermeture, {
      collectiviteId,
      facilityId,
      facilityName: nom || null,
      ...extra,
    });
  };

  const metaLigne = [
    getFacilityTypeLabel(installation.type),
    t('collectiviteCreneaux.liste.capacite', {
      count: capacite,
      defaultValue_one: '{{count}} équipe à la fois',
      defaultValue_other: '{{count}} équipes à la fois',
    }),
    formatOpeningHours(installation.openingTime, installation.closingTime),
  ].filter(Boolean).join(' · ');

  // ─── Une ligne de creneau (telephone) ou un bloc (ordinateur) ─────────────────────────
  const libelleDuCreneau = (/** @type {any} */ creneau) => [
    timeRange(creneau.startTime, creneau.endTime),
    creneau.plateau?.name || null,
    // 🗓️ R17-QUAND-1 (planche P11-quand-ou-ca-vit, 2) — la forme quand ce n'est pas « chaque
    // semaine » : « un mercredi sur deux », ou les dates choisies (alors sans « du … au … »).
    // R17-QUAND-2 (planche P11-quand-ou-ca-vit, 2) : et « sauf vacances ».
    slotShape(creneau).everyWeeks > 1 || slotShape(creneau).dates
      || slotShape(creneau).exceptHolidays
      ? formeEnMots(t, creneau)
      : null,
    // FINITIONS12-COLL (03/10) — la fin écrite : le dernier jour où il a lieu (T11, C23).
    !slotShape(creneau).dates && meta.season && (creneau.validFrom !== meta.season.validFrom
      || finDuCreneau(creneau) !== meta.season.validUntil)
      ? t('collectiviteCreneaux.creneaux.du', 'du {{debut}} au {{fin}}', {
        debut: jourCourt(creneau.validFrom),
        fin: jourCourt(finDuCreneau(creneau)),
        ...SANS_ECHAPPEMENT,
      })
      : null,
  ].filter(Boolean).join(' · ');

  const carteDeCreneau = (/** @type {any} */ creneau) => (
    <TouchableOpacity
      accessibilityLabel={t(
        'collectiviteCreneaux.creneaux.ouvrirCreneau',
        '{{qui}}, {{jour}} {{heures}}',
        {
          heures: timeRange(creneau.startTime, creneau.endTime),
          jour: weekdayName(creneau.weekday).toLocaleLowerCase(),
          qui: slotWho(creneau),
          ...SANS_ECHAPPEMENT,
        },
      )}
      accessibilityRole="button"
      key={creneau.documentId}
      onPress={() => setPanneau({ creneau, type: 'gerer' })}
      style={[
        Spaces.padding[12],
        {
          backgroundColor: withAlpha(Colors.primary800, 0.6),
          borderColor: withAlpha(Colors.neutral00, 0.12),
          borderLeftColor: creneau.displayColor || Colors.primary500,
          borderLeftWidth: 3,
          borderRadius: 14,
          borderWidth: 1,
          gap: 2,
        },
      ]}
      testID={`creneau-${creneau.documentId}`}
    >
      <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>{slotWho(creneau)}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{libelleDuCreneau(creneau)}</Text>
    </TouchableOpacity>
  );

  const titreDuJour = (/** @type {number} */ jour, /** @type {any[]} */ duJour) => {
    const complet = fullRangesOfSlots(duJour, capacite)[0];
    return [
      weekdayName(jour),
      complet
        ? t('collectiviteCreneaux.creneaux.completDe', 'complet {{heures}}', {
          heures: timeRange(fromMinutes(complet.start), fromMinutes(complet.end)),
          ...SANS_ECHAPPEMENT,
        })
        : null,
    ].filter(Boolean).join(' · ');
  };

  const attribuer = (/** @type {number | undefined} */ jour) => setPanneau({
    initial: jour ? { weekday: jour } : {},
    type: 'attribuer',
  });
  // COLL-C2B-BIS — une case vide de la grille : le jour ET l heure (« 17:30 – 19:00 »).
  const attribuerALHeure = (/** @type {Record<string, any>} */ initial) => setPanneau({
    initial,
    type: 'attribuer',
  });

  // ─── L onglet « Creneaux » ──────────────────────────────────────────────────────────
  const ongletCreneaux = (() => {
    if (actifs.isLoading) return <Loader />;
    if (actifs.error) {
      return (
        <View style={{ gap: 12 }}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('collectiviteCreneaux.creneaux.erreur', 'Impossible de charger les créneaux')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>{getErrorMessage(actifs.error)}</Text>
          <Button
            onPress={() => actifs.refetch()}
            title={t('facilityList.retry', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      );
    }
    if (creneaux.length === 0) {
      return (
        <EmptyState
          actionLabel={canManage
            ? t('collectiviteCreneaux.creneaux.attribuerPremier', 'Attribuer le premier')
            : undefined}
          description={t(
            'collectiviteCreneaux.creneaux.videTexte',
            'Un créneau attribué revient chaque semaine, une semaine sur deux ou à des dates '
              + 'choisies : le club y pose ses entraînements sans rien vous demander.',
          )}
          onAction={canManage ? () => attribuer() : undefined}
          title={t('collectiviteCreneaux.creneaux.vide', 'Aucun créneau attribué')}
        />
      );
    }
    const parJour = groupSlotsByWeekday(creneauxColores);
    const blocLegende = legende.length > 2 ? (
      <View
        accessibilityLabel={t('collectiviteCreneaux.creneaux.legende', 'Couleurs des clubs')}
        style={[Alignments.row, { columnGap: 16, flexWrap: 'wrap', rowGap: 6 }]}
        testID="creneaux-legende"
      >
        {legende.map(({ couleur, nom: club }) => (
          <View key={club} style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}>
            <View style={{
              backgroundColor: couleur, borderRadius: 3, height: 10, width: 10,
            }}
            />
            <Text style={[Fonts.p3, Fonts.neutral200]}>{club}</Text>
          </View>
        ))}
      </View>
    ) : null;
    if (isDesktop) {
      // Ordinateur (P4v2-ordi, etat A) : la semaine type A L ECHELLE DES HEURES. Un bloc se gere ;
      // une case vide ouvre « Attribuer », deja rempli du jour et de l heure (COLL-C2B-BIS).
      return (
        <View style={{ gap: 12 }}>
          <SeasonSlotWeekGrid
            capacite={capacite}
            creneaux={creneauxColores}
            fermeture={toMinutes(installation.closingTime)}
            onAttribuer={canManage ? attribuerALHeure : undefined}
            onCreneau={(creneau) => setPanneau({ creneau, type: 'gerer' })}
            ouverture={toMinutes(installation.openingTime)}
          />
          {/* R17-QUAND-1 (planche P11-quand-v2-ordi, A) : les dates choisies, sous la grille. */}
          <SeasonSlotDatesBand
            creneaux={creneauxColores}
            onCreneau={(creneau) => setPanneau({ creneau, type: 'gerer' })}
          />
          {blocLegende}
        </View>
      );
    }
    // R17-QUAND-1 (planche P11-quand-ou-ca-vit, 2) : au téléphone, les dates choisies, en groupe.
    const aDates = creneauxColores.filter((/** @type {any} */ creneau) => slotShape(creneau).dates);
    return (
      <View style={{ gap: 8 }}>
        {blocLegende}
        {parJour.map(({ slots, weekday }) => (
          <View key={`jour-${weekday}`} style={{ gap: 8 }}>
            <Text
              accessibilityRole="header"
              style={[Fonts.p2Bold, Fonts.primary200, Spaces.marginTop[8]]}
            >
              {titreDuJour(weekday, slots)}
            </Text>
            {slots.map(carteDeCreneau)}
          </View>
        ))}
        {aDates.length ? (
          <View style={{ gap: 8 }} testID="creneaux-dates-choisies">
            <Text
              accessibilityRole="header"
              style={[Fonts.p2Bold, Fonts.primary200, Spaces.marginTop[8]]}
            >
              {t('collectiviteCreneaux.quand.groupeDates', 'Dates choisies')}
            </Text>
            {aDates.map(carteDeCreneau)}
          </View>
        ) : null}
      </View>
    );
  })();

  // ─── L onglet « Infos » ─────────────────────────────────────────────────────────────
  const adresse = typeof installation.address === 'object'
    ? installation.address?.description || installation.address?.label || ''
    : String(installation.address || '');
  const ongletInfos = (
    <View style={{ gap: 10 }}>
      {[
        [t('collectiviteCreneaux.infos.type', 'Type'), getFacilityTypeLabel(installation.type)],
        [t('collectiviteCreneaux.infos.capacite', 'Équipes à la fois'), String(capacite)],
        [
          t('collectiviteCreneaux.infos.horaires', 'Horaires'),
          formatOpeningHours(installation.openingTime, installation.closingTime),
        ],
        [t('collectiviteCreneaux.infos.adresse', 'Adresse'), adresse],
        [
          t('collectiviteCreneaux.infos.plein', 'Quand c’est plein'),
          getFacilityConflictMode(installation) === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY
            ? t('facilityForm.conflictModes.allow.label', 'Autoriser et notifier')
            : t('facilityForm.conflictModes.pending.label', 'Demande à valider'),
        ],
        [
          t('collectiviteCreneaux.infos.plateaux', 'Plateaux'),
          (Array.isArray(installation.plateaux) ? installation.plateaux : []).join(', '),
        ],
      ].filter(([, valeur]) => Boolean(valeur)).map(([libelle, valeur]) => (
        <View key={libelle} style={LIGNE_D_INFO}>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{libelle}</Text>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flexShrink: 1, textAlign: 'right' }]}>
            {valeur}
          </Text>
        </View>
      ))}
      {canManage && ligne ? (
        <Button
          onPress={() => navigation.navigate(RouteNames.CollectiviteInstallationForm, {
            collectiviteId,
            facility: ligne,
            facilityId,
          })}
          title={t('collectiviteCreneaux.liste.modifier', 'Modifier l’installation')}
          variant="Secondary"
        />
      ) : null}
    </View>
  );

  // ─── Le panneau : feuille du bas (telephone) ou colonne de droite (ordinateur) ──────
  // 📐 COLL-R-A7 (13/10, COL-005, decision d'Adel D4 A) : au telephone, « Attribuer » s'ouvre
  // en PLEIN ECRAN (la fenetre du formulaire), plus dans la feuille ; « Modifier » aussi
  // (« pareil », 4 etapes). Le site en grand ecran garde son panneau de droite.
  const enPleinEcran = !isDesktop && ['attribuer', 'modifier'].includes(panneau?.type);
  let titreDuPanneau = null;
  let contenuDuPanneau = null;
  if (panneau?.type === 'attribuer') {
    titreDuPanneau = t('collectiviteCreneaux.creneaux.attribuer', 'Attribuer un créneau');
    contenuDuPanneau = (
      <SeasonSlotForm
        ajouterUnClub={() => {
          fermer();
          navigation.navigate(RouteNames.CollectiviteInviteClub, {
            collectiviteId, onglet: 'recherche',
          });
        }}
        clubs={clubsRattaches}
        facilityId={facilityId}
        guided
        initial={panneau.initial}
        key={`attribuer-${panneau.initial?.weekday || 0}-${panneau.initial?.startTime || ''}`}
        lectureDesClubs={clubs}
        onCancel={fermer}
        onDone={fermer}
        pleinEcran={enPleinEcran}
      />
    );
  } else if (panneau?.type === 'modifier') {
    titreDuPanneau = t('collectiviteCreneaux.gerer.modifier', 'Modifier le créneau');
    contenuDuPanneau = (
      <SeasonSlotForm
        clubs={clubsRattaches}
        facilityId={facilityId}
        guided
        key={`modifier-${panneau.creneau.documentId}`}
        onCancel={fermer}
        onDone={fermer}
        pleinEcran={enPleinEcran}
        slot={panneau.creneau}
      />
    );
  } else if (panneau?.type === 'signalement' && onglet === ONGLETS.securite) {
    // R17-SIGNALER-1 (P10-securite-ordi B) : sur ordinateur, le signalement s ouvre ICI, a droite
    // de l onglet « Sécurité et suivi » ; au telephone, l onglet ouvre la page (pas de panneau).
    contenuDuPanneau = (
      <FacilityReportPanel
        enPanneau
        key={`signalement-${panneau.reportId}`}
        onClose={fermer}
        reportId={panneau.reportId}
      />
    );
  } else if (panneau?.type === 'gerer') {
    contenuDuPanneau = (
      <SeasonSlotManage
        canManage={canManage}
        installationName={nom}
        key={`gerer-${panneau.creneau.documentId}`}
        onClose={fermer}
        onModify={(creneau) => setPanneau({ creneau, type: 'modifier' })}
        slot={panneau.creneau}
      />
    );
  }
  const panneauRendu = contenuDuPanneau && !enPleinEcran ? (
    <View style={{ gap: 12 }}>
      {titreDuPanneau ? (
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {titreDuPanneau}
        </Text>
      ) : null}
      {contenuDuPanneau}
    </View>
  ) : null;

  // R17-SIGNALER-1 : cinq onglets a largeur egale tiennent dans la colonne d un ordinateur, plus
  // quand un panneau en prend 420 a droite (banc du 19/10 a 1 360 px : « Sécurité et … »). La
  // rangee garde alors la largeur de chaque nom et defile s il le faut, comme au telephone.
  const rangeeQuiDefile = canManage && (!isDesktop || Boolean(panneauRendu));

  const corps = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 2 }}>
        <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
          {t('collectiviteCreneaux.creneaux.surtitre', 'Installations de la Ville')}
        </Text>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>{nom}</Text>
        {metaLigne ? <Text style={[Fonts.p2, Fonts.neutral200]}>{metaLigne}</Text> : null}
      </View>

      <FacilityClosureBanner
        closures={bandeaux}
        facilityType={installation.type}
        testID="installation-bandeau-fermeture"
        withDays
      />

      {/* VILLE-T18A (T18 G28a) — 4 onglets (P4v3-fermer-ordi) : en défilement, « Infos » sortait
          de l écran (22 px visibles). Largeur égale, libellés d un mot rétrécis pour tenir.
          R17-SIGNALER-1 (P10-securite-tel, écran 1) : la Ville a un 5ᵉ onglet ; cinq ne
          tiennent pas sur 412 px, la rangée DÉFILE au téléphone et chaque nom reste entier. */}
      <SegmentedControl
        centerContent={!rangeeQuiDefile}
        fitLabels={!rangeeQuiDefile}
        fullLabels={rangeeQuiDefile}
        onChange={choisirOnglet}
        options={[
          { label: t('collectiviteCreneaux.creneaux.onglet', 'Créneaux'), value: ONGLETS.creneaux },
          {
            label: t('collectiviteCreneaux.creneaux.ongletPlanning', 'Planning'),
            value: ONGLETS.planning,
          },
          {
            label: t('collectiviteFermetures.liste.onglet', 'Fermetures'),
            value: ONGLETS.fermetures,
          },
          { label: t('collectiviteCreneaux.creneaux.ongletInfos', 'Infos'), value: ONGLETS.infos },
          ...(canManage ? [{
            accessibilityLabel: signalementsOuverts
              ? t('facilityReports.ville.ongletAvecCompte', {
                count: signalementsOuverts,
                ...SANS_ECHAPPEMENT,
              })
              : undefined,
            badge: signalementsOuverts,
            label: t('facilityReports.ville.onglet', 'Sécurité et suivi'),
            value: ONGLETS.securite,
          }] : []),
        ]}
        value={onglet}
      />

      {onglet === ONGLETS.securite && canManage ? (
        <FacilitySecurityTab
          facilityId={facilityId}
          onOpenClosures={() => choisirOnglet(ONGLETS.fermetures)}
          onOpenReport={isDesktop
            ? (/** @type {string} */ reportId) => setPanneau({ reportId, type: 'signalement' })
            : undefined}
          selectedReportId={panneau?.type === 'signalement' ? panneau.reportId : null}
        />
      ) : null}

      {onglet === ONGLETS.fermetures ? (
        <FacilityClosureList
          facilityId={facilityId}
          onBlock={() => ouvrirLaFermeture({ mode: 'bloquer' })}
          onClose={() => ouvrirLaFermeture({ mode: 'fermer' })}
          onModify={(fermeture) => ouvrirLaFermeture({ closureId: fermeture.documentId })}
        />
      ) : null}
      {onglet === ONGLETS.infos ? ongletInfos : null}
      {onglet === ONGLETS.creneaux ? (
        <View style={{ gap: 12 }}>
          {annees ? (
            <View style={[Alignments.row, Alignments.alignCenter, LIGNE_DE_SAISON]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('collectiviteCreneaux.creneaux.saison', 'Saison {{debut}}-{{fin}}', annees)}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t('collectiviteCreneaux.creneaux.du', 'du {{debut}} au {{fin}}', {
                  debut: jourCourt(meta.season.validFrom),
                  fin: jourCourt(meta.season.validUntil),
                  ...SANS_ECHAPPEMENT,
                })}
              </Text>
              {/* 🌴 R17-QUAND-2 (planche P11-quand-v2-ordi, A) : « vacances : Zone B ». */}
              {meta.holidays?.label ? (
                <Text style={[Fonts.p3, Fonts.neutral300]} testID="installation-zone-vacances">
                  {t('collectiviteCreneaux.creneaux.vacances', 'vacances : {{zone}}', {
                    zone: meta.holidays.label, ...SANS_ECHAPPEMENT,
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}
          {/* COLL-C2B-BIS : sur ordinateur aussi (la grille ne montre pas les heures repliees). */}
          {canManage && creneaux.length > 0 ? (
            // COLL-R-A6 (13/10, COL-004) : « + Attribuer un créneau », l'icône de la planche
            // validée P4v2-creneaux-tel (l.28), avant le texte.
            <Button
              icon="plus"
              iconPosition="before"
              onPress={() => attribuer()}
              title={t('collectiviteCreneaux.creneaux.attribuer', 'Attribuer un créneau')}
              variant="Primary"
            />
          ) : null}
          {ongletCreneaux}
          {creneauxRetires.length ? (
            <View style={{ gap: 8 }}>
              <Text
                accessibilityRole="header"
                style={[Fonts.p2Bold, Fonts.neutral300, Spaces.marginTop[8]]}
              >
                {t('collectiviteCreneaux.creneaux.retires', 'Créneaux retirés')}
              </Text>
              {creneauxRetires.map((/** @type {any} */ creneau) => (
                <CreneauRetire key={creneau.documentId} slot={creneau} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer bgImage="bg2" contentContainerStyle={[Alignments.fill]}>
      <View style={[Alignments.fill, { flexDirection: isDesktop ? 'row' : 'column', gap: 24 }]}>
        <ScrollView
          accessibilityElementsHidden={panneauMobileOuvert}
          contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingVertical[16]]}
          importantForAccessibility={panneauMobileOuvert ? 'no-hide-descendants' : 'auto'}
          pointerEvents={panneauMobileOuvert ? 'none' : 'auto'}
          refreshControl={(
            <RefreshControl
              colors={[Colors.primary500]}
              onRefresh={() => {
                actifs.refetch();
                if (canManage) retires.refetch();
              }}
              refreshing={Boolean(actifs.isRefetching)}
              tintColor={Colors.primary500}
            />
          )}
          style={{ flex: 1 }}
        >
          {corps}
        </ScrollView>
        {isDesktop && panneauRendu ? (
          <ScrollView
            contentContainerStyle={[Spaces.padding[16]]}
            style={{
              backgroundColor: withAlpha(Colors.primary800, 0.85),
              borderColor: withAlpha(Colors.neutral00, 0.1),
              borderRadius: 24,
              borderWidth: 1,
              flexGrow: 0,
              width: 420,
            }}
          >
            {panneauRendu}
          </ScrollView>
        ) : null}
      </View>
      {isDesktop ? null : (
        <BottomModal
          close={fermer}
          contentBottomPaddingOverride={16 + insets.bottom}
          contentContainerStyle={{ paddingTop: 24 }}
          isVisible={Boolean(panneauRendu)}
          // SAIS (T20 lot 1) : « Annuler » finissait coupé au bas de la feuille « Attribuer ».
          maxContentHeightRatio={HAUTEUR_DE_LA_FEUILLE}
        >
          <View>
            {panneauRendu}
          </View>
        </BottomModal>
      )}
      {enPleinEcran ? contenuDuPanneau : null}
    </ScreenContainer>
  );
}

export default InstallationCreneaux;
