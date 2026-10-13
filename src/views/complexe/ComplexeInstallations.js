import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import CarteTerrain from '@/views/complexe/components/CarteTerrain';

import { RouteNames } from '@/navigation/routeNames';

import { useTerrains } from '@/services/complexe/complexeQueries';

import { useIsDesktop } from '@/responsive';

/**
 * E-G07 — « MES INSTALLATIONS » — RESA-L5A1 (13/10/2026), planche EG07 : la case « Gérer mes
 * installations » (les mots d'Adel). Modèle : `FacilityList.js` en mode Ville (carte à liseré,
 * menu « Plus d'actions »). Une carte par terrain : photo ou pictogramme, « Foot à 5 · Extérieur ·
 * 10 joueurs », le mode, le prix indicatif, les horaires — ou « Aucun créneau ouvert » en orange.
 * Le menu « … » propose « Créneaux » (E-G09) ; « Fermetures » (E-G10), « Voir le planning »
 * (E-G03) et « Retirer » attendent les lots L5A2 / L2A (le serveur ne sait pas encore retirer un
 * terrain) et n'y figurent pas.
 * Paramètre de route : `complexeId`. Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeInstallations() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  const complexeId = params?.complexeId;
  const terrainsLus = useTerrains(complexeId);
  const surOrdinateur = useIsDesktop();
  const [menu, setMenu] = useState(/** @type {any} */ (null));

  const terrains = Array.isArray(terrainsLus.data) ? terrainsLus.data : [];
  const ajouter = () => navigation.navigate(RouteNames.ComplexeTerrain, { complexeId });
  const ouvrirLaFiche = (/** @type {any} */ terrain) => navigation.navigate(
    RouteNames.ComplexeTerrain,
    { complexeId, terrainId: terrain.documentId },
  );
  const ouvrirLesCreneaux = (/** @type {any} */ terrain) => {
    setMenu(null);
    navigation.navigate(RouteNames.ComplexeCreneaux, {
      complexeId,
      terrainId: terrain.documentId,
    });
  };

  let sousTitre = '';
  if (terrains.length === 1) sousTitre = t('complexeGerant.installations.unTerrain', '1 terrain');
  else if (terrains.length > 1) {
    sousTitre = t('complexeGerant.installations.nTerrains', '{{nombre}} terrains', {
      nombre: terrains.length,
      ...SANS_ECHAPPEMENT,
    });
  }

  const enTete = (
    <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          accessibilityRole="header"
          style={[
            Fonts.h2Black,
            Fonts.neutral00,
            { flexGrow: 1, flexShrink: 1, letterSpacing: 1 },
          ]}
        >
          {t('complexeGerant.installations.titre', 'Mes installations').toUpperCase()}
        </Text>
        {sousTitre ? <Text style={[Fonts.p2, Fonts.neutral200]}>{sousTitre}</Text> : null}
      </View>
      <TouchableOpacity
        accessibilityLabel={t('complexeGerant.accueil.ajouterTerrain', 'Ajouter un terrain')}
        accessibilityRole="button"
        onPress={ajouter}
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          ApplicationStyle.borderRadius16,
          ApplicationStyle.backgroundColor.primary500,
          { height: 48, width: 48 },
        ]}
        testID="complexe-installations-ajouter"
      >
        <Image
          source={Images.plus}
          style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary900]}
        />
      </TouchableOpacity>
    </View>
  );

  let corps;
  if (terrainsLus.isLoading) {
    corps = (
      <View style={{ gap: 12 }} testID="complexe-installations-squelette">
        {[1, 2].map((ligne) => (
          <View
            accessibilityState={{ busy: true }}
            key={ligne}
            style={[
              ApplicationStyle.borderRadius24,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: 160 },
            ]}
          />
        ))}
      </View>
    );
  } else if (terrainsLus.error) {
    corps = (
      <View
        accessibilityRole="alert"
        style={{
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.4),
          borderRadius: 16,
          borderWidth: 1,
          gap: 8,
          padding: 16,
        }}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeGerant.installations.erreur', 'Impossible de charger tes terrains.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => terrainsLus.refetch?.()}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else if (!terrains.length) {
    corps = (
      <EmptyState
        actionLabel={t('complexeGerant.accueil.ajouterTerrain', 'Ajouter un terrain')}
        icon={Images.stadium}
        onAction={ajouter}
        title={t('complexeGerant.installations.vide', 'Tu n’as pas encore de terrain.')}
      />
    );
  } else {
    // Site (planche EG07, rubrique 9) : une grille de 2 ou 3 cartes ; téléphone : une liste.
    corps = (
      <View style={[surOrdinateur ? [Alignments.row, Alignments.wrap] : null, { gap: 12 }]}>
        {terrains.map((terrain) => (
          <View
            key={terrain.documentId}
            style={surOrdinateur ? { flexBasis: 360, flexGrow: 1, maxWidth: 560 } : null}
          >
            <CarteTerrain
              onOuvrir={() => ouvrirLaFiche(terrain)}
              onPlus={() => setMenu(terrain)}
              terrain={terrain}
            />
          </View>
        ))}
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
            onRefresh={() => terrainsLus.refetch?.()}
            refreshing={Boolean(terrainsLus.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {enTete}
        {corps}
      </ScrollView>
      <BottomModal close={() => setMenu(null)} isVisible={Boolean(menu)} webPresentation="dialog">
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{String(menu?.name || '')}</Text>
          <TouchableOpacity
            accessibilityRole="menuitem"
            onPress={() => ouvrirLesCreneaux(menu)}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              {
                backgroundColor: withAlpha(Colors.neutral00, 0.04),
                borderColor: withAlpha(Colors.neutral00, 0.1),
                borderRadius: 14,
                borderWidth: 1,
                gap: 12,
                minHeight: 52,
                paddingHorizontal: 16,
              },
            ]}
          >
            <Image
              source={Images.calendar}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary500]}
            />
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('complexeGerant.installations.creneaux', 'Créneaux')}
            </Text>
          </TouchableOpacity>
          <Button
            onPress={() => setMenu(null)}
            title={t('complexeGerant.creation.fermer', 'Fermer')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default ComplexeInstallations;
