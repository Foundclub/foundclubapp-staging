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
  ligneSeancesDeLaSemaine,
  nombreOuTiret,
} from '@/domains/collectivite/collectiviteClubsDisplay';
import { findManagedCollectivite, formatSlot } from '@/domains/collectivite/collectiviteDisplay';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteClub,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

import { formatDateWithDayPrefix } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors/displayError';

import { SUPPORT_CONTACT_EMAIL } from '@/config/legalUrls';
import { useIsDesktop } from '@/responsive';

/**
 * Un bloc de la fiche (design P7v2 : `.bloc`) : un titre, une etiquette eventuelle, son contenu.
 * @param {{
 *   children: import('react').ReactNode, etiquette?: string, testID: string, titre: string,
 * }} props
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocDeFiche({
  children, etiquette, testID, titre,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  return (
    <View
      style={[
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
          borderRadius: 16,
          borderWidth: 1,
          gap: 8,
        },
      ]}
      testID={testID}
    >
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
        <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.primary200]}>{titre}</Text>
        {etiquette ? <Text style={[Fonts.p4Bold, Fonts.neutral300]}>{etiquette}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * 🏛️ LA FICHE D UN CLUB, COTE MAIRIE — COLL-CLUBS (01/10/2026), design HY521H1 page 7
 * (« P7v2-fiche-tel » et « P7v2-fiche-ordi »), SPEC §2 G.
 *
 * Ecran NEUF, en lecture. Les blocs suivent les questions d un service des sports : qui joindre
 * (les DIRIGEANTS, nommes comme sur la fiche publique du club), en nombres (et les noms
 * d equipes), ses creneaux de la Ville, ses demandes, ses coordonnees et partenaires (ce que
 * montre la fiche du club : adresse, telephone, e-mail, site ; logos des partenaires par
 * `SponsorLogoTile`, le composant de la fiche), l utilisation (plus tard), l offre.
 * Sur ordinateur, deux colonnes.
 *
 * ⛔ SPEC §2 H : ni joueur, ni parent, ni enfant, ni coordonnee personnelle, ni qui demande, ni
 * message, ni presence. L ecran n affiche que ce que le serveur rend ; le serveur ne rend que ca
 * (temoin admin COLL-CLUBS K10, secrets semes).
 *
 * CE QUI MANQUE, NOMME :
 *   - « Ecrire aux dirigeants » : aucune conversation Ville ↔ dirigeants d UN club n existe
 *     (D73 : conversation privee, membres calcules, comme le canal des dirigeants D72, lot C4a) ;
 *     le bouton n est pas pose, plutot qu un bouton qui ne fait rien ;
 *   - « Ses creneaux de la Ville » : A BRANCHER SUR C2a (le creneau de saison n existe pas
 *     encore) ; C2b le remplit en vague 2. Le bloc est la, vide et nomme ;
 *   - « Utilisation » : plus tard (lot C5) ;
 *   - « Demander au club de completer sa fiche » : aucun envoi n existe (meme canal que D73).
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteClubDetails() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const isDesktop = useIsDesktop();
  /** @typedef {{ clubId?: string, collectiviteId?: string } | undefined} ParametresDeLaFiche */
  const routeParams = /** @type {ParametresDeLaFiche} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;
  const clubId = routeParams?.clubId || null;

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const fiche = useCollectiviteClub(collectiviteId, clubId);
  const club = /** @type {any} */ (fiche.data) || null;

  const ouvrir = (/** @type {string} */ adresse) => {
    Linking.openURL(adresse).catch(() => {});
  };
  const voirLesDemandes = () => {
    /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteRequests, { collectiviteId });
  };

  const nonRenseigne = t('collectiviteClubs.detail.notProvided', 'non renseigné');

  const renderQuiJoindre = () => {
    let contenu;
    if (club?.leaders === null) {
      contenu = (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteClubs.detail.leadersHidden',
            'Le club ne rend pas public le nom de ses dirigeants.',
          )}
        </Text>
      );
    } else if (!Array.isArray(club?.leaders) || club.leaders.length === 0) {
      contenu = (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteClubs.detail.leadersNone',
            'Aucun dirigeant n’est inscrit sur la fiche du club.',
          )}
        </Text>
      );
    } else {
      contenu = club.leaders.map((/** @type {any} */ leader) => (
        <Text key={leader?.name} style={[Fonts.p2Bold, Fonts.neutral00]}>
          {leader?.name}
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectiviteClubs.detail.leaderRole', ' · dirigeant')}
          </Text>
        </Text>
      ));
    }
    return (
      <BlocDeFiche
        testID="fiche-club-qui-joindre"
        titre={t('collectiviteClubs.detail.who', 'Qui joindre')}
      >
        {contenu}
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteClubs.detail.coachNotListed',
            'L’entraîneur n’est pas listé : la Ville s’adresse aux dirigeants.',
          )}
        </Text>
      </BlocDeFiche>
    );
  };

  const renderNombres = () => {
    const seances = club?.sessionsThisWeek;
    const chiffres = [
      {
        cle: 'teams',
        libelle: t('collectiviteClubs.detail.teams', 'équipes'),
        valeur: nombreOuTiret(club?.teamsCount),
      },
      {
        cle: 'members',
        libelle: t('collectiviteClubs.detail.members', 'membres'),
        valeur: nombreOuTiret(club?.membersCount),
      },
      {
        cle: 'week',
        libelle: t('collectiviteClubs.detail.sessionsWeek', 'séances cette semaine'),
        valeur: nombreOuTiret(seances?.count),
      },
    ];
    const equipes = (Array.isArray(club?.teams) ? club.teams : [])
      .map((equipe) => equipe?.name)
      .filter(Boolean);
    return (
      <BlocDeFiche
        testID="fiche-club-nombres"
        titre={t('collectiviteClubs.detail.numbers', 'En nombres')}
      >
        <View style={[Alignments.row, { gap: 8 }]}>
          {chiffres.map((chiffre) => (
            <View key={chiffre.cle} style={{ flex: 1 }}>
              <Text style={[Fonts.h3Black, Fonts.neutral00]}>{chiffre.valeur}</Text>
              <Text style={[Fonts.p4, Fonts.neutral300]}>{chiffre.libelle}</Text>
            </View>
          ))}
        </View>
        {equipes.length ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'collectiviteClubs.detail.teamNames',
              'Équipes : {{equipes}}. Aucun nom de membre.',
              { equipes: equipes.join(', '), ...SANS_ECHAPPEMENT },
            )}
          </Text>
        ) : null}
        {seances?.count ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>{ligneSeancesDeLaSemaine(t, seances)}</Text>
        ) : null}
      </BlocDeFiche>
    );
  };

  // A BRANCHER SUR C2a : le creneau de saison n existe pas encore. C2b (vague 2) remplit ce bloc
  // avec les creneaux attribues a ce club et « Attribuer un creneau a ce club ».
  const renderCreneaux = () => (
    <BlocDeFiche
      testID="fiche-club-creneaux"
      titre={t('collectiviteClubs.detail.slots', 'Ses créneaux de la Ville')}
    >
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'collectiviteClubs.detail.slotsSoon',
          'Les créneaux que la Ville attribue à ce club s’afficheront ici.',
        )}
      </Text>
    </BlocDeFiche>
  );

  const renderDemandes = () => {
    const demandes = club?.requests || {};
    const enAttente = Array.isArray(demandes.pending) ? demandes.pending : [];
    const acceptees = Number(demandes.accepted) || 0;
    const refusees = Number(demandes.refused) || 0;
    const restantes = Math.max(0, (Number(demandes.pendingCount) || 0) - enAttente.length);
    return (
      <BlocDeFiche
        testID="fiche-club-demandes"
        titre={t('collectiviteClubs.detail.requests', 'Ses demandes')}
      >
        {enAttente.length === 0 ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('collectiviteClubs.detail.requestsNone', 'Aucune demande en attente.')}
          </Text>
        ) : enAttente.map((/** @type {any} */ demande) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={demande?.documentId}
            onPress={voirLesDemandes}
            style={[Alignments.row, Alignments.alignCenter, { gap: 8, minHeight: 44 }]}
            testID={`fiche-club-demande-${demande?.documentId}`}
          >
            <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
              {[
                demande?.team?.name,
                formatSlot(demande?.requestedStart, demande?.requestedEnd),
                demande?.facility?.name,
              ].filter(Boolean).join(' · ')}
            </Text>
            <View
              style={[
                ApplicationStyle.borderRadius24,
                Spaces.paddingHorizontal[8],
                Spaces.paddingVertical[4],
                { backgroundColor: withAlpha(Colors.warning500, 0.16) },
              ]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.warning400 }]}>
                {t('collectiviteClubs.detail.toDecide', 'À trancher')}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
        {restantes ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'collectiviteClubs.detail.requestsMore',
              'Et {{nombre}} autre(s) en attente.',
              { nombre: restantes },
            )}
          </Text>
        ) : null}
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('collectiviteClubs.detail.season', 'Cette saison : {{acceptees}}, {{refusees}}.', {
            acceptees: acceptees > 1
              ? t('collectiviteClubs.detail.acceptedMany', '{{nombre}} acceptées', {
                nombre: acceptees,
              })
              : t('collectiviteClubs.detail.acceptedOne', '{{nombre}} acceptée', {
                nombre: acceptees,
              }),
            refusees: refusees > 1
              ? t('collectiviteClubs.detail.refusedMany', '{{nombre}} refusées', {
                nombre: refusees,
              })
              : t('collectiviteClubs.detail.refusedOne', '{{nombre}} refusée', {
                nombre: refusees,
              }),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
        <TouchableOpacity
          accessibilityRole="link"
          onPress={voirLesDemandes}
          style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
          testID="fiche-club-voir-demandes"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>
            {t('collectiviteClubs.detail.seeRequests', 'Voir ses demandes')}
          </Text>
        </TouchableOpacity>
      </BlocDeFiche>
    );
  };

  const renderCoordonnees = () => {
    const lignes = [
      {
        cle: 'address',
        libelle: t('collectiviteClubs.detail.address', 'Adresse'),
        valeur: club?.address,
      },
      {
        adresse: club?.phoneNumber ? `tel:${club.phoneNumber}` : null,
        cle: 'phone',
        libelle: t('collectiviteClubs.detail.phone', 'Téléphone'),
        valeur: club?.phoneNumber,
      },
      {
        adresse: club?.email ? `mailto:${club.email}` : null,
        cle: 'email',
        libelle: t('collectiviteClubs.detail.email', 'E-mail'),
        valeur: club?.email,
      },
      {
        adresse: club?.websiteUrl || null,
        cle: 'website',
        libelle: t('collectiviteClubs.detail.website', 'Site'),
        valeur: club?.websiteUrl,
      },
    ];
    return (
      <BlocDeFiche
        testID="fiche-club-coordonnees"
        titre={t('collectiviteClubs.detail.contact', 'Coordonnées du club')}
      >
        {lignes.map((ligne) => (
          <View key={ligne.cle} style={[Alignments.row, { gap: 12 }]}>
            <Text style={[Fonts.p3, Fonts.neutral300, { width: 96 }]}>{ligne.libelle}</Text>
            {ligne.valeur && ligne.adresse ? (
              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => ouvrir(String(ligne.adresse))}
                style={{ flex: 1 }}
                testID={`fiche-club-${ligne.cle}`}
              >
                <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.primary200]}>
                  {ligne.valeur}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                style={[Fonts.p2, ligne.valeur ? Fonts.neutral100 : Fonts.neutral400, { flex: 1 }]}
              >
                {ligne.valeur || nonRenseigne}
              </Text>
            )}
          </View>
        ))}
      </BlocDeFiche>
    );
  };

  const renderPartenaires = () => {
    const partenaires = Array.isArray(club?.sponsors) ? club.sponsors : [];
    return (
      <BlocDeFiche
        testID="fiche-club-partenaires"
        titre={t('collectiviteClubs.detail.sponsors', 'Nos partenaires')}
      >
        {partenaires.length === 0 ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('collectiviteClubs.detail.sponsorsNone', 'Aucun partenaire renseigné par le club.')}
          </Text>
        ) : (
          <View style={[Alignments.row, Alignments.wrap, { gap: 12 }]}>
            {partenaires.map((/** @type {any} */ partenaire) => (
              <View
                key={`${partenaire?.title}-${partenaire?.link}`}
                style={[Alignments.alignCenter, { gap: 4, width: 84 }]}
              >
                <SponsorLogoTile
                  height={56}
                  imageUrl={partenaire?.logo?.url}
                  link={partenaire?.link}
                  width={56}
                />
                <Text numberOfLines={2} style={[Fonts.p4, Fonts.neutral100, Fonts.textCenter]}>
                  {partenaire?.title}
                </Text>
              </View>
            ))}
          </View>
        )}
      </BlocDeFiche>
    );
  };

  const renderUtilisation = () => (
    <BlocDeFiche
      etiquette={t('collectiviteClubs.detail.usageLater', 'plus tard')}
      testID="fiche-club-utilisation"
      titre={t('collectiviteClubs.detail.usage', 'Utilisation')}
    >
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'collectiviteClubs.detail.usageSoon',
          // eslint-disable-next-line max-len
          'Bientôt : les heures réservées, les séances tenues et annulées, de quoi répondre au conseil municipal.',
        )}
      </Text>
    </BlocDeFiche>
  );

  // « la Ville de Montrivage » : le nom officiel avec son article (bandeau « Offert par », 1d).
  const ville = collectivite?.name
    ? formatCollectiviteOfferedBy(collectivite.name)
    : t('collectiviteClubs.detail.theCity', 'la Ville');
  const renderOffre = () => {
    const offre = club?.offer || {};
    let ligne = t('collectiviteClubs.detail.offerNone', 'Aucune offre en cours pour ce club.');
    if (offre.kind === 'collectivite') {
      ligne = t(
        'collectiviteClubs.detail.offerCity',
        'Abonnement offert par {{ville}}.',
        { ville, ...SANS_ECHAPPEMENT },
      );
    } else if (offre.kind === 'own') {
      ligne = t('collectiviteClubs.detail.offerOwn', 'Son propre abonnement.');
    }
    const depuis = offre.kind === 'collectivite' && offre.since
      ? formatDateWithDayPrefix(offre.since).split(' ').pop()
      : '';
    return (
      <BlocDeFiche testID="fiche-club-offre" titre={t('collectiviteClubs.detail.offer', 'L’offre')}>
        <Text style={[Fonts.p2, Fonts.neutral100]}>{ligne}</Text>
        {depuis ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectiviteClubs.detail.offerSince', 'Depuis le {{date}}.', { date: depuis })}
          </Text>
        ) : null}
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => ouvrir(`mailto:${SUPPORT_CONTACT_EMAIL}`)}
          style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
          testID="fiche-club-offre-contact"
        >
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t(
              'collectiviteClubs.detail.offerChange',
              'Pour la changer, écrivez à l’équipe FoundClub.',
            )}
          </Text>
        </TouchableOpacity>
      </BlocDeFiche>
    );
  };

  const renderPastilleOffre = () => {
    const kind = club?.offer?.kind;
    if (kind !== 'collectivite' && kind !== 'own') return null;
    const offerte = kind === 'collectivite';
    return (
      <View
        style={[
          ApplicationStyle.borderRadius24,
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[4],
          {
            alignSelf: 'flex-start',
            backgroundColor: withAlpha(offerte ? Colors.success500 : Colors.neutral00, 0.12),
            borderColor: withAlpha(offerte ? Colors.success500 : Colors.neutral00, 0.45),
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[Fonts.p4Bold, { color: offerte ? Colors.success200 : Colors.neutral100 }]}>
          {offerte
            ? t('collectiviteClubs.detail.badgeCity', 'Offert par la Ville')
            : t('collectiviteClubs.detail.badgeOwn', 'Son propre abonnement')}
        </Text>
      </View>
    );
  };

  let contenu;
  if (fiche.isLoading) {
    contenu = <Loader />;
  } else if (fiche.error || !club) {
    contenu = (
      <View
        accessibilityRole="alert"
        style={[
          Spaces.padding[16],
          {
            backgroundColor: withAlpha(Colors.error500, 0.12),
            borderColor: withAlpha(Colors.error500, 0.4),
            borderRadius: 16,
            borderWidth: 1,
            gap: 8,
          },
        ]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('collectiviteClubs.detail.error', 'La fiche du club n’a pas pu être lue.')}
        </Text>
        {fiche.error ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {getErrorMessage(/** @type {any} */ (fiche.error))}
          </Text>
        ) : null}
        <Button
          isOption
          onPress={() => fiche.refetch?.()}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('collectiviteClubs.list.retry', 'Réessayer')}
          variant="SecondaryLight"
        />
      </View>
    );
  } else if (isDesktop) {
    contenu = (
      <View style={[Alignments.row, { alignItems: 'flex-start', gap: 20 }]}>
        <View style={{ gap: 14, width: 400 }}>
          {renderQuiJoindre()}
          {renderCoordonnees()}
          {renderNombres()}
          {renderOffre()}
        </View>
        <View style={{ flex: 1, gap: 14, minWidth: 0 }}>
          {renderCreneaux()}
          {renderDemandes()}
          {renderPartenaires()}
          {renderUtilisation()}
        </View>
      </View>
    );
  } else {
    contenu = (
      <View style={{ gap: 14 }}>
        {renderQuiJoindre()}
        {renderNombres()}
        {renderCreneaux()}
        {renderDemandes()}
        {renderCoordonnees()}
        {renderPartenaires()}
        {renderUtilisation()}
        {renderOffre()}
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
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => fiche.refetch?.()}
            refreshing={Boolean(fiche.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {club ? (
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
            <ClubLogoMark logoUrl={club?.logo?.url} name={club?.name} size={isDesktop ? 64 : 56} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                {t(
                  'collectiviteClubs.detail.kicker',
                  'Club rattaché à {{ville}}',
                  { ville, ...SANS_ECHAPPEMENT },
                )}
              </Text>
              <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
                {club?.name}
              </Text>
              {renderPastilleOffre()}
            </View>
          </View>
        ) : null}
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteClubDetails;
