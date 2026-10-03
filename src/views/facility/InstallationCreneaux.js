import { useNavigation, useRoute } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { formatOpeningHours } from '@/domains/collectivite/collectiviteDisplay';
import {
  formatDay,
  fromMinutes,
  fullRangesOfSlots,
  groupSlotsByWeekday,
  overCapacityPreviewOf,
  seasonSlotErrorMessage,
  seasonYears,
  slotWho,
  timeRange,
  toMinutes,
  weekdayName,
} from '@/domains/seasonSlot/seasonSlotDisplay';
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
import SeasonSlotForm from '@/components/organisms/seasonSlot/SeasonSlotForm';
import SeasonSlotManage from '@/components/organisms/seasonSlot/SeasonSlotManage';
import SeasonSlotWeekGrid from '@/components/organisms/seasonSlot/SeasonSlotWeekGrid';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteClubs,
  useCollectiviteInstallations,
} from '@/services/collectivite/collectiviteQueries';
import { useFacilityClosures } from '@/services/facilityClosure/facilityClosureQueries';
import {
  useFacilitySeasonSlots,
  useRestoreSeasonSlot,
} from '@/services/seasonSlot/seasonSlotQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { FACILITY_CONFLICT_MODES, getFacilityConflictMode } from '@/utils/facilityConflictMode';
import { getFacilityTypeLabel } from '@/utils/facilityTypes';

import { useIsDesktop } from '@/responsive';

/** Les trois onglets d une installation (design P4v2-creneaux). */
const LIGNE_D_INFO = /** @type {const} */ ({
  flexDirection: 'row', gap: 12, justifyContent: 'space-between',
});
const LIGNE_DE_SAISON = /** @type {const} */ ({ gap: 8, justifyContent: 'space-between' });
// COLL-C4B (02/10) : + « Fermetures » (design P4v3-fermer, ecran 6).
const ONGLETS = {
  creneaux: 'creneaux', fermetures: 'fermetures', infos: 'infos', planning: 'planning',
};

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
  const params = /** @type {any} */ (route.params) || {};
  const collectiviteId = params.collectiviteId || null;
  const facilityId = params.facilityId || null;

  // Design P4v2 : la page porte le nom de l installation ; l en-tete de navigation se tait.
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerTitle: '' });
  }, [navigation]);

  // COLL-C4B : l accueil de la Ville (« Fermeture a venir ») ouvre l onglet « Fermetures ».
  const [onglet, setOnglet] = useState(
    params.onglet === ONGLETS.fermetures ? ONGLETS.fermetures : ONGLETS.creneaux,
  );
  // Ce qui est ouvert : « attribuer » (avec un jour pre-rempli), « gerer » ou « modifier ».
  const [panneau, setPanneau] = useState(/** @type {any} */ (null));

  const installations = useCollectiviteInstallations(collectiviteId);
  const actifs = useFacilitySeasonSlots(facilityId, 'active');
  const meta = actifs.data?.meta || {};
  const canManage = meta.canManage === true;
  const retires = useFacilitySeasonSlots(facilityId, 'withdrawn', { enabled: canManage });
  const clubs = useCollectiviteClubs(canManage ? collectiviteId : null);
  // COLL-C4B (02/10) — le bandeau de la fiche, tant que la fermeture dure ou approche (P3b).
  const fermeturesDeLInstallation = useFacilityClosures(facilityId);
  const bandeau = fermeturesDeLInstallation.data?.meta?.bandeau || null;

  const ligne = (Array.isArray(installations.data) ? installations.data : [])
    .find((installation) => installation?.documentId === facilityId) || null;
  const installation = { ...(meta.facility || {}), ...(ligne || {}) };
  const nom = installation.name || meta.facility?.name || '';
  const capacite = Math.max(1, Number(installation.maxSlots) || 1);
  const creneaux = Array.isArray(actifs.data?.data) ? actifs.data.data : [];
  const creneauxRetires = canManage && Array.isArray(retires.data?.data) ? retires.data.data : [];
  const clubsRattaches = (Array.isArray(clubs.data) ? clubs.data : [])
    .filter((club) => club?.documentId && club?.name)
    .map((club) => ({ documentId: club.documentId, name: club.name }));
  const annees = seasonYears(meta.season);

  const fermer = () => setPanneau(null);
  const ouvrirLePlanning = () => {
    navigation.navigate(RouteNames.PlanningWeekFullscreen, {
      contextDetailLabel: nom || null,
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
    meta.season && (creneau.validFrom !== meta.season.validFrom
      || creneau.validUntil !== meta.season.validUntil)
      ? t('collectiviteCreneaux.creneaux.du', 'du {{debut}} au {{fin}}', {
        debut: jourCourt(creneau.validFrom),
        fin: jourCourt(creneau.validUntil),
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
          borderLeftColor: Colors.primary500,
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
            'Un créneau attribué revient chaque semaine de la saison : le club y pose ses '
              + 'entraînements sans rien vous demander.',
          )}
          onAction={canManage ? () => attribuer() : undefined}
          title={t('collectiviteCreneaux.creneaux.vide', 'Aucun créneau attribué')}
        />
      );
    }
    const parJour = groupSlotsByWeekday(creneaux);
    if (isDesktop) {
      // Ordinateur (P4v2-ordi, etat A) : la semaine type A L ECHELLE DES HEURES. Un bloc se gere ;
      // une case vide ouvre « Attribuer », deja rempli du jour et de l heure (COLL-C2B-BIS).
      return (
        <SeasonSlotWeekGrid
          capacite={capacite}
          creneaux={creneaux}
          fermeture={toMinutes(installation.closingTime)}
          onAttribuer={canManage ? attribuerALHeure : undefined}
          onCreneau={(creneau) => setPanneau({ creneau, type: 'gerer' })}
          ouverture={toMinutes(installation.openingTime)}
        />
      );
    }
    return (
      <View style={{ gap: 8 }}>
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
  let titreDuPanneau = null;
  let contenuDuPanneau = null;
  if (panneau?.type === 'attribuer') {
    titreDuPanneau = t('collectiviteCreneaux.creneaux.attribuer', 'Attribuer un créneau');
    contenuDuPanneau = (
      <SeasonSlotForm
        clubs={clubsRattaches}
        facilityId={facilityId}
        initial={panneau.initial}
        key={`attribuer-${panneau.initial?.weekday || 0}-${panneau.initial?.startTime || ''}`}
        onCancel={fermer}
        onDone={fermer}
      />
    );
  } else if (panneau?.type === 'modifier') {
    titreDuPanneau = t('collectiviteCreneaux.gerer.modifier', 'Modifier le créneau');
    contenuDuPanneau = (
      <SeasonSlotForm
        clubs={clubsRattaches}
        facilityId={facilityId}
        key={`modifier-${panneau.creneau.documentId}`}
        onCancel={fermer}
        onDone={fermer}
        slot={panneau.creneau}
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
  const panneauRendu = contenuDuPanneau ? (
    <View style={{ gap: 12 }}>
      {titreDuPanneau ? (
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {titreDuPanneau}
        </Text>
      ) : null}
      {contenuDuPanneau}
    </View>
  ) : null;

  const corps = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 2 }}>
        <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
          {t('collectiviteCreneaux.creneaux.surtitre', 'Installations de la Ville')}
        </Text>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>{nom}</Text>
        {metaLigne ? <Text style={[Fonts.p2, Fonts.neutral200]}>{metaLigne}</Text> : null}
      </View>

      <FacilityClosureBanner closure={bandeau} testID="installation-bandeau-fermeture" withDays />

      <SegmentedControl
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
        ]}
        value={onglet}
      />

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
            </View>
          ) : null}
          {/* COLL-C2B-BIS : sur ordinateur aussi (la grille ne montre pas les heures repliees). */}
          {canManage && creneaux.length > 0 ? (
            <Button
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
          contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingVertical[16]]}
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
        <BottomModal close={fermer} isVisible={Boolean(panneauRendu)}>
          <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16]]}>
            {panneauRendu}
          </View>
        </BottomModal>
      )}
    </ScreenContainer>
  );
}

export default InstallationCreneaux;
