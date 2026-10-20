import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { texteHeure } from '@/domains/complexe/complexeTerrain';
import { apercuDeLaFidelite, jourEtHeure } from '@/domains/complexe/partieDuJoueur';
import {
  joursDeMesReservations,
  ONGLETS_DE_MES_RESERVATIONS,
  periodeDeLOnglet,
  reservationsDeLOnglet,
} from '@/domains/complexe/reservationsDuJoueur';
import { etatAffiche, momentLisible, texteJourLong } from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';
import PastilleEtat from '@/views/reserverTerrain/components/PastilleEtat';
import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';
import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import {
  useGroupesDeReservations,
  useMaFidelite,
  useMesReservations,
} from '@/services/complexe/complexeJoueurQueries';

import { useIsDesktop } from '@/responsive';

/** Planche OR3, gabarit A : la liste de 440 px, le détail dans le volet. */
const LISTE_ORDINATEUR = 440;
const LARGEUR_MAX = 1160;

/**
 * E-P10 — « MES RÉSERVATIONS » — RESA-L6B-1 (19/10/2026), planches EP10 et OR3 (gabarit A) de la
 * toile BLG79NHv2, plan E-P10 ; RC-P03, A-G20. Dans l'ordre de l'écran :
 *   1. l'en-tête « MES RÉSERVATIONS » et les onglets À venir · Passées · Refusées et annulées ;
 *   2. la liste groupée par jour : l'heure, le complexe, le terrain, la pastille d'état ; « Tu as
 *      réservé » ou « Demande envoyée · réponse avant … ». Toucher ⇒ la fiche (E-P07).
 * États : chargement, erreur, vide par onglet (« Réserver un terrain » ⇒ E-P01) ; tirer pour
 * rafraîchir. Ordinateur (≥ 1 024 px) : la liste à gauche, la fiche à droite, toucher une ligne
 * remplit le volet au lieu de changer d'écran.
 * RESA-L6B-2 (20/10/2026, serveurs RESA-L3 / L4 ; planche EP10 états 1 et 2) : l'onglet « En
 * collecte » (chaque collecte avec sa jauge et sa date limite), « Invité par Julien M. » pour une
 * partie où l'on est participant, et « MA FIDÉLITÉ » sous « À venir » (une carte par complexe ⇒
 * E-P02).
 * ⛔ « 8/10 joueurs » et « Pour U15 Valbrune » sur chaque ligne : la liste du serveur ne porte ni
 * les présents ni l'équipe (une lecture du groupe par ligne serait le prix) ; la fiche (E-P07) les
 * dit.
 * Paramètre facultatif : `onglet` (`a-venir | en-collecte | passees | refusees`). Caché par
 * `COMPLEXES_JOUEUR`.
 * Témoin : `__tests__/EP10.mesReservations.test.js`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverMesReservations() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @type {{ onglet?: string }} */
  const params = /** @type {any} */ (route?.params) || {};
  const surOrdinateur = useIsDesktop();
  const { dockClearance } = useBottomDockLayout();
  const [periode, setPeriode] = useState(/** @type {string} */ (
    ONGLETS_DE_MES_RESERVATIONS.find((p) => p === params.onglet) || 'a-venir'
  ));
  const [choisie, setChoisie] = useState(/** @type {string | null} */ (null));
  const lecture = useMesReservations(periodeDeLOnglet(periode));
  const reservations = reservationsDeLOnglet(periode, lecture?.data);
  const enCollecte = periode === 'en-collecte';
  const { groupes } = useGroupesDeReservations(
    enCollecte ? reservations.map((r) => String(r?.documentId || '')) : [],
    { enabled: enCollecte },
  );
  const fidelites = useMaFidelite()?.data;
  const cartesDeFidelite = (Array.isArray(fidelites) ? fidelites : [])
    .map((carte) => ({ apercu: apercuDeLaFidelite(t, carte), carte }))
    .filter(({ apercu }) => apercu);
  const ficheDuVolet = surOrdinateur
    ? (reservations.find((r) => r?.documentId === choisie) || reservations[0])?.documentId || null
    : null;

  /** @type {Record<string, string>} */
  const onglets = {
    'a-venir': t('reserverTerrain.mesReservations.onglets.aVenir', 'À venir'),
    'en-collecte': t('reserverTerrain.mesReservations.onglets.enCollecte', 'En collecte'),
    passees: t('reserverTerrain.mesReservations.onglets.passees', 'Passées'),
    refusees: t('reserverTerrain.mesReservations.onglets.refusees', 'Refusées et annulées'),
  };
  /** @type {Record<string, string>} */
  const vides = {
    'a-venir': t('reserverTerrain.mesReservations.vide.aVenir', 'Aucune réservation à venir.'),
    'en-collecte': t(
      'reserverTerrain.mesReservations.vide.enCollecte',
      'Aucune collecte en cours.',
    ),
    passees: t('reserverTerrain.mesReservations.vide.passees', 'Aucune réservation passée.'),
    refusees: t(
      'reserverTerrain.mesReservations.vide.refusees',
      'Aucune réservation refusée ou annulée.',
    ),
  };

  const ouvrir = (/** @type {any} */ reservation) => {
    if (surOrdinateur) {
      setChoisie(reservation.documentId);
      return;
    }
    navigation.navigate(RouteNames.ReserverMaReservation, {
      reservationId: reservation.documentId,
    });
  };

  const carte = {
    backgroundColor: withAlpha(Colors.primary800, 0.82),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  };

  /**
   * La phrase sous la ligne : « Tu as réservé » (à venir), « Demande envoyée · réponse avant … ».
   * @param {any} reservation - La réservation.
   * @param {string} etat - Son état affiché.
   * @returns {string} La phrase, ou ''.
   */
  const sousLigne = (reservation, etat) => {
    // RESA-L6B-2 : une partie où l'on est participant (D3 : la même réservation, d'autres droits).
    if (reservation?.role === 'participant' && reservation?.bookerLabel) {
      return t('reserverTerrain.mesReservations.invitePar', 'Invité par {{reserveur}}', {
        reserveur: String(reservation.bookerLabel),
        ...SANS_ECHAPPEMENT,
      });
    }
    // RESA-L6B-2 : une collecte, sa jauge et sa date limite (le groupe lu pour l'onglet).
    const collecte = groupes?.[reservation?.documentId]?.collecte;
    if (etat === 'enCollecte' && collecte) {
      return t(
        'reserverTerrain.resultat.jauge',
        '{{presents}} sur {{quorum}} · date limite {{echeance}}',
        {
          echeance: jourEtHeure(t, collecte.collectDeadline),
          presents: Number(collecte.presents) || 0,
          quorum: Number(collecte.quorum) || 0,
          ...SANS_ECHAPPEMENT,
        },
      );
    }
    if (etat === 'confirmee') {
      return t('reserverTerrain.mesReservations.tuAsReserve', 'Tu as réservé');
    }
    if (etat !== 'enAttente') return '';
    const echeance = momentLisible(reservation.expiresAt);
    return echeance
      ? t(
        'reserverTerrain.mesReservations.demandeAvant',
        'Demande envoyée · réponse avant le {{jour}} à {{heure}}',
        { heure: echeance.heure, jour: echeance.jour, ...SANS_ECHAPPEMENT },
      )
      : t('reserverTerrain.mesReservations.demande', 'Demande envoyée');
  };

  const enTete = (
    <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}>
      {t('reserverTerrain.mesReservations.titre', 'Mes réservations').toUpperCase()}
    </Text>
  );

  const puces = (
    <ScrollView
      contentContainerStyle={{ gap: 8 }}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {ONGLETS_DE_MES_RESERVATIONS.map((p) => (
        <PuceChoix
          choisie={p === periode}
          key={p}
          libelle={onglets[p]}
          onPress={() => {
            setPeriode(p);
            setChoisie(null);
          }}
          testID={`mes-reservations-onglet-${p}`}
        />
      ))}
    </ScrollView>
  );

  let corps;
  if (lecture?.isLoading && !reservations.length) {
    corps = (
      <View style={{ gap: 12 }} testID="reserver-mes-reservations-squelette">
        {[1, 2, 3].map((rang) => (
          <View
            accessibilityState={{ busy: true }}
            key={rang}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.06),
              borderRadius: 16,
              height: 88,
            }}
          />
        ))}
      </View>
    );
  } else if (lecture?.error && !reservations.length) {
    corps = (
      <View accessibilityRole="alert" style={{ ...carte, gap: 12, padding: 16 }}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('reserverTerrain.mesReservations.erreur', 'Impossible de charger tes réservations.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => lecture?.refetch?.()}
            title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else if (!reservations.length) {
    corps = (
      <View style={[Alignments.alignCenter, { gap: 16, paddingTop: 32 }]}>
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: withAlpha(Colors.primary500, 0.16),
              borderRadius: 28,
              height: 56,
              width: 56,
            },
          ]}
        >
          <Image
            source={Images.calendar}
            style={{ height: 24, tintColor: Colors.primary500, width: 24 }}
          />
        </View>
        <Text style={[Fonts.p1Bold, Fonts.neutral00, { textAlign: 'center' }]}>
          {vides[periode]}
        </Text>
        <Button
          onPress={() => navigateToSearchHub(navigation, 'reservations')}
          title={t('reserverTerrain.mesReservations.reserver', 'Réserver un terrain')}
          variant="Primary"
        />
      </View>
    );
  } else {
    corps = joursDeMesReservations(reservations).map((jour) => (
      <View key={jour.date} style={{ gap: 8 }}>
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>{texteJourLong(t, jour.date)}</Text>
        {jour.reservations.map((/** @type {any} */ reservation) => {
          const etat = etatAffiche(reservation);
          const phrase = sousLigne(reservation, etat);
          const collecte = groupes?.[reservation.documentId]?.collecte;
          const choisi = surOrdinateur && reservation.documentId === ficheDuVolet;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={surOrdinateur ? { selected: choisi } : undefined}
              key={reservation.documentId}
              onPress={() => ouvrir(reservation)}
              style={[
                carte,
                { minHeight: 44 },
                choisi ? {
                  backgroundColor: withAlpha(Colors.primary500, 0.14),
                  borderColor: Colors.primary500,
                  borderLeftWidth: 4,
                } : null,
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {[
                  texteHeure(reservation.from),
                  reservation?.complexe?.name,
                  reservation?.terrain?.name,
                ].filter(Boolean).join(' · ')}
              </Text>
              {phrase ? <Text style={[Fonts.p3, Fonts.neutral200]}>{phrase}</Text> : null}
              <View style={{ marginTop: 4 }}>
                <PastilleEtat
                  compte={collecte ? `${collecte.presents}/${collecte.quorum}` : null}
                  etat={etat}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    ));
  }

  // RESA-L6B-2 — « MA FIDÉLITÉ » (planche EP10 état 1, RG-FIDELITE) : sous « À venir ».
  const maFidelite = periode === 'a-venir' && cartesDeFidelite.length ? (
    <View style={{ gap: 8 }} testID="mes-reservations-fidelite">
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('reserverTerrain.mesReservations.maFidelite', 'Ma fidélité').toUpperCase()}
      </Text>
      {cartesDeFidelite.map(({ apercu, carte: fidelite }) => (
        <TouchableOpacity
          accessibilityLabel={String(fidelite?.complexe?.name || '')}
          accessibilityRole="button"
          disabled={!fidelite?.complexe?.slug}
          key={String(fidelite?.complexe?.slug || fidelite?.complexe?.name)}
          onPress={() => navigation.navigate(RouteNames.ReserverComplexe, {
            slug: fidelite.complexe.slug,
          })}
          style={[carte, { gap: 8, minHeight: 44 }]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 10 }]}>
            <View
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: withAlpha(Colors.primary500, 0.2),
                  borderRadius: 10,
                  height: 32,
                  width: 32,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                {String(fidelite?.complexe?.name || '')
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((mot) => mot.charAt(0).toLocaleUpperCase())
                  .join('')}
              </Text>
            </View>
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
              {String(fidelite?.complexe?.name || '')}
            </Text>
            {!apercu.disponible ? (
              <Text style={[Fonts.p2Bold, Fonts.primary200]}>
                {`${apercu.compte}/${apercu.seuil}`}
              </Text>
            ) : null}
          </View>
          {!apercu.disponible ? (
            <View
              style={{
                backgroundColor: withAlpha(Colors.primary500, 0.18),
                borderRadius: 4,
                height: 6,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  backgroundColor: Colors.primary500,
                  height: 6,
                  width: `${Math.round((apercu.compte / Math.max(1, apercu.seuil)) * 100)}%`,
                }}
              />
            </View>
          ) : null}
          <Text style={[Fonts.p3, apercu.disponible ? Fonts.success500 : Fonts.neutral200]}>
            {apercu.texte}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  const rafraichir = (
    <RefreshControl
      colors={[Colors.primary500]}
      onRefresh={() => lecture?.refetch?.()}
      refreshing={Boolean(lecture?.isRefetching)}
      tintColor={Colors.primary500}
    />
  );

  return (
    // `boundedHeight` : sur le SITE, la liste défile DANS l'écran (sans lui, l'écran prend la
    // hauteur de tout son contenu) ; sur ordinateur, la liste et le volet défilent chacun à part.
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      boundedHeight
      contentContainerStyle={[Alignments.fill]}
    >
      {surOrdinateur ? (
        <View
          style={[
            Alignments.fill,
            {
              alignSelf: 'center', gap: 16, maxWidth: LARGEUR_MAX, paddingTop: 12, width: '100%',
            },
          ]}
        >
          {enTete}
          <View style={[Alignments.fill, Alignments.row, { gap: 24 }]}>
            <ScrollView
              contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
              refreshControl={rafraichir}
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 0, width: LISTE_ORDINATEUR }}
            >
              {puces}
              {corps}
              {maFidelite}
            </ScrollView>
            {ficheDuVolet ? (
              <View
                accessibilityLabel={t('reserverTerrain.maReservation.titre', 'Ma réservation')}
                style={{
                  backgroundColor: Colors.primary800,
                  borderColor: withAlpha(Colors.primary500, 0.24),
                  borderRadius: 16,
                  borderWidth: 1,
                  flex: 1,
                  minWidth: 0,
                  padding: 24,
                }}
                testID="mes-reservations-volet"
              >
                <ReserverMaReservation
                  dansUnVolet
                  key={ficheDuVolet}
                  reservationId={ficheDuVolet}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            gap: 16,
            paddingBottom: 24 + (Platform.OS === 'web' ? dockClearance : 0),
            paddingTop: 12,
          }}
          refreshControl={rafraichir}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          {enTete}
          {puces}
          {corps}
          {maFidelite}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

export default ReserverMesReservations;
