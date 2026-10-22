import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { nomComplet, ONGLETS_CLIENTS, resumeDuClient } from '@/domains/complexe/clientDuComplexe';
import { initialesDe, lignesDesPages } from '@/domains/complexe/complexeReservation';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import SearchBar from '@/components/molecules/searchBar/SearchBar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ComplexeClient from '@/views/complexe/ComplexeClient';
import DeuxVolets from '@/views/complexe/components/DeuxVolets';

import { RouteNames } from '@/navigation/routeNames';

import { useClientsDuComplexe, useComplexeChoisi } from '@/services/complexe/complexeQueries';

import { useIsDesktop } from '@/responsive';

/** @typedef {'bannis' | 'habitues' | 'tous'} OngletDesClients */

/**
 * E-G15 — LES CLIENTS DU COMPLEXE, LA LISTE — RESA-L5B-2 (20/10/2026), planche EG15 états 1, 6, 7
 * et 8 ; plan :970-1010 ; serveur RESA-L4 (`GET /complexes/:id/clients?onglet&recherche&page`).
 * Dans l'ordre : « CLIENTS », la recherche par nom, les onglets Tous · Habitués · Bannis, une ligne
 * par client — ses initiales, son nom, « 12 parties · 1 non honorée · fidélité 8/10 » (la fidélité
 * quand le complexe a un programme), la pastille « Banni » — et « Voir plus » (pages de 20).
 * Toucher un client ouvre SA fiche (RESA-L5B-1, `ComplexeClient`). Un client est un compte qui a
 * réservé ICI (une note « à l'extérieur » n'a pas de fiche) ; jamais un numéro (RC-T04), et le
 * serveur ne rend pas la photo d'un mineur : la ligne montre les initiales.
 * États : chargement (squelette), erreur (« Réessayer »), vide, recherche sans résultat.
 * Paramètre de route : `complexeId` (sinon SON complexe). Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeClients() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  const { complexeId } = useComplexeChoisi(params?.complexeId);
  const [onglet, setOnglet] = useState(/** @type {OngletDesClients} */ ('tous'));
  const [saisie, setSaisie] = useState('');
  const recherche = saisie.trim();
  const lecture = useClientsDuComplexe(complexeId, { onglet, recherche });
  const clients = lignesDesPages(lecture.data);
  // RESA-FIN-APP (20/10) — sur ordinateur, la fiche d'un client s'ouvre dans le VOLET de droite, la
  // liste reste à gauche (plan :279, :1007 ; reste de RESA-L5B-2), comme E-G04 et E-G06.
  const surOrdinateur = useIsDesktop();
  const [choisi, setChoisi] = useState(/** @type {string | null} */ (null));

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };
  /** @type {Record<string, string>} */
  const libelles = {
    bannis: t('complexeClients.liste.bannis', 'Bannis'),
    habitues: t('complexeClients.liste.habitues', 'Habitués'),
    tous: t('complexeClients.liste.tous', 'Tous'),
  };

  const ligneDe = (/** @type {any} */ client) => {
    const nom = nomComplet(client);
    const resume = resumeDuClient(t, client);
    const banni = client.banni ? t('complexeClients.fiche.banni', 'Banni') : '';
    return (
      <TouchableOpacity
        accessibilityLabel={[nom, resume, banni].filter(Boolean).join(', ')}
        accessibilityRole="button"
        key={client.documentId}
        onPress={() => (surOrdinateur
          ? setChoisi(client.documentId)
          : navigation.navigate(RouteNames.ComplexeClient, {
            complexeId, joueurId: client.documentId,
          }))}
        style={[carte, Alignments.row, Alignments.alignCenter, Spaces.padding[12], {
          gap: 12, minHeight: 64,
        }]}
        testID={`client-ligne-${client.documentId}`}
      >
        <View
          style={[Alignments.alignCenter, Alignments.justifyCenter, {
            backgroundColor: Colors.primary700, borderRadius: 999, height: 44, width: 44,
          }]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{initialesDe(client)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{nom}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{resume}</Text>
          {client.banni ? (
            <View
              style={[Alignments.row, Alignments.alignCenter, {
                alignSelf: 'flex-start',
                backgroundColor: withAlpha(Colors.error500, 0.14),
                borderColor: withAlpha(Colors.error500, 0.55),
                borderRadius: 999,
                borderWidth: 1,
                gap: 4,
                marginTop: 2,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }]}
              testID={`client-ligne-${client.documentId}-banni`}
            >
              <GlyphIcon color={Colors.error500} name="ban" size={12} />
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                {t('complexeClients.fiche.banni', 'Banni')}
              </Text>
            </View>
          ) : null}
        </View>
        <GlyphIcon color={Colors.primary200} name="chevronRight" size={12} />
      </TouchableOpacity>
    );
  };

  let corps;
  if (lecture.isLoading) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="clients-squelette">
        {[1, 2, 3].map((ligne) => (
          <View
            key={ligne}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: 64 },
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
          {t('complexeClients.liste.erreur', 'Impossible de charger tes clients.')}
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
  } else if (!clients.length && recherche) {
    corps = (
      <View style={[carte, Spaces.padding[16]]} testID="clients-recherche-vide">
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {t(
            'complexeClients.liste.rechercheVide',
            'Aucun client « {{recherche}} ». '
            + 'Une réservation à l’extérieur n’a pas de fiche client.',
            { recherche, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      </View>
    );
  } else if (!clients.length) {
    const vides = {
      bannis: t('complexeClients.liste.videBannis', 'Aucun client banni.'),
      habitues: t(
        'complexeClients.liste.videHabitues',
        'Pas encore d’habitué : un client le devient à sa 3e partie jouée chez toi.',
      ),
      tous: t(
        'complexeClients.liste.vide',
        'Tes clients apparaîtront après leur première réservation.',
      ),
    };
    corps = <EmptyState title={vides[onglet]} />;
  } else {
    corps = (
      <View style={{ gap: 8 }}>
        {clients.map(ligneDe)}
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

  // Le volet ouvre le client touché, sinon le premier de la liste (comme E-G04).
  const joueurDuVolet = choisi || clients[0]?.documentId || null;
  const volet = surOrdinateur && joueurDuVolet ? (
    <ComplexeClient
      complexeId={complexeId}
      dansUnVolet
      joueurId={joueurDuVolet}
      key={joueurDuVolet}
    />
  ) : null;

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <DeuxVolets actif={surOrdinateur} droite={volet}>
        <ScrollView
        // Sur ordinateur, une colonne de 720 px au plus, centrée (comme la fiche).
          contentContainerStyle={{
            alignSelf: 'center',
            gap: 16,
            maxWidth: 720,
            paddingBottom: 24,
            paddingTop: 12,
            width: '100%',
          }}
          keyboardShouldPersistTaps="handled"
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
            {t('complexeClients.liste.titre', 'Clients').toUpperCase()}
          </Text>
          <SearchBar
            onChangeText={setSaisie}
            placeholder={t('complexeClients.liste.chercher', 'Chercher un client')}
            value={saisie}
            withCalendar={false}
            withFilter={false}
          />
          <SegmentedControl
            onChange={(valeur) => setOnglet(/** @type {OngletDesClients} */ (valeur))}
            options={ONGLETS_CLIENTS.map((cle) => ({
              label: libelles[cle],
              value: cle,
            }))}
            value={onglet}
          />
          {corps}
        </ScrollView>
      </DeuxVolets>
    </ScreenContainer>
  );
}

export default ComplexeClients;
