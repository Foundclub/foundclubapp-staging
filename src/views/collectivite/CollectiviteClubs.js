import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { clePremierPas } from '@/domains/collectivite/collectiviteAccueil';
import {
  etatDInvitation,
  ligneDirigeants,
  nombreOuTiret,
} from '@/domains/collectivite/collectiviteClubsDisplay';
import {
  findManagedCollectivite,
  formatCollectiviteDay,
} from '@/domains/collectivite/collectiviteDisplay';
import { useAppContext } from '@/store/appContext';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ScreenContainer from '@/components/templates/ScreenContainer';
import DemandesDeRattachement from '@/views/collectivite/components/DemandesDeRattachement';
import EcrireAuxDirigeants from '@/views/collectivite/components/EcrireAuxDirigeants';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteClubs,
  useCollectiviteInvitations,
  useMyCollectivites,
  useRemindCollectiviteInvitation,
} from '@/services/collectivite/collectiviteQueries';
import {
  useCollectiviteClubRequests,
} from '@/services/collectivite/collectiviteRattachementQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

import { setItem } from '@/platform/storage';
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
 * COLL-CLUBS (planche 3) : « Inviter un club absent de FoundClub » (en bas de liste ; en tete
 * sur ordinateur ; dans l etat vide), et SOUS la liste, les invitations en cours : envoyee,
 * inscrit, rattache, avec « Relancer ».
 * COLL-C4A2 (02/10) : sur chaque club, « Ecrire aux dirigeants » (D73, la conversation privee de
 * la Ville avec CE club) ; sans contact, « Demander au club de completer sa fiche ».
 * VILLE-INVITER-CLUB (07/10) : « Ajouter un club » (deja sur FoundClub : la recherche, puis la
 * demande au club, « club A ») et, au-dessus des invitations, « Demandes de rattachement »
 * dans les deux sens (« lien A » : la Ville accepte ou refuse celles venues de son lien).
 * Les demandes du lien quittent alors « Invitations », qui ne garde que « Par FoundClub » ;
 * tant que le serveur ne rend pas ces demandes (serveur d'avant le lot), elle les garde.
 * COLL-R-A6 (13/10, COL-001, planche P7v4-clubs, D1 A′ d'Adel) : la carte tient en 3 lignes — le
 * nom avec « Écrire » en bouton rond, les nombres, les dirigeants. L'e-mail, le téléphone et le
 * site sont sur la fiche du club, à un appui. UN bouton « Ajouter un club » (l'écran à 3 onglets :
 * déjà sur FoundClub, par un lien, par FoundClub). Les demandes de rattachement en attente passent
 * AU-DESSUS des clubs ; « Invitations » (P7v3) reste en dessous. Sur ordinateur, le tableau perd la
 * colonne « Contact général ».
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

  // FINITIONS18 · POINT 10 (T16) — ouvrir cette liste, par N'IMPORTE quelle entree (bouton de
  // l'accueil, menu de la Ville du site), coche « Verifiez vos clubs » : 3 sur 4 sur le site, 4 sur
  // 4 au telephone, parce que seul le bouton de l'accueil cochait. Meme cle que l'accueil.
  // ponytail: retenu sur l'appareil, comme avant ; voie de sortie : un champ du compte.
  const userDocumentId = /** @type {any} */ (useAppContext()[0])?.auth?.user?.documentId;
  useEffect(() => {
    if (!userDocumentId || !collectiviteId) return;
    try {
      setItem(clePremierPas('clubs-vus', userDocumentId, collectiviteId), '1');
    } catch {
      // Sans stockage, l'etape se cochera par le bouton de l'accueil, comme avant.
    }
  }, [collectiviteId, userDocumentId]);

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const clubs = useCollectiviteClubs(collectiviteId);
  const liste = Array.isArray(clubs.data) ? clubs.data : [];

  const invitations = useCollectiviteInvitations(collectiviteId);
  const relancer = useRemindCollectiviteInvitation();
  const lesInvitations = Array.isArray(invitations.data) ? invitations.data : [];
  const ajouter = () => {
    /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteInviteClub, {
      collectiviteId,
      onglet: 'recherche',
    });
  };
  const demandes = useCollectiviteClubRequests(collectiviteId);
  const demandesLues = Array.isArray(demandes.data);
  const invitationsAffichees = demandesLues
    ? lesInvitations.filter(
      (/** @type {any} */ invitation) => invitation?.kind !== 'attach_request',
    )
    : lesInvitations;
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

  // COLL-R-A6 (P7v4-clubs) : « 2 équipes · 2 membres · 2 séances cette semaine ». Zéro et un au
  // singulier (« 0 membre ») ; un nombre illisible s'écrit « — », jamais un 0 inventé.
  const avecNombre = (
    /** @type {unknown} */ valeur,
    /** @type {[string, string]} */ [cleUne, repliUne],
    /** @type {[string, string]} */ [cle, repli],
  ) => (Number.isInteger(valeur) && Number(valeur) <= 1
    ? t(cleUne, repliUne, { nombre: nombreOuTiret(valeur) })
    : t(cle, repli, { nombre: nombreOuTiret(valeur) }));
  const ligneDesNombres = (/** @type {any} */ club) => [
    avecNombre(
      club?.teamsCount,
      ['collectiviteClubs.carte.equipesUne', '{{nombre}} équipe'],
      ['collectiviteClubs.carte.equipes', '{{nombre}} équipes'],
    ),
    avecNombre(
      club?.membersCount,
      ['collectiviteClubs.carte.membresUn', '{{nombre}} membre'],
      ['collectiviteClubs.carte.membres', '{{nombre}} membres'],
    ),
    club?.sessionsThisWeek?.count === 0
      ? t('collectiviteClubs.carte.seancesAucune', 'aucune séance cette semaine')
      : avecNombre(
        club?.sessionsThisWeek?.count,
        ['collectiviteClubs.carte.seancesUne', '{{nombre}} séance cette semaine'],
        ['collectiviteClubs.carte.seances', '{{nombre}} séances cette semaine'],
      ),
  ].join(' · ');
  // La colonne « Cette semaine » du tableau : « 2 séances », « aucune », « — ».
  const semaineCourte = (/** @type {any} */ club) => (club?.sessionsThisWeek?.count === 0
    ? t('collectiviteClubs.carte.semaineAucune', 'aucune')
    : avecNombre(
      club?.sessionsThisWeek?.count,
      ['collectiviteClubs.carte.semaineUne', '{{nombre}} séance'],
      ['collectiviteClubs.carte.semaine', '{{nombre}} séances'],
    ));

  const ecrire = (/** @type {any} */ club) => (
    <EcrireAuxDirigeants
      club={club}
      collectiviteId={collectiviteId}
      icone
      testID={`collectivite-club-${club?.documentId}-ecrire`}
    />
  );

  // Toute la carte ouvre la fiche (COLL-CLUBS, 01/10), mais elle ne se présente pas comme UN seul
  // élément au lecteur d'écran (`accessible={false}`) : sinon VoiceOver ne trouvait pas « Écrire »
  // dedans. Le nom porte le geste « ouvrir la fiche », le bouton rond le sien (planche P7v4).
  const nomQuiOuvre = (/** @type {any} */ club, /** @type {any} */ police) => (
    <TouchableOpacity
      accessibilityHint={t('collectiviteClubs.list.openHint', 'Ouvre la fiche du club.')}
      accessibilityLabel={club?.name}
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={() => ouvrirLaFiche(club)}
      style={[Alignments.row, Alignments.alignCenter, { flex: 1, gap: 12, minHeight: 44 }]}
    >
      <ClubLogoMark logoUrl={club?.logo?.url} name={club?.name} size={40} />
      <Text numberOfLines={2} style={[police, Fonts.neutral00, { flex: 1 }]}>{club?.name}</Text>
    </TouchableOpacity>
  );

  const retrait = { paddingLeft: 52 };
  const renderCarte = (/** @type {any} */ club) => {
    const dirigeants = ligneDirigeants(t, club?.leaders);
    return (
      <TouchableOpacity
        accessible={false}
        activeOpacity={0.8}
        key={club?.documentId}
        onPress={() => ouvrirLaFiche(club)}
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 4 }]}
        testID={`collectivite-club-${club?.documentId}`}
      >
        {/* La saisie du premier message (après « Écrire ») passe sous le nom, toute largeur. */}
        <View style={[Alignments.row, Alignments.alignCenter, { flexWrap: 'wrap', gap: 12 }]}>
          {nomQuiOuvre(club, Fonts.h5Bold)}
          {ecrire(club)}
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200, retrait]}>{ligneDesNombres(club)}</Text>
        {dirigeants ? (
          <Text style={[Fonts.p3, Fonts.neutral200, retrait]}>{dirigeants}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  // Sur ordinateur, une ligne par club (P7v4-clubs-ordi, A′) : club et dirigeants, equipes,
  // membres, seances de la semaine, « Ecrire » en bouton rond. Toute la ligne ouvre la fiche.
  const colonnes = /** @type {const} */ ([
    { cle: 'club', flex: 3, titre: t('collectiviteClubs.table.club', 'Club') },
    { cle: 'teams', flex: 1, titre: t('collectiviteClubs.table.teams', 'Équipes') },
    { cle: 'members', flex: 1, titre: t('collectiviteClubs.table.members', 'Membres') },
    { cle: 'week', flex: 2, titre: t('collectiviteClubs.table.week', 'Cette semaine') },
  ]);
  const renderLigne = (/** @type {any} */ club) => {
    const dirigeants = ligneDirigeants(t, club?.leaders);
    return (
      <TouchableOpacity
        accessible={false}
        activeOpacity={0.8}
        key={club?.documentId}
        onPress={() => ouvrirLaFiche(club)}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          {
            borderTopColor: `${Colors.neutral00}17`, borderTopWidth: 1, flexWrap: 'wrap', gap: 12,
          },
        ]}
        testID={`collectivite-club-${club?.documentId}`}
      >
        <View style={{ flex: colonnes[0].flex, gap: 2 }}>
          {nomQuiOuvre(club, Fonts.p2Bold)}
          {dirigeants ? (
            <Text style={[Fonts.p3, Fonts.neutral200, retrait]}>{dirigeants}</Text>
          ) : null}
        </View>
        <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: colonnes[1].flex }]}>
          {nombreOuTiret(club?.teamsCount)}
        </Text>
        <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: colonnes[2].flex }]}>
          {nombreOuTiret(club?.membersCount)}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: colonnes[3].flex }]}>
          {semaineCourte(club)}
        </Text>
        {ecrire(club)}
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
            'L’équipe FoundClub rattache les clubs de la commune. Un club manque ? Ajoutez-le.',
          )}
        </Text>
        {/* COLL-R-A6 (P7v4-clubs, état « vide ») : un seul bouton, « Ajouter un club ». */}
        <Button
          isOption
          onPress={ajouter}
          size="sm"
          testID="collectivite-clubs-ajouter"
          title={t('collectiviteRattachement.add.button', 'Ajouter un club')}
          variant="SecondaryLight"
        />
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
              style={[Fonts.p3Bold, Fonts.primary200, { flex: colonne.flex }]}
            >
              {colonne.titre}
            </Text>
          ))}
          {/* La place du bouton rond « Écrire » (44 px), sans titre (planche P7v4-clubs-ordi). */}
          <View style={{ width: 44 }} />
        </View>
        {liste.map(renderLigne)}
      </View>
    );
  } else {
    contenu = <View style={{ gap: 12 }}>{liste.map(renderCarte)}</View>;
  }
  // COLL-R-A6 : le bouton « Ajouter un club », en haut, quand la liste est là (vide : dans l'état
  // vide ; chargement et erreur : aucun, comme la planche).
  const avecListe = !clubs.isLoading && !clubs.error && liste.length > 0;
  const boutonAjouter = (
    <Button
      icon="plus"
      iconPosition="before"
      onPress={ajouter}
      size={isDesktop ? 'sm' : undefined}
      testID="collectivite-clubs-ajouter"
      title={t('collectiviteRattachement.add.button', 'Ajouter un club')}
      variant="Secondary"
    />
  );

  // Les invitations en cours, SOUS la liste (P7v3, etat 2) : ce que le serveur LIT de chacune
  // (envoyee, inscrit, rattache). « Relancer » seulement pour une demande « Par FoundClub » que
  // personne n a encore inscrite : elle remonte a l equipe FoundClub (aucun e-mail).
  const tonDePastille = {
    cyan: Colors.primary200,
    neutre: Colors.neutral100,
    vert: Colors.success200,
  };
  const renderInvitation = (/** @type {any} */ invitation) => {
    const etat = etatDInvitation(t, invitation);
    // FINITIONS15 point 8 : la date comme les planches, « jeu. 1 oct. ».
    const date = formatCollectiviteDay(invitation?.createdAt);
    const relancee = Number(invitation?.remindCount) || 0;
    return (
      <View
        key={invitation?.documentId}
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 6 }]}
        testID={`collectivite-invitation-${invitation?.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
            {invitation?.clubName}
          </Text>
          <View
            style={[
              ApplicationStyle.borderRadius24,
              Spaces.paddingHorizontal[8],
              Spaces.paddingVertical[4],
              { backgroundColor: `${tonDePastille[etat.ton]}26` },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: tonDePastille[etat.ton] }]}>{etat.pastille}</Text>
          </View>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {date
            ? t('collectiviteClubs.invitations.since', 'Le {{date}} · {{etat}}', {
              date,
              etat: etat.ligne,
              ...SANS_ECHAPPEMENT,
            })
            : etat.ligne}
        </Text>
        {relancee ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectiviteClubs.invitations.reminded', 'Relancée {{nombre}} fois.', {
              nombre: relancee,
            })}
          </Text>
        ) : null}
        {invitation?.kind === 'foundclub' && invitation?.status === 'sent' ? (
          <Button
            isLoading={relancer.isPending
              && relancer.variables?.invitationId === invitation?.documentId}
            isOption
            onPress={() => relancer.mutate({
              collectiviteId,
              invitationId: invitation?.documentId,
            })}
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            title={t('collectiviteClubs.invitations.remind', 'Relancer')}
            variant="SecondaryLight"
          />
        ) : null}
      </View>
    );
  };

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
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
            <Text style={[Fonts.h2Black, Fonts.neutral00, { flex: 1 }]}>{titre}</Text>
            {isDesktop && avecListe ? boutonAjouter : null}
          </View>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'collectivite.clubs.hint',
              // FINITIONS-VILLE (« dirigeant A », 08/10) : les dirigeants oui, les autres non.
              // eslint-disable-next-line max-len
              'Le contact général de chaque club, le nom de ses dirigeants et des nombres : jamais les autres membres.',
            )}
          </Text>
        </View>
        {/* COLL-R-A6 (P7v4-clubs, état 4) : ce qui attend la Ville passe AU-DESSUS des clubs. */}
        {demandesLues ? (
          <DemandesDeRattachement collectiviteId={collectiviteId} demandes={demandes.data} />
        ) : null}
        {!isDesktop && avecListe ? boutonAjouter : null}
        {contenu}
        {invitationsAffichees.length ? (
          <View style={{ gap: 12 }} testID="collectivite-invitations">
            <Text accessibilityRole="header" style={[Fonts.h4Black, Fonts.neutral00]}>
              {t('collectiviteClubs.invitations.title', 'Invitations')}
            </Text>
            {invitationsAffichees.map(renderInvitation)}
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteClubs;
