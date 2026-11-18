import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { getTournamentEssentials } from '@/views/event/components/TournamentEssentials';

import { RouteNames } from '@/navigation/routeNames';

import {
  MY_TOURNAMENT_INVITATIONS_KEY,
  useGetTournamentTeam,
  useMyTournamentInvitations,
} from '@/services/tournamentTeam/tournamentTeamQueries';
import { respondToTournamentInvitation } from '@/services/tournamentTeam/tournamentTeamService';

import { getEventLocationText } from '@/utils/eventLocationText';
import texteInsecable from '@/utils/texteInsecable';

import LinksPlatform from '@/platform/links';

// Une panne de cette lecture ne dit rien : l'accueil reste tel quel (ancien serveur, rôle sans
// droit).
const LECTURE_DISCRETE = Object.freeze({ meta: { preventToastError: true }, retry: false });

/**
 * La ligne « jour · heures » de la fiche du tournoi (même règle que sa case « Date »).
 * @param {any} event - Le tournoi de l'invitation.
 * @returns {string} La ligne, ou rien.
 */
const ligneDate = (event) => {
  const item = getTournamentEssentials(event).find((candidat) => candidat.key === 'date');
  return item ? [item.value, item.note].filter(Boolean).join(' · ') : '';
};

/**
 * Le lieu complet : le nom du lieu, puis son adresse (planche 2a : « AR Soccer, 119 rue …,
 * Montpellier »). La règle commune (`getEventLocationText`) donne l'adresse ; le nom s'y ajoute
 * quand l'événement le porte à part et que l'adresse ne le dit pas déjà.
 * @param {any} event - Le tournoi.
 * @returns {string} Le lieu, ou rien.
 */
const lieuComplet = (event) => {
  const texte = getEventLocationText(event);
  const nom = typeof event?.location?.name === 'string' ? event.location.name.trim() : '';
  return nom && texte && !texte.includes(nom) ? `${nom}, ${texte}` : texte;
};

/**
 * Le prix d'une place lu sur la fiche d'équipe (`payment.entryFeeCents`, sinon le tournoi), en
 * « 20 € » ; rien pour un tournoi gratuit ou une fiche illisible. Jamais écrit en dur.
 * @param {any} equipe - La fiche d'équipe (`GET /tournament-teams/:id`).
 * @returns {string | null} Le prix.
 */
const prixDeLaPlace = (equipe) => {
  const cents = Math.round(Number(
    equipe?.payment?.entryFeeCents ?? equipe?.event?.tournamentConfig?.entryFeeCents,
  ));
  return Number.isFinite(cents) && cents > 0 ? `${(cents / 100).toLocaleString('fr-FR')} €` : null;
};

/**
 * Le prénom de qui invite (« Karim » de « Karim Benali » ou de « Karim B. »).
 * @param {any} invitation - L'invitation.
 * @returns {string} Le prénom, ou rien.
 */
const prenomDeLInvitant = (invitation) => String(invitation?.invitedBy?.displayName || '')
  .trim().split(/\s+/)[0] || '';

/**
 * Le lien « › Voir … » de la carte (cible de 44 px).
 * @param {{ libelle: string, onPress: () => void }} props - Le libellé et le geste.
 * @returns {import('react').ReactElement} Le lien.
 */
function LienDeCarte({ libelle, onPress }) {
  const { Colors, Fonts, Images } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="link"
      onPress={onPress}
      style={{
        alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, minHeight: 44,
      }}
    >
      <Image
        source={Images.arrowRight}
        style={{
          height: 14, tintColor: Colors.primary200, width: 14,
        }}
      />
      <Text style={[Fonts.p2Bold, Fonts.primary200]}>{texteInsecable(libelle)}</Text>
    </TouchableOpacity>
  );
}

/**
 * Le cadre commun des cartes de l'accueil (rayon 20, repris de T-INVITATION-ACCUEIL).
 * @param {{ children: import('react').ReactNode, testID: string, reussie?: boolean }} props
 *   `reussie` : le cadre bleu de « Tu as rejoint » (planche 2b).
 * @returns {import('react').ReactElement} La carte.
 */
function CadreDeCarte({ children, reussie = false, testID }) {
  const { Colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: reussie
          ? withAlpha(Colors.primary500, 0.08)
          : withAlpha(Colors.primary800, 0.82),
        borderColor: withAlpha(Colors.primary500, reussie ? 0.5 : 0.3),
        borderRadius: 20,
        borderWidth: 1,
        gap: 8,
        padding: 16,
      }}
      testID={testID}
    >
      {children}
    </View>
  );
}

/**
 * Une invitation (planche 2a) : qui invite, avec sa photo, l'équipe, le tournoi (date, lieu, prix),
 * la question, « Voir le tournoi », « Refuser » et « Accepter ».
 * @param {object} props - Les propriétés.
 * @param {any} props.invitation - L'invitation (`team`, `event`, `invitedBy`).
 * @param {{ navigate: (...args: any[]) => void }} props.navigation - La navigation de l'accueil.
 * @param {(invitation: any) => void} props.onAcceptee - Prévenu quand le serveur a accepté.
 * @returns {import('react').ReactElement} La carte.
 */
function CarteInvitationTournoi({ invitation, navigation, onAcceptee }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images,
  } = useTheme();
  const queryClient = useQueryClient();
  const [erreur, setErreur] = useState('');
  const teamId = String(invitation?.team?.documentId || '');
  const eventId = String(invitation?.event?.documentId || '');
  // Le prix et le maillot : la fiche d'équipe, que l'invité lit déjà (sa notification l'y mène).
  const { data: equipe } = useGetTournamentTeam(teamId, LECTURE_DISCRETE);
  const prix = prixDeLaPlace(equipe);
  const maillot = equipe?.event?.tournamentConfig?.jerseySizeRequired === true;

  const reponse = useMutation({
    meta: { preventToastError: true }, // le refus s'écrit sur la carte, pas dans une alerte
    mutationFn: (/** @type {'accepted' | 'declined'} */ status) => (
      respondToTournamentInvitation(teamId, status)
    ),
    onError: (/** @type {any} */ raison) => {
      setErreur(raison?.message || t(
        'tournamentHomeInvitation.error',
        'Ta réponse n’est pas partie. Vérifie ta connexion, puis réessaie.',
      ));
    },
    onSuccess: async (_equipe, status) => {
      setErreur('');
      // IMPL-4-ACCUEIL (planche 2b) : « Accepter » ne quitte plus l'accueil ; la carte devient
      // « Tu as rejoint » (gardée par la liste, l'invitation sortant de la lecture).
      if (status === 'accepted') onAcceptee(invitation);
      // Les clefs de la page d'équipe (son `invalidate`), plus la liste de l'accueil.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...MY_TOURNAMENT_INVITATIONS_KEY] }),
        queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['tournamentTeam', teamId] }),
      ]);
    },
  });

  const invitant = invitation?.invitedBy?.displayName
    || t('tournamentHomeInvitation.someone', 'Un joueur');
  const enCours = reponse.isPending;
  const date = ligneDate(invitation?.event);
  const lieu = lieuComplet(invitation?.event);
  let lignePrix = null;
  if (prix) {
    lignePrix = maillot
      ? t('implAccueil.invitation.prixMaillot', '{{prix}} par joueur · maillot offert', { prix })
      : t('implAccueil.invitation.prix', '{{prix}} par joueur', { prix });
  }

  return (
    <CadreDeCarte testID={`accueil-invitation-tournoi-${teamId}`}>
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>
        {t('implAccueil.invitation.titre', 'Invitation au tournoi')}
      </Text>
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        <Image
          accessibilityIgnoresInvertColors
          source={Images.roundAvatar}
          style={{ borderRadius: 24, height: 48, width: 48 }}
          testID="accueil-invitation-photo"
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{invitant}</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('implAccueil.invitation.invite', 't’invite dans son équipe')}
            {' '}
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{invitation?.team?.name || ''}</Text>
          </Text>
        </View>
      </View>
      <View
        style={{
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderRadius: 12,
          borderWidth: 1,
          gap: 4,
          padding: 12,
        }}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{invitation?.event?.name || ''}</Text>
        {date ? <Text style={[Fonts.p3, Fonts.neutral200]}>{date}</Text> : null}
        {lieu ? <Text style={[Fonts.p3, Fonts.neutral200]}>{lieu}</Text> : null}
        {lignePrix ? <Text style={[Fonts.p3Bold, Fonts.primary500]}>{lignePrix}</Text> : null}
      </View>
      <Text style={[Fonts.p1, Fonts.neutral00]}>
        {t(
          'implAccueil.invitation.question',
          '« Veux-tu rejoindre mon équipe pour ce tournoi ? »',
          SANS_ECHAPPEMENT,
        )}
      </Text>
      {erreur ? (
        <Text accessibilityLiveRegion="polite" style={[Fonts.p3, { color: Colors.error500 }]}>
          {erreur}
        </Text>
      ) : null}
      <LienDeCarte
        libelle={t('tournamentHomeInvitation.seeTournament', 'Voir le tournoi')}
        onPress={() => navigation.navigate(RouteNames.EventStack, {
          params: { eventId },
          screen: RouteNames.EventDetails,
        })}
      />
      <View style={[Alignments.row, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <Button
            disabled={enCours}
            onPress={() => reponse.mutate('declined')}
            title={t('tournamentHomeInvitation.decline', 'Refuser')}
            variant="Danger"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            disabled={enCours}
            isLoading={enCours && reponse.variables === 'accepted'}
            keepTitleWhileLoading
            onPress={() => reponse.mutate('accepted')}
            title={t('tournamentHomeInvitation.accept', 'Accepter')}
            variant="Primary"
          />
        </View>
      </View>
    </CadreDeCarte>
  );
}

/**
 * IMPL-4-ACCUEIL (planche 2b) — l'invitation acceptée : « Tu as rejoint l'équipe », ce qui reste à
 * payer (prix, maillot, seuil de validation : la fiche d'équipe), « Payer ma place » (le lien de
 * SA place, le même geste que la page d'équipe) et « Voir l'équipe ». Sans lien de paiement
 * lisible, « Voir l'équipe » seulement : la page d'équipe porte le paiement.
 * @param {object} props - Les propriétés.
 * @param {any} props.invitation - L'invitation acceptée.
 * @param {{ navigate: (...args: any[]) => void }} props.navigation - La navigation de l'accueil.
 * @returns {import('react').ReactElement} La carte.
 */
function CarteEquipeRejointe({ invitation, navigation }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images,
  } = useTheme();
  const teamId = String(invitation?.team?.documentId || '');
  const eventId = String(invitation?.event?.documentId || '');
  const { data: equipe } = useGetTournamentTeam(teamId, LECTURE_DISCRETE);
  const prix = prixDeLaPlace(equipe);
  const maillot = equipe?.event?.tournamentConfig?.jerseySizeRequired === true;
  const places = Array.isArray(equipe?.payment?.members) ? equipe.payment.members : [];
  const maPlace = places.find((place) => place?.isSelf);
  const lienDePaiement = maPlace && maPlace.status !== 'paid' ? maPlace.paymentUrl : null;
  const seuil = Number(equipe?.payment?.paidMembersToValidate) || 5;
  const prenom = prenomDeLInvitant(invitation);
  const nomEquipe = invitation?.team?.name || '';
  const details = [
    prix ? t('implAccueil.invitation.valideeDes', {
      count: seuil,
      defaultValue: 'L’équipe est validée dès {{count}} joueurs payés.',
    }) : null,
    prenom ? t('implAccueil.invitation.prevenu', '{{prenom}} est prévenu de ta réponse.', {
      prenom, ...SANS_ECHAPPEMENT,
    }) : null,
  ].filter(Boolean).join(' ');

  return (
    <CadreDeCarte reussie testID={`accueil-equipe-rejointe-${teamId}`}>
      <View style={[Alignments.row, { gap: 8 }]}>
        <Image
          source={Images.check}
          style={{
            height: 18, marginTop: 2, tintColor: Colors.primary500, width: 18,
          }}
        />
        <Text style={[Fonts.h5Bold, Fonts.primary500, { flex: 1 }]}>
          {t('implAccueil.invitation.rejoint', 'Tu as rejoint l’équipe {{team}}', {
            team: nomEquipe, ...SANS_ECHAPPEMENT,
          })}
        </Text>
      </View>
      {prix ? (
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {maillot
            ? t(
              'implAccueil.invitation.resteAPayerMaillot',
              'Il te reste à payer ta place pour qu’elle compte : {{prix}}, maillot offert.',
              { prix },
            )
            : t(
              'implAccueil.invitation.resteAPayer',
              'Il te reste à payer ta place pour qu’elle compte : {{prix}}.',
              { prix },
            )}
        </Text>
      ) : null}
      {details ? <Text style={[Fonts.p3, Fonts.neutral200]}>{details}</Text> : null}
      {prix && lienDePaiement ? (
        <Button
          onPress={() => LinksPlatform.openUrlHere(lienDePaiement)}
          title={t('implAccueil.invitation.payer', 'Payer ma place ({{prix}})', { prix })}
          variant="Primary"
        />
      ) : null}
      <LienDeCarte
        libelle={t('implAccueil.invitation.voirEquipe', 'Voir l’équipe')}
        onPress={() => navigation.navigate(RouteNames.EventStack, {
          params: { eventId, teamId },
          screen: RouteNames.TournamentTeamDetails,
        })}
      />
    </CadreDeCarte>
  );
}

/**
 * T-INVITATION-ACCUEIL (18/11/2026, Adel D237 ; constat M1357 de la recette 46) — L'INVITATION À
 * REJOINDRE UNE ÉQUIPE DE TOURNOI, EN ATTENTE, EN HAUT DE L'ACCUEIL (téléphone et site) : une carte
 * par invitation `invited`, la plus récente en haut (ordre du serveur). Accepter et Refuser
 * appellent l'action de la page d'équipe (`respondToTournamentInvitation`) : aucune règle neuve, le
 * refus du serveur (déjà dans une équipe, équipe pleine, âge) s'écrit sur la carte. Rien sans
 * invitation, rien si la lecture échoue.
 * IMPL-4-ACCUEIL (planches 2a-2e, 18/11) : la carte refaite (photo, nom, encadré du tournoi avec
 * son prix, « Refuser » rouge et « Accepter » bleu côte à côte) ; après « Accepter », la carte
 * devient « Tu as rejoint l'équipe » et enchaîne sur le paiement, jusqu'à ce qu'on quitte
 * l'accueil (la carte « Mon équipe » prend alors le relais).
 * Témoins : __tests__/InvitationsTournoiAccueil.test.js,
 * __tests__/HomeHub.T-INVITATION-ACCUEIL.test.js.
 * @param {object} props - Les propriétés.
 * @param {{ navigate: (...args: any[]) => void }} props.navigation - La navigation de l'accueil.
 * @returns {import('react').ReactElement | null} Les cartes, ou rien.
 */
function InvitationsTournoiAccueil({ navigation }) {
  // L'onglet de l'accueil reste monté et l'app ne relit rien au retour
  // (`refetchOnWindowFocus: false`) : la lecture suit le focus de l'écran (comme HomeHub.js),
  // une invitation répondue sur la page d'équipe ou reçue entre-temps est à jour au retour sur
  // l'accueil.
  const isFocused = useIsFocused();
  const lecture = useMyTournamentInvitations({ ...LECTURE_DISCRETE, enabled: isFocused });
  // Les invitations acceptées ici, gardées tant que l'accueil reste à l'écran (la lecture ne les
  // rend plus) ; oubliées dès qu'on le quitte.
  const [rejointes, setRejointes] = useState(/** @type {any[]} */ ([]));
  useEffect(() => {
    if (!isFocused) setRejointes([]);
  }, [isFocused]);
  const idsRejoints = new Set(rejointes.map((invitation) => String(invitation.team.documentId)));
  const invitations = (Array.isArray(lecture?.data) ? lecture.data : [])
    .filter((invitation) => invitation?.responseStatus === 'invited'
      && invitation?.team?.documentId && invitation?.event?.documentId
      && !idsRejoints.has(String(invitation.team.documentId)));
  if (!invitations.length && !rejointes.length) return null;
  return (
    <View style={{ gap: 12 }}>
      {rejointes.map((invitation) => (
        <CarteEquipeRejointe
          invitation={invitation}
          key={`rejointe-${String(invitation.team.documentId)}`}
          navigation={navigation}
        />
      ))}
      {invitations.map((invitation) => (
        <CarteInvitationTournoi
          invitation={invitation}
          key={String(invitation.team.documentId)}
          navigation={navigation}
          onAcceptee={(acceptee) => setRejointes((avant) => [acceptee, ...avant])}
        />
      ))}
    </View>
  );
}

export default InvitationsTournoiAccueil;
