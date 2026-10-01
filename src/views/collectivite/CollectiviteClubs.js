import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  ligneDirigeants,
  ligneSeancesDeLaSemaine,
  nombreOuTiret,
} from '@/domains/collectivite/collectiviteClubsDisplay';
import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteClubs,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

import { useIsDesktop } from '@/responsive';

/**
 * 🏛️ « CLUBS RATTACHES » — ce que la mairie voit de ses clubs (COLLECTIVITES 1c, SPEC §2 G).
 *
 * Pour chaque club : son nom, son logo, son CONTACT GENERAL (e-mail, telephone et site du
 * CLUB, D15 — deja publics dans l annuaire) et des NOMBRES : equipes, membres.
 * COLL-CLUBS (01/10, design HY521H1 page 7) : TOUTE la carte ouvre la fiche du club ; chaque
 * carte nomme ses DIRIGEANTS (SPEC §2 G, ajout voulu : leur nom, comme sur la fiche publique du
 * club) et dit ses seances de la semaine sur les installations de la Ville. Sur ordinateur, un
 * tableau. Les quatre etats du design : chargement, erreur avec « Reessayer », vide, liste.
 * ⛔ Jamais une autre personne (SPEC §2 H) : le serveur ne rend ni membre, ni coordonnee
 * personnelle (temoins admin COLL1C C12 et COLL-CLUBS K2) ; cet ecran n affiche que ce qu il
 * recoit. Un nombre illisible s affiche « — », jamais 0.
 * « Ecrire aux dirigeants » et « Demander au club de completer sa fiche » ne sont PAS ici :
 * aucune conversation Ville ↔ dirigeants d un club n existe encore (D73, lot C4a).
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteClubs() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const isDesktop = useIsDesktop();
  const routeParams = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const clubs = useCollectiviteClubs(collectiviteId);
  const liste = Array.isArray(clubs.data) ? clubs.data : [];

  const ouvrir = (/** @type {string} */ adresse) => {
    Linking.openURL(adresse).catch(() => {});
  };
  const ouvrirLaFiche = (/** @type {any} */ club) => {
    /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteClubDetails, {
      clubId: club?.documentId,
      collectiviteId,
    });
  };
  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: `${Colors.primary500}80`,
    borderWidth: 1,
  };

  const renderContact = (/** @type {any} */ club) => {
    const liens = [
      club?.email ? { adresse: `mailto:${club.email}`, cle: 'email', texte: club.email } : null,
      club?.phoneNumber
        ? { adresse: `tel:${club.phoneNumber}`, cle: 'phone', texte: club.phoneNumber }
        : null,
      club?.websiteUrl
        ? { adresse: club.websiteUrl, cle: 'website', texte: club.websiteUrl }
        : null,
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
        style={{ alignSelf: 'flex-start' }}
        testID={`collectivite-club-${club?.documentId}-${lien.cle}`}
      >
        <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.primary200]}>{lien.texte}</Text>
      </TouchableOpacity>
    ));
  };

  const compte = (/** @type {any} */ club) => t(
    'collectivite.clubs.counts',
    'Équipes : {{teams}} · Membres : {{members}}',
    { members: nombreOuTiret(club?.membersCount), teams: nombreOuTiret(club?.teamsCount) },
  );

  const renderSeances = (/** @type {any} */ club) => (
    <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
      <SvgIcon color={Colors.primary200} height={12} name="calendar" width={12} />
      <Text style={[Fonts.p3, Fonts.neutral200, { flex: 1 }]}>
        {ligneSeancesDeLaSemaine(t, club?.sessionsThisWeek)}
      </Text>
    </View>
  );

  const renderCarte = (/** @type {any} */ club) => {
    const dirigeants = ligneDirigeants(t, club?.leaders);
    return (
      <TouchableOpacity
        accessibilityHint={t('collectiviteClubs.list.openHint', 'Ouvre la fiche du club.')}
        accessibilityLabel={club?.name}
        accessibilityRole="button"
        activeOpacity={0.8}
        key={club?.documentId}
        onPress={() => ouvrirLaFiche(club)}
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 8 }]}
        testID={`collectivite-club-${club?.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
          <ClubLogoMark logoUrl={club?.logo?.url} name={club?.name} size={40} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={[Fonts.p1Black, Fonts.neutral00]}>{club?.name}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>{compte(club)}</Text>
          </View>
        </View>
        {dirigeants ? <Text style={[Fonts.p3, Fonts.neutral200]}>{dirigeants}</Text> : null}
        {renderSeances(club)}
        {renderContact(club)}
      </TouchableOpacity>
    );
  };

  // Sur ordinateur, une ligne par club (P7-clubs-ordi) : club et dirigeants, equipes, membres,
  // seances de la semaine, contact general. Toute la ligne ouvre la fiche.
  const colonnes = /** @type {const} */ ([
    { cle: 'club', flex: 3, titre: t('collectiviteClubs.table.club', 'Club') },
    { cle: 'teams', flex: 1, titre: t('collectiviteClubs.table.teams', 'Équipes') },
    { cle: 'members', flex: 1, titre: t('collectiviteClubs.table.members', 'Membres') },
    { cle: 'week', flex: 3, titre: t('collectiviteClubs.table.week', 'Cette semaine') },
    { cle: 'contact', flex: 3, titre: t('collectiviteClubs.table.contact', 'Contact général') },
  ]);
  const renderLigne = (/** @type {any} */ club) => {
    const dirigeants = ligneDirigeants(t, club?.leaders);
    return (
      <TouchableOpacity
        accessibilityHint={t('collectiviteClubs.list.openHint', 'Ouvre la fiche du club.')}
        accessibilityLabel={club?.name}
        accessibilityRole="button"
        activeOpacity={0.8}
        key={club?.documentId}
        onPress={() => ouvrirLaFiche(club)}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          { borderTopColor: `${Colors.neutral00}17`, borderTopWidth: 1, gap: 12 },
        ]}
        testID={`collectivite-club-${club?.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { flex: colonnes[0].flex, gap: 12 }]}>
          <ClubLogoMark logoUrl={club?.logo?.url} name={club?.name} size={40} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>{club?.name}</Text>
            {dirigeants ? <Text style={[Fonts.p3, Fonts.neutral300]}>{dirigeants}</Text> : null}
          </View>
        </View>
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: colonnes[1].flex }]}>
          {nombreOuTiret(club?.teamsCount)}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: colonnes[2].flex }]}>
          {nombreOuTiret(club?.membersCount)}
        </Text>
        <View style={{ flex: colonnes[3].flex }}>{renderSeances(club)}</View>
        <View style={{ flex: colonnes[4].flex, gap: 2 }}>{renderContact(club)}</View>
      </TouchableOpacity>
    );
  };

  const titreAvec = (/** @type {number | string} */ nombre) => t(
    'collectivite.clubs.title',
    'Clubs rattachés : {{nombre}}',
    { nombre },
  );
  let titre = titreAvec(liste.length);
  if (clubs.isLoading) titre = titreAvec('…');
  else if (clubs.error) titre = t('collectiviteClubs.list.titleError', 'Clubs rattachés');

  let contenu;
  if (clubs.isLoading) {
    const squelette = { backgroundColor: `${Colors.neutral00}14`, borderRadius: 12 };
    contenu = (
      <View
        accessibilityState={{ busy: true }}
        style={{ gap: 12 }}
        testID="collectivite-clubs-chargement"
      >
        {[0, 1].map((rang) => (
          <View
            key={rang}
            style={[ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 12 }]}
          >
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
              <View style={[squelette, { height: 40, width: 40 }]} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={[squelette, { height: 18, width: '60%' }]} />
                <View style={[squelette, { height: 12, width: '40%' }]} />
              </View>
            </View>
            <View style={[squelette, { height: 36 }]} />
          </View>
        ))}
      </View>
    );
  } else if (clubs.error) {
    contenu = (
      <View
        accessibilityRole="alert"
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          {
            backgroundColor: `${Colors.error500}1F`,
            borderColor: `${Colors.error500}66`,
            borderWidth: 1,
            gap: 8,
          },
        ]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('collectiviteClubs.list.error', 'Les clubs n’ont pas pu être lus.')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {getErrorMessage(/** @type {any} */ (clubs.error))}
        </Text>
        <Button
          isOption
          onPress={() => clubs.refetch?.()}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('collectiviteClubs.list.retry', 'Réessayer')}
          variant="SecondaryLight"
        />
      </View>
    );
  } else if (liste.length === 0) {
    contenu = (
      <View style={[Alignments.alignCenter, Spaces.paddingVertical[24], { gap: 8 }]}>
        <SvgIcon color={Colors.primary200} height={40} name="users" width={40} />
        <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
          {t('collectivite.clubs.empty', 'Aucun club rattaché pour l’instant.')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter]}>
          {t(
            'collectiviteClubs.list.emptyHint',
            'L’équipe FoundClub rattache les clubs de la commune. Un club manque ? Invitez-le.',
          )}
        </Text>
      </View>
    );
  } else if (isDesktop) {
    contenu = (
      <View
        style={[
          ApplicationStyle.card,
          Spaces.paddingHorizontal[16],
          Spaces.paddingVertical[8],
          carteStyle,
        ]}
      >
        <View style={[Alignments.row, Spaces.paddingVertical[8], { gap: 12 }]}>
          {colonnes.map((colonne) => (
            <Text
              key={colonne.cle}
              style={[Fonts.p3Bold, Fonts.neutral300, { flex: colonne.flex }]}
            >
              {colonne.titre}
            </Text>
          ))}
        </View>
        {liste.map(renderLigne)}
      </View>
    );
  } else {
    contenu = <View style={{ gap: 12 }}>{liste.map(renderCarte)}</View>;
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
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
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>{titre}</Text>
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
