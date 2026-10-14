import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { canCancelRegistration } from '@/domains/participation/childRegistrationFlow';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import { feedbackCardStyle } from '@/views/profile/coachFeedback/CoachFeedbackList';
import ChildIdentityCard from '@/views/profile/parent/ChildIdentityCard';
import ClubEtEquipe from '@/views/profile/parent/ClubEtEquipe';
import {
  acceptationPour,
  clubDeLaDemande,
  enAttente,
} from '@/views/profile/parent/demandesDeLEnfant';
import PastilleDEtat from '@/views/profile/parent/PastilleDEtat';

import { parentalPowerForAge } from '@/constants/parentalDeclaration';

/**
 * « 11/10 » : le jour et le mois d une date du serveur, ou rien si elle est illisible.
 * @param {unknown} iso - La date (ISO).
 * @returns {string} - « jj/mm », ou une chaine vide.
 */
const jourEtMois = (iso) => {
  const date = new Date(String(iso || ''));
  return Number.isNaN(date.getTime()) ? '' : format(date, 'dd/MM');
};

/**
 * 👪 PAR-L11c — l état d une inscription à un événement : sa pastille et son ton.
 * @type {Record<string, { cle: string, ton: 'attente' | 'ok' | 'refus' }>}
 */
const ETATS_D_INSCRIPTION = {
  accepted: { cle: 'childEventRegistration.childPage.accepted', ton: 'ok' },
  declined: { cle: 'childEventRegistration.childPage.declined', ton: 'refus' },
  pending: { cle: 'childEventRegistration.childPage.pending', ton: 'attente' },
};

/**
 * Une carte de la fiche : son titre, un filet, puis son contenu (motif « carte à titre suivi
 * d'un filet » de l'app) — la carte bleue des écrans parent, jamais la carte grise.
 * @param {object} props - Les propriétés.
 * @param {import('react').ReactNode} [props.action] - Un lien à droite du titre.
 * @param {import('react').ReactNode} props.children - Le contenu.
 * @param {string} props.testID - L étiquette de test.
 * @param {string} props.titre - Le titre.
 * @returns {import('react').ReactElement} - La carte.
 */
function Carte({
  action = null, children, testID, titre,
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <View style={feedbackCardStyle(Colors, false)} testID={testID}>
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00, { flexGrow: 1, flexShrink: 1 }]}>{titre}</Text>
        {action}
      </View>
      {/* Le filet est une BORDURE, pas un fond : aucun texte ne se pose sur du primary500. */}
      <View style={{ borderTopColor: withAlpha(Colors.primary500, 0.24), borderTopWidth: 1 }} />
      {children}
    </View>
  );
}

/**
 * Une ligne d information : une icône dans un rond liseré cyan, le libellé, la valeur en gras
 * (« Non renseigné » en clair quand elle manque) — motif « Infos personnelles » de l'app.
 * @param {object} props - Les propriétés.
 * @param {string} props.icone - L icône (`SvgIcon`).
 * @param {string} props.libelle - Le libellé.
 * @param {string} props.testID - L étiquette de test.
 * @param {string} props.valeur - La valeur, ou rien.
 * @returns {import('react').ReactElement} - La ligne.
 */
function LigneDInfo({
  icone, libelle, testID, valeur,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]} testID={testID}>
      <View
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            borderColor: withAlpha(Colors.primary500, 0.45),
            borderRadius: 20,
            borderWidth: 1,
            height: 40,
            width: 40,
          },
        ]}
      >
        <Icone color={Colors.primary200} height={18} name={icone} width={18} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{libelle}</Text>
        {valeur ? (
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{valeur}</Text>
        ) : (
          <Text style={[Fonts.p1, Fonts.neutral200]}>
            {t('userDetails.notSet', 'Non renseigné')}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Un lien texte de la fiche (44 px de haut au moins).
 * @param {object} props - Les propriétés.
 * @param {string} [props.accessibilityLabel] - Ce que dit le lecteur d écran, s il faut plus.
 * @param {boolean} [props.danger] - En rouge.
 * @param {boolean} [props.disabled] - Éteint (un envoi est en cours).
 * @param {string} props.libelle - Ce qu il fait.
 * @param {() => void} props.onPress - Le geste.
 * @param {string} props.testID - L étiquette de test.
 * @returns {import('react').ReactElement} - Le lien.
 */
function Lien({
  accessibilityLabel = undefined, danger = false, disabled = false, libelle, onPress, testID,
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[Alignments.justifyCenter, { minHeight: 44 }]}
      testID={testID}
    >
      <Text style={[Fonts.p2Bold, { color: danger ? Colors.error300 : Colors.primary300 }]}>
        {libelle}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * PAR-L5L6 (13/10, design parent E07, planche 3) — LA FICHE D UN ENFANT DECLARE, vue par son
 * parent. Tout ce qui le concerne est ICI, dans cet ordre :
 *   1. son identite (la carte d identite, inchangee) ;
 *   2. « Son équipe » — le CLUB sur sa ligne, precede du mot « Club », l equipe sur la sienne
 *      (remarque d Adel du 13/10 : « on voit bien que les enfants sont dans aucun club »), et
 *      « Acceptée le 11/10 » quand la demande acceptee est lue. Sans equipe seulement :
 *      « Chercher un club pour Anissa » ;
 *   3. « Ses demandes » en attente (masque s il n y en a pas) ; sous chacune, « Annuler la
 *      demande » en rouge (PAR-L8, E19) quand l ecran qui monte la fiche sait annuler ;
 *   3 ter. PAR-L11c (14/10, PAR-012, design §3 E21) — « Ses événements » : ses inscriptions
 *      (en attente, confirmée, refusée avec son motif), « Voir l'événement », « Annuler
 *      l'inscription » (à venir, pas refusée). Masqué s il n y en a pas ;
 *   3 bis. PAR-L13 (13/10, E29, prototype planche 3) — « Sa carte » (moins de 13 ans) : son
 *      numéro et son poste, « Carte de collection », « Voir » ouvre sa carte ;
 *   4. « Infos sportives » (maillot, poste), « Compléter » / « Modifier » ;
 *   5. « Stats et retours de match » (moins de 13 ans) ;
 *   6. « Modifier sa fiche », « Supprimer la fiche ».
 *
 * 🔒 Rien de plus que la fiche deja lue par « Mes enfants » (prenom, nom, age calcule par le
 * serveur — jamais la date —, equipe, club, maillot, poste) et les demandes du parent.
 * Le premier temoin de ce fichier (ST-RETOURS2, planche 22 etat 6) est
 * `__tests__/DeclaredChildPage.caracterisation.test.js`.
 * @param {object} props - Les proprietes.
 * @param {string} [props.annulationEnCours] - La demande en cours d annulation (lien eteint).
 * @param {any[]} [props.demandes] - SES demandes (`demandesDe`), la plus recente d abord.
 * @param {boolean} [props.demandesEnErreur] - La lecture des demandes a echoue.
 * @param {any} props.enfant - La fiche (`GET` des enfants declares).
 * @param {any[]} [props.evenements] - PAR-L11c : SES inscriptions a des evenements.
 * @param {boolean} [props.evenementsEnErreur] - PAR-L11c : leur lecture a echoue.
 * @param {string} [props.inscriptionEnAnnulation] - PAR-L11c : la ligne en cours d annulation.
 * @param {number} [props.maintenant] - L instant (temoins) ; sinon l heure du telephone.
 * @param {(demande: any) => void} [props.onCancelRequest] - « Annuler la demande » (PAR-L8).
 * @param {(inscription: any) => void} [props.onCancelRegistration] - PAR-L11c « Annuler
 * l'inscription ».
 * @param {(enfant: any) => void} [props.onDelete] - « Supprimer la fiche ».
 * @param {(enfant: any) => void} [props.onEdit] - « Modifier sa fiche » / « Compléter ».
 * @param {(enfant: any) => void} [props.onGiveAccount] - F20 « Donner un compte à Lina ».
 * @param {(enfant: any) => void} [props.onOpenCard] - PAR-L13 « Voir » sa carte de collection.
 * @param {(inscription: any) => void} [props.onOpenEvent] - PAR-L11c « Voir l'événement ».
 * @param {() => void} [props.onRetryDemandes] - Relire les demandes.
 * @param {() => void} [props.onRetryEvenements] - PAR-L11c : relire ses inscriptions.
 * @param {(enfant: any) => void} props.onSearchClub - « Chercher un club pour Lea ».
 * @returns {import('react').ReactElement} - La page.
 */
function DeclaredChildPage({
  annulationEnCours = '',
  demandes = [],
  demandesEnErreur = false,
  enfant,
  evenements = [],
  evenementsEnErreur = false,
  inscriptionEnAnnulation = '',
  maintenant = undefined,
  onCancelRegistration = undefined,
  onCancelRequest = undefined,
  onDelete = undefined,
  onEdit = undefined,
  onGiveAccount = undefined,
  onOpenCard = undefined,
  onOpenEvent = undefined,
  onRetryDemandes = undefined,
  onRetryEvenements = undefined,
  onSearchClub,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts,
  } = useTheme();

  const prenom = enfant?.firstname || '';
  const nomComplet = `${prenom} ${enfant?.lastname || ''}`.trim();
  const pouvoir = parentalPowerForAge(enfant?.age);
  const moinsDe13Ans = pouvoir === 'full';
  const age = typeof enfant?.age === 'number'
    ? t('myChildren.screen.years', '{{count}} ans', { count: enfant.age })
    : '';
  const avecPrenom = { firstname: prenom, ...SANS_ECHAPPEMENT };

  // 2. Son équipe.
  const equipe = String(enfant?.team?.name || '').trim();
  const acceptee = acceptationPour(demandes, enfant?.team?.documentId);
  const club = String(enfant?.club?.name || '').trim() || clubDeLaDemande(acceptee);
  const dateDAcceptation = jourEtMois(acceptee?.respondedAt);
  // 3. Ses demandes.
  const attente = moinsDe13Ans ? enAttente(demandes) : [];
  // 3 ter. Ses événements (PAR-L11c).
  const inscriptions = Array.isArray(evenements) ? evenements : [];
  const instant = typeof maintenant === 'number' ? maintenant : Date.now();
  // 4. Infos sportives.
  const maillot = enfant?.number === null || enfant?.number === undefined
    ? ''
    : String(enfant.number);
  const poste = String(enfant?.position || '').trim();

  return (
    <View style={{ gap: 16 }}>
      <View style={[Alignments.alignCenter, { gap: 8 }]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00, { letterSpacing: 1 }]}>
          {prenom.toUpperCase()}
        </Text>
        <View style={{ backgroundColor: Colors.neutral00, height: 2, width: 80 }} />
      </View>

      <ChildIdentityCard
        avatarUrl={enfant?.photo?.url}
        line={age}
        name={nomComplet}
        testID="declared-child-identity"
      />

      <Carte testID="declared-child-team" titre={t('myChildren.sheet.teamTitle')}>
        {equipe ? (
          <>
            {club ? (
              <LigneDInfo
                icone="shield"
                libelle={t('myChildren.list.clubLabel', 'Club')}
                testID="declared-child-team-club"
                valeur={club}
              />
            ) : null}
            <LigneDInfo
              icone="users"
              libelle={t('myChildren.list.teamLabel', { count: 1 })}
              testID="declared-child-team-name"
              valeur={equipe}
            />
            {dateDAcceptation ? (
              <PastilleDEtat
                testID="declared-child-team-accepted"
                texte={t('myChildren.sheet.acceptedOn', {
                  date: dateDAcceptation, ...SANS_ECHAPPEMENT,
                })}
                ton="ok"
              />
            ) : null}
          </>
        ) : (
          <>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('myChildren.screen.noTeam', 'Pas encore d’équipe')}
            </Text>
            {/* Remarque d'Adel (13/10) : « Chercher un club » n'est l'action que d'un enfant
                SANS équipe — et seulement avant 13 ans (E17). */}
            {moinsDe13Ans ? (
              <Button
                onPress={() => onSearchClub(enfant)}
                title={t(
                  'myChildren.actions.searchClub',
                  'Chercher un club pour {{firstname}}',
                  avecPrenom,
                )}
              />
            ) : null}
          </>
        )}
        {pouvoir === 'view' ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('myChildren.screen.tooOldHint', avecPrenom)}
          </Text>
        ) : null}
        {pouvoir === 'view' && !enfant?.account && onGiveAccount ? (
          <Lien
            libelle={t('myChildren.actions.giveAccount', avecPrenom)}
            onPress={() => onGiveAccount(enfant)}
            testID="declared-child-give-account"
          />
        ) : null}
      </Carte>

      {attente.length > 0 || (moinsDe13Ans && demandesEnErreur) ? (
        <Carte testID="declared-child-requests" titre={t('myChildren.sheet.requestsTitle')}>
          {demandesEnErreur ? (
            <View style={{ gap: 4 }}>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t('myChildren.sheet.requestsError')}
              </Text>
              {onRetryDemandes ? (
                <Lien
                  libelle={t('errorWrapper.retry', 'Réessayer')}
                  onPress={onRetryDemandes}
                  testID="declared-child-requests-retry"
                />
              ) : null}
            </View>
          ) : null}
          {attente.map((demande) => (
            <View
              key={demande?.documentId}
              style={{ gap: 4 }}
              testID={`declared-child-request-${demande?.documentId}`}
            >
              <PastilleDEtat texte={t('myChildren.sheet.pending')} ton="attente" />
              <ClubEtEquipe
                club={clubDeLaDemande(demande)}
                equipes={[demande?.team?.name]}
                libelleEquipe={t('myChildren.list.requestedTeamLabel')}
              />
              {jourEtMois(demande?.createdAt) ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t('myChildren.sheet.sentOn', {
                    date: jourEtMois(demande?.createdAt), ...SANS_ECHAPPEMENT,
                  })}
                </Text>
              ) : null}
              {onCancelRequest ? (
                <Lien
                  accessibilityLabel={t('myChildren.cancelRequest.linkLabel', {
                    team: demande?.team?.name || clubDeLaDemande(demande), ...SANS_ECHAPPEMENT,
                  })}
                  danger
                  disabled={annulationEnCours === demande?.documentId}
                  libelle={t('myChildren.cancelRequest.link')}
                  onPress={() => onCancelRequest(demande)}
                  testID={`declared-child-cancel-${demande?.documentId}`}
                />
              ) : null}
            </View>
          ))}
        </Carte>
      ) : null}

      {inscriptions.length > 0 || (moinsDe13Ans && evenementsEnErreur) ? (
        <Carte testID="declared-child-events" titre={t('childEventRegistration.childPage.title')}>
          {evenementsEnErreur ? (
            <View style={{ gap: 4 }}>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t('childEventRegistration.childPage.error')}
              </Text>
              {onRetryEvenements ? (
                <Lien
                  libelle={t('errorWrapper.retry', 'Réessayer')}
                  onPress={onRetryEvenements}
                  testID="declared-child-events-retry"
                />
              ) : null}
            </View>
          ) : null}
          {inscriptions.map((inscription) => {
            const id = String(inscription?.documentId || '');
            const etat = ETATS_D_INSCRIPTION[inscription?.status] || ETATS_D_INSCRIPTION.pending;
            const date = jourEtMois(inscription?.event?.date);
            const motif = inscription?.status === 'declined'
              ? String(inscription?.reason || '').trim()
              : '';
            return (
              <View key={id} style={{ gap: 4 }} testID={`declared-child-event-${id}`}>
                <PastilleDEtat texte={t(etat.cle)} ton={etat.ton} />
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                  {String(inscription?.event?.name || '').trim()
                    || t('childEventRegistration.sheet.defaultType')}
                </Text>
                {date ? (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {t('childEventRegistration.childPage.on', { date, ...SANS_ECHAPPEMENT })}
                  </Text>
                ) : null}
                {motif ? (
                  <Text style={[Fonts.p3, Fonts.neutral100]}>
                    {t('childEventRegistration.childPage.reason', {
                      reason: motif, ...SANS_ECHAPPEMENT,
                    })}
                  </Text>
                ) : null}
                <View style={[Alignments.row, { columnGap: 16, flexWrap: 'wrap' }]}>
                  {onOpenEvent && inscription?.event?.documentId ? (
                    <Lien
                      libelle={t('childEventRegistration.childPage.open')}
                      onPress={() => onOpenEvent(inscription)}
                      testID={`declared-child-event-open-${id}`}
                    />
                  ) : null}
                  {onCancelRegistration && canCancelRegistration(inscription, instant) ? (
                    <Lien
                      accessibilityLabel={t('childEventRegistration.cancel.linkLabel', avecPrenom)}
                      danger
                      disabled={inscriptionEnAnnulation === id}
                      libelle={t('childEventRegistration.cancel.link')}
                      onPress={() => onCancelRegistration(inscription)}
                      testID={`declared-child-event-cancel-${id}`}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </Carte>
      ) : null}

      {moinsDe13Ans && onOpenCard ? (
        <Carte
          action={(
            <Lien
              libelle={t('myChildren.card.blockOpen')}
              onPress={() => onOpenCard(enfant)}
              testID="declared-child-card-open"
            />
          )}
          testID="declared-child-card"
          titre={t('myChildren.card.blockTitle')}
        >
          {maillot || poste ? (
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {[maillot, poste].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <Text style={[Fonts.p3, Fonts.neutral200]}>{t('myChildren.card.blockCaption')}</Text>
        </Carte>
      ) : null}

      <Carte
        action={onEdit ? (
          <Lien
            libelle={maillot || poste
              ? t('myChildren.sheet.edit')
              : t('myChildren.sheet.complete')}
            onPress={() => onEdit(enfant)}
            testID="declared-child-sport-edit"
          />
        ) : null}
        testID="declared-child-sport"
        titre={t('myChildren.sheet.sportTitle')}
      >
        <LigneDInfo
          icone="soccer-ball"
          libelle={t('myChildren.sheet.numberLabel')}
          testID="declared-child-number"
          valeur={maillot}
        />
        <LigneDInfo
          icone="flag"
          libelle={t('myChildren.sheet.positionLabel')}
          testID="declared-child-position"
          valeur={poste}
        />
      </Carte>

      {moinsDe13Ans ? (
        <View style={feedbackCardStyle(Colors, false)}>
          <Text
            style={[
              Fonts.p3Bold,
              Fonts.primary200,
              { letterSpacing: 0.4, textTransform: 'uppercase' },
            ]}
          >
            {t('stRetours.parent.under13Title')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('stRetours.parent.under13Hint', avecPrenom)}
          </Text>
        </View>
      ) : null}

      {onEdit ? (
        <Button
          onPress={() => onEdit(enfant)}
          title={t('myChildren.menu.edit')}
          variant="Secondary"
        />
      ) : null}
      {onDelete ? (
        <View style={Alignments.alignCenter}>
          <Lien
            danger
            libelle={t('myChildren.menu.delete')}
            onPress={() => onDelete(enfant)}
            testID="declared-child-delete"
          />
        </View>
      ) : null}
    </View>
  );
}

export default DeclaredChildPage;
