import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  jourCourt,
  ONGLETS_CONSOLE,
  pastillesDuComplexe,
} from '@/domains/complexe/consoleDesComplexes';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import FicheComplexeConsole from '@/views/admin/components/FicheComplexeConsole';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import LogoComplexe from '@/views/complexe/components/LogoComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { useConsoleDesComplexes } from '@/services/complexe/complexeQueries';

// La planche ES01 (état 1) : sur ordinateur, la liste et la fiche côte à côte (comme OR1).
const LARGEUR_DEUX_VOLETS = 1024;

/**
 * E-S01 — LA CONSOLE DES COMPLEXES (SuperAdmin) — RESA-L5B-2 (20/10/2026), planche ES01 (états
 * 1, 2, 5), plan :1806-1850, serveur RESA-L4 (`GET /superadmin/complexes`). Écran de départ :
 * AdminCollectiviteList. « CONSOLE » « Complexes », la recherche (nom ou ville, au serveur), les
 * onglets « À traiter (n) » (un signalement ouvert, ou créé depuis 7 jours) · « Tous » ·
 * « Suspendus », puis une ligne par complexe : logo, nom, « Ville · créé le 13/10 », pastilles
 * « 2 signalements » / « Suspendu » / « Retiré » / « Nouveau ». Sur téléphone, une ligne ouvre la
 * fiche (AdminComplexeDetail) ; sur ordinateur, la fiche s'ouvre dans le volet de droite.
 * États : chargement, erreur (« Réessayer »), « Rien à traiter. », « Aucun complexe pour
 * l'instant. ». Seul un SuperAdmin arrive ici (AdminStack) ; le serveur le revérifie.
 * Caché par `COMPLEXES_GERANT` (la route n'existe pas tant qu'il est éteint).
 * @returns {import('react').ReactElement} L'écran.
 */
function AdminComplexeList() {
  const { t } = useTranslation();
  const navigation = /** @type {any} */ (useNavigation());
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const deuxVolets = useWindowDimensions().width >= LARGEUR_DEUX_VOLETS;
  const [onglet, setOnglet] = useState(/** @type {string} */ ('a-traiter'));
  const [recherche, setRecherche] = useState('');
  const [choisi, setChoisi] = useState(/** @type {string | null} */ (null));
  const lecture = useConsoleDesComplexes(onglet, recherche.trim());

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderWidth: 1,
  };
  const compteurs = lecture.data?.compteurs || {};
  const lignes = Array.isArray(lecture.data?.items) ? lecture.data.items : [];
  const ouvrir = (/** @type {string} */ complexeId) => {
    if (deuxVolets) setChoisi(complexeId);
    else navigation.navigate(RouteNames.AdminComplexeDetail, { complexeId });
  };

  const libellePastille = (/** @type {{ cle: string, nombre?: number }} */ pastille) => {
    switch (pastille.cle) {
      case 'retire':
        return t('complexeConsole.pastilles.retire', 'Retiré');
      case 'signalements':
        return t('complexeConsole.pastilles.signalements', {
          count: pastille.nombre,
          defaultValue_one: '{{count}} signalement',
          defaultValue_other: '{{count}} signalements',
        });
      case 'suspendu':
        return t('complexeConsole.pastilles.suspendu', 'Suspendu');
      default:
        return t('complexeConsole.pastilles.nouveau', 'Nouveau');
    }
  };
  const couleurPastille = (/** @type {string} */ cle) => {
    if (cle === 'signalements' || cle === 'retire') return Colors.error500;
    if (cle === 'suspendu') return Colors.warning500;
    return Colors.primary500;
  };

  const renderLigne = (/** @type {any} */ ligne) => {
    const pastilles = pastillesDuComplexe(ligne);
    const sousTitre = [
      ligne.city,
      t('complexeConsole.creeLe', 'créé le {{date}}', {
        date: jourCourt(ligne.createdAt), ...SANS_ECHAPPEMENT,
      }),
    ].filter(Boolean).join(' · ');
    const actif = deuxVolets && choisi === ligne.documentId;
    return (
      <TouchableOpacity
        accessibilityLabel={[ligne.name, sousTitre, ...pastilles.map(libellePastille)].join(', ')}
        accessibilityRole="button"
        accessibilityState={{ selected: actif }}
        key={ligne.documentId}
        onPress={() => ouvrir(ligne.documentId)}
        style={[
          ApplicationStyle.borderRadius16,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.padding[12],
          carte,
          actif ? { borderColor: Colors.primary500 } : null,
          { gap: 12 },
        ]}
        testID={`console-complexe-${ligne.documentId}`}
      >
        <LogoComplexe logo={ligne.logo || null} nom={String(ligne.name || '')} taille={40} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>{ligne.name}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{sousTitre}</Text>
          {pastilles.length ? (
            <View style={[Alignments.row, Alignments.wrap, { gap: 6 }]}>
              {pastilles.map((pastille) => (
                <Text
                  key={pastille.cle}
                  style={[Fonts.p3Bold, Spaces.paddingHorizontal[8], {
                    backgroundColor: withAlpha(couleurPastille(pastille.cle), 0.16),
                    borderRadius: 999,
                    color: couleurPastille(pastille.cle),
                    paddingVertical: 2,
                  }]}
                >
                  {libellePastille(pastille)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
        <SvgIcon color={Colors.neutral300} name="arrow-right" />
      </TouchableOpacity>
    );
  };

  const onglets = ONGLETS_CONSOLE.map((cle) => {
    let label = t('complexeConsole.onglets.tous', 'Tous');
    if (cle === 'a-traiter') {
      label = t('complexeConsole.onglets.aTraiter', 'À traiter ({{nombre}})', {
        nombre: Number(compteurs.aTraiter) || 0,
      });
    } else if (cle === 'suspendus') {
      label = t('complexeConsole.onglets.suspendus', 'Suspendus');
    }
    return { label, value: cle };
  });
  const libelleRecherche = t('complexeConsole.chercher', 'Chercher un complexe');
  let vide = t('complexeConsole.vide', 'Aucun complexe pour l’instant.');
  if (recherche.trim()) vide = t('complexeConsole.aucunTrouve', 'Aucun complexe ne porte ce nom.');
  else if (onglet === 'a-traiter') vide = t('complexeConsole.rienATraiter', 'Rien à traiter.');
  else if (onglet === 'suspendus') {
    vide = t('complexeConsole.aucunSuspendu', 'Aucun complexe suspendu.');
  }

  let corps;
  if (lecture.isLoading) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="console-chargement">
        {[1, 2, 3].map((rang) => (
          <View
            key={rang}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: 76 },
            ]}
          />
        ))}
      </View>
    );
  } else if (lecture.isError || !lecture.data) {
    corps = (
      <BandeauComplexe
        action={t('complexeConsole.reessayer', 'Réessayer')}
        onAction={() => lecture.refetch?.()}
        testID="console-erreur"
        texte={t('complexeConsole.erreur', 'Impossible de charger les complexes.')}
        ton="erreur"
      />
    );
  } else if (!lignes.length) {
    corps = (
      <View
        style={[ApplicationStyle.borderRadius16, Spaces.padding[16], carte]}
        testID="console-vide"
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{vide}</Text>
      </View>
    );
  } else {
    corps = <View style={{ gap: 10 }}>{lignes.map(renderLigne)}</View>;
  }

  const liste = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>
          {t('adminCollectivites.kicker', 'Console').toUpperCase()}
        </Text>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('complexeConsole.titre', 'Complexes')}
        </Text>
      </View>
      <View
        style={[
          ApplicationStyle.borderRadius16,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingHorizontal[12],
          {
            borderColor: withAlpha(Colors.primary500, 0.5), borderWidth: 1, gap: 8, minHeight: 47,
          },
        ]}
      >
        <SvgIcon color={Colors.neutral300} name="search" />
        <TextInput
          accessibilityLabel={libelleRecherche}
          autoCorrect={false}
          onChangeText={setRecherche}
          placeholder={libelleRecherche}
          placeholderTextColor={Colors.neutral400}
          style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}
          testID="console-recherche"
          value={recherche}
        />
      </View>
      <SegmentedControl
        onChange={(/** @type {string} */ valeur) => setOnglet(valeur)}
        options={onglets}
        value={onglet}
      />
      {corps}
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
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
        {deuxVolets ? (
          <View style={[Alignments.row, { alignItems: 'flex-start', gap: 24 }]}>
            <View style={{ flex: 2 }}>{liste}</View>
            <View style={{ flex: 3 }} testID="console-volet-fiche">
              {choisi ? <FicheComplexeConsole complexeId={choisi} /> : (
                <View style={[ApplicationStyle.borderRadius16, Spaces.padding[16], carte]}>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {t(
                      'complexeConsole.choisir',
                      'Choisis un complexe dans la liste pour voir sa fiche.',
                    )}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : liste}
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminComplexeList;
