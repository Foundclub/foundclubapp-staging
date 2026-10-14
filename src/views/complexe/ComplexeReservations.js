import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  grouperParJour,
  libelleStatut,
  lignesDesPages,
  STATUTS,
  titreDuJour,
  totalDesPages,
} from '@/domains/complexe/complexeReservation';
import { texteHeure } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import PastillesReservation from '@/views/complexe/components/PastillesReservation';

import { RouteNames } from '@/navigation/routeNames';

import { useReservationsDuComplexe, useTerrains } from '@/services/complexe/complexeQueries';

/** @typedef {'a-venir' | 'aujourdhui' | 'passees'} VueDesReservations */
/** @typedef {'source' | 'statut' | 'terrain'} NomDuFiltre */

const VUES = /** @type {VueDesReservations[]} */ (['aujourdhui', 'a-venir', 'passees']);

/** L'état d'une réservation que le filtre propose (Non honorée : lot L5b, après RESA-L2B). */
const ETATS_FILTRES = Object.freeze([
  STATUTS.confirmee, STATUTS.enAttente, STATUTS.annulee, STATUTS.refusee, STATUTS.sansReponse,
]);

/**
 * E-G04 — LES RÉSERVATIONS DU COMPLEXE — RESA-L5A2 (14/10/2026), planche EG04 : onglets
 * Aujourd'hui · À venir · Passées avec leurs nombres (le total du serveur), filtres terrain ·
 * source · état (une feuille de choix chacun), une liste groupée par jour — l'heure, « Julien M. ·
 * Terrain 1 », les joueurs, la source, l'état (une note « extérieur » confirmée : sa source seule).
 * Toucher une carte ouvre sa fiche (E-G05). Pages de 20 : « Voir plus ».
 * Pas encore servi (dit dans le compte rendu du lot) : « Non honorée » sur les cartes passées et
 * l'état « Non honorée » du filtre (lot L5b, après RESA-L2B) ; « Confirmée la veille » (RG-VEILLE,
 * RESA-L2B) ; « 8/10 joueurs » (participants, lot L3 : la carte dit les joueurs DÉCLARÉS) ; « Créer
 * une affiche » sous « Aucune réservation à venir » (E-G13, lot L4).
 * Paramètres de route : `complexeId`, `vue` (l'onglet d'arrivée ; sinon Aujourd'hui). Caché par
 * `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeReservations() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string, vue?: string } | undefined} */ (route?.params);
  const complexeId = params?.complexeId || null;
  const [vue, setVue] = useState(/** @type {VueDesReservations} */ (
    VUES.find((candidate) => candidate === params?.vue) || 'aujourdhui'
  ));
  const [filtres, setFiltres] = useState(/** @type {Record<NomDuFiltre, string>} */ ({
    source: '', statut: '', terrain: '',
  }));
  const [feuille, setFeuille] = useState(/** @type {NomDuFiltre | ''} */ (''));

  const remplis = Object.fromEntries(Object.entries(filtres).filter(([, valeur]) => valeur));
  const aujourdhui = useReservationsDuComplexe(complexeId, { ...remplis, vue: 'aujourdhui' });
  const aVenir = useReservationsDuComplexe(complexeId, { ...remplis, vue: 'a-venir' });
  const passees = useReservationsDuComplexe(
    complexeId,
    { ...remplis, vue: 'passees' },
    { enabled: vue === 'passees' },
  );
  const terrainsLus = useTerrains(complexeId);
  const terrains = Array.isArray(terrainsLus.data) ? terrainsLus.data : [];
  const lectures = { 'a-venir': aVenir, aujourdhui, passees };
  const lecture = lectures[vue];
  const lignes = lignesDesPages(lecture.data);

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };

  const avecNombre = (/** @type {string} */ libelle, /** @type {any} */ donnees) => {
    const total = totalDesPages(donnees);
    return total === null ? libelle : `${libelle} (${total})`;
  };

  // ── Les filtres ────────────────────────────────────────────────────────────────────────
  const libelleSource = (/** @type {string} */ source) => (source === 'exterieur'
    ? t('complexeReservations.source.exterieur', 'Extérieur')
    : t('complexeReservations.source.app', 'App'));
  const choixDe = (/** @type {NomDuFiltre} */ nom) => {
    if (nom === 'terrain') {
      return terrains.map((terrain) => ({
        libelle: String(terrain.name || ''), valeur: String(terrain.documentId),
      }));
    }
    if (nom === 'source') {
      return ['app', 'exterieur']
        .map((source) => ({ libelle: libelleSource(source), valeur: source }));
    }
    return ETATS_FILTRES.map((statut) => ({ libelle: libelleStatut(t, statut), valeur: statut }));
  };
  const titres = {
    source: t('complexeReservations.filtres.source', 'Source'),
    statut: t('complexeReservations.filtres.etat', 'État'),
    terrain: t('complexeReservations.filtres.terrain', 'Terrain'),
  };
  const tous = {
    source: t('complexeReservations.filtres.toutesSources', 'Toutes les sources'),
    statut: t('complexeReservations.filtres.tousEtats', 'Tous les états'),
    terrain: t('complexeReservations.filtres.tousTerrains', 'Tous les terrains'),
  };
  const libelleDuFiltre = (/** @type {NomDuFiltre} */ nom) => {
    const choisi = choixDe(nom).find((choix) => choix.valeur === filtres[nom]);
    return choisi ? choisi.libelle : titres[nom];
  };
  const choisir = (/** @type {string} */ valeur) => {
    if (feuille) setFiltres((avant) => ({ ...avant, [feuille]: valeur }));
    setFeuille('');
  };

  const puces = (
    <ScrollView
      contentContainerStyle={{ gap: 8 }}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {/** @type {NomDuFiltre[]} */ (['terrain', 'source', 'statut']).map((nom) => {
        const actif = Boolean(filtres[nom]);
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            key={nom}
            onPress={() => setFeuille(nom)}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              {
                backgroundColor: actif ? withAlpha(Colors.primary500, 0.2) : 'transparent',
                borderColor: actif ? Colors.primary500 : withAlpha(Colors.primary500, 0.4),
                borderRadius: 999,
                borderWidth: 1,
                gap: 6,
                minHeight: 44,
                paddingHorizontal: 14,
              },
            ]}
            testID={`filtre-${nom}`}
          >
            <Text style={[Fonts.p3Bold, actif ? Fonts.neutral00 : Fonts.primary200]}>
              {libelleDuFiltre(nom)}
            </Text>
            <Image
              source={Images.chevronDown}
              style={[{ height: 12, width: 12 }, ApplicationStyle.tintColor.primary200]}
            />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ── Une réservation ────────────────────────────────────────────────────────────────────
  const carteDe = (/** @type {any} */ ligne) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={ligne.documentId}
      onPress={() => navigation.navigate(
        RouteNames.ComplexeReservation,
        { complexeId, reservationId: ligne.documentId },
      )}
      style={[carte, Alignments.row, Spaces.padding[12], { gap: 12 }]}
      testID={`reservation-${ligne.documentId}`}
    >
      <Text style={[Fonts.p1Black, Fonts.neutral00, { width: 56 }]}>{texteHeure(ligne.from)}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {`${String(ligne.label || '')} · ${String(ligne.terrain?.name || '')}`}
        </Text>
        {ligne.players ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('complexeReservations.fiche.joueurs', '{{nombre}} joueurs', {
              nombre: ligne.players, ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        <PastillesReservation
          sansEtat={ligne.source === 'exterieur' && ligne.status === STATUTS.confirmee}
          source={ligne.source}
          statut={ligne.status}
        />
      </View>
    </TouchableOpacity>
  );

  let corps;
  if (lecture.isLoading) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="reservations-squelette">
        {[1, 2, 3].map((ligne) => (
          <View
            key={ligne}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: 96 },
            ]}
          />
        ))}
      </View>
    );
  } else if (lecture.error) {
    corps = (
      <View
        accessibilityRole="alert"
        style={[carte, Spaces.padding[16], {
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.4),
          gap: 8,
        }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeReservations.liste.erreur', 'Impossible de charger les réservations.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => lecture.refetch?.()}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else if (!lignes.length) {
    const vides = {
      'a-venir': t('complexeReservations.liste.videAVenir', 'Aucune réservation à venir.'),
      aujourdhui: t('complexeReservations.liste.videAujourdhui', 'Aucune réservation aujourd’hui.'),
      passees: t('complexeReservations.liste.videPassees', 'Aucune réservation passée.'),
    };
    corps = <EmptyState icon={Images.calendar} title={vides[vue]} />;
  } else {
    corps = (
      <View style={{ gap: 12 }}>
        {grouperParJour(lignes).map((groupe) => (
          <View key={groupe.date} style={{ gap: 8 }}>
            <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
              {titreDuJour(groupe.date).toUpperCase()}
            </Text>
            {groupe.items.map(carteDe)}
          </View>
        ))}
        {lecture.hasNextPage ? (
          <Button
            isLoading={Boolean(lecture.isFetchingNextPage)}
            onPress={() => lecture.fetchNextPage?.()}
            title={t('complexeReservations.voirPlus', 'Voir plus')}
            variant="Ghost"
          />
        ) : null}
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
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => lecture.refetch?.()}
            refreshing={Boolean(lecture.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <Text
          accessibilityRole="header"
          style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
        >
          {t('complexeReservations.liste.titre', 'Réservations').toUpperCase()}
        </Text>
        <SegmentedControl
          onChange={(valeur) => setVue(/** @type {VueDesReservations} */ (valeur))}
          options={[
            {
              label: avecNombre(
                t('complexeReservations.liste.aujourdhui', 'Aujourd’hui'),
                aujourdhui.data,
              ),
              value: 'aujourdhui',
            },
            {
              label: avecNombre(t('complexeReservations.liste.aVenir', 'À venir'), aVenir.data),
              value: 'a-venir',
            },
            { label: t('complexeReservations.liste.passees', 'Passées'), value: 'passees' },
          ]}
          value={vue}
        />
        {puces}
        {corps}
      </ScrollView>
      <BottomModal
        close={() => setFeuille('')}
        isVisible={Boolean(feuille)}
        webPresentation="dialog"
      >
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {feuille ? titres[feuille] : ''}
          </Text>
          {(feuille ? [{ libelle: tous[feuille], valeur: '' }, ...choixDe(feuille)] : [])
            .map((choix) => {
              const actif = Boolean(feuille)
              && filtres[/** @type {NomDuFiltre} */ (feuille)] === choix.valeur;
              return (
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{ checked: actif }}
                  key={choix.valeur || 'tous'}
                  onPress={() => choisir(choix.valeur)}
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    {
                      backgroundColor: actif
                        ? withAlpha(Colors.primary500, 0.16)
                        : withAlpha(Colors.neutral00, 0.04),
                      borderColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.1),
                      borderRadius: 14,
                      borderWidth: 1,
                      minHeight: 52,
                      paddingHorizontal: 16,
                    },
                  ]}
                  testID={`filtre-option-${choix.valeur || 'tous'}`}
                >
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{choix.libelle}</Text>
                </TouchableOpacity>
              );
            })}
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default ComplexeReservations;
