import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  useCollectiviteClubs,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 🏛️ « CLUBS RATTACHES » — ce que la mairie voit de ses clubs (COLLECTIVITES 1c, SPEC §2 G).
 *
 * Pour chaque club : son nom, son logo, son CONTACT GENERAL (e-mail, telephone et site du
 * CLUB, D15 — deja publics dans l annuaire) et des NOMBRES : equipes, membres.
 * ⛔ Jamais une personne (SPEC §2 H) : le serveur ne rend ni membre, ni dirigeant, ni
 * coordonnee personnelle (temoin admin COLL1C C12, banc vrai moteur C1c) ; cet ecran
 * n affiche que ce qu il recoit. Un nombre illisible s affiche « — », jamais 0.
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteClubs() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  const routeParams = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const clubs = useCollectiviteClubs(collectiviteId);
  const liste = Array.isArray(clubs.data) ? clubs.data : [];

  const nombre = (/** @type {unknown} */ valeur) => (Number.isInteger(valeur) ? String(valeur) : '—');
  const ouvrir = (/** @type {string} */ adresse) => {
    Linking.openURL(adresse).catch(() => {});
  };
  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: `${Colors.primary500}80`,
    flexBasis: 320,
    flexGrow: 1,
    gap: 8,
  };

  const renderContact = (/** @type {any} */ club) => {
    const liens = [
      club?.email ? { adresse: `mailto:${club.email}`, cle: 'email', texte: club.email } : null,
      club?.phoneNumber
        ? { adresse: `tel:${club.phoneNumber}`, cle: 'phone', texte: club.phoneNumber }
        : null,
      club?.websiteUrl ? { adresse: club.websiteUrl, cle: 'website', texte: club.websiteUrl } : null,
    ].filter(Boolean);
    if (liens.length === 0) {
      return (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('collectivite.clubs.noContact', 'Pas de contact renseigné par le club.')}
        </Text>
      );
    }
    return liens.map((/** @type {any} */ lien) => (
      <TouchableOpacity
        accessibilityRole="link"
        key={lien.cle}
        onPress={() => ouvrir(lien.adresse)}
        testID={`collectivite-club-${club?.documentId}-${lien.cle}`}
      >
        <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.primary200]}>{lien.texte}</Text>
      </TouchableOpacity>
    ));
  };

  let contenu;
  if (clubs.isLoading) {
    contenu = <Loader />;
  } else if (clubs.error) {
    contenu = (
      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {getErrorMessage(/** @type {any} */ (clubs.error))}
      </Text>
    );
  } else if (liste.length === 0) {
    contenu = (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t('collectivite.clubs.empty', 'Aucun club rattaché pour l’instant.')}
      </Text>
    );
  } else {
    contenu = (
      <View style={[Alignments.row, Alignments.wrap, { gap: 12 }]}>
        {liste.map((/** @type {any} */ club) => (
          <View
            key={club?.documentId}
            style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
            testID={`collectivite-club-${club?.documentId}`}
          >
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
              <ClubLogoMark logoUrl={club?.logo?.url} name={club?.name} size={40} />
              <Text numberOfLines={2} style={[Fonts.p1Black, Fonts.neutral00, { flex: 1 }]}>
                {club?.name}
              </Text>
            </View>
            <Text style={[Fonts.p2Bold, Fonts.neutral100]}>
              {t('collectivite.clubs.counts', 'Équipes : {{teams}} · Membres : {{members}}', {
                members: nombre(club?.membersCount),
                teams: nombre(club?.teamsCount),
              })}
            </Text>
            {renderContact(club)}
          </View>
        ))}
      </View>
    );
  }

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
            onRefresh={() => clubs.refetch?.()}
            refreshing={Boolean(clubs.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {(collectivite?.name || t('collectivite.home.kicker', 'Ma collectivité')).toUpperCase()}
          </Text>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('collectivite.clubs.title', 'Clubs rattachés : {{nombre}}', { nombre: liste.length })}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'collectivite.clubs.hint',
              'Le contact général de chaque club et des nombres : jamais le nom d’un membre.',
            )}
          </Text>
        </View>
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteClubs;
