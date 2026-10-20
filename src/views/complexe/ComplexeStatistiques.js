import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  avecMarqueUtf8,
  PERIODES_CHIFFRES,
  tauxLisible,
} from '@/domains/collectivite/collectiviteChiffres';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import JaugeOccupation from '@/views/collectivite/components/JaugeOccupation';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { useChiffresDuComplexe, useComplexeChoisi } from '@/services/complexe/complexeQueries';
import { lireExportChiffres } from '@/services/complexe/complexeService';

// Résolution par suffixe de plateforme (`.native.js` / `.web.js`), comme l'écran des chiffres de la
// Ville : le contrôle de types ne voit aucun fichier à ce chemin exact.
// @ts-ignore -- cf. ci-dessus
import { saveTextFile } from '@/platform/media/saveTextFile';
import { useIsDesktop } from '@/responsive';

/** @typedef {'mois' | 'saison' | 'semaine'} PeriodeDesChiffres */

/**
 * Un nombre du serveur, ou 0.
 * @param {unknown} valeur - La valeur.
 * @returns {number} Le nombre.
 */
const nombre = (valeur) => (Number.isFinite(Number(valeur)) ? Number(valeur) : 0);

/**
 * E-G17 — LES STATISTIQUES DU COMPLEXE (V1) — RESA-L5B-2 (20/10/2026), planche EG17-EG18 (états 1
 * à 3) ; plan :1053-1087 ; RC-G12 ; serveur RESA-L4 (`GET /complexes/:id/chiffres?periode`,
 * `GET …/chiffres/export`). L'écran des chiffres de la Ville repris (les mêmes périodes, le même
 * taux lisible, la même jauge, le même export avec sa marque UTF-8), « en remplaçant la
 * collectivité par le complexe ». Dans l'ordre : la période (Semaine · Mois · Saison),
 * « OCCUPATION » (le taux du complexe, une ligne par terrain avec sa jauge ; sans horaires :
 * « — »), « RÉSERVATIONS » (dans
 * l'app, extérieures, annulées dont hors délai, non honorées), « FAVORIS » (total, nouveaux sur la
 * période), « CLIENTS FIDÈLES » (les 5 qui ont le plus joué ; un client ouvre sa fiche, E-G15),
 * « PAR HEURE » (la carte de chaleur : V2), puis « Exporter (CSV) ». Le taux se calcule sur les
 * créneaux du modèle (pas 24 h) ; les réservations « extérieur » comptent dans l'occupation (le
 * serveur). Sur ordinateur : deux colonnes. États : chargement, erreur, période vide.
 * Paramètre de route : `complexeId` (sinon SON complexe). Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeStatistiques() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  const { complexe, complexeId } = useComplexeChoisi(params?.complexeId);
  const [periode, setPeriode] = useState(/** @type {PeriodeDesChiffres} */ ('semaine'));
  const lecture = useChiffresDuComplexe(complexeId, periode);
  const surOrdinateur = useIsDesktop();
  const [exportEtat, setExportEtat] = useState(
    /** @type {{ enCours: boolean, texte: string, ton: 'erreur' | 'ok' } | null} */ (null),
  );
  const chiffres = lecture.data || null;

  const bloc = (
    /** @type {string} */ titre,
    /** @type {string} */ testID,
    /** @type {import('react').ReactNode} */ contenu,
    /** @type {boolean} */ attenue = false,
  ) => (
    <View
      style={[Spaces.padding[16], {
        backgroundColor: withAlpha(Colors.neutral00, attenue ? 0.02 : 0.04),
        borderColor: withAlpha(Colors.neutral00, 0.09),
        borderRadius: 16,
        borderWidth: 1,
        // Sur téléphone, toute la largeur : « auto » prenait celle du contenu et la ligne d'un
        // terrain (nom, jauge, taux) débordait à droite (mesuré à 390 px sur le site, 20/10).
        flexBasis: surOrdinateur ? '45%' : '100%',
        flexGrow: 1,
        gap: 10,
        opacity: attenue ? 0.7 : 1,
      }]}
      testID={testID}
    >
      <Text
        accessibilityRole="header"
        style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}
      >
        {titre.toUpperCase()}
      </Text>
      {contenu}
    </View>
  );
  const ligne = (/** @type {string} */ texte, /** @type {string} */ cle) => (
    <Text key={cle} style={[Fonts.p2, Fonts.neutral00]}>{texte}</Text>
  );
  const periodes = {
    mois: t('complexeStats.periodes.mois', 'Mois'),
    saison: t('complexeStats.periodes.saison', 'Saison'),
    semaine: t('complexeStats.periodes.semaine', 'Semaine'),
  };

  const exporter = async () => {
    if (!complexeId || exportEtat?.enCours) return;
    setExportEtat({ enCours: true, texte: '', ton: 'ok' });
    try {
      const csv = await lireExportChiffres(complexeId, periode);
      const depuis = String(chiffres?.from || '');
      const debut = /^\d{4}-\d{2}-\d{2}$/.test(depuis) ? `-${depuis}` : '';
      await saveTextFile({
        contenu: avecMarqueUtf8(csv),
        fileName: `statistiques-${String(complexe?.slug || 'complexe')}-${periode}${debut}.csv`,
        mimeType: 'text/csv',
      });
      setExportEtat({
        enCours: false, texte: t('complexeStats.exportOk', 'Fichier enregistré.'), ton: 'ok',
      });
    } catch {
      setExportEtat({
        enCours: false,
        texte: t('complexeStats.exportErreur', 'Le fichier n’a pas pu être créé. Réessaie.'),
        ton: 'erreur',
      });
    }
  };

  let corps;
  if (lecture.isLoading) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="stats-squelette">
        {[140, 120, 96].map((hauteur) => (
          <View
            key={hauteur}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: hauteur },
            ]}
          />
        ))}
      </View>
    );
  } else if (!chiffres) {
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
          {t('complexeStats.erreur', 'Impossible de calculer tes chiffres.')}
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
  } else {
    const resa = chiffres.reservations || {};
    const vide = ['app', 'exterieur', 'annulees', 'nonHonorees']
      .every((cle) => nombre(resa[cle]) === 0);
    const occupation = chiffres.occupation || {};
    const terrains = Array.isArray(occupation.terrains) ? occupation.terrains : [];
    const sansHoraires = terrains.some((/** @type {any} */ terrain) => terrain?.taux === null);
    const fideles = Array.isArray(chiffres.clientsFideles) ? chiffres.clientsFideles : [];
    const parTerrain = (
      <View style={{ gap: 10 }}>
        <Text style={[Fonts.h2Black, Fonts.neutral00]}>{tauxLisible(occupation.taux)}</Text>
        {terrains.map((/** @type {any} */ terrain) => (
          <View
            accessibilityLabel={`${terrain.name} : ${tauxLisible(terrain.taux)}`}
            accessible
            key={terrain.documentId}
            style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 28 }]}
          >
            <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { width: 120 }]}>
              {terrain.name}
            </Text>
            <View style={{ flex: 1 }}>
              <JaugeOccupation taux={terrain.taux ?? null} />
            </View>
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { minWidth: 48, textAlign: 'right' }]}>
              {tauxLisible(terrain.taux)}
            </Text>
          </View>
        ))}
        {sansHoraires ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'complexeStats.sansHoraires',
              'Pas d’horaires : ouvre ses créneaux pour calculer le taux.',
            )}
          </Text>
        ) : null}
      </View>
    );
    const resas = [
      ligne(t('complexeStats.app', '{{count}} faites dans l’app', {
        count: nombre(resa.app),
        defaultValue_one: '{{count}} faite dans l’app',
        defaultValue_other: '{{count}} faites dans l’app',
      }), 'app'),
      ligne(t('complexeStats.exterieur', '{{count}} extérieures', {
        count: nombre(resa.exterieur),
        defaultValue_one: '{{count}} extérieure',
        defaultValue_other: '{{count}} extérieures',
      }), 'exterieur'),
      ligne(t('complexeStats.annulees', '{{count}} annulées, dont {{horsDelai}} hors délai', {
        count: nombre(resa.annulees),
        defaultValue_one: '{{count}} annulée, dont {{horsDelai}} hors délai',
        defaultValue_other: '{{count}} annulées, dont {{horsDelai}} hors délai',
        horsDelai: nombre(resa.annuleesHorsDelai),
      }), 'annulees'),
      ligne(t('complexeStats.nonHonorees', '{{count}} non honorées', {
        count: nombre(resa.nonHonorees),
        defaultValue_one: '{{count}} non honorée',
        defaultValue_other: '{{count}} non honorées',
      }), 'non-honorees'),
    ];
    const lesFavoris = [
      ligne(t('complexeStats.favorisTotal', '{{count}} au total', {
        count: nombre(chiffres.favoris?.total),
      }), 'total'),
      ligne(t('complexeStats.favorisNouveaux', '{{count}} nouveaux sur la période', {
        count: nombre(chiffres.favoris?.nouveaux),
        defaultValue_one: '{{count}} nouveau sur la période',
        defaultValue_other: '{{count}} nouveaux sur la période',
      }), 'nouveaux'),
    ];
    const ouvrirLeClient = (/** @type {any} */ client) => {
      if (!client.documentId) return;
      navigation.navigate(RouteNames.ComplexeClient, { complexeId, joueurId: client.documentId });
    };
    const lesFideles = fideles.length ? fideles.map((/** @type {any} */ client) => (
      <TouchableOpacity
        accessibilityRole="button"
        key={client.documentId || client.nom}
        onPress={() => ouvrirLeClient(client)}
        style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{client.nom}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('complexeStats.parties', '{{count}} parties', {
            count: nombre(client.parties),
            defaultValue_one: '{{count}} partie',
            defaultValue_other: '{{count}} parties',
          })}
        </Text>
        <GlyphIcon color={Colors.primary200} name="chevronRight" size={12} />
      </TouchableOpacity>
    )) : (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t('complexeStats.aucunFidele', 'Aucune partie jouée sur cette période.')}
      </Text>
    );
    const parHeure = (
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t('complexeStats.parHeureDit', 'Jours × heures : la carte de chaleur viendra en V2.')}
      </Text>
    );
    corps = (
      <View style={{ gap: 12 }}>
        {vide ? (
          <BandeauComplexe
            testID="stats-vide"
            texte={t('complexeStats.vide', 'Pas encore de réservations sur cette période.')}
          />
        ) : null}
        <View style={[Alignments.row, Alignments.wrap, { gap: 12 }]}>
          {bloc(t('complexeStats.occupation', 'Occupation'), 'stats-occupation', parTerrain)}
          {bloc(t('complexeStats.reservations', 'Réservations'), 'stats-reservations', resas)}
          {bloc(t('complexeStats.favoris', 'Favoris'), 'stats-favoris', lesFavoris)}
          {bloc(t('complexeStats.fideles', 'Clients fidèles'), 'stats-fideles', lesFideles)}
          {bloc(t('complexeStats.parHeure', 'Par heure · V2'), 'stats-par-heure', parHeure, true)}
        </View>
        {exportEtat?.texte ? (
          <BandeauComplexe
            testID="stats-export"
            texte={exportEtat.texte}
            ton={exportEtat.ton === 'ok' ? 'ok' : 'erreur'}
          />
        ) : null}
        <Button
          isLoading={Boolean(exportEtat?.enCours)}
          onPress={exporter}
          title={t('complexeStats.exporter', 'Exporter (CSV)')}
          variant="Secondary"
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
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: surOrdinateur ? 1120 : 720,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
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
          {t('complexeStats.titre', 'Statistiques').toUpperCase()}
        </Text>
        <SegmentedControl
          onChange={(valeur) => {
            setExportEtat(null);
            setPeriode(/** @type {PeriodeDesChiffres} */ (valeur));
          }}
          options={PERIODES_CHIFFRES.map((cle) => ({ label: periodes[cle], value: cle }))}
          value={periode}
        />
        {corps}
      </ScrollView>
    </ScreenContainer>
  );
}

export default ComplexeStatistiques;
