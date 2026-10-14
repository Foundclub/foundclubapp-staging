import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  aujourdhuiAParis,
  enJours,
  finsPossibles,
  jourCourt,
  joursDeLaSemaine,
  libelleDuCreneau,
  messageDeRefusResa,
  plageHoraire,
  semaineLisible,
  titreDuJour,
} from '@/domains/complexe/complexeReservation';
import { texteHeure } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  ETATS_DU_CRENEAU,
  libelleDeLEtat,
  styleDuCreneau,
} from '@/views/complexe/components/allureDuCreneau';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import GrillePlanning from '@/views/complexe/components/GrillePlanning';

import { RouteNames } from '@/navigation/routeNames';

import {
  useBloquerCreneau,
  useComplexeChoisi,
  useNoterExterieur,
  usePlanning,
  useRouvrirFermetures,
  useTerrains,
} from '@/services/complexe/complexeQueries';

import { getServerErrorCode } from '@/utils/errors/displayError';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';

import { useIsDesktop } from '@/responsive';

/** @typedef {'jour' | 'liste' | 'semaine'} VueDuPlanning */
/** @typedef {import('@/views/complexe/components/GrillePlanning').CreneauDuPlanning} Creneau */

/**
 * E-G03 — LE PLANNING — RESA-L5A2 (14/10/2026), planche EG03 : l'onglet « Planning » de l'espace du
 * complexe. En-tête, sélecteur de terrain (« Tous les terrains » / un terrain), vues Jour ·
 * Semaine · Liste, barre de date (« ‹ Vendredi 16 octobre › » + « Aujourd'hui »), la grille (une
 * colonne par terrain le jour, un terrain sur 7 colonnes la semaine), la légende des 6 états.
 *   · case libre : la feuille « Ce créneau » — « Réservé à l'extérieur » (un nom libre, A-G17) ou
 *     « Bloquer ce créneau » (motif facultatif) ; appui long : « Bloquer à partir d'ici », l'heure
 *     de fin, un créneau réservé dans la plage est GARDÉ (le serveur ne le bloque pas) ;
 *   · réservation (app, extérieure, demande) : sa fiche (E-G05) ;
 *   · bloqué : « Débloquer » (la fermeture est rouverte, un état) ; fermé : le motif.
 * Téléphone : vue Jour d'abord ; site (≥ 1024 px) : vue Semaine d'abord (rubrique 9).
 * Pas fait (dit dans le compte rendu du lot) : le GLISSER sur plusieurs cases (nouveau dans l'app ;
 * l'appui long le remplace), la mémoire de la vue par appareil, la feuille en panneau à droite sur
 * ordinateur (une fenêtre centrée à la place).
 * Paramètres de route : `complexeId`, `date` (« AAAA-MM-JJ »), `terrainId`. Caché par
 * `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexePlanning() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @typedef {{ complexeId?: string, date?: string, terrainId?: string }} ParamsDuPlanning */
  const params = /** @type {ParamsDuPlanning | undefined} */ (route?.params);
  const { complexe, complexeId } = useComplexeChoisi(params?.complexeId);
  const surOrdinateur = useIsDesktop();
  const [vue, setVue] = useState(/** @type {VueDuPlanning} */ (surOrdinateur ? 'semaine' : 'jour'));
  const [date, setDate] = useState(() => params?.date || aujourdhuiAParis());
  const [terrainChoisi, setTerrainChoisi] = useState(params?.terrainId || '');
  const [feuille, setFeuille] = useState(/** @type {{ creneau: Creneau, quoi: string } | null} */ (
    null
  ));
  const [nom, setNom] = useState('');
  const [motif, setMotif] = useState('');
  const [fin, setFin] = useState('');
  const [erreurFeuille, setErreurFeuille] = useState('');
  const [message, setMessage] = useState('');

  // L'onglet est déjà monté quand la frise de l'accueil ou « Voir le planning » l'ouvre : il se
  // place sur le jour et le terrain de l'adresse.
  useEffect(() => {
    if (params?.date) setDate(params.date);
    if (params?.terrainId) setTerrainChoisi(params.terrainId);
  }, [params?.date, params?.terrainId]);

  const terrainsLus = useTerrains(complexeId);
  const terrains = Array.isArray(terrainsLus.data) ? terrainsLus.data : [];
  const terrainSemaine = terrainChoisi || String(terrains[0]?.documentId || '');
  const lundi = joursDeLaSemaine(date)[0];
  /** @type {{ from: string, terrain?: string, to: string }} */
  let periode = { from: date, to: date };
  if (vue === 'semaine') periode = { from: lundi, terrain: terrainSemaine, to: enJours(lundi, 6) };
  else if (vue === 'liste') periode = { from: date, to: enJours(date, 6) };
  if (vue !== 'semaine' && terrainChoisi) periode = { ...periode, terrain: terrainChoisi };
  const planning = usePlanning(complexeId, periode, {
    enabled: terrains.length > 0 && (vue !== 'semaine' || Boolean(terrainSemaine)),
  });
  const noter = useNoterExterieur();
  const bloquer = useBloquerCreneau();
  const rouvrir = useRouvrirFermetures();
  const maintenant = Date.now();

  const couleurDe = (/** @type {string} */ terrainId) => {
    const terrain = terrains.find((candidat) => candidat.documentId === terrainId);
    return terrain ? resolveFacilityPlanningColor(terrain) : null;
  };
  const avecTerrain = (/** @type {any} */ terrain, /** @type {any} */ jour) => (
    (Array.isArray(jour?.slots) ? jour.slots : []).map((/** @type {any} */ creneau) => ({
      ...creneau, date: jour.date, terrainId: terrain.documentId, terrainNom: terrain.name,
    }))
  );
  const lignesDuServeur = Array.isArray(planning.data?.terrains) ? planning.data.terrains : [];

  /** @type {import('@/views/complexe/components/GrillePlanning').ColonneDuPlanning[]} */
  let colonnes = [];
  if (vue === 'jour') {
    colonnes = lignesDuServeur.map((/** @type {any} */ terrain) => ({
      cle: terrain.documentId,
      couleur: couleurDe(terrain.documentId),
      creneaux: avecTerrain(terrain, terrain.days?.[0]),
      titre: String(terrain.name || ''),
    }));
  } else if (vue === 'semaine' && lignesDuServeur[0]) {
    const terrain = lignesDuServeur[0];
    colonnes = (terrain.days || []).map((/** @type {any} */ jour) => ({
      cle: jour.date,
      couleur: couleurDe(terrain.documentId),
      creneaux: avecTerrain(terrain, jour),
      titre: `${new Date(`${jour.date}T12:00:00`).toLocaleDateString(localeDesFormats(), {
        weekday: 'short',
      })} ${Number(jour.date.slice(8))}`,
    }));
  }

  // ── Les gestes ─────────────────────────────────────────────────────────────────────────
  const ouvrir = (/** @type {Creneau} */ creneau, /** @type {string} */ quoi) => {
    setNom('');
    setMotif('');
    setFin('');
    setErreurFeuille('');
    setMessage('');
    setFeuille({ creneau, quoi });
  };
  const fermer = () => setFeuille(null);
  const toucher = (/** @type {Creneau} */ creneau) => {
    if (creneau.reservation?.documentId) {
      navigation.navigate(RouteNames.ComplexeReservation, {
        complexeId, reservationId: creneau.reservation.documentId,
      });
      return;
    }
    if (creneau.state === 'bloque') ouvrir(creneau, 'bloque');
    else if (creneau.state === 'ferme') ouvrir(creneau, 'ferme');
    else ouvrir(creneau, 'libre');
  };
  const repli = t('complexeReservations.fiche.erreurGeste', 'Le geste n’a pas pu être fait.');
  /**
   * Un geste depuis la feuille : elle se ferme et le message s'affiche ; un refus y reste.
   * @param {() => Promise<any>} geste - Le geste.
   * @param {string} reussite - Le message.
   * @returns {Promise<void>} Fini.
   */
  const agir = async (geste, reussite) => {
    setErreurFeuille('');
    try {
      await geste();
      setFeuille(null);
      setMessage(reussite);
    } catch (erreur) {
      if (getServerErrorCode(erreur) === 'COMPLEXE_RESERVATION_SLOT_TAKEN') {
        setErreurFeuille(t(
          'complexeReservations.planning.prisDansLApp',
          'Ce créneau vient d’être réservé dans l’app.',
        ));
        planning.refetch?.();
        return;
      }
      setErreurFeuille(messageDeRefusResa(t, erreur, repli));
    }
  };
  const creneauOuvert = feuille?.creneau || null;
  const fins = creneauOuvert && feuille?.quoi === 'plage'
    ? finsPossibles(
      colonnes.flatMap((colonne) => colonne.creneaux).filter((creneau) => (
        creneau.terrainId === creneauOuvert.terrainId && creneau.date === creneauOuvert.date
      )),
      String(creneauOuvert.from),
    )
    : [];
  const finChoisie = fins.find((choix) => choix.to === fin) || null;

  const noterExterieur = () => agir(
    () => noter.mutateAsync({
      complexeId,
      note: {
        date: creneauOuvert?.date,
        externalName: nom.replace(/\s+/g, ' ').trim(),
        from: creneauOuvert?.from,
        terrain: creneauOuvert?.terrainId,
      },
    }),
    t('complexeReservations.planning.note', 'Créneau noté : {{nom}}', {
      nom: nom.replace(/\s+/g, ' ').trim(), ...SANS_ECHAPPEMENT,
    }),
  );
  const bloquerDe = (/** @type {string} */ a, /** @type {string} */ reussite) => agir(
    () => bloquer.mutateAsync({
      blocage: {
        date: String(creneauOuvert?.date),
        from: String(creneauOuvert?.from),
        motif: motif.trim(),
        to: a,
      },
      terrainId: String(creneauOuvert?.terrainId),
    }),
    reussite,
  );

  // ── L'en-tête ──────────────────────────────────────────────────────────────────────────
  const puce = (
    /** @type {string} */ cle,
    /** @type {string} */ libelle,
    /** @type {boolean} */ actif,
  ) => (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
      key={cle || 'tous'}
      onPress={() => setTerrainChoisi(cle)}
      style={[
        Alignments.justifyCenter,
        {
          backgroundColor: actif ? withAlpha(Colors.primary500, 0.2) : 'transparent',
          borderColor: actif ? Colors.primary500 : withAlpha(Colors.primary500, 0.4),
          borderRadius: 999,
          borderWidth: 1,
          minHeight: 44,
          paddingHorizontal: 14,
        },
      ]}
      testID={`planning-terrain-${cle || 'tous'}`}
    >
      <Text style={[Fonts.p3Bold, actif ? Fonts.neutral00 : Fonts.primary200]}>{libelle}</Text>
    </TouchableOpacity>
  );
  const pas = vue === 'jour' ? 1 : 7;
  const titreDeLaDate = vue === 'semaine' ? semaineLisible(lundi) : titreDuJour(date);
  const fleche = (/** @type {number} */ sens) => (
    <TouchableOpacity
      accessibilityLabel={sens < 0
        ? t('complexeReservations.planning.precedent', 'Précédent')
        : t('complexeReservations.planning.suivant', 'Suivant')}
      accessibilityRole="button"
      onPress={() => setDate(enJours(date, sens * pas))}
      style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
      testID={sens < 0 ? 'planning-precedent' : 'planning-suivant'}
    >
      <Image
        source={sens < 0 ? Images.arrowLeft : Images.arrowRight}
        style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary200]}
      />
    </TouchableOpacity>
  );

  // ── Le corps ───────────────────────────────────────────────────────────────────────────
  let corps;
  if (!terrainsLus.isLoading && !terrains.length) {
    corps = (
      <EmptyState
        actionLabel={t('complexeGerant.accueil.ajouterTerrain', 'Ajouter un terrain')}
        icon={Images.stadium}
        onAction={() => navigation.navigate(RouteNames.ComplexeTerrain, { complexeId })}
        title={t(
          'complexeReservations.planning.aucunTerrain',
          'Ajoute un terrain pour voir ton planning.',
        )}
      />
    );
  } else if (planning.isLoading || terrainsLus.isLoading) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 8 }} testID="planning-squelette">
        {[1, 2, 3, 4].map((ligne) => (
          <View
            key={ligne}
            style={[
              ApplicationStyle.borderRadius12,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: 64 },
            ]}
          />
        ))}
      </View>
    );
  } else if (planning.error) {
    corps = (
      <View
        accessibilityRole="alert"
        style={[Spaces.padding[16], {
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.4),
          borderRadius: 16,
          borderWidth: 1,
          gap: 8,
        }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeReservations.planning.erreur', 'Impossible de charger le planning.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => planning.refetch?.()}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else if (vue === 'liste') {
    const jours = [];
    for (let jour = periode.from; jour <= periode.to; jour = enJours(jour, 1)) jours.push(jour);
    const occupes = (/** @type {string} */ jour) => lignesDuServeur
      .flatMap((/** @type {any} */ terrain) => avecTerrain(
        terrain,
        (terrain.days || []).find((/** @type {any} */ d) => d.date === jour),
      ))
      .filter((creneau) => creneau.state !== 'libre')
      .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    corps = (
      <View style={{ gap: 16 }}>
        {jours.map((jour) => {
          const lignes = occupes(jour);
          return (
            <View key={jour} style={{ gap: 8 }}>
              <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
                {titreDuJour(jour).toUpperCase()}
              </Text>
              {lignes.length ? lignes.map((creneau) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={`${creneau.terrainId}-${creneau.startsAt}`}
                  onPress={() => toucher(creneau)}
                  style={[
                    Spaces.padding[12],
                    {
                      backgroundColor: withAlpha(Colors.primary700, 0.45),
                      borderColor: withAlpha(Colors.primary500, 0.5),
                      borderRadius: 14,
                      borderWidth: 1,
                      gap: 2,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {`${plageHoraire(creneau.from, creneau.to)} · ${creneau.terrainNom}`}
                  </Text>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {libelleDuCreneau(t, creneau)}
                  </Text>
                </TouchableOpacity>
              )) : (
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t('complexeReservations.planning.rienCeJour', 'Rien de réservé ni de bloqué.')}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  } else {
    corps = (
      <GrillePlanning
        colonnes={colonnes}
        estActif={(creneau) => Boolean(creneau.reservation?.documentId)
          || creneau.state === 'bloque' || creneau.state === 'ferme'
          || new Date(creneau.endsAt).getTime() > maintenant}
        onAppuiLong={(creneau) => ouvrir(creneau, 'plage')}
        onToucher={toucher}
      />
    );
  }

  const legende = (
    <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
      {ETATS_DU_CRENEAU.map((etat) => (
        <View key={etat} style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}>
          <View
            style={[
              {
                borderRadius: 4, borderWidth: 1, height: 14, width: 22,
              },
              styleDuCreneau(Colors, etat, Colors.primary500),
            ]}
          />
          <Text style={[Fonts.p3, Fonts.neutral100]}>{libelleDeLEtat(t, etat)}</Text>
        </View>
      ))}
    </View>
  );

  // ── Les feuilles ───────────────────────────────────────────────────────────────────────
  const rappel = creneauOuvert ? [
    creneauOuvert.terrainNom,
    jourCourt(creneauOuvert.date),
    plageHoraire(creneauOuvert.from, creneauOuvert.to),
  ].join(' · ') : '';
  const titreDeLaFeuille = () => {
    if (!feuille) return '';
    if (feuille.quoi === 'plage') {
      return t('complexeReservations.planning.bloquerDepuis', 'Bloquer à partir d’ici');
    }
    if (feuille.quoi === 'libre') return t('complexeReservations.planning.ceCreneau', 'Ce créneau');
    return libelleDuCreneau(t, feuille.creneau);
  };
  const erreur = erreurFeuille ? (
    <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{erreurFeuille}</Text>
  ) : null;
  const champMotif = (
    <Input
      label={t('complexeReservations.planning.motifFacultatif', 'Motif (facultatif)')}
      onChangeText={setMotif}
      value={motif}
    />
  );
  let contenuDeLaFeuille = null;
  if (feuille?.quoi === 'libre') {
    contenuDeLaFeuille = (
      <>
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('complexeReservations.planning.reserveExterieur', 'Réservé à l’extérieur')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('complexeReservations.planning.reserveExterieurDit', 'Au téléphone, au comptoir…')}
          </Text>
          <Input
            label={t('complexeReservations.fiche.auNomDeChamp', 'Au nom de')}
            onChangeText={setNom}
            value={nom}
          />
          <View testID="creneau-enregistrer">
            <Button
              disabled={nom.trim().length < 2}
              isLoading={Boolean(noter.isPending)}
              onPress={noterExterieur}
              title={t('complexeReservations.fiche.enregistrer', 'Enregistrer')}
            />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('complexeReservations.planning.bloquerCeCreneau', 'Bloquer ce créneau')}
          </Text>
          {champMotif}
          <View testID="creneau-bloquer">
            <Button
              isLoading={Boolean(bloquer.isPending)}
              onPress={() => bloquerDe(
                String(creneauOuvert?.to),
                t('complexeReservations.planning.bloqueFait', 'Créneau bloqué.'),
              )}
              title={t('complexeReservations.planning.bloquer', 'Bloquer')}
              variant="Secondary"
            />
          </View>
        </View>
      </>
    );
  } else if (feuille?.quoi === 'plage') {
    contenuDeLaFeuille = (
      <>
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {fins.map((choix) => (
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ checked: choix.to === fin }}
              key={choix.to}
              onPress={() => setFin(choix.to)}
              style={[
                Alignments.justifyCenter,
                {
                  backgroundColor: choix.to === fin
                    ? withAlpha(Colors.primary500, 0.2)
                    : 'transparent',
                  borderColor: choix.to === fin
                    ? Colors.primary500
                    : withAlpha(Colors.primary500, 0.4),
                  borderRadius: 999,
                  borderWidth: 1,
                  minHeight: 44,
                  paddingHorizontal: 14,
                },
              ]}
              testID={`fin-${choix.to}`}
            >
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                {t('complexeReservations.planning.jusqua', 'jusqu’à {{heure}}', {
                  heure: texteHeure(choix.to), ...SANS_ECHAPPEMENT,
                })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {finChoisie ? (
          <View style={{ gap: 4 }}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t(
                'complexeReservations.planning.bloquerDeA',
                'Bloquer de {{de}} à {{a}} ({{count}} créneaux)',
                {
                  a: texteHeure(finChoisie.to),
                  count: finChoisie.bloques,
                  de: texteHeure(creneauOuvert?.from),
                  defaultValue_one: 'Bloquer de {{de}} à {{a}} ({{count}} créneau)',
                  defaultValue_other: 'Bloquer de {{de}} à {{a}} ({{count}} créneaux)',
                  ...SANS_ECHAPPEMENT,
                },
              )}
            </Text>
            {finChoisie.gardes ? (
              <Text style={[Fonts.p2, { color: Colors.warning500 }]}>
                {t(
                  'complexeReservations.planning.gardes',
                  '{{count}} créneaux réservés : ils ne seront pas bloqués.',
                  {
                    count: finChoisie.gardes,
                    defaultValue_one:
                      '{{count}} créneau de cette plage est réservé : il ne sera pas bloqué.',
                    defaultValue_other:
                      '{{count}} créneaux de la plage sont réservés : ils ne seront pas bloqués.',
                    ...SANS_ECHAPPEMENT,
                  },
                )}
              </Text>
            ) : null}
          </View>
        ) : null}
        {champMotif}
        <View testID="plage-bloquer">
          <Button
            disabled={!finChoisie}
            isLoading={Boolean(bloquer.isPending)}
            onPress={() => bloquerDe(
              fin,
              t('complexeReservations.planning.plageBloquee', 'Plage bloquée.'),
            )}
            title={t('complexeReservations.planning.bloquer', 'Bloquer')}
          />
        </View>
      </>
    );
  } else if (feuille?.quoi === 'ferme') {
    contenuDeLaFeuille = (
      <View testID="creneau-voir-fermetures">
        <Button
          onPress={() => {
            setFeuille(null);
            navigation.navigate(RouteNames.ComplexeFermetures, {
              complexeId, terrainId: creneauOuvert?.terrainId,
            });
          }}
          title={t('complexeReservations.planning.voirFermetures', 'Voir les fermetures')}
          variant="Secondary"
        />
      </View>
    );
  } else if (feuille?.quoi === 'bloque') {
    contenuDeLaFeuille = (
      <View testID="creneau-debloquer">
        <Button
          isLoading={Boolean(rouvrir.isPending)}
          onPress={() => agir(
            () => rouvrir.mutateAsync([String(creneauOuvert?.closure?.documentId)]),
            t('complexeReservations.planning.debloque', 'Créneau débloqué.'),
          )}
          title={t('complexeReservations.planning.debloquer', 'Débloquer')}
        />
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 16 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => planning.refetch?.()}
            refreshing={Boolean(planning.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary500, { letterSpacing: 0.6 }]}>
            {String(complexe?.name || '').toUpperCase()}
          </Text>
          <Text
            accessibilityRole="header"
            style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
          >
            {t('complexeReservations.planning.titre', 'Planning').toUpperCase()}
          </Text>
        </View>
        {terrains.length ? (
          <ScrollView
            contentContainerStyle={{ gap: 8 }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {vue === 'semaine' ? null : puce(
              '',
              t('complexeReservations.filtres.tousTerrains', 'Tous les terrains'),
              !terrainChoisi,
            )}
            {terrains.map((terrain) => puce(
              String(terrain.documentId),
              String(terrain.name || ''),
              (vue === 'semaine' ? terrainSemaine : terrainChoisi) === terrain.documentId,
            ))}
          </ScrollView>
        ) : null}
        <SegmentedControl
          onChange={(valeur) => setVue(/** @type {VueDuPlanning} */ (valeur))}
          options={[
            { label: t('complexeReservations.planning.jour', 'Jour'), value: 'jour' },
            { label: t('complexeReservations.planning.semaine', 'Semaine'), value: 'semaine' },
            { label: t('complexeReservations.planning.liste', 'Liste'), value: 'liste' },
          ]}
          value={vue}
        />
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 4 }]}>
          {fleche(-1)}
          <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter, { flex: 1 }]}>
            {titreDeLaDate}
          </Text>
          {fleche(1)}
          <Button
            onPress={() => setDate(aujourdhuiAParis())}
            size="sm"
            title={t('complexeReservations.liste.aujourdhui', 'Aujourd’hui')}
            variant="Ghost"
          />
        </View>
        {message ? <BandeauComplexe texte={message} ton="ok" /> : null}
        {corps}
        {terrains.length ? legende : null}
        {terrains.length ? (
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => navigation.navigate(RouteNames.ComplexeFermetures, {
              complexeId, terrainId: terrainChoisi || undefined,
            })}
            style={[Alignments.justifyCenter, { alignSelf: 'flex-start', minHeight: 44 }]}
            testID="planning-fermer-des-jours"
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t('complexeReservations.planning.fermerDesJours', 'Fermer des jours')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      <BottomModal close={fermer} isVisible={Boolean(feuille)} webPresentation="dialog">
        <View style={{ gap: 16 }} testID="feuille-creneau">
          <View style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
              {titreDeLaFeuille()}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>{rappel}</Text>
          </View>
          {contenuDeLaFeuille}
          {erreur}
          <Button
            onPress={fermer}
            title={t('complexeGerant.creation.fermer', 'Fermer')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default ComplexePlanning;
