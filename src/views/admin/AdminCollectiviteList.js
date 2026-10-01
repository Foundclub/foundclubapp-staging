import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  collectiviteTypeLabel,
  toAdminCollectiviteRow,
} from '@/domains/collectivite/collectiviteDisplay';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';
import CollectiviteActivation from '@/views/admin/components/CollectiviteActivation';

import { RouteNames } from '@/navigation/routeNames';

import { useAdminCollectivites } from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 🏛️ CONSOLE › COLLECTIVITES — la liste (D61, decision d Adel du 29/09 : « Écran pour
 * activer une mairie, sur le super-admin, pour nous »).
 *
 * Chaque collectivite : son nom, son type, « Active » ou « Inactive » (NULL = inactive,
 * comme le serveur), le nombre de clubs rattaches, et le bouton « Activer » / « Couper »
 * (CollectiviteActivation : confirmation, geste, relecture).
 * Seul un SuperAdmin arrive ici : la pile AdminStack n est montee que pour lui
 * (PrivateNavigator) et le serveur refuse la lecture a tout autre compte (403, affiche).
 * @returns {import('react').ReactElement} L ecran.
 */
function AdminCollectiviteList() {
  const { t } = useTranslation();
  const navigation = /** @type {any} */ (useNavigation());
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const collectivites = useAdminCollectivites();

  if (collectivites.isLoading) {
    return (
      <AdminStateView
        description={t('adminCollectivites.list.loading', 'Lecture des collectivités…')}
        isLoading
        title={t('adminCollectivites.list.title', 'Collectivités')}
      />
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

  const lignes = (Array.isArray(collectivites.data?.data) ? collectivites.data.data : [])
    .map(toAdminCollectiviteRow);
  const total = Number(collectivites.data?.meta?.pagination?.total) || lignes.length;
  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: `${Colors.primary500}80`,
    gap: 8,
  };

  const renderCollectivite = (/** @type {ReturnType<typeof toAdminCollectiviteRow>} */ ligne) => (
    <View
      key={ligne.documentId}
      style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
      testID={`admin-collectivite-${ligne.documentId}`}
    >
      <Text numberOfLines={2} style={[Fonts.p1Black, Fonts.neutral00]}>{ligne.name}</Text>
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, { gap: 8 }]}>
        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
          {collectiviteTypeLabel(t, ligne.type)}
        </Text>
        <Text style={[Fonts.p3Bold, ligne.isActive ? Fonts.success500 : Fonts.warning500]}>
          {ligne.isActive
            ? t('adminCollectivites.status.active', 'Active')
            : t('adminCollectivites.status.inactive', 'Inactive')}
        </Text>
      </View>
      <Text style={[Fonts.p2Bold, Fonts.neutral100]}>
        {t('adminCollectivites.list.clubsCount', 'Clubs rattachés : {{nombre}}', {
          nombre: ligne.clubsCount,
        })}
      </Text>
      <CollectiviteActivation collectivite={ligne} />
      <Button
        onPress={() => navigation.navigate(RouteNames.AdminCollectiviteDetail, {
          collectiviteId: ligne.documentId,
        })}
        size="sm"
        title={t('adminCollectivites.list.manage', 'Gérer')}
        variant="Ghost"
      />
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 12 }}
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
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('adminCollectivites.kicker', 'Console').toUpperCase()}
          </Text>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('adminCollectivites.list.heading', 'Collectivités : {{nombre}}', { nombre: total })}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'adminCollectivites.list.hint',
              // eslint-disable-next-line max-len
              '« Activer » donne l’offre Club aux clubs rattachés, sauf à ceux qui paient déjà ; « Couper » la leur retire.',
            )}
          </Text>
        </View>
        <Button
          onPress={() => navigation.navigate(RouteNames.AdminCollectiviteForm)}
          size="sm"
          title={t('adminCollectivites.list.create', 'Créer une collectivité')}
          variant="Primary"
        />
        {lignes.length === 0 ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('adminCollectivites.list.empty', 'Aucune collectivité pour l’instant.')}
          </Text>
        ) : lignes.map(renderCollectivite)}
        {total > lignes.length ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('adminCollectivites.list.truncated', '{{shown}} affichées sur {{total}}.', {
              shown: lignes.length,
              total,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminCollectiviteList;
