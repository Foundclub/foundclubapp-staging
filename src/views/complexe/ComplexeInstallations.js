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
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import CarteTerrain from '@/views/complexe/components/CarteTerrain';
import FeuilleRetrait from '@/views/complexe/components/FeuilleRetrait';

import { RouteNames } from '@/navigation/routeNames';

import { useTerrains } from '@/services/complexe/complexeQueries';

import { useIsDesktop } from '@/responsive';

/**
 * E-G07 — « MES INSTALLATIONS » — RESA-L5A1 (13/10/2026), planche EG07 : la case « Gérer mes
 * installations » (les mots d'Adel). Modèle : `FacilityList.js` en mode Ville (carte à liseré,
 * menu « Plus d'actions »). Une carte par terrain : photo ou pictogramme, « Foot à 5 · Extérieur ·
 * 10 joueurs », le mode, le prix indicatif, les horaires — ou « Aucun créneau ouvert » en orange.
 * Le menu « … » propose « Créneaux » (E-G09) ; RESA-L5A2 (14/10/2026) y ajoute « Fermetures »
 * (E-G10), « Voir le planning » (E-G03) et « Retirer » (le compte des réservations à venir,
 * puis le retrait : serveur RESA-L2A).
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
  const [aRetirer, setARetirer] = useState(/** @type {any} */ (null));
  const [message, setMessage] = useState('');

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
  // RESA-L5A2 — Fermetures (E-G10), Voir le planning (E-G03), Retirer.
  const ouvrirLesFermetures = (/** @type {any} */ terrain) => {
    setMenu(null);
    navigation.navigate(RouteNames.ComplexeFermetures, {
      complexeId,
      terrainId: terrain.documentId,
    });
  };
  const voirLePlanning = (/** @type {any} */ terrain) => {
    setMenu(null);
    navigation.navigate(RouteNames.ComplexeEspace, {
      params: { complexeId, terrainId: terrain.documentId },
      screen: RouteNames.ComplexePlanning,
    });
  };
  const proposerLeRetrait = (/** @type {any} */ terrain) => {
    setMenu(null);
    setMessage('');
    setARetirer(terrain);
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
        {message ? <BandeauComplexe texte={message} ton="ok" /> : null}
        {corps}
      </ScrollView>
      <BottomModal close={() => setMenu(null)} isVisible={Boolean(menu)} webPresentation="dialog">
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{String(menu?.name || '')}</Text>
          {[
            {
              icone: Images.calendar,
              libelle: t('complexeGerant.installations.creneaux', 'Créneaux'),
              onPress: () => ouvrirLesCreneaux(menu),
            },
            {
              icone: Images.close,
              libelle: t('complexeReservations.installations.fermetures', 'Fermetures'),
              onPress: () => ouvrirLesFermetures(menu),
            },
            {
              icone: Images.calendar,
              libelle: t('complexeReservations.installations.voirPlanning', 'Voir le planning'),
              onPress: () => voirLePlanning(menu),
            },
            {
              danger: true,
              icone: Images.trash,
              libelle: t('complexeReservations.installations.retirer', 'Retirer'),
              onPress: () => proposerLeRetrait(menu),
            },
          ].map((entree) => (
            <TouchableOpacity
              accessibilityRole="menuitem"
              key={entree.libelle}
              onPress={entree.onPress}
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
                source={entree.icone}
                style={[
                  ApplicationStyle.icon20,
                  entree.danger
                    ? ApplicationStyle.tintColor.error500
                    : ApplicationStyle.tintColor.primary500,
                ]}
              />
              <Text style={[Fonts.p2Bold, entree.danger ? Fonts.error300 : Fonts.neutral00]}>
                {entree.libelle}
              </Text>
            </TouchableOpacity>
          ))}
          <Button
            onPress={() => setMenu(null)}
            title={t('complexeGerant.creation.fermer', 'Fermer')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
      <FeuilleRetrait
        complexeId={complexeId || null}
        onFermer={() => setARetirer(null)}
        onRetire={({ annulees, nom }) => {
          setARetirer(null);
          setMessage(t(
            'complexeReservations.retrait.fait',
            '{{nom}} est retiré. {{count}} réservations annulées, les joueurs sont prévenus.',
            {
              count: annulees,
              defaultValue_one:
                '{{nom}} est retiré. {{count}} réservation annulée, le joueur est prévenu.',
              defaultValue_other:
                '{{nom}} est retiré. {{count}} réservations annulées, les joueurs sont prévenus.',
              nom,
              ...SANS_ECHAPPEMENT,
            },
          ));
        }}
        terrain={aRetirer}
      />
    </ScreenContainer>
  );
}

export default ComplexeInstallations;
