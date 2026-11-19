import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import { formatEuros } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import {
  getTournamentTeamCaptainShort,
  getTournamentTeamLookingFor,
  getTournamentTeamPlayerCount,
  getTournamentTeamPublicPlayers,
} from '../tournamentJoinRules';
import { isTournamentTeamOpenToJoinRequests } from '../tournamentUtils';

/**
 * CORR-EVENEMENTS 130 (recette du site, décision A) — la feuille d'équipe du tournoi.
 *
 * Le site demandait le nom d'une équipe, ou le numéro de l'équipe à inscrire, dans une fenêtre
 * grise du navigateur (`window.prompt`) ; l'annuler ne disait rien. Cette feuille reprend celle
 * du téléphone (`EventDetails.js`, « Créer une équipe ») et ses textes :
 *   · `mode="name"` : le nom de l'équipe éphémère, refusé vide avec un message ;
 *   · `mode="choose"` : une rangée par équipe du club à inscrire.
 * Elle n'appelle aucun service : `onCreate(nom)` et `onChoose(equipe)` sont pilotés par l'écran.
 */

/** Cible tactile minimale du projet. */
const MIN_TOUCH_TARGET = 44;

/**
 * La feuille d'équipe du tournoi.
 * @param {object} props - Les propriétés du composant.
 * @param {number} [props.entryFeeCents] - T-PARCOURS-1 (R10) : le prix d'une place, en
 *   centimes (0 = gratuit).
 * @param {boolean} [props.isPending] - Une création ou une inscription est-elle en cours.
 * @param {number | null} [props.paidMembersToValidate] - T-SANS-PLAFOND (D239) : le seuil de places
 *   payées qui valide l'équipe (5 par défaut) ; il n'y a plus de nombre maximum de joueurs.
 * @param {'name' | 'choose' | null} props.mode - Ce que demande la feuille ; `null` la ferme.
 * @param {() => void} props.onClose - Fermer sans rien faire.
 * @param {(equipe: any) => void} props.onChoose - Inscrire cette équipe.
 * @param {(nom: string) => void} props.onCreate - Créer l'équipe sous ce nom.
 * @param {any[]} [props.teams] - Les équipes inscriptibles (`mode="choose"`).
 * @returns {import('react').ReactElement | null} - La feuille.
 */
function TournamentTeamSheet({
  entryFeeCents = 0, isPending = false, mode, onChoose, onClose, onCreate,
  paidMembersToValidate = null,
  teams = [],
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const [nom, setNom] = useState('');
  const [nomManquant, setNomManquant] = useState(false);

  useEffect(() => {
    if (mode !== 'name') return;
    setNom('');
    setNomManquant(false);
  }, [mode]);

  if (!mode) return null;

  // T-PARCOURS-1 (17/11, R10) — ce qui attend le capitaine, lu sur le tournoi : rien pour un
  // tournoi gratuit.
  const prix = Number(entryFeeCents) > 0 ? formatEuros(Number(entryFeeCents) / 100) : '';
  const coequipiers = (Number(paidMembersToValidate) > 0 ? Number(paidMembersToValidate) : 5) - 1;
  let ensuite = '';
  if (prix) {
    ensuite = coequipiers > 0
      ? t('eventDetails.createMyTeamNext', { count: coequipiers, prix })
      : t('eventDetails.createMyTeamNextAnyPlayers', { prix });
  }

  const creer = () => {
    const nomPropre = nom.trim();
    if (!nomPropre) {
      setNomManquant(true);
      return;
    }
    onCreate(nomPropre);
  };

  const pied = (
    <View style={[Spaces.gap[12]]}>
      {mode === 'name' ? (
        <Button
          disabled={isPending}
          isLoading={isPending}
          onPress={creer}
          style={{ minHeight: MIN_TOUCH_TARGET }}
          title={t('eventDetails.createMyTeam', 'Créer mon équipe')}
          variant="Primary"
        />
      ) : null}
      <Button
        disabled={isPending}
        onPress={onClose}
        style={{ minHeight: MIN_TOUCH_TARGET }}
        title={t('eventDetails.cancel', 'Annuler')}
        variant="Secondary"
      />
    </View>
  );

  return (
    <BottomModal
      close={onClose}
      footerComponent={pied}
      headerComponent={(
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {mode === 'name'
              ? t('eventDetails.createATeam', 'Créer une équipe')
              : t('eventDetails.registerMyTeam', 'Inscrire mon équipe')}
          </Text>
          {mode === 'name' ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'eventDetails.thisTeamWillOnlyExist',
                'Cette équipe n’existera que pour ce tournoi. Tu en deviendras automatiquement le capitaine.',
              )}
            </Text>
          ) : null}
          {mode === 'name' && ensuite ? (
            <Text style={[Fonts.p2Bold, Fonts.neutral00]} testID="tournament-team-sheet-next">
              {ensuite}
            </Text>
          ) : null}
        </View>
      )}
      isVisible
      webPresentation="dialog"
    >
      <View style={[Spaces.gap[12], Spaces.paddingBottom[16]]}>
        {mode === 'name' ? (
          <>
            <TextInput
              accessibilityLabel={t('eventDetails.teamName', 'Nom de l’équipe')}
              autoFocus
              onChangeText={(texte) => {
                setNom(texte);
                if (texte.trim()) setNomManquant(false);
              }}
              onSubmitEditing={creer}
              placeholder={t('eventDetails.teamName', 'Nom de l’équipe')}
              placeholderTextColor={Colors.neutral300}
              style={[Fonts.p2, {
                borderColor: nomManquant ? Colors.error500 : Colors.neutral500,
                borderRadius: 12,
                borderWidth: 1,
                color: Colors.neutral00,
                minHeight: MIN_TOUCH_TARGET,
                paddingHorizontal: 14,
              }]}
              value={nom}
            />
            {nomManquant ? (
              <Text accessibilityRole="alert" style={[Fonts.p3, { color: Colors.error500 }]}>
                {t('eventDetails.addATeamNameBefore', 'Ajoute un nom d’équipe avant de continuer.')}
              </Text>
            ) : null}
          </>
        ) : teams.map((equipe) => (
          <Button
            disabled={isPending}
            key={equipe?.documentId || equipe?.name}
            onPress={() => onChoose(equipe)}
            style={{ minHeight: MIN_TOUCH_TARGET }}
            title={equipe?.name || t('eventDetails.teamFallback', 'Équipe')}
            variant="SecondaryLight"
          />
        ))}
      </View>
    </BottomModal>
  );
}

// IMPL-1-FICHE (18/11, pack T-DESIGN-TOURNOI, écran 8e) — l'aperçu d'une équipe, dans la feuille
// d'équipe du tournoi (même fichier que la feuille de création ; les témoins du site la doublent).

// ponytail: pastille recopiée de TournamentTeamsPublic.js (un import croisé ferait une boucle) ;
// sortie : un atome commun de pastille.
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
 * Les places payées d'une équipe et le seuil, lus dans le résumé du serveur.
 * @param {any} team - L'équipe.
 * @param {any} tournamentConfig - Le réglage du tournoi.
 * @returns {{ payees: number | null, seuil: number }} Les places payées (null si inconnues).
 */
const placesDeLEquipe = (team, tournamentConfig) => {
  const seuilLu = Math.round(Number(tournamentConfig?.paidMembersToValidate));
  const lues = Number(team?.membersSummary?.paidCount);
  return {
    payees: team?.membersSummary && Number.isFinite(lues) ? Math.round(lues) : null,
    seuil: seuilLu > 0 ? seuilLu : 5,
  };
};

/**
 * 8e — l'aperçu d'une équipe, vu par qui n'en fait pas partie (feuille du bas ; fenêtre sur le
 * site).
 * @param {object} props - Les propriétés.
 * @param {any} props.team - L'équipe (null : fermée).
 * @param {string} [props.tournamentName] - Le nom du tournoi.
 * @param {any} [props.tournamentConfig] - Le réglage du tournoi.
 * @param {() => void} props.onClose - Fermer.
 * @param {((team: any) => void) | null} [props.onAsk] - « Demander à rejoindre », si permis.
 * @param {boolean} [props.requested] - Le lecteur a déjà demandé à rejoindre cette équipe.
 * @returns {import('react').ReactElement | null} L'aperçu.
 */
export function TournamentTeamPreviewSheet({
  onAsk = null, onClose, requested = false, team, tournamentConfig = {}, tournamentName = '',
}) {
  const { t } = useTranslation();
  const {
    Colors, Fonts, Spaces,
  } = useTheme();
  if (!team) return null;
  const capitaine = getTournamentTeamCaptainShort(team);
  const cherche = getTournamentTeamLookingFor(team, tournamentConfig);
  const ouverte = isTournamentTeamOpenToJoinRequests(team);
  const validee = String(team?.status || '').toLowerCase() === 'accepted';
  const { payees, seuil } = placesDeLEquipe(team, tournamentConfig);
  const joueurs = getTournamentTeamPublicPlayers(team);
  const effectif = getTournamentTeamPlayerCount(team, tournamentConfig);
  const resteAPayer = payees === null ? 0 : Math.max(0, seuil - payees);
  const pied = ouverte && onAsk && !requested ? (
    <Button
      onPress={() => onAsk(team)}
      style={{ minHeight: 44 }}
      title={t('implFiche.askToJoin')}
      variant="Primary"
    />
  ) : null;
  return (
    <BottomModal
      close={onClose}
      footerComponent={pied}
      headerComponent={(
        <View style={Spaces.gap[4]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {team?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {tournamentName
              ? t('implFiche.teamPreviewSubtitle', {
                tournament: tournamentName, ...SANS_ECHAPPEMENT,
              })
              : t('implFiche.tournamentTeam')}
          </Text>
        </View>
      )}
      isVisible
      webPresentation="dialog"
    >
      <View style={[Spaces.gap[12], Spaces.paddingBottom[16]]} testID="tournament-team-preview">
        {capitaine ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('implFiche.captainLine', { name: capitaine, ...SANS_ECHAPPEMENT })}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {validee ? <Pastille color={Colors.primary500} text={t('implFiche.validated')} /> : null}
          {!validee && resteAPayer > 0 ? (
            <Pastille
              color={Colors.warning400}
              text={t('implFiche.placesToPay', { count: resteAPayer })}
            />
          ) : null}
          {cherche > 0 ? (
            <Pastille
              color={Colors.primary200}
              text={t('implFiche.lookingFor', { count: cherche })}
            />
          ) : null}
          {ouverte
            ? <Pastille color={Colors.primary500} text={t('implFiche.openToRequests')} />
            : null}
          {ouverte && requested ? (
            <Pastille color={Colors.primary500} text={t('implFiche.requestSent')} />
          ) : null}
        </View>
        {payees !== null ? (
          <View style={Spaces.gap[8]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('implFiche.placesPaid', { count: payees, total: seuil })}
            </Text>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ max: seuil, min: 0, now: Math.min(payees, seuil) }}
              style={{
                backgroundColor: withAlpha(Colors.neutral00, 0.12),
                borderRadius: 4,
                height: 8,
                overflow: 'hidden',
              }}
            >
              <View style={{
                backgroundColor: Colors.primary500,
                borderRadius: 4,
                height: 8,
                width: `${Math.round((Math.min(payees, seuil) / seuil) * 100)}%`,
              }}
              />
            </View>
          </View>
        ) : null}
        <View style={{
          alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between',
        }}
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{t('implFiche.playersTitle')}</Text>
          {effectif !== null ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('implFiche.players', { count: effectif })}
            </Text>
          ) : null}
        </View>
        {joueurs.map((joueur, index) => (
          <View
            // Pas d'identifiant de joueur dans le résumé : la position suffit, la liste est figée.
            // eslint-disable-next-line react/no-array-index-key
            key={`joueur-${index}`}
            style={{
              borderTopColor: withAlpha(Colors.neutral00, 0.08),
              borderTopWidth: index ? 1 : 0,
              paddingVertical: 8,
            }}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {joueur.minor ? t('implFiche.minorPlayer') : joueur.label}
            </Text>
            {joueur.minor ? (
              <Text style={[Fonts.p4, Fonts.neutral300]}>{t('implFiche.minorNote')}</Text>
            ) : null}
          </View>
        ))}
        <Text style={[Fonts.p4, Fonts.neutral300]}>{t('implFiche.paymentsPrivate')}</Text>
      </View>
    </BottomModal>
  );
}

export default TournamentTeamSheet;
