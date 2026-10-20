import { useNavigation } from '@react-navigation/native';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  startOfWeek,
} from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  closureBandLabel,
  closureHoursLabel,
} from '@/domains/facilityClosure/facilityClosureDisplay';
import { capitalize } from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';
import PlanningCalendarView from '@/components/organisms/planningCalendarView';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView';

import { RouteNames } from '@/navigation/routeNames';

import { useCollectiviteClubs } from '@/services/collectivite/collectiviteQueries';
import { getFacilityPlanning } from '@/services/facility/facilityService';
import { listCollectiviteClosures } from '@/services/facilityClosure/facilityClosureService';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  pageDAujourdhui,
  pageSuivante,
  plageDeLaVue,
  vueParDefaut,
  VUES,
} from '@/utils/planning/installationPlanningViews';
import {
  getPlanningDefaultDate,
  getPlanningItemDate,
  getPlanningTimeLabel,
} from '@/utils/planning/planningSlots';
import {
  blocsDeLaVille,
  blocsDuMois,
  fermeturesDuJour,
  grilleDeLaSemaine,
  journeeParInstallation,
  listeDeLaSemaine,
  prochainBloc,
} from '@/utils/planning/planningToutesInstallations';

import useVueInitiale from '@/hooks/useVueInitiale';
import { useIsDesktop } from '@/responsive';

/**
 * 🏟️ R17-PLANNING (20/10/2026, REC17-005 lot 1) — « PLANNING DE TOUTES LES INSTALLATIONS », sous
 * les cartes de la Ville (planches P10-planning-ordi et P10-planning-tel, validées le 19/10).
 *
 * Vues Jour · Semaine · Mois. Ordinateur : la semaine en grille (une rangée par installation, une
 * colonne par jour), le jour en colonnes (une par installation), le mois. Téléphone : le jour
 * rangé par installation, la semaine en liste jour par jour, le mois. Une couleur PAR CLUB
 * (COL-019) ; au mois, celle de l'installation. Toucher un bloc ouvre le planning de son
 * installation à ce jour (ce qu'ouvre déjà le planning d'une installation) ; toucher le nom d'une
 * installation ouvre sa fiche.
 *
 * Lecture : une `GET /facilities/:id/planning` par installation (31 jours au plus), sous la clé
 * du planning d'une installation : la semaine en cours est déjà lue pour les cartes. À l'arrivée,
 * la règle R17-VUE (`useVueInitiale`) choisit la vue.
 */

/** Une rangée : le texte à gauche, l'action à droite. */
const ENTRE = /** @type {const} */ ({
  alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between',
});

/** Une case de la grille (un jour d'une installation). */
const caseDuJour = {
  borderLeftWidth: 1, flex: 1, gap: 4, minHeight: 64, padding: 4,
};

/** Les trois vues de la section (Liste et 3 jours restent au planning d'une installation). */
const VUES_DE_LA_SECTION = [VUES.jour, VUES.semaine, VUES.mois];

/**
 * La locale date-fns de la langue de l'app.
 * @returns {import('date-fns').Locale} fr ou en-GB.
 */
const localeDesDates = () => (localeDesFormats() === 'en-GB' ? enGB : fr);

/**
 * Le planning de toutes les installations de la Ville.
 * @param {{
 *   collectiviteId: string,
 *   installations: any[],
 *   onOuvrirInstallation: (installation: any) => void,
 * }} props - La Ville, ses installations (dans l'ordre des cartes), et l'ouverture d'une fiche.
 * @returns {import('react').ReactElement} La section.
 */
function PlanningDesInstallations({ collectiviteId, installations, onOuvrirInstallation }) {
  const navigation = /** @type {any} */ (useNavigation());
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const isDesktop = useIsDesktop();
  const locale = localeDesDates();
  const vueDeBase = vueParDefaut(Platform.OS);
  const [vue, setVue] = useState(vueDeBase);
  const [date, setDate] = useState(getPlanningDefaultDate);
  const aujourdhui = getPlanningDefaultDate();

  const plage = plageDeLaVue(vue, date);
  const lectures = useQueries({
    queries: installations.map((/** @type {any} */ installation) => ({
      placeholderData: keepPreviousData,
      queryFn: () => getFacilityPlanning(installation.documentId, plage),
      queryKey: [
        'planning', 'fullscreen', 'facility', installation.documentId, plage.from, plage.to,
      ],
      staleTime: 60 * 1000,
    })),
  });
  const clubs = useCollectiviteClubs(collectiviteId);
  const blocs = blocsDeLaVille(
    lectures.map((lecture) => /** @type {any} */ (lecture.data)),
    installations,
    Array.isArray(clubs.data) ? clubs.data : null,
  );
  // R17-PLANNING-2 (20/10) : UNE lecture des fermetures de la Ville, à partir du début de la
  // période affichée (planche : « Fermé · désinfection » dans la case). Une panne n'en dit rien :
  // le planning reste.
  const fermeturesLues = useQuery({
    enabled: Boolean(collectiviteId),
    placeholderData: keepPreviousData,
    queryFn: () => listCollectiviteClosures(String(collectiviteId), { from: plage.from }),
    queryKey: ['facility-closures', 'collectivite', collectiviteId, plage.from],
    staleTime: 15 * 1000,
  });
  const fermetures = Array.isArray(fermeturesLues.data?.data) ? fermeturesLues.data.data : [];
  const enErreur = lectures.some((lecture) => lecture.isError);
  const toutesRevenues = lectures.every((lecture) => lecture.data !== undefined);
  const provisoire = lectures.some((lecture) => lecture.isPlaceholderData);

  // R17-VUE : à l'arrivée, la vue de base vide ⇒ la semaine, puis le mois du prochain bloc (une
  // lecture bornée de 31 jours, installation par installation).
  const lectureDeLaSuite = useMemo(() => ({
    queryFn: async (/** @type {{ from: string, to: string }} */ plageSuite) => {
      const reponses = await Promise.all(installations.map((/** @type {any} */ installation) => (
        getFacilityPlanning(installation.documentId, plageSuite))));
      return { data: reponses.flatMap((/** @type {any} */ reponse) => reponse?.data || []) };
    },
    queryKey: [
      'planning', 'toutes-installations', collectiviteId,
      ...installations.map((/** @type {any} */ installation) => installation.documentId),
    ],
  }), [collectiviteId, installations]);
  const appliquerLaVue = useCallback((/** @type {{ date: Date, vue: string }} */ decision) => {
    if (decision.vue === vueDeBase) return;
    setVue(decision.vue);
    setDate(decision.date);
  }, [vueDeBase]);
  const { enDecision, garderLeChoix } = useVueInitiale({
    actif: installations.length > 0 && !enErreur,
    appliquer: appliquerLaVue,
    evenements: toutesRevenues && !provisoire ? blocs : undefined,
    lectureDeLaSuite,
    vueDeBase,
  });
  const choisirVue = (/** @type {string} */ nouvelle) => {
    garderLeChoix();
    setVue(nouvelle);
  };
  const allerA = (/** @type {Date} */ jour) => {
    garderLeChoix();
    setDate(jour);
  };

  const ouvrirBloc = useCallback((/** @type {any} */ bloc) => {
    const installation = bloc?.installation;
    if (!installation?.documentId) return;
    const jour = getPlanningItemDate(bloc);
    navigation.navigate(RouteNames.PlanningWeekFullscreen, {
      contextDetailLabel: installation.name || null,
      ...(jour ? { date: jour.toISOString() } : {}),
      espace: 'ville',
      facilityId: installation.documentId,
      sourceType: 'facility',
    });
  }, [navigation]);

  const debutDeSemaine = startOfWeek(date, { weekStartsOn: 1 });
  const finDeSemaine = addDays(debutDeSemaine, 6);
  const formatDuDebut = isSameMonth(debutDeSemaine, finDeSemaine) ? 'd' : 'd MMM';
  const semaineCourte = `${format(debutDeSemaine, formatDuDebut, { locale })} – ${
    format(finDeSemaine, 'd MMM', { locale })}`;
  let titreDeLaPage = capitalize(format(date, 'EEEE d MMMM', { locale }));
  if (vue === VUES.semaine) titreDeLaPage = semaineCourte;
  if (vue === VUES.mois) titreDeLaPage = capitalize(format(date, 'MMMM yyyy', { locale }));
  /** @type {Record<string, string[]>} */
  const nomsDesFleches = {
    [VUES.jour]: [
      t('personalPlanningWeekFullscreen.previousDay', 'Jour précédent'),
      t('personalPlanningWeekFullscreen.nextDay', 'Jour suivant'),
    ],
    [VUES.mois]: [
      t('collectiviteCreneaux.vues.moisPrecedent', 'Mois précédent'),
      t('collectiviteCreneaux.vues.moisSuivant', 'Mois suivant'),
    ],
    [VUES.semaine]: [
      t('personalPlanningWeekFullscreen.previousWeek', 'Semaine précédente'),
      t('personalPlanningWeekFullscreen.nextWeek', 'Semaine suivante'),
    ],
  };
  /** @type {Record<string, string>} */
  const libellesDesVues = {
    [VUES.jour]: t('collectiviteCreneaux.vues.jour', 'Jour'),
    [VUES.mois]: t('collectiviteCreneaux.vues.mois', 'Mois'),
    [VUES.semaine]: t('collectiviteCreneaux.vues.semaine', 'Semaine'),
  };
  const fond = withAlpha(Colors.primary500, 0.06);
  const trait = withAlpha(Colors.primary500, 0.18);
  const encadre = {
    backgroundColor: fond,
    borderColor: trait,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  };
  const boutonFleche = {
    alignItems: /** @type {const} */ ('center'),
    borderColor: trait,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: /** @type {const} */ ('center'),
    width: 44,
  };

  /**
   * Ce que dit un bloc au lecteur d'écran.
   * @param {any} bloc - Le bloc.
   * @returns {string} « Club · équipe, lundi 19, 18:00 – 19:30, Gymnase ».
   */
  const nomDuBloc = (bloc) => {
    const jour = getPlanningItemDate(bloc);
    return t('facilityList.toutesInstallations.bloc', '{{titre}}, {{quand}}, {{installation}}', {
      ...SANS_ECHAPPEMENT,
      installation: bloc.installation?.name || '',
      quand: [jour ? format(jour, 'EEEE d', { locale }) : '', getPlanningTimeLabel(bloc)]
        .filter(Boolean).join(', '),
      titre: bloc.title || '',
    });
  };

  /**
   * Un bloc de la grille (ordinateur) : l'heure, puis « club · équipe ».
   * @param {any} bloc - Le bloc.
   * @returns {import('react').ReactElement} Le bouton.
   */
  const caseDeLaGrille = (bloc) => (
    <TouchableOpacity
      accessibilityLabel={nomDuBloc(bloc)}
      accessibilityRole="button"
      key={`${bloc.installation?.documentId}-${bloc.startAt}-${bloc.title}`}
      onPress={() => ouvrirBloc(bloc)}
      style={{
        backgroundColor: withAlpha(bloc.displayColor || Colors.primary500, 0.18),
        borderLeftColor: bloc.displayColor || Colors.primary500,
        borderLeftWidth: 3,
        borderRadius: 8,
        minHeight: 44,
        paddingHorizontal: 6,
        paddingVertical: 4,
      }}
      testID="toutes-bloc"
    >
      <Text
        numberOfLines={1}
        style={[Fonts.p4, bloc.complet ? Fonts.warning500 : Fonts.neutral200]}
      >
        {bloc.complet
          ? t('facilityList.toutesInstallations.complet', '{{heures}} · complet', {
            ...SANS_ECHAPPEMENT,
            heures: getPlanningTimeLabel(bloc),
          })
          : getPlanningTimeLabel(bloc)}
      </Text>
      <Text numberOfLines={2} style={[Fonts.p3Bold, Fonts.neutral00]}>{bloc.title}</Text>
    </TouchableOpacity>
  );

  /**
   * R17-PLANNING-2 — une fermeture dans une case (planche : « Fermé · désinfection »), et ses
   * heures si elle ne prend pas toute la journée.
   * @param {any} fermeture - La fermeture.
   * @returns {import('react').ReactElement} La plage.
   */
  const plageFermee = (fermeture) => (
    <View
      key={`fermeture-${fermeture.documentId || fermeture.startDate}`}
      style={{
        backgroundColor: withAlpha(Colors.warning500, 0.12),
        borderColor: withAlpha(Colors.warning500, 0.45),
        borderRadius: 8,
        borderStyle: 'dashed',
        borderWidth: 1,
        gap: 2,
        paddingHorizontal: 6,
        paddingVertical: 4,
      }}
      testID="toutes-fermeture"
    >
      <Text numberOfLines={2} style={[Fonts.p3Bold, Fonts.warning500]}>
        {closureBandLabel(t, fermeture)}
      </Text>
      <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral200]}>
        {closureHoursLabel(t, fermeture)}
      </Text>
    </View>
  );

  /**
   * Une ligne de liste (téléphone) : l'heure à gauche, « club · équipe » et, si demandé, le nom
   * de l'installation.
   * @param {any} bloc - Le bloc.
   * @param {boolean} avecInstallation - La ligne dit son installation (semaine).
   * @returns {import('react').ReactElement} La ligne.
   */
  const ligneDeListe = (bloc, avecInstallation) => (
    <TouchableOpacity
      accessibilityLabel={nomDuBloc(bloc)}
      accessibilityRole="button"
      key={`${bloc.installation?.documentId}-${bloc.startAt}-${bloc.title}`}
      onPress={() => ouvrirBloc(bloc)}
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(bloc.displayColor || Colors.primary500, 0.14),
        borderLeftColor: bloc.displayColor || Colors.primary500,
        borderLeftWidth: 3,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 12,
        minHeight: 52,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
      testID="toutes-ligne"
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { minWidth: 46 }]}>
        {getPlanningTimeLabel(bloc).split(' – ')[0]}
      </Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{bloc.title}</Text>
        <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>
          {avecInstallation ? bloc.installation?.name : getPlanningTimeLabel(bloc)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // La légende des clubs (semaine, jour) : une couleur par club, celle de COL-019.
  /** @type {Map<string, { couleur: string, nom: string }>} */
  const clubsVus = new Map();
  blocs.forEach((/** @type {any} */ bloc) => {
    const cle = String(bloc.club?.documentId || bloc.club?.name || '');
    if (cle && !clubsVus.has(cle)) {
      clubsVus.set(cle, {
        couleur: bloc.displayColor || Colors.primary500,
        nom: bloc.club?.name || '',
      });
    }
  });
  /** @type {Array<{ couleur: string, nom: string }>} */
  const legende = vue === VUES.mois
    ? installations.map((/** @type {any} */ installation) => ({
      couleur: resolveFacilityPlanningColor(installation) || Colors.primary500,
      nom: installation.name,
    }))
    : [...clubsVus.values()];
  // R17-PLANNING-2 : la légende dit la plage hachurée orange quand une fermeture est affichée.
  const debutDeLaPeriode = vue === VUES.jour ? date : startOfWeek(date, { weekStartsOn: 1 });
  const joursDeLaPeriode = vue === VUES.jour ? 1 : 7;
  const fermetureAffichee = vue !== VUES.mois && installations.some((/** @type {any} */ i) => (
    [...Array(joursDeLaPeriode).keys()].some((decalage) => (
      fermeturesDuJour(fermetures, i, addDays(debutDeLaPeriode, decalage)).length > 0))
  ));
  if (fermetureAffichee) {
    legende.push({
      couleur: Colors.warning500,
      nom: t('facilityList.toutesInstallations.legendeFermeture', 'Fermeture'),
    });
  }

  /**
   * Le corps de la section selon la vue et l'écran.
   * @returns {import('react').ReactElement} Le corps.
   */
  const corps = () => {
    if (enErreur) {
      return (
        <View
          style={{
            backgroundColor: withAlpha(Colors.warning500, 0.1),
            borderColor: withAlpha(Colors.warning500, 0.4),
            borderRadius: 16,
            borderWidth: 1,
            gap: 6,
            padding: 16,
          }}
          testID="toutes-erreur"
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'facilityList.toutesInstallations.erreurTitre',
              'Le planning n’a pas pu être chargé.',
            )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'facilityList.toutesInstallations.erreurTexte',
              'Vérifiez la connexion. Les installations restent accessibles au-dessus.',
            )}
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              onPress={() => lectures.forEach((lecture) => lecture.refetch())}
              title={t('common.retry', 'Réessayer')}
              variant="Secondary"
            />
          </View>
        </View>
      );
    }
    if (!toutesRevenues || enDecision) {
      return (
        <View accessibilityState={{ busy: true }} testID="toutes-chargement">
          <SkeletonLoader
            backgroundColor={Colors.primary200}
            highlightColor={Colors.neutral200}
            isActive
          >
            <View style={{ gap: 8 }}>
              {[36, 72, 72, 72].map((hauteur, rang) => (
                <View
                  key={`squelette-${rang + 1}`}
                  style={{ backgroundColor: Colors.primary200, borderRadius: 12, height: hauteur }}
                />
              ))}
            </View>
          </SkeletonLoader>
        </View>
      );
    }

    if (vue === VUES.mois) {
      return (
        <PlanningCalendarView
          currentDate={date}
          events={blocsDuMois(blocs)}
          onDateSelect={(/** @type {Date} */ jour) => {
            // Le calendrier dit aussi ses changements de MOIS (ses flèches) par ici : seul un jour
            // du mois affiché, sur ordinateur, ouvre la vue Jour à cette date (planche, état 3).
            const unJourDuMois = isSameMonth(jour, date);
            allerA(jour);
            if (isDesktop && unJourDuMois) setVue(VUES.jour);
          }}
          onEventPress={ouvrirBloc}
        />
      );
    }

    if (vue === VUES.semaine) {
      const blocsDeLaSemaine = blocs.filter((/** @type {any} */ bloc) => {
        const jour = getPlanningItemDate(bloc);
        return Boolean(jour) && /** @type {Date} */ (jour) >= debutDeSemaine
          && /** @type {Date} */ (jour) < addDays(debutDeSemaine, 7);
      });
      const vide = blocsDeLaSemaine.length === 0 ? (
        <View
          style={encadre}
          testID="toutes-vide"
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'facilityList.toutesInstallations.videSemaine',
              'Aucune séance du {{debut}} au {{fin}}.',
              {
                ...SANS_ECHAPPEMENT,
                debut: format(debutDeSemaine, 'd MMM', { locale }),
                // « 25 oct. » finit déjà par un point : la phrase ne le double pas.
                fin: format(finDeSemaine, 'd MMM', { locale }).replace(/\.$/, ''),
              },
            )}
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              onPress={() => allerA(addDays(date, 7))}
              title={t(
                'facilityList.toutesInstallations.semaineSuivante',
                'Voir la semaine suivante',
              )}
              variant="Secondary"
            />
          </View>
        </View>
      ) : null;
      if (!isDesktop) {
        return (
          <View style={{ gap: 8 }}>
            {vide}
            {listeDeLaSemaine(blocs, debutDeSemaine).map((ligne) => (
              <View key={ligne.jour.toISOString()} style={{ gap: 8 }}>
                <Text style={[Fonts.p2Bold, Fonts.primary200, { marginTop: 8 }]}>
                  {isSameDay(ligne.jour, aujourdhui)
                    ? t('facilityList.toutesInstallations.aujourdhui', '{{jour}} · aujourd’hui', {
                      ...SANS_ECHAPPEMENT,
                      jour: capitalize(format(ligne.jour, 'EEEE d', { locale })),
                    })
                    : capitalize(format(ligne.jour, 'EEEE d', { locale }))}
                </Text>
                {ligne.blocs.map((/** @type {any} */ bloc) => ligneDeListe(bloc, true))}
              </View>
            ))}
          </View>
        );
      }
      const jours = [0, 1, 2, 3, 4, 5, 6].map((decalage) => addDays(debutDeSemaine, decalage));
      return (
        <View style={{ gap: 12 }}>
          {vide}
          <View
            accessibilityLabel={t(
              'facilityList.toutesInstallations.grille',
              'Planning de toutes les installations, semaine du {{debut}} au {{fin}}',
              {
                ...SANS_ECHAPPEMENT,
                debut: format(debutDeSemaine, 'd MMMM', { locale }),
                fin: format(finDeSemaine, 'd MMMM', { locale }),
              },
            )}
            style={{
              borderColor: trait, borderRadius: 16, borderWidth: 1, overflow: 'hidden',
            }}
            testID="toutes-grille"
          >
            <View style={{ backgroundColor: fond, flexDirection: 'row' }}>
              <View style={{ width: 190 }} />
              {jours.map((jour) => (
                <View
                  key={jour.toISOString()}
                  style={{
                    borderLeftColor: trait, borderLeftWidth: 1, flex: 1, padding: 8,
                  }}
                >
                  <Text
                    style={[
                      Fonts.p3,
                      isSameDay(jour, aujourdhui) ? Fonts.primary200 : Fonts.neutral200,
                      Fonts.textCenter,
                    ]}
                  >
                    {`${format(jour, 'EEE', { locale })} `}
                    <Text
                      style={[
                        Fonts.p2Bold,
                        isSameDay(jour, aujourdhui) ? Fonts.primary200 : Fonts.neutral00,
                      ]}
                    >
                      {format(jour, 'd', { locale })}
                    </Text>
                  </Text>
                </View>
              ))}
            </View>
            {grilleDeLaSemaine(blocs, installations, debutDeSemaine).map((rangee) => (
              <View
                key={rangee.installation.documentId}
                style={{ borderTopColor: trait, borderTopWidth: 1, flexDirection: 'row' }}
                testID={`toutes-rangee-${rangee.installation.documentId}`}
              >
                <TouchableOpacity
                  accessibilityLabel={t(
                    'facilityList.toutesInstallations.ouvrirInstallation',
                    'Ouvrir {{installation}}',
                    {
                      ...SANS_ECHAPPEMENT,
                      installation: rangee.installation.name,
                    },
                  )}
                  accessibilityRole="link"
                  onPress={() => onOuvrirInstallation(rangee.installation)}
                  style={{
                    gap: 2, minHeight: 44, padding: 10, width: 190,
                  }}
                >
                  <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {rangee.installation.name}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.neutral300]}>
                    {t('collectiviteCreneaux.liste.capacite', {
                      count: Math.max(1, Number(rangee.installation.maxSlots || 1)),
                      defaultValue_one: '{{count}} équipe à la fois',
                      defaultValue_other: '{{count}} équipes à la fois',
                    })}
                  </Text>
                </TouchableOpacity>
                {rangee.jours.map((blocsDuJour, rang) => (
                  <View
                    key={jours[rang].toISOString()}
                    style={[caseDuJour, { borderLeftColor: trait }]}
                  >
                    {fermeturesDuJour(fermetures, rangee.installation, jours[rang])
                      .map(plageFermee)}
                    {blocsDuJour.map(caseDeLaGrille)}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    }

    // Jour.
    const journee = journeeParInstallation(blocs, installations, date);
    if (isDesktop) {
      return (
        <PlanningWeekTimelineView
          cardDisplayProfile="clubFocused"
          currentDate={date}
          events={journee.flatMap((ligne) => ligne.blocs)}
          expandToContent
          laneOf={(/** @type {any} */ bloc) => Math.max(0, installations.findIndex(
            (/** @type {any} */ i) => i.documentId === bloc.installation?.documentId,
          ))}
          lanes={installations.map((/** @type {any} */ installation) => ({
            key: installation.documentId,
            label: installation.name,
          }))}
          mode="day"
          onDateChange={allerA}
          onEventPress={ouvrirBloc}
          onReadOnlyEventPress={ouvrirBloc}
          scrollEnabled={false}
          showHeader={false}
          showUntimedSection={false}
        />
      );
    }
    if (journee.every((ligne) => (
      ligne.blocs.length === 0
      && fermeturesDuJour(fermetures, ligne.installation, date).length === 0
    ))) {
      const suivant = prochainBloc(blocs, date);
      const jourSuivant = suivant ? getPlanningItemDate(suivant) : null;
      return (
        <View
          style={encadre}
          testID="toutes-vide"
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('facilityList.toutesInstallations.rienCeJour', 'Rien ce {{jour}}', {
              ...SANS_ECHAPPEMENT,
              jour: format(date, 'EEEE', { locale }),
            })}
          </Text>
          {suivant && jourSuivant ? (
            <>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'facilityList.toutesInstallations.prochaine',
                  'Prochaine séance : {{quand}}, {{installation}}.',
                  {
                    ...SANS_ECHAPPEMENT,
                    installation: suivant.installation?.name || '',
                    quand: `${format(jourSuivant, 'EEEE d', { locale })}, ${
                      getPlanningTimeLabel(suivant).split(' – ')[0]}`,
                  },
                )}
              </Text>
              <View style={{ alignSelf: 'flex-start' }}>
                <Button
                  onPress={() => allerA(jourSuivant)}
                  title={t('facilityList.toutesInstallations.allerAu', 'Aller au {{jour}}', {
                    ...SANS_ECHAPPEMENT,
                    jour: format(jourSuivant, 'EEEE d', { locale }),
                  })}
                  variant="Secondary"
                />
              </View>
            </>
          ) : null}
        </View>
      );
    }
    return (
      <View style={{ gap: 8 }}>
        {journee.map((ligne) => (
          <View key={ligne.installation.documentId} style={{ gap: 8 }}>
            <View style={ENTRE}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                {ligne.installation.name}
              </Text>
              <TouchableOpacity
                accessibilityLabel={t(
                  'facilityList.toutesInstallations.ouvrirInstallation',
                  'Ouvrir {{installation}}',
                  {
                    ...SANS_ECHAPPEMENT,
                    installation: ligne.installation.name,
                  },
                )}
                accessibilityRole="link"
                hitSlop={8}
                onPress={() => onOuvrirInstallation(ligne.installation)}
                style={{ justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 }}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                  {t('facilityList.toutesInstallations.ouvrir', 'Ouvrir')}
                </Text>
              </TouchableOpacity>
            </View>
            {fermeturesDuJour(fermetures, ligne.installation, date).map(plageFermee)}
            {ligne.blocs.length
              ? ligne.blocs.map((/** @type {any} */ bloc) => ligneDeListe(bloc, false))
              : fermeturesDuJour(fermetures, ligne.installation, date).length === 0 && (
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t('facilityList.toutesInstallations.rienCeJourCourt', 'Rien ce jour')}
                </Text>
              )}
          </View>
        ))}
      </View>
    );
  };

  const [flecheGauche, flecheDroite] = nomsDesFleches[vue];
  return (
    <View style={[Spaces.marginTop[24], { gap: 12 }]} testID="planning-toutes-installations">
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('facilityList.toutesInstallations.titre', 'Planning de toutes les installations')}
        </Text>
        {isDesktop && vue === VUES.semaine ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'facilityList.toutesInstallations.sousTitre',
              'Séances des clubs, semaine du {{jour}}.',
              {
                ...SANS_ECHAPPEMENT,
                jour: format(debutDeSemaine, 'd MMMM', { locale }),
              },
            )}
          </Text>
        ) : null}
        {/* R17-EVT-1 : « Ajouter un événement de la Ville » se pose ici, à droite du titre. */}
      </View>
      <View
        style={{
          alignItems: 'center',
          flexDirection: isDesktop ? 'row' : 'column-reverse',
          gap: 8,
          justifyContent: 'space-between',
        }}
      >
        {/* Au mois, le calendrier a son en-tête (mois, flèches, aujourd’hui) : rien à doubler. */}
        {vue === VUES.mois ? <View /> : (
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              accessibilityLabel={flecheGauche}
              accessibilityRole="button"
              onPress={() => allerA(pageSuivante(vue, date, -1))}
              style={boutonFleche}
            >
              <Text style={[Fonts.p1Bold, Fonts.primary200]}>‹</Text>
            </TouchableOpacity>
            <Text
              style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter, { minWidth: 160 }]}
              testID="toutes-periode"
            >
              {titreDeLaPage}
            </Text>
            <TouchableOpacity
              accessibilityLabel={flecheDroite}
              accessibilityRole="button"
              onPress={() => allerA(pageSuivante(vue, date, 1))}
              style={boutonFleche}
            >
              <Text style={[Fonts.p1Bold, Fonts.primary200]}>›</Text>
            </TouchableOpacity>
            {!pageDAujourdhui(vue, date, aujourdhui) ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => allerA(getPlanningDefaultDate())}
                style={{ justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 }}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                  {t('personalPlanningWeekFullscreen.today', 'Aujourd’hui')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        <View
          accessibilityLabel={t('facilityList.toutesInstallations.vue', 'Vue du planning')}
          style={{ flexDirection: 'row', gap: 6, width: isDesktop ? 300 : '100%' }}
        >
          {VUES_DE_LA_SECTION.map((option) => {
            const active = option === vue;
            return (
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={option}
                onPress={() => choisirVue(option)}
                style={{
                  alignItems: 'center',
                  backgroundColor: active ? withAlpha(Colors.primary500, 0.18) : 'transparent',
                  borderColor: active ? Colors.primary500 : withAlpha(Colors.neutral00, 0.12),
                  borderRadius: 10,
                  borderWidth: 1,
                  flex: 1,
                  justifyContent: 'center',
                  minHeight: 44,
                }}
                testID={`toutes-vue-${option}`}
              >
                <Text
                  numberOfLines={1}
                  style={[Fonts.p3Bold, active ? Fonts.primary200 : Fonts.neutral200]}
                >
                  {libellesDesVues[option]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {corps()}
      {!enErreur && toutesRevenues && !enDecision && legende.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} testID="toutes-legende">
          {legende.map((entree) => (
            <View key={entree.nom} style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
              <View style={{
                backgroundColor: entree.couleur, borderRadius: 5, height: 10, width: 10,
              }}
              />
              <Text style={[Fonts.p3, Fonts.neutral200]}>{entree.nom}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default PlanningDesInstallations;
