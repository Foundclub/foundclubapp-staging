// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { feedbackCardStyle, NewPill } from '@/views/profile/coachFeedback/CoachFeedbackList';
import {
  newFeedbackKeys,
  seenFeedbackKeys,
} from '@/views/profile/coachFeedback/coachFeedbackModel';
import { equipesParClub } from '@/views/profile/parent/ChildIdentityCard';
import ClubEtEquipe from '@/views/profile/parent/ClubEtEquipe';
import DeclaredChildPage from '@/views/profile/parent/DeclaredChildPage';
import { demandesDe, etatDeLEnfant } from '@/views/profile/parent/demandesDeLEnfant';
import PastilleDEtat from '@/views/profile/parent/PastilleDEtat';

import allerDansLOnglet from '@/navigation/allerDansLOnglet';
import { RouteNames } from '@/navigation/routeNames';
import { navigateOrExplainOnWeb } from '@/navigation/webNavigationGuard';

import { useGetUserById } from '@/services/auth/authQueries';
import {
  useGetMyClubInterestRequests,
} from '@/services/clubInterestRequest/clubInterestRequestQueries';
import { useGetCoachFeedbackFollow } from '@/services/coachFeedback/coachFeedbackQueries';
import {
  useDeleteDeclaredChild,
  useGetMyDeclaredChildren,
} from '@/services/declaredChild/declaredChildQueries';
import { useGetPersonalStats } from '@/services/matchStats/matchStatsQueries';
import {
  useCancelParentLink,
  useParentLinksAsParent,
} from '@/services/parentLink/parentLinkQueries';

import { parentalPowerForAge } from '@/constants/parentalDeclaration';

/**
 * L age d un enfant, ou rien (« 11 ans »).
 * @param {any} t - La traduction.
 * @param {unknown} age - L age rendu par le serveur.
 * @returns {string} - « 11 ans », ou une chaine vide.
 */
const lAge = (t, age) => (typeof age === 'number'
  ? t('myChildren.screen.years', '{{count}} ans', { count: age })
  : '');

/**
 * LA CARTE D UN ENFANT RELIE dans « Mes enfants » (planche 22, etat 1) : elle ouvre SON profil,
 * ou vivent « Retours du coach » et sa fiche.
 * - ST-RETOURS (02/10) : les retours de son entraineur que le parent n a pas encore lus — il
 *   sait s il y a du neuf sans ouvrir. Rien tant que « ce que j ai deja lu » n est pas arrive :
 *   on n annonce pas tout comme neuf.
 * - ST-RETOURS2 · point 2 bis : son age vient du lien ; ses equipes et son club, de son profil
 *   public — la lecture que fait deja SA fiche (`UserDetails`, meme cle de cache : la fiche
 *   s ouvre donc deja remplie). Profil pas encore lu : l age seul, sans trou.
 * - ST-RETOURS2 · point 2 ter : la « carte-bloc » de la planche, VIVE quand il y a du neuf,
 *   et une fleche ; « Voir son profil » reste dit au lecteur d ecran.
 * - PAR-L5L6 (13/10, design parent E04) : la MEME forme que la carte d une fiche — l age, la
 *   pastille « A son compte », et chaque club sur SA ligne avec ses equipes dessous (remarque
 *   d Adel du 13/10 : « 14 ans · U15 · FoundClub » ne laissait pas voir le club).
 * @param {object} props - Les proprietes.
 * @param {any} props.compte - L enfant relie (`/parent-links/as-parent`).
 * @param {any} props.follow - Ce que le parent a deja lu
 *   (`/firebase-auth/me/coach-feedback-follow`).
 * @param {(compte: any) => void} props.onOpen - Ouvre son profil.
 * @returns {import('react').ReactElement} - La carte.
 */
function CarteDuCompteRelie({ compte, follow, onOpen }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const id = compte?.documentId;
  const { data: stats } = useGetPersonalStats(id, { enabled: Boolean(id) });
  const { data: profil } = useGetUserById(id, { enabled: Boolean(id) });
  const nom = `${compte?.firstname || ''} ${compte?.lastname || ''}`.trim();
  const retours = Array.isArray(stats?.recentCoachFeedback) ? stats.recentCoachFeedback : [];
  const nouveaux = follow ? newFeedbackKeys(retours, seenFeedbackKeys(follow, id)).size : 0;
  const equipes = Array.isArray(profil?.myTeams) ? profil.myTeams : [];
  const groupes = equipesParClub({ clubName: profil?.club?.name, teams: equipes });
  const age = lAge(t, compte?.age);

  return (
    <TouchableOpacity
      accessibilityLabel={`${nom}, ${t('myChildren.accounts.open', 'Voir son profil')}`}
      accessibilityRole="button"
      onPress={() => onOpen(compte)}
      style={feedbackCardStyle(Colors, nouveaux > 0)}
      testID={`linked-child-${id}`}
    >
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        <ProfileAvatar enablePreview={false} imageUrl={compte?.avatar?.url} name={nom} size={48} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>{nom}</Text>
          {age ? <Text style={[Fonts.p3, Fonts.neutral200]}>{age}</Text> : null}
          <PastilleDEtat texte={t('myChildren.list.state.hasAccount')} ton="compte" />
          {groupes.map((groupe) => (
            <ClubEtEquipe
              club={groupe.club}
              equipes={groupe.equipes}
              key={`${groupe.club}|${groupe.equipes.join('|')}`}
              testID={`linked-child-club-${id}`}
            />
          ))}
        </View>
        <Icone color={Colors.primary500} height={12} name="arrow-right" width={12} />
      </View>
      {nouveaux > 0 ? (
        <View
          style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}
          testID={`linked-child-new-feedback-${id}`}
        >
          <NewPill label={t('stRetours.parent.newCount', { count: nouveaux })} />
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('stRetours.parent.newCountHint', { count: nouveaux })}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * PAR-L5L6 (13/10, design parent E04, planche 2) — LA CARTE COURTE D UN ENFANT DECLARE.
 *
 * Son nom, son age, et CE QUI COMPTE AUJOURD HUI dans une pastille : « En équipe »,
 * « Demande en attente », ou « Pas encore d'équipe ». Quand il y a un club, il a SA ligne,
 * precede du mot « Club », et l equipe la sienne (remarque d Adel du 13/10). Les explications
 * ne vivent plus ici (« Comment ça marche ? ») ; « Chercher un club » est sur SA fiche, et
 * seulement quand il n a pas d equipe (E07).
 * @param {object} props - Les proprietes.
 * @param {any[]} props.demandes - Ses demandes (`demandesDe`).
 * @param {any} props.enfant - La fiche.
 * @param {(enfant: any) => void} props.onDelete - « Supprimer ».
 * @param {(enfant: any) => void} props.onEdit - « Modifier ».
 * @param {(enfant: any) => void} props.onGiveAccount - F20 « Donner un compte à Lina ».
 * @param {(enfant: any) => void} props.onOpen - Ouvre SA fiche (moins de 13 ans).
 * @param {boolean} props.suppressionEnCours - Une suppression part.
 * @returns {import('react').ReactElement} - La carte.
 */
function CarteDeLaFiche({
  demandes, enfant, onDelete, onEdit, onGiveAccount, onOpen, suppressionEnCours,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const id = enfant?.documentId;
  const prenom = enfant?.firstname || '';
  const nomComplet = `${prenom} ${enfant?.lastname || ''}`.trim();
  const pouvoir = parentalPowerForAge(enfant?.age);
  const age = lAge(t, enfant?.age);
  const etat = etatDeLEnfant(enfant, demandes);
  const texteDeLEtat = {
    attente: t('myChildren.list.state.pending', { count: etat.enAttente }),
    neutre: t('myChildren.screen.noTeam', 'Pas encore d’équipe'),
    ok: t('myChildren.list.state.inTeam'),
  }[etat.ton];
  // ST-RETOURS2 · point 4 — moins de 13 ans : la carte ouvre SA page.
  const aSaPage = pouvoir === 'full';
  const Rangee = aSaPage ? TouchableOpacity : View;
  const porte = aSaPage
    ? {
      accessibilityLabel: `${nomComplet}, ${t('myChildren.declared.open')}`,
      accessibilityRole: 'button',
      onPress: () => onOpen(enfant),
      testID: `declared-child-${id}`,
    }
    : {};
  const texteDuLien = [Fonts.p2Bold, { color: Colors.primary300 }];

  return (
    <View style={feedbackCardStyle(Colors, false)}>
      <Rangee
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...porte}
        style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}
      >
        <ProfileAvatar
          enablePreview={false}
          imageUrl={enfant?.photo?.url}
          name={nomComplet}
          size={48}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>{nomComplet}</Text>
          {age ? <Text style={[Fonts.p3, Fonts.neutral200]}>{age}</Text> : null}
          <PastilleDEtat
            testID={`declared-child-state-${id}`}
            texte={texteDeLEtat}
            ton={etat.ton}
          />
          <ClubEtEquipe
            club={etat.club}
            equipes={etat.equipes}
            libelleEquipe={etat.ton === 'attente' ? t('myChildren.list.requestedTeamLabel') : ''}
            testID={`declared-child-club-${id}`}
          />
        </View>
        {aSaPage ? (
          <Icone color={Colors.primary500} height={12} name="arrow-right" width={12} />
        ) : null}
      </Rangee>

      {/* On EXPLIQUE l'absence de « chercher un club » a partir de 13 ans (E17). */}
      {pouvoir === 'view' ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'myChildren.screen.tooOldHint',
            'À partir de 13 ans, {{firstname}} fait ses demandes lui-même.',
            { firstname: prenom, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : null}

      {/* 🔑 F20 — à 13 ans, la fiche reçoit la clé : Lina crée SON compte, et la fiche y est
          accrochée quand elle accepte le lien. */}
      {age && pouvoir === 'view' && !enfant?.account ? (
        <TouchableOpacity onPress={() => onGiveAccount(enfant)}>
          <Text style={texteDuLien}>
            {t(
              'myChildren.actions.giveAccount',
              'Donner un compte à {{firstname}}',
              { firstname: prenom, ...SANS_ECHAPPEMENT },
            )}
          </Text>
        </TouchableOpacity>
      ) : null}
      {enfant?.account ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'myChildren.screen.hasAccount',
            '{{firstname}} a son propre compte.',
            { firstname: prenom, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : null}
      {pouvoir === 'none' ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'myChildren.screen.adultHint',
            '{{firstname}} est majeur : il gère son compte seul.',
            { firstname: prenom, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : null}

      <View style={[Alignments.row, { gap: 20 }]}>
        <TouchableOpacity onPress={() => onEdit(enfant)}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
            {t('myChildren.actions.edit', 'Modifier')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={suppressionEnCours} onPress={() => onDelete(enfant)}>
          <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>
            {t('myChildren.actions.delete', 'Supprimer')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * PARENT P2 — ÉCRAN 7 : « MES ENFANTS ».
 *
 * 🧒 POURQUOI CET ÉCRAN EXISTE. Un enfant de moins de 13 ans n'a pas de compte —
 * le serveur le refuse (palier 13). Il vit donc comme une FICHE portée par le
 * compte de son parent, et c'est ici que le parent la crée, la corrige, et
 * l'efface. C'est le seul endroit, pour le 1er enfant comme pour le 3ᵉ.
 *
 * 🔒 LES TROIS TRANCHES D'ÂGE SE VOIENT ICI (E17, tranché par Adel le 07/09) —
 * et l'écran EXPLIQUE au lieu de faire disparaître un bouton sans un mot :
 *   · moins de 13 ans → sa fiche, où l'on cherche un club pour Léa ;
 *   · 13 à 17 ans     → l'ado fait ses demandes lui-même ;
 *   · 18 ans et plus  → le lien parental s'éteint, c'est la loi.
 * Le pouvoir se CALCULE à partir de l'âge rendu par le serveur : rien n'est
 * stocké, donc rien ne peut être en retard le jour d'un anniversaire.
 *
 * ⛔ CE QUE CET ÉCRAN NE MONTRE PAS, et c'est voulu : la date de naissance. Le
 * serveur ne la rend jamais — il rend un âge calculé, exactement comme le profil
 * public d'un compte.
 *
 * 📋 PAR-L5L6 (13/10, design parent E04, planche 2) — une carte COURTE par enfant, la même
 * forme pour une fiche et un compte relié (jamais fusionnés : la fiche ouvre SA page, le
 * compte ouvre SON profil). Les demandes de place de chaque enfant se lisent en une fois
 * (`/club-interest-requests/mine`, avec celles des enfants et l'historique, sans club).
 *
 * 📄 ST-RETOURS2 (planche 22, état 6) — avec `childDocumentId`, la route montre la PAGE
 * d'un enfant de moins de 13 ans, au lieu de la liste.
 * @param {object} [props] - Les propriétés de la route.
 * @param {any} [props.route] - La route ; `params.childDocumentId` ouvre une fiche.
 * @returns {import('react').ReactElement} L'écran.
 */
function MyChildren({ route } = {}) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  const {
    data: enfantsBruts,
    error: erreurEnfants,
    isLoading: chargementEnfants,
    refetch: relireLesEnfants,
  } = useGetMyDeclaredChildren();
  const { isPending: suppressionEnCours, mutate: supprimerEnfant } = useDeleteDeclaredChild();

  const enfants = Array.isArray(enfantsBruts) ? enfantsBruts : [];

  // 🔗 PARENT-LIEN — LES COMPTES de mes enfants (13-17 ans) reliés au mien, et mes demandes.
  // Une liste À PART des fiches : une fiche est un enfant SANS compte, déclaré par moi ; un
  // compte relié est un ado qui a ACCEPTÉ le lien depuis le sien.
  const {
    data: liens,
    error: erreurLiens,
    isLoading: chargementLiens,
  } = useParentLinksAsParent();
  const { isPending: annulationEnCours, mutate: annulerDemande } = useCancelParentLink();
  const comptesRelies = Array.isArray(liens?.children) ? liens.children : [];
  const demandesEnvoyees = Array.isArray(liens?.requests) ? liens.requests : [];
  // ST-RETOURS — ce que j ai deja lu des retours de mes enfants (une lecture pour tous).
  const { data: suiviDesRetours } = useGetCoachFeedbackFollow({
    enabled: comptesRelies.length > 0,
  });

  // PAR-L5L6 — les demandes de place de MES ENFANTS : une lecture pour toutes les fiches. Sa
  // clé de cache porte `includeChildRequests` (elle ne se mélange pas à celle de la fiche club).
  const { data: mesDemandes } = useGetMyClubInterestRequests(
    { includeChildRequests: true, includeHistory: true },
    { enabled: enfants.length > 0 },
  );
  const lignesDeDemandes = useMemo(
    () => (Array.isArray(mesDemandes?.data) ? mesDemandes.data : []),
    [mesDemandes?.data],
  );

  const relierUnCompte = useCallback((enfant) => {
    // Ecran pas encore route sur le site (webRouteExemptions) : le site EXPLIQUE au lieu
    // d atterrir en silence sur l accueil.
    navigateOrExplainOnWeb(navigation, RouteNames.ParentLinkInvite, enfant
      ? { childDocumentId: enfant.documentId, childFirstname: enfant.firstname || '' }
      : undefined);
  }, [navigation]);

  const ouvrirLeProfil = useCallback((compte) => {
    // C'est SUR SON PROFIL que vit « Retours du coach » (lot PARENT-RETOURS).
    navigation.navigate(RouteNames.UserDetails, { userId: compte.documentId });
  }, [navigation]);

  // ST-RETOURS2 · point 4 — la page d un enfant de moins de 13 ans : la MEME route, une
  // fiche ouverte (`push`, pour que « retour » ramene a la liste).
  const ouvrirLaFiche = useCallback((enfant) => {
    navigation.push(RouteNames.MyChildren, { childDocumentId: enfant?.documentId });
  }, [navigation]);

  const ouvrirFormulaire = useCallback((enfant) => {
    navigation.navigate(RouteNames.ChildEdit, enfant
      ? { childDocumentId: enfant.documentId }
      : undefined);
  }, [navigation]);

  const chercherUnClub = useCallback((enfant) => {
    // On emmène l'enfant visé jusqu'à la recherche : la fiche du club en a
    // besoin pour proposer « demander à rejoindre au nom de Léa » plutôt qu'un
    // bouton anonyme.
    // ⚠️ La recherche vit dans `SearchStack`, deux niveaux plus bas que cet
    // ecran : un nom nu remonterait vers les PARENTS, il ne descend jamais chez
    // un voisin. `allerDansLOnglet` ecrit ce chemin UNE fois (defaut du 08/09,
    // cinq navigations mortes de la meme facon).
    allerDansLOnglet(navigation, RouteNames.SearchClubs, {
      childDocumentId: enfant?.documentId,
      childFirstname: enfant?.firstname,
    });
  }, [navigation]);

  const demanderSuppression = useCallback((enfant) => {
    const prenom = enfant?.firstname || '';
    Alert.alert(
      t('myChildren.confirmDelete.title', 'Supprimer cette fiche ?', {
        firstname: prenom, ...SANS_ECHAPPEMENT,
      }),
      t('myChildren.confirmDelete.message', 'Cette fiche sera effacée.', {
        firstname: prenom, ...SANS_ECHAPPEMENT,
      }),
      [
        { style: 'cancel', text: t('myChildren.confirmDelete.cancel', 'Annuler') },
        {
          onPress: () => supprimerEnfant(enfant?.documentId, {
            onError: () => Alert.alert(
              t('common.error', 'Erreur'),
              t('myChildren.errors.delete', 'Impossible de supprimer cette fiche pour le moment.'),
            ),
          }),
          style: 'destructive',
          text: t('myChildren.confirmDelete.confirm', 'Supprimer'),
        },
      ],
    );
  }, [supprimerEnfant, t]);

  // C4 du design parent — « Annuler » une demande de lien partait SANS confirmation et sans
  // message d'erreur. Deux choix : sur le site, `Alert` devient `window.confirm`.
  const confirmerLAnnulation = useCallback((demande) => {
    Alert.alert(
      t('myChildren.list.confirmCancelLink.title'),
      t('myChildren.list.confirmCancelLink.message', {
        hint: demande?.phoneHint || '··', ...SANS_ECHAPPEMENT,
      }),
      [
        { style: 'cancel', text: t('myChildren.list.confirmCancelLink.keep') },
        {
          onPress: () => annulerDemande(demande?.documentId, {
            onError: () => Alert.alert(
              t('common.error', 'Erreur'),
              t('myChildren.list.errors.cancelLink'),
            ),
          }),
          style: 'destructive',
          text: t('myChildren.list.confirmCancelLink.confirm'),
        },
      ],
    );
  }, [annulerDemande, t]);

  // ST-RETOURS2 · point 4 (planche 22, etat 6) — LA PAGE D UN ENFANT DE MOINS DE 13 ANS. Une
  // vue de cette route, comme « Retours du coach » sur celle du profil : aucune route neuve,
  // le site la sert deja. Les donnees : la liste deja lue. Placee apres tous les hooks.
  const ficheOuverte = route?.params?.childDocumentId;
  if (ficheOuverte) {
    const enfantOuvert = enfants.find((enfant) => enfant?.documentId === ficheOuverte);
    return (
      <ScreenContainer
        bgImage="bg2"
        bottomInsetMode="screen"
        contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          <WithDataWrapper error={erreurEnfants?.message} isLoading={chargementEnfants}>
            {enfantOuvert ? (
              <DeclaredChildPage enfant={enfantOuvert} onSearchClub={chercherUnClub} />
            ) : (
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t('myChildren.declared.notFound')}
              </Text>
            )}
          </WithDataWrapper>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const total = comptesRelies.length + enfants.length;
  // Rien du tout — ni fiche, ni compte relié, ni demande de lien : l'écran vide du design.
  const rienDuTout = !chargementLiens && !erreurLiens && total === 0
    && demandesEnvoyees.length === 0;
  // ErrorWrapper pose son pavé SUR ses enfants, à leur taille : sans contenu, il ne se voit pas.
  const placeDuPave = <View style={{ minHeight: 140 }} />;

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <View style={[Alignments.alignCenter, { gap: 8 }]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00, { letterSpacing: 1 }]}>
          {t('myChildren.screen.title', 'Mes enfants').toUpperCase()}
        </Text>
        <View style={{ backgroundColor: Colors.neutral00, height: 2, width: 80 }} />
        {total > 0 ? (
          <Text
            style={[Fonts.p3Bold, Fonts.primary300, { letterSpacing: 1 }]}
            testID="my-children-count"
          >
            {t('myChildren.list.count', { count: total }).toUpperCase()}
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {/* STATS-FIX2 · 8-22 (tournee T10, ecran 22) — les comptes relies D ABORD (planche 22,
            etat 1) : c est la que vivent les retours de l entraineur. */}
        <WithDataWrapper error={erreurLiens?.message} isLoading={chargementLiens}>
          <View style={{ gap: 12 }} testID="my-children-accounts">
            {erreurLiens ? placeDuPave : null}
            {comptesRelies.map((compte) => (
              <CarteDuCompteRelie
                compte={compte}
                follow={suiviDesRetours}
                key={compte?.documentId}
                onOpen={ouvrirLeProfil}
              />
            ))}
          </View>
        </WithDataWrapper>

        <WithDataWrapper
          error={erreurEnfants}
          errorMessage={t('myChildren.list.loadError')}
          isLoading={chargementEnfants}
          onRetry={relireLesEnfants ? () => relireLesEnfants() : undefined}
        >
          {erreurEnfants ? placeDuPave : null}
          {rienDuTout && !erreurEnfants ? (
            <View style={{ gap: 12 }} testID="my-children-empty">
              <EmptyState
                description={t(
                  'myChildren.screen.emptyHint',
                  'Déclare-le ici, puis cherche-lui un club.',
                )}
                title={t('myChildren.screen.empty', 'Tu n’as pas encore déclaré d’enfant.')}
              />
              <Button
                onPress={() => ouvrirFormulaire(null)}
                title={t('myChildren.actions.add', 'Ajouter un enfant')}
              />
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => relierUnCompte(null)}
                style={[Alignments.alignCenter, Alignments.justifyCenter, { minHeight: 44 }]}
                testID="my-children-link-account-empty"
              >
                <Text style={[Fonts.p2Bold, { color: Colors.primary300, textAlign: 'center' }]}>
                  {t('myChildren.list.linkAccountEmpty')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!rienDuTout && !erreurEnfants ? (
            <View style={{ gap: 12 }} testID="my-children-list">
              {enfants.map((enfant) => (
                <CarteDeLaFiche
                  demandes={demandesDe(enfant?.documentId, lignesDeDemandes)}
                  enfant={enfant}
                  key={enfant?.documentId}
                  onDelete={demanderSuppression}
                  onEdit={ouvrirFormulaire}
                  onGiveAccount={relierUnCompte}
                  onOpen={ouvrirLaFiche}
                  suppressionEnCours={suppressionEnCours}
                />
              ))}

              {/* 🤐 Une demande de lien s'affiche « envoyée » jusqu'à sa réponse ou son
                  échéance : le numéro ne dit jamais s'il existe un compte derrière. */}
              {demandesEnvoyees.map((demande) => (
                <View
                  key={demande?.documentId}
                  style={{
                    borderColor: withAlpha(Colors.primary500, 0.45),
                    borderRadius: 16,
                    borderWidth: 1,
                    gap: 4,
                    padding: 12,
                  }}
                  testID={`link-request-${demande?.documentId}`}
                >
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {demande?.declaredChild?.firstname
                      ? t(
                        'myChildren.accounts.pendingForChild',
                        'Demande envoyée au numéro finissant par {{hint}} (pour {{firstname}}).',
                        {
                          firstname: demande.declaredChild.firstname,
                          hint: demande?.phoneHint || '··',
                          ...SANS_ECHAPPEMENT,
                        },
                      )
                      : t(
                        'myChildren.accounts.pending',
                        'Demande envoyée au numéro finissant par {{hint}}.',
                        { hint: demande?.phoneHint || '··', ...SANS_ECHAPPEMENT },
                      )}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={annulationEnCours}
                    onPress={() => confirmerLAnnulation(demande)}
                    style={[Alignments.justifyCenter, { alignSelf: 'flex-start', minHeight: 44 }]}
                    testID={`cancel-link-${demande?.documentId}`}
                  >
                    <Text style={[Fonts.p2Bold, { color: Colors.error300 }]}>
                      {t('myChildren.list.cancelLink')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              <Button
                onPress={() => ouvrirFormulaire(null)}
                title={t('myChildren.actions.add', 'Ajouter un enfant')}
              />
              <Button
                onPress={() => relierUnCompte(null)}
                testID="my-children-link-account"
                title={t('myChildren.accounts.link', 'Relier le compte de mon enfant')}
                variant="Secondary"
              />
            </View>
          ) : null}
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default MyChildren;
