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
  countAdminCollectivitesByFilter,
  filterAdminCollectivites,
  summarizeAdminCollectivites,
} from '@/domains/collectivite/collectiviteConsole';
import {
  collectiviteTypeLabel,
  formatCollectiviteDay,
  toAdminCollectiviteRow,
} from '@/domains/collectivite/collectiviteDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';
import {
  EcussonCollectivite,
  EtatCollectivite,
} from '@/views/admin/components/CollectiviteBadges';
import CollectivitesATraiter from '@/views/admin/components/CollectivitesATraiter';

import { RouteNames } from '@/navigation/routeNames';

import { useAdminCollectivites } from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * @typedef {import('@/domains/collectivite/collectiviteConsole').AdminCollectiviteFilter} Filtre
 * @typedef {ReturnType<typeof toAdminCollectiviteRow>} Ligne
 */

// Au-dela de cette largeur (site, tablette), la liste devient un vrai tableau (P2-liste-ordi).
const LARGEUR_TABLEAU = 768;

/**
 * 🏛️ CONSOLE › COLLECTIVITÉS — la liste (D61), restylée par COLL-CONSOLE (02/10/2026) selon la
 * planche P2-liste (design HY521H1, page 2, écran 2).
 *
 *   - « À traiter » en tête (planche P2-console) : mairies à activer, demandes de gestionnaire,
 *     de rattachement et « Par FoundClub » ;
 *   - « Créer une collectivité », une recherche par nom et trois filtres comptés ;
 *   - des LIGNES qui ouvrent la fiche : écusson, nom, type et clubs, état en pastille. « Activer
 *     / Couper » et « Gérer » quittent la liste : un geste qui touche l'abonnement de plusieurs
 *     clubs ne se fait plus d'un appui dans une liste, il se fait depuis la fiche, après avoir
 *     vu ce qu'il change ;
 *   - sur le site (large), un vrai tableau ;
 *   - chargement, vide (qui porte la création), erreur, liste tronquée, filtre sans résultat.
 * COLL-CONSOLE-BIS (03/10/2026) — la colonne « Activée le » du tableau (planche 13) : la date
 * posée par le serveur à l'activation, ou « — » (une Ville activée avant le lot, ou inactive).
 * COLL-CONSOLE-BIS (03/10/2026) — la colonne « Adhérents couverts » (planche 13) : la somme des
 * membres des clubs rattachés, comptée par le serveur dans la même lecture ; « — » sans nombre.
 * Seul un SuperAdmin arrive ici : la pile AdminStack n'est montée que pour lui
 * (PrivateNavigator) et le serveur refuse la lecture à tout autre compte (403, affiché).
 * @returns {import('react').ReactElement} L'écran.
 */
function AdminCollectiviteList() {
  const { t } = useTranslation();
  const navigation = /** @type {any} */ (useNavigation());
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { width } = useWindowDimensions();
  const tableau = width >= LARGEUR_TABLEAU;
  const collectivites = useAdminCollectivites();
  const [filtre, setFiltre] = useState(/** @type {Filtre} */ ('all'));
  const [recherche, setRecherche] = useState('');

  const ouvrirFiche = (/** @type {Ligne} */ ligne) => navigation.navigate(
    RouteNames.AdminCollectiviteDetail,
    { collectiviteId: ligne.documentId },
  );
  const creer = () => navigation.navigate(RouteNames.AdminCollectiviteForm);
  const ecran = [Spaces.paddingTop[12], Alignments.fill];
  const carteStyle = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderWidth: 1,
  };

  const enTete = (
    <View style={{ gap: 4 }}>
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>
        {t('adminCollectivites.kicker', 'Console').toUpperCase()}
      </Text>
      <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
        {t('adminCollectivites.list.title', 'Collectivités')}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'collectiviteConsole.liste.dit',
          // eslint-disable-next-line max-len
          'Une collectivité active offre l’offre Club à ses clubs rattachés, sauf à ceux qui paient déjà. Ouvre sa fiche pour l’activer ou la couper.',
        )}
      </Text>
    </View>
  );

  if (collectivites.isLoading) {
    const squelette = (/** @type {number} */ hauteur, /** @type {string} */ cle) => (
      <View
        key={cle}
        style={[
          ApplicationStyle.borderRadius16,
          { backgroundColor: withAlpha(Colors.neutral700, 0.6), height: hauteur },
        ]}
      />
    );
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen" contentContainerStyle={ecran}>
        <View
          accessibilityState={{ busy: true }}
          style={{ gap: 12 }}
          testID="collectivites-chargement"
        >
          {enTete}
          {squelette(47, 'recherche')}
          {squelette(96, 'ligne-1')}
          {squelette(96, 'ligne-2')}
          <Text style={[Fonts.p2, Fonts.neutral300]}>
            {t('adminCollectivites.list.loading', 'Lecture des collectivités…')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }
  if (collectivites.error) {
    return (
      <AdminStateView
        actionLabel={t('adminCollectivites.list.retry', 'Réessayer')}
        description={getErrorMessage(/** @type {any} */ (collectivites.error))}
        onAction={() => collectivites.refetch?.()}
        title={t('adminCollectivites.list.errorTitle', 'Collectivités indisponibles')}
      />
    );
  }

  const toutes = (Array.isArray(collectivites.data?.data) ? collectivites.data.data : [])
    .map(toAdminCollectiviteRow);
  const total = Number(collectivites.data?.meta?.pagination?.total) || toutes.length;
  const nombres = countAdminCollectivitesByFilter(toutes);
  const lignes = filterAdminCollectivites(toutes, { filter: filtre, query: recherche });
  const clubsDe = (/** @type {Ligne} */ ligne) => t('collectiviteConsole.liste.clubs', {
    count: ligne.clubsCount,
    defaultValue_one: '{{count}} club rattaché',
    defaultValue_other: '{{count}} clubs rattachés',
  });
  const libelleCreer = t('adminCollectivites.list.create', 'Créer une collectivité');
  const aTraiter = (
    <CollectivitesATraiter
      onShowToActivate={() => setFiltre('inactive')}
      toActivate={summarizeAdminCollectivites(toutes).toActivate}
    />
  );

  // L'état vide (aucune collectivité du tout) porte la création.
  if (toutes.length === 0) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen" contentContainerStyle={ecran}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }} style={Alignments.fill}>
          {enTete}
          {aTraiter}
          <View
            style={[Alignments.alignCenter, { gap: 12, paddingVertical: 24 }]}
            testID="collectivites-vide"
          >
            <SvgIcon color={Colors.primary200} height={40} name="flag" width={40} />
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('adminCollectivites.list.empty', 'Aucune collectivité pour l’instant.')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral300, Fonts.textCenter]}>
              {t(
                'collectiviteConsole.liste.videDit',
                'Crée la première mairie cliente : elle naîtra inactive.',
              )}
            </Text>
            <Button onPress={creer} size="sm" title={libelleCreer} variant="Secondary" />
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const renderLigne = (/** @type {Ligne} */ ligne) => {
    const libelleType = collectiviteTypeLabel(t, ligne.type);
    const libelleEtat = ligne.isActive
      ? t('adminCollectivites.status.active', 'Active')
      : t('adminCollectivites.status.inactive', 'Inactive');
    // Sur le site, une rangée du tableau ; sur téléphone, une carte. Toute la ligne ouvre la fiche.
    const contenuTableau = (
      <>
        <View style={[Alignments.row, Alignments.alignCenter, { flex: 3, gap: 12 }]}>
          <EcussonCollectivite name={ligne.name} size={36} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{ligne.name}</Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>{libelleType}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}><EtatCollectivite isActive={ligne.isActive} /></View>
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{String(ligne.clubsCount)}</Text>
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
          {ligne.membersCount === null ? '—' : String(ligne.membersCount)}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
          {/* FINITIONS15 point 8 : planche P2-liste-ordi, « jeu. 1 oct. ». */}
          {ligne.isActive ? formatCollectiviteDay(ligne.activatedAt) || '—' : '—'}
        </Text>
      </>
    );
    const contenuCarte = (
      <>
        <EcussonCollectivite name={ligne.name} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>{ligne.name}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{`${libelleType} · ${clubsDe(ligne)}`}</Text>
          <EtatCollectivite isActive={ligne.isActive} />
        </View>
      </>
    );
    return (
      <TouchableOpacity
        accessibilityLabel={[ligne.name, libelleType, libelleEtat, clubsDe(ligne)].join(', ')}
        accessibilityRole="button"
        key={ligne.documentId}
        onPress={() => ouvrirFiche(ligne)}
        style={tableau ? [
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          { borderTopColor: withAlpha(Colors.primary500, 0.25), borderTopWidth: 1, gap: 12 },
        ] : [
          ApplicationStyle.borderRadius16,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.padding[16],
          carteStyle,
          { gap: 12 },
        ]}
        testID={`admin-collectivite-${ligne.documentId}`}
      >
        {tableau ? contenuTableau : contenuCarte}
        <SvgIcon color={Colors.neutral300} name="arrow-right" />
      </TouchableOpacity>
    );
  };

  const libelleFiltreVide = {
    active: t('collectiviteConsole.liste.aucuneActive', 'Aucune collectivité active.'),
    all: t('collectiviteConsole.liste.aucuneTrouvee', 'Aucune collectivité ne porte ce nom.'),
    inactive: t('collectiviteConsole.liste.aucuneInactive', 'Aucune collectivité inactive.'),
  };
  const libelleRecherche = t('collectiviteConsole.liste.chercher', 'Chercher une collectivité');
  const filtres = [
    {
      label: t('collectiviteConsole.liste.toutes', 'Toutes ({{nombre}})', { nombre: nombres.all }),
      value: 'all',
    },
    {
      label: t('collectiviteConsole.liste.actives', 'Actives ({{nombre}})', {
        nombre: nombres.active,
      }),
      value: 'active',
    },
    {
      label: t('collectiviteConsole.liste.inactives', 'Inactives ({{nombre}})', {
        nombre: nombres.inactive,
      }),
      value: 'inactive',
    },
  ];
  const enTeteColonne = (/** @type {string} */ texte, /** @type {number} */ flex) => (
    <Text style={[Fonts.p3Bold, Fonts.neutral300, { flex }]}>{texte}</Text>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => collectivites.refetch?.()}
            refreshing={Boolean(collectivites.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {tableau ? (
          <View style={[Alignments.row, Alignments.alignEnd, { gap: 16 }]}>
            <View style={{ flex: 1 }}>{enTete}</View>
            <Button icon="plus" onPress={creer} title={libelleCreer} variant="Primary" />
          </View>
        ) : enTete}
        {aTraiter}
        {tableau ? null : (
          <Button icon="plus" onPress={creer} title={libelleCreer} variant="Primary" />
        )}
        <View style={[tableau ? Alignments.row : null, { gap: 12 }]}>
          <View
            style={[
              ApplicationStyle.borderRadius16,
              Alignments.row,
              Alignments.alignCenter,
              Spaces.paddingHorizontal[12],
              {
                borderColor: withAlpha(Colors.primary500, 0.5),
                borderWidth: 1,
                gap: 8,
                minHeight: 47,
                width: tableau ? 420 : '100%',
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
              testID="collectivites-recherche"
              value={recherche}
            />
          </View>
          <SegmentedControl
            onChange={(/** @type {string} */ valeur) => setFiltre(
              valeur === 'active' || valeur === 'inactive' ? valeur : 'all',
            )}
            options={filtres}
            value={filtre}
          />
        </View>
        {total > toutes.length ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'collectiviteConsole.liste.tronquee',
              '{{shown}} affichées sur {{total}}. Cherche par le nom pour trouver les autres.',
              { shown: toutes.length, total, ...SANS_ECHAPPEMENT },
            )}
          </Text>
        ) : null}
        {lignes.length === 0 ? (
          <View
            style={[ApplicationStyle.borderRadius16, Spaces.padding[16], carteStyle, { gap: 8 }]}
            testID="collectivites-filtre-vide"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {libelleFiltreVide[recherche.trim() ? 'all' : filtre]}
            </Text>
            <Button
              onPress={() => {
                setFiltre('all');
                setRecherche('');
              }}
              size="sm"
              title={t('collectiviteConsole.liste.voirToutes', 'Voir toutes les collectivités')}
              variant="Ghost"
            />
          </View>
        ) : null}
        {lignes.length > 0 && tableau ? (
          <View
            style={[
              ApplicationStyle.borderRadius16,
              Spaces.paddingHorizontal[16],
              Spaces.paddingVertical[8],
              carteStyle,
            ]}
          >
            <View style={[Alignments.row, Spaces.paddingVertical[8], { gap: 12 }]}>
              {enTeteColonne(t('collectiviteConsole.liste.colonneCollectivite', 'Collectivité'), 3)}
              {enTeteColonne(t('collectiviteConsole.liste.colonneEtat', 'État'), 1)}
              {enTeteColonne(t('collectiviteConsole.liste.colonneClubs', 'Clubs rattachés'), 1)}
              {enTeteColonne(
                t('collectiviteConsoleBis.liste.colonneAdherents', 'Adhérents couverts'),
                1,
              )}
              {enTeteColonne(t('collectiviteConsoleBis.liste.colonneActivee', 'Activée le'), 1)}
              <View style={{ width: 18 }} />
            </View>
            {lignes.map(renderLigne)}
          </View>
        ) : null}
        {lignes.length > 0 && !tableau ? lignes.map(renderLigne) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminCollectiviteList;
