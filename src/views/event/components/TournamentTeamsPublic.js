import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Pressable, Text, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';

import { requestJoinTournamentTeam } from '@/services/tournamentTeam/tournamentTeamService';

import {
  canAskToJoinTournamentTeam,
  getTournamentJoinBlockingNotice,
  getTournamentTeamCaptainShort,
  getTournamentTeamLookingFor,
  getTournamentTeamPlayerCount,
  isTournamentRegistrationClosed,
} from '../tournamentJoinRules';
import { isTournamentTeamOpenToJoinRequests } from '../tournamentUtils';
// L'aperçu (8e) vit dans la feuille d'équipe, doublée par les témoins du site.
import { TournamentTeamPreviewSheet } from './TournamentTeamSheet';

// IMPL-1-FICHE (18/11/2026, pack T-DESIGN-TOURNOI, page 8 et écran 8e, remarque 2 d'Adel) —
// L'ONGLET ÉQUIPES VU PAR QUI N'ORGANISE PAS LE TOURNOI, le même au téléphone (EventDetails.js)
// et sur le site (EventDetails.web.js) :
//   · 8a, sous le seuil : « Les équipes s'affichent dès 8 inscrites », « Créer mon équipe » et
//     « Rejoindre une équipe » ;
//   · 8b, la carte d'une équipe : toute la carte s'ouvre (« Voir l'équipe ») ; « Équipe du
//     tournoi · capitaine Yanis R. », l'état, « Cherche N joueurs » et « Demander à rejoindre »
//     seulement si l'équipe est ouverte aux demandes ;
//   · 8c : la demande envoyée se lit sur la carte (« Demande envoyée ») ; ponytail: pas
//     d'« Annuler la demande », aucune route ne l'annule (ni app ni admin) ; sortie : une route
//     `cancel-request` côté serveur, puis un lien ici ;
//   · 8e, l'aperçu : le nom, le capitaine, les joueurs en « Prénom I. », un mineur sans prénom,
//     les places payées sur 5 SANS dire qui a payé, l'état, « Cherche N joueurs », et
//     « Demander à rejoindre » en bas si l'équipe est ouverte.
// Le paiement de chacun n'est jamais montré ici, même si le serveur le rend encore.
// Témoin : __tests__/TournamentTeamsPublic.IMPL-1.test.js.

/**
 * Une pastille arrondie.
 * @param {object} props - Les propriétés.
 * @param {string} props.color - La couleur du texte (le fond en est une teinte).
 * @param {string} props.text - Le texte.
 * @param {string} [props.testID] - L'identifiant de test.
 * @returns {import('react').ReactElement} La pastille.
 */
function Pastille({ color, testID, text }) {
  const { ApplicationStyle, Fonts, Spaces } = useTheme();
  return (
    <View
      style={[ApplicationStyle.borderRadius100, Spaces.paddingHorizontal[12], {
        alignSelf: 'flex-start', backgroundColor: withAlpha(color, 0.16), paddingVertical: 6,
      }]}
      testID={testID}
    >
      <Text style={[Fonts.p4Bold, { color }]}>{text}</Text>
    </View>
  );
}

/**
 * 8a — sous le seuil : la phrase qui explique et les deux gestes.
 * @param {object} props - Les propriétés.
 * @param {number | null} props.threshold - Le seuil (8 pour 24 équipes).
 * @param {(() => void) | null} [props.onCreate] - « Créer mon équipe », si le lecteur le peut.
 * @param {(() => void) | null} [props.onJoin] - « Rejoindre une équipe », si le lecteur le peut.
 * @returns {import('react').ReactElement} La carte.
 */
export function TournamentTeamsThresholdCard({ onCreate = null, onJoin = null, threshold }) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  return (
    <View
      style={[ApplicationStyle.borderRadius24, Spaces.padding[16], Spaces.gap[8], {
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.primary500, 0.06),
        borderColor: withAlpha(Colors.primary500, 0.32),
        borderWidth: 1,
      }]}
      testID="tournament-teams-threshold"
    >
      <Image
        source={Images.users}
        style={{ height: 32, tintColor: Colors.primary500, width: 32 }}
      />
      <Text style={[Fonts.h4Bold, Fonts.neutral00, { textAlign: 'center' }]}>
        {t('implFiche.teamsShownFrom', { count: threshold || 0 })}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200, { textAlign: 'center' }]}>
        {t('implFiche.teamsShownFromText')}
      </Text>
      <View style={[Spaces.gap[8], Spaces.marginTop[8], { alignSelf: 'stretch' }]}>
        {onCreate ? (
          <Button
            onPress={onCreate}
            style={{ minHeight: 44 }}
            title={t('tournamentFicheWeb.signUp.create')}
            variant="Primary"
          />
        ) : null}
        {onJoin ? (
          <Button
            onPress={onJoin}
            style={{ minHeight: 44 }}
            title={t('tournamentJoin.button', 'Rejoindre une équipe')}
            variant="Secondary"
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * 8b / 8c — la carte d'une équipe, ouverte d'un toucher.
 * @param {object} props - Les propriétés.
 * @param {any} props.team - L'équipe.
 * @param {any} [props.tournamentConfig] - Le réglage du tournoi.
 * @param {(team: any) => void} props.onOpen - Ouvrir l'équipe (aperçu ou page d'équipe).
 * @param {((team: any) => void) | null} [props.onAsk] - « Demander à rejoindre », si permis.
 * @param {boolean} [props.requested] - Le lecteur a déjà demandé à rejoindre cette équipe.
 * @returns {import('react').ReactElement} La carte.
 */
export function TournamentPublicTeamCard({
  onAsk = null, onOpen, requested = false, team, tournamentConfig = {},
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const nom = team?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi');
  const capitaine = getTournamentTeamCaptainShort(team);
  const cherche = getTournamentTeamLookingFor(team, tournamentConfig);
  const effectif = getTournamentTeamPlayerCount(team, tournamentConfig);
  const ouverte = isTournamentTeamOpenToJoinRequests(team);
  const validee = String(team?.status || '').toLowerCase() === 'accepted';
  return (
    <Pressable
      accessibilityHint={t('implFiche.seeTeam')}
      accessibilityLabel={nom}
      accessibilityRole="button"
      onPress={() => onOpen(team)}
      style={[ApplicationStyle.borderRadius24, Spaces.padding[16], Spaces.gap[8], {
        backgroundColor: withAlpha(Colors.primary900, 0.6),
        borderColor: withAlpha(Colors.primary500, 0.24),
        borderWidth: 1,
      }]}
      testID={`tournament-public-team-${team?.documentId}`}
    >
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{nom}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {[
              t('implFiche.tournamentTeam'),
              capitaine
                ? t('implFiche.captainShort', { name: capitaine, ...SANS_ECHAPPEMENT })
                : '',
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {validee ? <Pastille color={Colors.primary500} text={t('implFiche.validated')} /> : null}
      </View>
      <View style={{
        alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      }}
      >
        {cherche > 0 ? (
          <Pastille
            color={Colors.primary200}
            testID="tournament-public-team-looking-for"
            text={t('implFiche.lookingFor', { count: cherche })}
          />
        ) : null}
        {/* D239 (pas de limite de joueurs) : une équipe ouverte qui a déjà ses 5 le dit. */}
        {ouverte && cherche === 0 ? (
          <Pastille color={Colors.primary500} text={t('implFiche.openToRequests')} />
        ) : null}
        {effectif !== null ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('implFiche.players', { count: effectif })}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>{t('implFiche.seeTeam')}</Text>
      </View>
      {ouverte && requested ? (
        <Pastille
          color={Colors.primary500}
          testID="tournament-public-team-requested"
          text={t('implFiche.requestSent')}
        />
      ) : null}
      {ouverte && !requested && onAsk ? (
        <Button
          onPress={() => onAsk(team)}
          style={{ minHeight: 44 }}
          title={t('implFiche.askToJoin')}
          variant="Secondary"
        />
      ) : null}
    </Pressable>
  );
}

/**
 * La demande pour rejoindre une équipe : la déclaration (JoinEventModal), puis la route
 * existante `request-join` (le serveur juge l'âge et « déjà dans une équipe »). Même parcours que
 * le panneau « Rejoindre une équipe » (TournamentJoinTeamPanel.js).
 * ponytail: parcours recopié du panneau, pas encore partagé avec lui ; sortie : que le panneau
 * utilise ce crochet.
 * @param {object} props - Les propriétés.
 * @param {any} props.event - Le tournoi.
 * @param {(team: any) => void} [props.onRequested] - Après l'envoi.
 * @returns {{ ask: (team: any) => void, modal: import('react').ReactElement }} Le geste et sa
 *   fenêtre.
 */
export function useTournamentJoinRequest({ event, onRequested }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [chosenTeam, setChosenTeam] = useState(/** @type {any} */ (null));
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const fermer = () => {
    setChosenTeam(null);
    setSendError('');
  };
  const envoyer = async (/** @type {any} */ acceptance = {}) => {
    if (!chosenTeam?.documentId || isSending) return;
    setSendError('');
    setIsSending(true);
    try {
      const updatedTeam = await requestJoinTournamentTeam(chosenTeam.documentId, {
        acceptRiskDeclaration: acceptance?.acceptRiskDeclaration === true,
      });
      setChosenTeam(null);
      queryClient.invalidateQueries({ queryKey: ['event', event?.documentId] });
      if (onRequested) onRequested(updatedTeam || chosenTeam);
    } catch (/** @type {any} */ error) {
      setSendError(error?.message || t('tournamentJoin.sendError'));
    } finally {
      setIsSending(false);
    }
  };
  return {
    ask: (team) => {
      setSendError('');
      setChosenTeam(team);
    },
    modal: (
      <JoinEventModal
        clubName={event?.club?.name || ''}
        confirmLabel={t('tournamentTeamDetails.sendMyRequest', 'Envoyer ma demande')}
        contextNote={t('tournamentTeamDetails.chosenTeam', 'Équipe choisie : {{name}}.', {
          name: chosenTeam?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi'),
          ...SANS_ECHAPPEMENT,
        })}
        errorMessage={sendError || null}
        eventId={event?.documentId || ''}
        isSubmitting={isSending}
        isVisible={Boolean(chosenTeam)}
        onClose={fermer}
        onConfirm={envoyer}
      />
    ),
  };
}

/**
 * L'onglet Équipes pour qui n'organise pas le tournoi : 8a sous le seuil, puis les cartes (8b,
 * 8c), et l'aperçu (8e) au toucher d'une équipe dont le lecteur ne fait pas partie.
 * @param {object} props - Les propriétés.
 * @param {any} props.event - Le tournoi.
 * @param {any[]} props.teams - Les équipes à montrer (déjà filtrées par la règle du seuil).
 * @param {boolean} props.belowThreshold - Sous le seuil des 30 %.
 * @param {number | null} props.threshold - Le seuil.
 * @param {any} [props.viewerTeam] - L'équipe du lecteur (capitaine, membre, invité, demandeur).
 * @param {boolean} [props.viewerRequested] - Le lecteur a demandé à rejoindre `viewerTeam`.
 * @param {(() => void) | null} [props.onCreate] - « Créer mon équipe », si le lecteur le peut.
 * @param {(teamId: string) => void} props.onOpenTeamPage - Ouvrir la page d'une équipe (la sienne).
 * @returns {import('react').ReactElement} L'onglet.
 */
function TournamentTeamsPublic({
  belowThreshold, event, onCreate = null, onOpenTeamPage, teams, threshold,
  viewerRequested = false, viewerTeam = null,
}) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  // IMPL-1C (19/11, recette 48, point A) : « dès N inscrites » seulement avec un seuil connu
  // (N > 0) et pas encore atteint ; inscriptions fermées : ni seuil, ni appel à créer,
  // « Inscriptions fermées », et les équipes se lisent.
  // Témoin : TournamentTeamsPublic.IMPL-1 « point A ».
  const fermees = isTournamentRegistrationClosed(event);
  const sousLeSeuil = Boolean(belowThreshold) && Number(threshold) > 0 && !fermees;
  const [listeOuverte, setListeOuverte] = useState(!sousLeSeuil);
  const [apercu, setApercu] = useState(/** @type {any} */ (null));
  const demande = useTournamentJoinRequest({
    event,
    onRequested: (team) => onOpenTeamPage(team?.documentId),
  });
  const config = event?.tournamentConfig || {};
  // Qui peut demander : la règle du panneau « Rejoindre une équipe » (compte, âge, organisateur,
  // déjà dans une équipe), sur toutes les équipes du tournoi.
  const { accountRoleKey, userData } = useAuth();
  const canAsk = canAskToJoinTournamentTeam({
    accountRoleKey, event, teams: event?.tournamentTeams || teams, user: userData,
  }) && !getTournamentJoinBlockingNotice({ event, user: userData });
  const demander = canAsk ? (/** @type {any} */ team) => {
    setApercu(null);
    demande.ask(team);
  } : null;
  const ouvrir = (/** @type {any} */ team) => {
    if (viewerTeam?.documentId && viewerTeam.documentId === team?.documentId && !viewerRequested) {
      onOpenTeamPage(team.documentId);
      return;
    }
    setApercu(team);
  };
  const aDemande = (/** @type {any} */ team) => Boolean(
    viewerRequested && viewerTeam?.documentId && viewerTeam.documentId === team?.documentId,
  );
  // La sienne reste visible sous le seuil ; les autres, après « Rejoindre une équipe ».
  const visibles = listeOuverte
    ? teams
    : teams.filter((team) => team?.documentId && team.documentId === viewerTeam?.documentId);
  return (
    <View style={Spaces.gap[12]} testID="tournament-teams-public">
      {fermees ? (
        <Text style={[Fonts.p2Bold, Fonts.warning400]} testID="tournament-teams-closed">
          {t('implFiche.registrationsClosed')}
        </Text>
      ) : null}
      {sousLeSeuil ? (
        <TournamentTeamsThresholdCard
          onCreate={viewerTeam ? null : onCreate}
          onJoin={demander && !viewerTeam ? () => setListeOuverte(true) : null}
          threshold={threshold}
        />
      ) : null}
      {listeOuverte && sousLeSeuil && teams.length === 0 ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.neutral00]}>
          {t('tournamentJoin.none')}
        </Text>
      ) : null}
      {visibles.map((team) => (
        <TournamentPublicTeamCard
          key={team?.documentId || team?.name}
          onAsk={viewerTeam ? null : demander}
          onOpen={ouvrir}
          requested={aDemande(team)}
          team={team}
          tournamentConfig={config}
        />
      ))}
      {/* Un témoin du site peut doubler la feuille d'équipe sans son export nommé. */}
      {apercu && TournamentTeamPreviewSheet ? (
        <TournamentTeamPreviewSheet
          event={event}
          onAsk={viewerTeam ? null : demander}
          onClose={() => setApercu(null)}
          requested={aDemande(apercu)}
          team={apercu}
          tournamentConfig={config}
          tournamentName={event?.name || ''}
        />
      ) : null}
      {demande.modal}
    </View>
  );
}

export default TournamentTeamsPublic;
