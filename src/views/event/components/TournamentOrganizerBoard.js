import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { avecMarqueUtf8 } from '@/domains/collectivite/collectiviteChiffres';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import ShareEventModal from '@/components/organisms/shareEventModal/ShareEventModal';

import { RouteNames } from '@/navigation/routeNames';

import { createChatMessage, createWhisperChat } from '@/services/chat/chatService';
import {
  exportTournamentPlayers,
  openTournamentCaptainsChat,
  remindTournamentTeamUnpaid,
  setTournamentRegistrations,
  tournamentOrganizerSummaryKey,
} from '@/services/tournamentTeam/tournamentOrganizerService';
import { reviewTournamentTeamRegistration } from '@/services/tournamentTeam/tournamentTeamService';

import { withAlpha } from '../tournamentDesignSystem';
import { getTournamentShortPlace } from '../tournamentJoinRules';
import { normalizeTournamentText } from '../tournamentUtils';

// 🪤 R7-d (EventParticipants.js) : `import/order` veut l'alias avant le relatif, `perfectionist`
// l'inverse ;
// l'image du tournoi (la même que le bandeau de la fiche, EventHeader) suit les relatifs.
// eslint-disable-next-line import/order
import BG_TOURNAMENT from '@/assets/background-card-event/card-tournoi.png';

// IMPL-3-ORGA (18/11/2026, page 1 des planches T-DESIGN-TOURNOI, Adel D261 « 1- A »)
// LE TABLEAU DE BORD DE L ORGANISATEUR : le tournoi et l'interrupteur des inscriptions (1a, 1e),
// quatre chiffres, trois boutons, puis une carte par équipe avec son menu ⋯ (1b) et la fenêtre
// de refus qui dit la règle de remboursement (1d). Bleu primaire partout (Adel 18/11, plus aucun
// vert) ; « Refuser » en rouge (Danger / DangerFilled). Le remboursement d'une équipe refusée
// reste le geste manuel d'Adel (REMBOURSEMENTS.md, cas F, D233) : la fenêtre dit la règle des
// CGV (§ 5), elle ne rembourse rien.
// Témoin : src/views/event/__tests__/TournamentManagement.IMPL3ORGA.test.js.
// ORGANISATEUR (19/11, décisions d'Adel, cartes 1a-1f et 11b) : « Archiver » confirmé, « Refuser »
// aussi pour une
// équipe validée (le serveur l'accepte et prévient les SuperAdmins : tournament-team.js
// reviewRegistration →
// alertRefundDue), la photo et le lieu court dans la carte du tournoi, « 1 payé sur 5 », plus d'«
// Effectif à revoir »
// sur les cartes (le filtre reste), un trait avant l'action rouge, des lignes serrées au bureau, la
// règle des payés
// et « ton équipe ». Témoin : TournamentManagement.ORGANISATEUR.test.js.

const SEUIL_PAR_DEFAUT = 5;
const CIBLE = 44;

/**
 * « 420 € » à partir de centimes.
 * @param {number} cents - Le montant.
 * @returns {string} Le montant lisible.
 */
const euros = (cents) => `${(Math.max(0, Number(cents) || 0) / 100).toLocaleString('fr-FR')} €`;

/**
 * « sam. 19 décembre · 19:00 – 23:00 » : l'heure SAISIE (`startTime`), jamais déduite de `date`.
 * @param {any} event - Le tournoi du tableau de bord.
 * @returns {string} La ligne, ou '' sans date.
 */
const ligneDeDate = (event) => {
  const brute = String(event?.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(brute)) return '';
  const jour = new Date(`${brute}T12:00:00Z`).toLocaleDateString(localeDesFormats(), {
    day: 'numeric', month: 'long', timeZone: 'UTC', weekday: 'short',
  });
  const debut = String(event?.startTime || '').slice(0, 5);
  const fin = String(event?.endTime || '').slice(0, 5);
  let heures = '';
  if (debut) heures = fin ? `${debut} – ${fin}` : debut;
  return [jour, heures].filter(Boolean).join(' · ');
};

/**
 * Le seuil des places payées qui valide une équipe (5 par défaut).
 * @param {any} summary - Le résumé de l'organisateur.
 * @param {any} tournamentConfig - Le réglage du tournoi.
 * @returns {number} Le seuil.
 */
const seuilDesPayes = (summary, tournamentConfig) => {
  if (Number(summary?.paidThreshold) > 0) return Number(summary.paidThreshold);
  if (Number(tournamentConfig?.paidMembersToValidate) > 0) {
    return Number(tournamentConfig.paidMembersToValidate);
  }
  return SEUIL_PAR_DEFAUT;
};

/**
 * Le tableau de bord de l'organisateur d'un tournoi ouvert.
 * @param {object} props
 * @param {boolean} [props.compact] - Bureau (1024 px et plus) : une ligne serrée par équipe
 *   (planche 1f).
 * @param {any} props.event - Le tournoi (tableau de bord).
 * @param {string} props.eventId - Son documentId.
 * @param {any} props.navigation - La navigation.
 * @param {() => Promise<void>} props.onChanged - Rafraîchit le tableau de bord après un geste.
 * @param {any} props.summary - Le résumé de l'organisateur, ou null.
 * @param {boolean} [props.summaryFailed] - Le résumé est refusé ou en panne (403 : pas
 *   l'organisateur).
 * @param {any[]} props.teams - Les équipes affichées (déjà filtrées).
 * @param {number} props.totalTeamsCount - Toutes les équipes, filtre ou non.
 * @param {number} props.registeredTeamsCount - Inscrites (en attente + validées).
 * @param {any} props.tournamentConfig - Le réglage du tournoi.
 * @param {string} [props.viewerDocumentId] - Le compte connecté.
 * @param {import('react').ReactNode} [props.filters] - Les filtres des équipes (existants).
 * @param {import('react').ReactNode} [props.invites] - Les invitations d'un tournoi privé.
 * @param {{ alt: string, uri: string } | null} [props.photo] - La photo du lieu
 *   (`photoDuLieu`), ou null.
 * @returns {import('react').ReactElement} Le tableau de bord.
 */
function TournamentOrganizerBoard({
  compact = false,
  event,
  eventId,
  filters = null,
  invites = null,
  navigation,
  onChanged,
  photo = null,
  registeredTeamsCount,
  summary,
  summaryFailed = false,
  teams,
  totalTeamsCount,
  tournamentConfig,
  viewerDocumentId = '',
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const [menuOuvert, setMenuOuvert] = useState('');
  const [equipeARefuser, setEquipeARefuser] = useState(/** @type {any} */ (null));
  const [avis, setAvis] = useState(
    /** @type {{ equipe: string, texte: string } | null} */ (null),
  );
  const [partageVisible, setPartageVisible] = useState(false);
  const [inscriptionsOuvertes, setInscriptionsOuvertes] = useState(
    /** @type {boolean | null} */ (null),
  );

  const estPayant = Number(tournamentConfig?.entryFeeCents) > 0
    || Number(summary?.entryFeeCents) > 0;
  const seuil = seuilDesPayes(summary, tournamentConfig);
  // Sans résumé (chargement, panne, 403), aucun chiffre de paiement n'est inventé : pas de « 0 € ».
  const connu = Boolean(summary);
  const ouvertes = inscriptionsOuvertes
    ?? (summary ? summary.registrationsOpen !== false : true);
  const maxLu = Number(summary?.maxTeams ?? tournamentConfig?.maxTeams);
  const maxEquipes = maxLu > 0 ? maxLu : null;
  /** @type {Map<string, any>} */
  const ligneParEquipe = new Map(
    (summary?.teams || []).map((/** @type {any} */ ligne) => [ligne.documentId, ligne]),
  );

  const carte = {
    backgroundColor: withAlpha(Colors.primary900, 'F2'),
    borderColor: withAlpha(Colors.primary500, '3D'),
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  };

  // La barre « N payés sur 5 » : bleu primaire (Adel 18/11, plus aucun vert). Le libellé blanc
  // est AU-DESSUS de la barre, jamais posé sur le bleu.
  const pisteDeLaBarre = withAlpha(Colors.primary500, '29');
  const remplissageDeLaBarre = Colors.primary500;

  const erreur = (/** @type {any} */ cause, /** @type {string} */ repli) => {
    Alert.alert(
      t('common.error', 'Erreur'),
      cause?.response?.data?.error?.message || cause?.details?.error || cause?.message || repli,
    );
  };
  const rafraichir = async () => {
    await Promise.all([
      onChanged?.(),
      queryClient.invalidateQueries({ queryKey: tournamentOrganizerSummaryKey(eventId) }),
    ]);
  };
  const erreurDEquipe = (/** @type {any} */ cause) => erreur(cause, t(
    'tournamentManagement.unableToUpdateThisTeam',
    'Impossible de mettre à jour cette équipe.',
  ));

  const inscriptions = useMutation({
    mutationFn: (/** @type {boolean} */ ouvrir) => setTournamentRegistrations(eventId, ouvrir),
    onError: (cause, ouvrir) => {
      setInscriptionsOuvertes(!ouvrir);
      erreur(cause, t(
        'implOrga.registrationsError',
        'Les inscriptions n’ont pas pu être modifiées.',
      ));
    },
    onSuccess: async (resultat, ouvrir) => {
      setInscriptionsOuvertes(typeof resultat?.registrationsOpen === 'boolean'
        ? resultat.registrationsOpen
        : ouvrir);
      await rafraichir();
    },
  });

  const phrasesDeLaRelance = (/** @type {any} */ resultat, /** @type {any} */ equipe) => {
    const envoyees = Number(resultat?.sent) || 0;
    const sautees = Number(resultat?.skipped) || 0;
    const phrases = [];
    if (envoyees > 0) {
      phrases.push(t('implOrga.remindSent', {
        count: envoyees,
        defaultValue_one: 'Relance envoyée au joueur de {{team}} qui n’a pas payé.',
        defaultValue_other: 'Relance envoyée aux {{count}} joueurs de {{team}} qui n’ont pas payé.',
        team: equipe?.name || '',
        ...SANS_ECHAPPEMENT,
      }));
    }
    if (sautees > 0) {
      phrases.push(t('implOrga.remindSkipped', {
        count: sautees,
        defaultValue_one: '1 joueur a déjà été relancé il y a moins de 12 h.',
        defaultValue_other: '{{count}} joueurs ont déjà été relancés il y a moins de 12 h.',
      }));
    }
    if (!phrases.length) {
      phrases.push(t(
        'implOrga.remindNobody',
        'Personne à relancer : toutes les places sont payées.',
      ));
    }
    return phrases.join(' ');
  };

  const relance = useMutation({
    mutationFn: (/** @type {any} */ equipe) => remindTournamentTeamUnpaid(equipe.documentId),
    onError: (cause) => erreur(cause, t('implOrga.remindError', 'La relance n’est pas partie.')),
    onSuccess: async (resultat, equipe) => {
      setAvis({ equipe: equipe.documentId, texte: phrasesDeLaRelance(resultat, equipe) });
      await rafraichir();
    },
  });

  const revue = useMutation({
    mutationFn: (/** @type {{ equipe: any, status: string }} */ { equipe, status }) => (
      reviewTournamentTeamRegistration(equipe.documentId, status)
    ),
    onError: erreurDEquipe,
    onSuccess: rafraichir,
  });

  const ouvrirLeFil = (/** @type {string | undefined} */ chatId) => {
    if (chatId) navigation.navigate(RouteNames.Conversation, { chatId });
  };
  const erreurDuFil = (/** @type {any} */ cause) => erreur(cause, t(
    'tournamentJoin.writeError',
    'Impossible d’ouvrir la conversation pour le moment.',
  ));
  const ecrireAuCapitaine = async (/** @type {string} */ capitaineId) => {
    try {
      const fil = await createWhisperChat([capitaineId]);
      ouvrirLeFil(fil?.documentId);
    } catch (cause) {
      erreurDuFil(cause);
    }
  };
  const ecrireATousLesCapitaines = async () => {
    try {
      const groupe = await openTournamentCaptainsChat(eventId);
      ouvrirLeFil(groupe?.chatId);
    } catch (cause) {
      erreurDuFil(cause);
    }
  };
  const exporter = async () => {
    try {
      const csv = await exportTournamentPlayers(eventId);
      // Résolution par suffixe de plateforme (`.native.js` / `.web.js`) : chargé au geste,
      // comme le fil de TournamentTeamDetails ; le contrôle de types ne voit aucun fichier à
      // ce chemin exact.
      // @ts-ignore -- cf. ci-dessus
      const media = require('@/platform/media/saveTextFile'); // eslint-disable-line global-require
      const { saveTextFile } = /** @type {any} */ (media);
      const nom = String(event?.name || 'tournoi').normalize('NFD')
        .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'tournoi';
      await saveTextFile({
        contenu: avecMarqueUtf8(csv), fileName: `joueurs_${nom}.csv`, mimeType: 'text/csv',
      });
    } catch (cause) {
      erreur(cause, t('implOrga.exportError', 'La liste n’a pas pu être exportée.'));
    }
  };
  const partagerDansUnFil = async (/** @type {string} */ chatId) => {
    setPartageVisible(false);
    try {
      // Le même message que la fiche (« Partage » et la carte de l'événement).
      await createChatMessage({ chatId, event: /** @type {any} */ (eventId), message: 'Partage' });
      ouvrirLeFil(chatId);
    } catch (cause) {
      erreur(cause, t(
        'event.shareInChatError',
        'Impossible de partager l’événement pour le moment.',
      ));
    }
  };

  // O9 (Adel 19/11) : archiver retire l'équipe des listes ; le geste se confirme, comme le refus.
  const confirmerLArchivage = (/** @type {any} */ equipe) => {
    Alert.alert(
      t('implOrga.archiveTitle', {
        defaultValue: 'Archiver {{name}} ?',
        name: equipe?.name || '',
        ...SANS_ECHAPPEMENT,
      }),
      t(
        'implOrga.archiveBody',
        'L’équipe sort de la liste des équipes inscrites. Tu la retrouves dans « Archivées ».',
      ),
      [
        { style: 'cancel', text: t('common.actions.cancel', 'Annuler') },
        {
          onPress: () => revue.mutate({ equipe, status: 'archived' }),
          style: 'destructive',
          text: t('implOrga.archiveConfirm', 'Archiver'),
        },
      ],
    );
  };

  const etatDeLEquipe = (/** @type {string} */ statut) => {
    if (statut === 'accepted') {
      return { couleur: Colors.primary500, texte: t('tournamentUtils.approved', 'Validée') };
    }
    if (statut === 'declined') {
      return { couleur: Colors.error500, texte: t('tournamentUtils.declined', 'Refusée') };
    }
    if (statut === 'archived') {
      return { couleur: Colors.neutral300, texte: t('tournamentUtils.archived', 'Archivée') };
    }
    return {
      couleur: Colors.warning400,
      texte: estPayant
        ? t('implOrga.statusWaitingPayments', 'En attente des paiements')
        : t('tournamentUtils.pending', 'En attente'),
    };
  };

  const pastille = (
    /** @type {string} */ texte,
    /** @type {string} */ couleur,
    /** @type {boolean} */ plein = false,
  ) => (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: plein ? couleur : withAlpha(couleur, '29'),
        borderRadius: 100,
        paddingHorizontal: 12,
        paddingVertical: 4,
      }}
    >
      <Text style={[Fonts.p4Bold, { color: plein ? Colors.primary900 : couleur }]}>{texte}</Text>
    </View>
  );

  const chiffre = (
    /** @type {string} */ valeur,
    /** @type {import('react').ReactNode} */ libelle,
    /** @type {string} */ couleur,
    /** @type {string} */ testID,
  ) => (
    <View style={[carte, { flexBasis: 140, flexGrow: 1, gap: 4 }]} testID={testID}>
      <Text style={[Fonts.h3Bold, { color: couleur }]}>{valeur}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{libelle}</Text>
    </View>
  );

  const tuile = (
    /** @type {string} */ libelle,
    /** @type {any} */ icone,
    /** @type {() => void} */ action,
  ) => (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole="button"
      key={libelle}
      onPress={action}
      style={[carte, Alignments.alignCenter, {
        flexBasis: 96,
        flexGrow: 1,
        gap: 8,
        justifyContent: 'center',
        minHeight: 72,
        paddingHorizontal: 8,
      }]}
    >
      <GlyphIcon color={Colors.primary500} name={icone} size={22} />
      <Text style={[Fonts.p4Bold, Fonts.primary100, { textAlign: 'center' }]}>{libelle}</Text>
    </TouchableOpacity>
  );

  const ligneDeMenu = (/** @type {any} */ {
    action, danger = false, icone, libelle, testID,
  }) => {
    // « Refuser l'équipe » des menus : chatDanger, le rouge des menus de la messagerie sur chatMenu
    // (6,3:1, PACK « Fidélité au thème ») ; error500 y tombait sous 4,5:1.
    const couleur = danger ? Colors.chatDanger : Colors.neutral00;
    return (
      <TouchableOpacity
        accessibilityLabel={libelle}
        accessibilityRole="menuitem"
        key={testID}
        onPress={action}
        style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], {
          minHeight: 48, paddingHorizontal: 16,
        }]}
        testID={testID}
      >
        <GlyphIcon color={couleur} name={icone} size={20} />
        <Text style={[Fonts.p2Bold, { color: couleur, flex: 1 }]}>{libelle}</Text>
      </TouchableOpacity>
    );
  };

  const lignesDuMenu = (/** @type {any} */ equipe, /** @type {any} */ ligne) => {
    const id = String(equipe?.documentId || '');
    const statut = normalizeTournamentText(equipe?.status) || 'pending';
    const aRelancer = Number(ligne?.unpaidCount) || 0;
    const actif = !['archived', 'declined'].includes(statut);
    const capitaineId = String(ligne?.captain?.documentId || '');
    const fermerPuis = (/** @type {() => void} */ geste) => () => { setMenuOuvert(''); geste(); };
    return [
      estPayant && actif && aRelancer > 0 ? {
        action: fermerPuis(() => relance.mutate(equipe)),
        icone: 'send',
        libelle: t('implOrga.menuRemind', {
          count: aRelancer,
          defaultValue: 'Relancer ceux qui n’ont pas payé ({{count}})',
        }),
        testID: `orga-relancer-${id}`,
      } : null,
      capitaineId && capitaineId !== viewerDocumentId ? {
        action: fermerPuis(() => ecrireAuCapitaine(capitaineId)),
        icone: 'envelope',
        libelle: t('implOrga.menuWriteCaptain', 'Écrire au capitaine'),
        testID: `orga-ecrire-${id}`,
      } : null,
      // Un tournoi payant valide l'équipe seul au seuil payé (planche 1b) ; un gratuit garde
      // « Valider ».
      !estPayant && statut === 'pending' ? {
        action: fermerPuis(() => revue.mutate({ equipe, status: 'accepted' })),
        icone: 'check',
        libelle: t('implOrga.menuApprove', 'Valider l’équipe'),
        testID: `orga-valider-${id}`,
      } : null,
      // Avant : « Refuser » passait avant « Archiver ». Planche 1b : l'action rouge ferme le menu,
      // sous un trait.
      statut !== 'archived' ? {
        action: fermerPuis(() => confirmerLArchivage(equipe)),
        icone: 'boxArchive',
        libelle: t('implOrga.menuArchive', 'Archiver l’équipe'),
        testID: `orga-archiver-${id}`,
      } : null,
      // Avant : une équipe validée ne se refusait pas (CGV partie I § 3, planche 1b). Décision
      // d'Adel du 19/11 :
      // « Refuser » aussi pour une équipe validée ; la fenêtre rouge dit les places à rembourser,
      // le serveur prévient
      // les SuperAdmins (alertRefundDue).
      ['accepted', 'pending'].includes(statut) ? {
        action: fermerPuis(() => setEquipeARefuser({ ...equipe, ligne })),
        danger: true,
        icone: 'xmark',
        libelle: t('implOrga.menuDecline', 'Refuser l’équipe'),
        testID: `orga-refuser-${id}`,
      } : null,
    ].filter(Boolean);
  };

  const libelleDesPaiements = (/** @type {number} */ payes, /** @type {number} */ joueurs) => (
    payes > seuil
      ? t('implOrga.paidAndPlayers', {
        count: joueurs, defaultValue: '{{paid}} payés · {{count}} joueurs', paid: payes,
      })
      // « 1 payé sur 5 » (O2) : le pluriel suit le nombre de payés.
      : t('implOrga.paidOn', {
        count: payes,
        defaultValue_one: '{{count}} payé sur {{threshold}}',
        defaultValue_other: '{{count}} payés sur {{threshold}}',
        threshold: seuil,
      })
  );

  const barreDesPaiements = (/** @type {number} */ payes, /** @type {string} */ libelle) => (
    <View style={Spaces.gap[4]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{libelle}</Text>
      <View
        accessibilityLabel={libelle}
        style={{
          backgroundColor: pisteDeLaBarre,
          borderRadius: 100,
          height: 6,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            backgroundColor: remplissageDeLaBarre,
            height: 6,
            width: `${Math.min(100, Math.round((payes / Math.max(1, seuil)) * 100))}%`,
          }}
        />
      </View>
    </View>
  );

  const placesDUneEquipeSortie = (/** @type {any} */ ligne) => (
    <>
      {Number(ligne?.refundedPlacesCount) > 0 ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('implOrga.refundedPlaces', {
            count: Number(ligne.refundedPlacesCount),
            defaultValue_one: '1 place payée remboursée',
            defaultValue_other: '{{count}} places payées remboursées',
          })}
        </Text>
      ) : null}
      {Number(ligne?.paidPlacesCount) > 0 ? (
        <Text style={[Fonts.p3, { color: Colors.warning400 }]}>
          {t('implOrga.placesToRefund', {
            count: Number(ligne.paidPlacesCount),
            defaultValue_one: '1 place payée à rembourser',
            defaultValue_other: '{{count}} places payées à rembourser',
          })}
        </Text>
      ) : null}
    </>
  );

  /**
   * Ce que lisent la carte (téléphone) et la ligne serrée (bureau) d'une équipe.
   * @param {any} equipe - L'équipe du tableau de bord.
   * @returns {any} Les morceaux de la carte.
   */
  const lectureDeLEquipe = (equipe) => {
    const id = String(equipe?.documentId || '');
    const ligne = ligneParEquipe.get(id) || null;
    const statut = normalizeTournamentText(equipe?.status) || 'pending';
    const nomDuCapitaine = [ligne?.captain?.firstName, ligne?.captain?.lastName]
      .filter(Boolean).join(' ');
    // 11b : l'organisateur capitaine d'une équipe la reconnaît (« · ton équipe »).
    const laSienne = Boolean(viewerDocumentId)
      && String(ligne?.captain?.documentId || '') === viewerDocumentId;
    return {
      actif: !['archived', 'declined'].includes(statut),
      etat: etatDeLEquipe(statut),
      id,
      joueurs: Number(ligne?.count) || 0,
      laSienne,
      ligne,
      menu: lignesDuMenu(equipe, ligne),
      menuEstOuvert: menuOuvert === id,
      nomDeLEquipe: equipe?.name || t('tournamentManagement.tournamentTeam', 'Équipe tournoi'),
      nomDuCapitaine,
      payes: Number(ligne?.paidCount) || 0,
    };
  };

  const suffixeDuCapitaine = (/** @type {boolean} */ laSienne) => (
    laSienne ? ` · ${t('implOrga.yourTeam', 'ton équipe')}` : ''
  );

  const lienVoirLEquipe = (/** @type {string} */ id) => (
    <TouchableOpacity
      accessibilityRole="link"
      onPress={() => navigation.navigate(RouteNames.TournamentTeamDetails, {
        eventId, teamId: id,
      })}
      style={[Alignments.row, Alignments.alignCenter, Spaces.gap[4], { minHeight: CIBLE }]}
      testID={`orga-voir-${id}`}
    >
      {compact ? null : <GlyphIcon color={Colors.primary500} name="chevronRight" size={16} />}
      <Text style={[Fonts.p2Bold, Fonts.primary500]}>
        {t('implOrga.seeTeam', 'Voir l’équipe')}
      </Text>
    </TouchableOpacity>
  );

  const boutonDuMenu = (/** @type {any} */ lu) => (lu.menu.length ? (
    <TouchableOpacity
      accessibilityLabel={t('implOrga.moreActions', {
        defaultValue: 'Plus d’actions pour {{name}}',
        name: lu.nomDeLEquipe,
        ...SANS_ECHAPPEMENT,
      })}
      accessibilityRole="button"
      accessibilityState={{ expanded: lu.menuEstOuvert }}
      onPress={() => setMenuOuvert(lu.menuEstOuvert ? '' : lu.id)}
      style={{
        alignItems: 'center', height: CIBLE, justifyContent: 'center', width: CIBLE,
      }}
      testID={`orga-menu-${lu.id}`}
    >
      <GlyphIcon color={Colors.neutral00} name="dotsVertical" size={20} />
    </TouchableOpacity>
  ) : null);

  // Le menu ouvert, puis l'avis de relance : le même sous la carte et sous la ligne serrée.
  const menuEtAvis = (/** @type {any} */ lu) => (
    <>
      {lu.menuEstOuvert ? (
        <View
          accessibilityRole="menu"
          style={{
            alignSelf: compact ? 'flex-end' : 'stretch',
            backgroundColor: Colors.chatMenu,
            borderRadius: 16,
            minWidth: compact ? 360 : undefined,
            overflow: 'hidden',
            paddingVertical: 4,
          }}
        >
          {lu.menu.flatMap((/** @type {any} */ entree, /** @type {number} */ index) => [
            // Planche 1b : un trait avant l'action rouge.
            entree.danger && index > 0 ? (
              <View
                key={`trait-${lu.id}`}
                style={{ backgroundColor: Colors.primary700, height: 1, marginVertical: 4 }}
                testID={`orga-menu-trait-${lu.id}`}
              />
            ) : null,
            ligneDeMenu(entree),
          ])}
        </View>
      ) : null}

      {avis?.equipe === lu.id ? (
        <View
          accessibilityLiveRegion="polite"
          style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], {
            backgroundColor: Colors.neutral00, borderRadius: 12, padding: 12,
          }]}
        >
          <GlyphIcon color={Colors.primary600} name="check" size={18} />
          <Text style={[Fonts.p3Bold, { color: Colors.primary900, flex: 1 }]}>{avis.texte}</Text>
        </View>
      ) : null}
    </>
  );

  // Avant : une pastille jaune « Effectif à revoir » sur la carte (1a, retirée le 19/11) ; le
  // filtre
  // « Effectifs à revoir » reste au-dessus de la liste.
  const carteDEquipe = (/** @type {any} */ equipe) => {
    const lu = lectureDeLEquipe(equipe);
    const {
      actif, etat, id, joueurs, ligne, payes,
    } = lu;

    return (
      <View key={id || equipe?.name} style={[carte, Spaces.gap[12]]} testID={`orga-equipe-${id}`}>
        <View style={[Alignments.row, Spaces.gap[8], { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[Fonts.h5Bold, Fonts.neutral00]}>{lu.nomDeLEquipe}</Text>
            {lu.nomDuCapitaine ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {`${t('implOrga.captainLine', {
                  defaultValue: 'Capitaine : {{name}}',
                  name: lu.nomDuCapitaine,
                  ...SANS_ECHAPPEMENT,
                })}${suffixeDuCapitaine(lu.laSienne)}`}
              </Text>
            ) : null}
          </View>
          {pastille(etat.texte, etat.couleur)}
        </View>

        {estPayant && actif && ligne
          ? barreDesPaiements(payes, libelleDesPaiements(payes, joueurs))
          : null}
        {!estPayant && actif && ligne ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('tournamentManagement.rosterTotal', {
              count: joueurs,
              defaultValue_one: '{{count}} joueur',
              defaultValue_other: '{{count}} joueurs',
            })}
          </Text>
        ) : null}
        {actif ? null : placesDUneEquipeSortie(ligne)}

        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          {lienVoirLEquipe(id)}
          {boutonDuMenu(lu)}
        </View>

        {menuEtAvis(lu)}
      </View>
    );
  };

  // Planche 1f : au bureau, une ligne serrée par équipe (nom et capitaine, paiements, état, « Voir
  // l'équipe », ⋯) dans un seul cadre ; plusieurs équipes se lisent sans défiler.
  const ligneSerree = (/** @type {any} */ equipe) => {
    const lu = lectureDeLEquipe(equipe);
    const {
      actif, etat, id, joueurs, ligne, payes,
    } = lu;
    let milieu = null;
    if (!actif) {
      milieu = placesDUneEquipeSortie(ligne);
    } else if (estPayant && ligne) {
      milieu = barreDesPaiements(payes, libelleDesPaiements(payes, joueurs));
    } else if (ligne) {
      milieu = (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('tournamentManagement.rosterTotal', {
            count: joueurs,
            defaultValue_one: '{{count}} joueur',
            defaultValue_other: '{{count}} joueurs',
          })}
        </Text>
      );
    }
    return (
      <View
        key={id || equipe?.name}
        style={[Spaces.gap[8], { paddingVertical: 8 }]}
        testID={`orga-ligne-${id}`}
      >
        {/* Largeurs mesurées sur la capture 1f (colonne des équipes ≈ 620 px à 1280) : barre 120,
            état et lien à leur largeur naturelle, le nom prend le reste. */}
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>{lu.nomDeLEquipe}</Text>
            {lu.nomDuCapitaine ? (
              <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral300]}>
                {`${t('implOrga.captainShort', {
                  defaultValue: 'Cap. {{name}}', name: lu.nomDuCapitaine, ...SANS_ECHAPPEMENT,
                })}${suffixeDuCapitaine(lu.laSienne)}`}
              </Text>
            ) : null}
          </View>
          <View style={{ flexShrink: 0, width: 120 }}>{milieu}</View>
          <View style={{ flexShrink: 0 }}>{pastille(etat.texte, etat.couleur)}</View>
          <View style={{ flexShrink: 0 }}>{lienVoirLEquipe(id)}</View>
          {boutonDuMenu(lu) || <View style={{ width: CIBLE }} />}
        </View>
        {menuEtAvis(lu)}
      </View>
    );
  };

  const texteDuRemboursement = (/** @type {number} */ payees, /** @type {number} */ montant) => {
    if (!connu) {
      return t(
        'implOrga.declineRefundRule',
        'Les places déjà payées sont remboursées en entier, sous 14 jours.',
      );
    }
    return payees > 0
      ? t('implOrga.declineRefund', {
        amount: euros(montant),
        count: payees,
        defaultValue_one:
          'La place déjà payée est remboursée en entier ({{amount}}), sous 14 jours.',
        defaultValue_other: 'Les {{count}} places déjà payées sont remboursées en entier '
          + '({{amount}}), sous 14 jours.',
        ...SANS_ECHAPPEMENT,
      })
      : t(
        'implOrga.declineNothingPaid',
        'Aucune place n’a encore été payée : rien à rembourser.',
      );
  };

  const fenetreDeRefus = () => {
    if (!equipeARefuser) return null;
    const payees = Number(equipeARefuser?.ligne?.paidPlacesCount) || 0;
    const montant = Number(equipeARefuser?.ligne?.paidCents) || 0;
    const fermer = () => setEquipeARefuser(null);
    const refuser = () => {
      const equipe = equipeARefuser;
      fermer();
      revue.mutate({ equipe, status: 'declined' });
    };
    return (
      <Modal animationType="fade" onRequestClose={fermer} transparent visible>
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary900, 'B3'),
            flex: 1,
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <View
            accessibilityRole="alert"
            style={[Spaces.gap[12], {
              alignSelf: 'center',
              backgroundColor: Colors.chatSheet,
              borderRadius: 24,
              maxWidth: 480,
              padding: 24,
              width: '100%',
            }]}
          >
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('implOrga.declineTitle', {
                defaultValue: 'Refuser {{name}} ?',
                name: equipeARefuser?.name || '',
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'implOrga.declineBody',
                'L’équipe quitte le tournoi et ses joueurs sont prévenus.',
              )}
            </Text>
            <View
              style={{
                backgroundColor: withAlpha(Colors.primary500, '14'),
                borderColor: withAlpha(Colors.primary500, '66'),
                borderRadius: 16,
                borderWidth: 1,
                padding: 12,
              }}
            >
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {texteDuRemboursement(payees, montant)}
              </Text>
            </View>
            {payees > 0 || !connu ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t(
                  'implOrga.declineRefundHow',
                  'Le remboursement revient sur le moyen de paiement de chaque joueur.',
                )}
              </Text>
            ) : null}
            {/* ORGANISATEUR 3 (19/11) : le serveur prévient les SuperAdmins d'une équipe
                refusée avec des places payées (tournament-organizer.js alertRefundDue) ; le
                remboursement reste leur geste. */}
            {payees > 0 || !connu ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t(
                  'implOrga.declineRefundNotified',
                  'FoundClub est prévenu et s’occupe du remboursement.',
                )}
              </Text>
            ) : null}
            <Button
              onPress={refuser}
              title={t('implOrga.menuDecline', 'Refuser l’équipe')}
              variant="DangerFilled"
            />
            <Button
              onPress={fermer}
              title={t('common.actions.cancel', 'Annuler')}
              variant="Ghost"
            />
          </View>
        </View>
      </Modal>
    );
  };

  const enTete = () => {
    // 1a : le lieu court (« AR Soccer · Montpellier »), comme le bandeau de la fiche ; sans lieu
    // court, l'adresse.
    const adresse = String(summary?.place || '').trim();
    const lieu = getTournamentShortPlace({ location: adresse }) || adresse;
    const dateDuTournoi = ligneDeDate(event);
    // Sans résumé, l'état des inscriptions n'est pas connu : jamais affiché comme « ouvertes ».
    let etatDesInscriptions = t('implOrga.registrationsUnknown', 'Inscriptions');
    if (connu) {
      etatDesInscriptions = ouvertes
        ? t('implOrga.registrationsOpen', 'Inscriptions ouvertes')
        : t('implOrga.registrationsClosed', 'Inscriptions fermées');
    }
    return (
      <View style={[carte, Spaces.gap[8], { borderColor: withAlpha(Colors.primary500, '66') }]}>
        {/* 1a (Adel 19/11) : la photo du tournoi, la même que le bandeau de la fiche
            (EventHeader) : l'illustration du TYPE (card-tournoi.png, ORGANISATEUR 4d5cafa2) reste
            dessous. IMPL-1B-PHOTO (e3954b46, Adel : « la photo de l'événement avec le ballon » = la
            photo du complexe) : la photo du complexe se pose SUR l'illustration, comme au bandeau ;
            sans photo, ou si elle ne charge pas, l'illustration seule. Récolte train 16. */}
        <ImageBackground
          accessibilityIgnoresInvertColors
          imageStyle={{ borderRadius: 12 }}
          resizeMode="cover"
          source={/** @type {any} */ (BG_TOURNAMENT)}
          style={{ borderRadius: 12, height: 120, overflow: 'hidden' }}
          testID="orga-photo-tournoi"
        >
          {photo ? (
            <Image
              accessibilityLabel={photo.alt}
              accessibilityRole="image"
              accessible
              resizeMode="cover"
              source={{ uri: photo.uri }}
              style={{
                borderRadius: 12, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0,
              }}
              testID="orga-venue-photo"
            />
          ) : null}
        </ImageBackground>
        <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
          {pastille(t('implOrga.tagTournament', 'TOURNOI'), Colors.primary500, true)}
          {connu
            ? pastille(etatDesInscriptions, ouvertes ? Colors.primary500 : Colors.warning400)
            : null}
        </View>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{event?.name || ''}</Text>
        {dateDuTournoi ? <Text style={[Fonts.p2, Fonts.neutral200]}>{dateDuTournoi}</Text> : null}
        {lieu ? (
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[4]]}>
            <GlyphIcon color={Colors.neutral200} name="locationPin" size={14} />
            <Text style={[Fonts.p2, Fonts.neutral200]}>{lieu}</Text>
          </View>
        ) : null}
        <View
          style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], {
            borderTopColor: Colors.primary700,
            borderTopWidth: 1,
            marginTop: 4,
            minHeight: 52,
            paddingTop: 12,
          }]}
        >
          <GlyphIcon color={Colors.neutral00} name={ouvertes ? 'users' : 'lockShut'} size={20} />
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.h5Bold, Fonts.neutral00]}>{etatDesInscriptions}</Text>
            {connu ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {ouvertes
                  ? t('implOrga.registrationsOpenHint', 'Les joueurs peuvent s’inscrire')
                  : t(
                    'implOrga.registrationsClosedHint',
                    'Plus aucune équipe ne s’inscrit. Le tournoi continue.',
                  )}
              </Text>
            ) : null}
          </View>
          <Switch
            accessibilityLabel={t('implOrga.registrationsOpen', 'Inscriptions ouvertes')}
            disabled={inscriptions.isPending || !connu}
            onValueChange={(valeur) => {
              setInscriptionsOuvertes(valeur);
              return inscriptions.mutate(valeur);
            }}
            testID="orga-inscriptions"
            thumbColor={Colors.neutral00}
            trackColor={{ false: withAlpha(Colors.neutral300, '66'), true: Colors.primary500 }}
            // Site : react-native-web peint le rond allumé en vert-bleu par défaut sans cette
            // propriété à lui ; plus aucun vert (Adel 18/11). Le téléphone l'ignore.
            {...{ activeThumbColor: Colors.neutral00 }}
            value={ouvertes}
          />
        </View>
      </View>
    );
  };

  const chiffres = () => {
    const libres = maxEquipes ? Math.max(0, maxEquipes - registeredTeamsCount) : null;
    const inscrites = maxEquipes
      ? t('implOrga.teamsOn', {
        count: registeredTeamsCount, defaultValue: '{{count}} sur {{max}}', max: maxEquipes,
      })
      : String(registeredTeamsCount);
    const libelleDesInscrites = (
      <Text>
        {t('implOrga.teamsRegistered', 'équipes inscrites')}
        {libres === null ? null : (
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
            {` · ${t('implOrga.freeSpots', {
              count: libres,
              defaultValue_one: '{{count}} place libre',
              defaultValue_other: '{{count}} places libres',
            })}`}
          </Text>
        )}
      </Text>
    );
    const libelleDesValidees = estPayant
      ? t('implOrga.teamsValidatedPaid', {
        count: seuil, defaultValue: 'équipes validées ({{count}} payés)',
      })
      : t('implOrga.teamsValidated', 'équipes validées');
    return (
      <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
        {chiffre(inscrites, libelleDesInscrites, Colors.neutral00, 'orga-chiffre-inscrites')}
        {chiffre(
          connu ? String(Number(summary.validatedTeamsCount) || 0) : '—',
          libelleDesValidees,
          Colors.neutral00,
          'orga-chiffre-validees',
        )}
        {estPayant ? chiffre(
          connu ? String(Number(summary.paidPlacesCount) || 0) : '—',
          t('implOrga.paidPlaces', 'places payées'),
          Colors.neutral00,
          'orga-chiffre-payees',
        ) : null}
        {estPayant ? chiffre(
          connu ? euros(summary.collectedCents) : '—',
          t('implOrga.collected', 'encaissé'),
          Colors.primary500,
          'orga-chiffre-encaisse',
        ) : null}
      </View>
    );
  };

  const listeDesEquipes = () => {
    if (totalTeamsCount === 0) {
      return (
        <View
          style={[carte, Alignments.alignCenter, Spaces.gap[8], {
            borderStyle: 'dashed', paddingVertical: 24,
          }]}
        >
          <GlyphIcon color={Colors.primary500} name="users" size={32} />
          <Text style={[Fonts.h5Bold, Fonts.neutral00, { textAlign: 'center' }]}>
            {t('implOrga.emptyTitle', 'Aucune équipe pour l’instant')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200, { textAlign: 'center' }]}>
            {t(
              'implOrga.emptyBody',
              'Partage le tournoi : les équipes apparaîtront ici dès leur inscription.',
            )}
          </Text>
          <Button
            onPress={() => setPartageVisible(true)}
            style={{ alignSelf: 'stretch' }}
            title={t('implOrga.share', 'Partager le tournoi')}
            variant="Primary"
          />
        </View>
      );
    }
    return (
      <View style={Spaces.gap[12]}>
        {filters}
        {teams.length === 0 ? (
          <View style={carte}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'tournamentManagement.noTeamMatchesThisFilter',
                'Aucune équipe ne correspond à ce filtre pour le moment.',
              )}
            </Text>
          </View>
        ) : null}
        {teams.length > 0 && compact ? (
          <View style={[carte, { paddingVertical: 4 }]}>
            {teams.flatMap((equipe, index) => [
              index > 0 ? (
                <View
                  key={`trait-${equipe?.documentId || index}`}
                  style={{ backgroundColor: Colors.primary700, height: 1 }}
                />
              ) : null,
              ligneSerree(equipe),
            ])}
          </View>
        ) : null}
        {teams.length > 0 && !compact ? teams.map(carteDEquipe) : null}
      </View>
    );
  };

  return (
    <View style={Spaces.gap[16]}>
      {enTete()}
      {chiffres()}
      {summaryFailed ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, { color: Colors.warning400 }]}>
          {t(
            'implOrga.summaryUnavailable',
            'Les paiements et l’interrupteur des inscriptions sont réservés à l’organisateur '
              + 'du tournoi.',
          )}
        </Text>
      ) : null}

      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
        {tuile(t('implOrga.share', 'Partager le tournoi'), 'send', () => setPartageVisible(true))}
        {tuile(
          t('implOrga.writeAllCaptains', 'Écrire à tous les capitaines'),
          'envelope',
          ecrireATousLesCapitaines,
        )}
        {tuile(t('implOrga.export', 'Exporter la liste'), 'arrowDownToBracket', exporter)}
      </View>

      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('tournamentManagement.tabTeams', 'Équipes')}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {registeredTeamsCount > 0
            ? t('implOrga.registeredCount', {
              count: registeredTeamsCount,
              defaultValue_one: '{{count}} inscrite',
              defaultValue_other: '{{count}} inscrites',
            })
            : t('implOrga.noneRegistered', 'aucune')}
        </Text>
      </View>
      {/* 11b : la règle des payés, dite une fois au-dessus des équipes (tournoi payant). */}
      {estPayant ? (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('implOrga.paidRule', {
            count: seuil,
            defaultValue_one: 'Une équipe se valide seule dès {{count}} joueur payé.',
            defaultValue_other: 'Une équipe se valide seule dès {{count}} joueurs payés.',
          })}
        </Text>
      ) : null}
      {invites}
      {listeDesEquipes()}

      {fenetreDeRefus()}
      <ShareEventModal
        event={event
          ? { ...event, title: event?.name || t('implOrga.tagTournament', 'TOURNOI') }
          : null}
        isVisible={partageVisible}
        onClose={() => setPartageVisible(false)}
        onSelectChat={partagerDansUnFil}
      />
    </View>
  );
}

export default TournamentOrganizerBoard;
