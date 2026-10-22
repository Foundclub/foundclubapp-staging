import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { libelleSport } from '@/domains/complexe/complexeTerrain';
import { contenuDEchec, varianteDEchec } from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ScreenContainer from '@/components/templates/ScreenContainer';
import FeuilleRetirerFavori from '@/views/reserverTerrain/components/FeuilleRetirerFavori';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import {
  useMesFavoris,
  useRelationsAuxComplexes,
  useRetirerDesFavoris,
} from '@/services/complexe/complexeJoueurQueries';

import { useIsDesktop } from '@/responsive';

const COLONNE = 720;
const LOGO = 44;

/**
 * Les initiales d'un complexe (« Le Five de Montrivage » ⇒ « LF »), comme le logo de la planche.
 * @param {unknown} nom - Le nom.
 * @returns {string} Deux lettres.
 */
const initiales = (nom) => String(nom || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((mot) => mot.charAt(0).toLocaleUpperCase())
  .join('');

/**
 * E-P11 — « MES COMPLEXES FAVORIS » — RESA-L6B-2 (20/10/2026), serveur RESA-L4, planche EP11, plan
 * E-P11 (A-G06, A-G08, Q5, AT-11 A, AT-15 A). Dans l'ordre de la fiche :
 *   1. « MES COMPLEXES FAVORIS » et leur nombre ;
 *   2. une carte par complexe : logo, nom, ville et sports, le cœur PLEIN (« Dans tes favoris :
 *      retirer ») et « Canal du complexe » quand on en est membre (E-P12 : la conversation du
 *      canal) ; toucher la carte ⇒ E-P02.
 * Le cœur ⇒ « Retirer des favoris ? Tu resteras dans le canal. » (Q5) et la case « Quitter aussi
 * le canal » (AT-11 A). Un complexe parti (suspendu, retiré) : « n'est plus disponible » et
 * « Retirer ». Vide : ce que le favori apporte et « Réserver un terrain » (E-P01). Chargement,
 * erreur.
 * ⛔ « Prochain créneau libre : ce soir 20 h » et « 2 nouveaux messages » : ni la liste des favoris
 * ni la relation au complexe ne les portent (serveur) — rien n'est affiché plutôt qu'un chiffre
 * deviné.
 * Ouvert par « Mon compte » et le raccourci de la recherche (E-P01). Caché par `COMPLEXES_JOUEUR`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverFavoris() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const surOrdinateur = useIsDesktop();
  const { dockClearance } = useBottomDockLayout();
  const lecture = useMesFavoris();
  const favoris = Array.isArray(lecture?.data) ? lecture.data : [];
  const { relations } = useRelationsAuxComplexes(favoris
    .filter((favori) => favori?.complexe?.disponible)
    .map((favori) => String(favori?.complexe?.slug || '')));
  const retirer = useRetirerDesFavoris();
  const [aRetirer, setARetirer] = useState(/** @type {any} */ (null));
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));

  const carte = {
    backgroundColor: withAlpha(Colors.primary800, 0.82),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  };

  const confirmerLeRetrait = async (
    /** @type {any} */ complexe,
    /** @type {boolean} */ quitter,
  ) => {
    setRefus(null);
    try {
      await retirer.mutateAsync({ quitterCanal: quitter, slug: complexe.slug });
      setARetirer(null);
    } catch (erreur) {
      setRefus(contenuDEchec(t, varianteDEchec(erreur), { erreur }).titre);
    }
  };

  let corps;
  if (lecture?.isLoading && !favoris.length) {
    corps = (
      <View style={{ gap: 12 }} testID="favoris-squelette">
        {[1, 2, 3].map((rang) => (
          <View
            accessibilityState={{ busy: true }}
            key={rang}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.06),
              borderRadius: 16,
              height: 96,
            }}
          />
        ))}
      </View>
    );
  } else if (lecture?.error && !favoris.length) {
    corps = (
      <View accessibilityRole="alert" style={carte}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('reserverTerrain.favoris.erreur', 'Impossible de charger tes favoris.')}
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
  } else if (!favoris.length) {
    corps = (
      <View style={[Alignments.alignCenter, { gap: 16, paddingTop: 24 }]}>
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
          <SvgIcon color={Colors.primary500} height={24} name="heart" width={24} />
        </View>
        <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
          {t(
            'reserverTerrain.favoris.vide',
            'Ajoute tes complexes préférés pour les retrouver ici et recevoir leurs nouvelles.',
          )}
        </Text>
        <Button
          onPress={() => navigateToSearchHub(navigation, 'reservations')}
          title={t('reserverTerrain.mesReservations.reserver', 'Réserver un terrain')}
          variant="Primary"
        />
      </View>
    );
  } else {
    corps = (
      <View style={{ gap: 12 }}>
        {favoris.map((favori) => {
          const complexe = favori?.complexe || {};
          const slug = String(complexe.slug || '');
          if (!complexe.disponible) {
            return (
              <View key={slug} style={[carte, { opacity: 0.85 }]}>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {t('reserverTerrain.favoris.plusDisponible', '{{nom}} n’est plus disponible', {
                    nom: String(complexe.name || ''),
                    ...SANS_ECHAPPEMENT,
                  })}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => confirmerLeRetrait(complexe, false)}
                  style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
                  testID={`favori-retirer-${slug}`}
                >
                  <Text style={[Fonts.p2Bold, Fonts.error300]}>
                    {t('reserverTerrain.favoris.retirer', 'Retirer')}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }
          const canal = relations?.[slug]?.canal;
          const sports = (Array.isArray(complexe.sports) ? complexe.sports : [])
            .map((/** @type {any} */ sport) => libelleSport(sport))
            .filter(Boolean)
            .join(', ');
          return (
            <View key={slug} style={carte}>
              <View style={[Alignments.row, { alignItems: 'flex-start', gap: 12 }]}>
                <TouchableOpacity
                  accessibilityLabel={String(complexe.name || '')}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate(RouteNames.ReserverComplexe, { slug })}
                  style={[Alignments.row, { flex: 1, gap: 12, minHeight: 44 }]}
                  testID={`favori-${slug}`}
                >
                  <View
                    style={[
                      Alignments.alignCenter,
                      Alignments.justifyCenter,
                      {
                        backgroundColor: withAlpha(Colors.primary500, 0.2),
                        borderRadius: 12,
                        height: LOGO,
                        width: LOGO,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p2Bold, Fonts.primary200]}>{initiales(complexe.name)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                      {String(complexe.name || '')}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {[complexe.city, sports].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={t(
                    'reserverTerrain.favoris.dansTesFavorisRetirer',
                    'Dans tes favoris : retirer',
                  )}
                  accessibilityRole="button"
                  onPress={() => {
                    setRefus(null);
                    setARetirer(complexe);
                  }}
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      backgroundColor: withAlpha(Colors.primary500, 0.16),
                      borderColor: withAlpha(Colors.primary500, 0.6),
                      borderRadius: 22,
                      borderWidth: 1,
                      height: 44,
                      width: 44,
                    },
                  ]}
                  testID={`favori-coeur-${slug}`}
                >
                  <SvgIcon color={Colors.primary500} height={20} name="heart-filled" width={20} />
                </TouchableOpacity>
              </View>
              {canal?.membre && canal?.chatId ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => navigation.navigate(RouteNames.Conversation, {
                    chatId: canal.chatId,
                  })}
                  style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
                >
                  <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                    {t('reserverTerrain.favoris.canal', 'Canal du complexe')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      boundedHeight
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 24 + (Platform.OS === 'web' ? dockClearance : 0),
          paddingTop: 12,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('reserverTerrain.favoris.titre', 'Mes complexes favoris').toUpperCase()}
          </Text>
          {favoris.length ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('reserverTerrain.favoris.nombre', {
                count: favoris.length,
                defaultValue_one: '{{count}} complexe',
                defaultValue_other: '{{count}} complexes',
              })}
            </Text>
          ) : null}
        </View>
        {refus && !aRetirer ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
        ) : null}
        {corps}
      </ScrollView>
      <FeuilleRetirerFavori
        enCours={Boolean(retirer?.isPending)}
        explication={t('reserverTerrain.favoris.resterasDansLeCanal', 'Tu resteras dans le canal.')}
        onFermer={() => setARetirer(null)}
        onRetirer={(quitter) => confirmerLeRetrait(aRetirer, quitter)}
        refus={aRetirer ? refus : null}
        visible={Boolean(aRetirer)}
      />
    </ScreenContainer>
  );
}

export default ReserverFavoris;
