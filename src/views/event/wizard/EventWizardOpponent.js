import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import { OPPONENT_NAME_MAX_LENGTH } from '@/domains/event/eventDisplayName';
import useTheme from '@/theme/themeContext';

import ClubSearchResultCard from '@/components/molecules/clubSearchResultCard/ClubSearchResultCard';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import EventWizardOpponentInvite from '@/views/event/wizard/components/EventWizardOpponentInvite';

import { RouteNames } from '@/navigation/routeNames';

import { useSearchClubs } from '@/services/club/clubQueries';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardExitRoute,
  getEventWizardNextRoute,
  getEventWizardOpponentStepIndex,
  getEventWizardStepCount,
} from './eventWizardDetectionUtils';

/**
 * Le nombre de clubs proposes sous le champ. `useSearchClubs` en demande deja
 * 10 (`clubQueries.js:75`) : on ne coupe donc aucun appel, on borne seulement
 * la hauteur de la liste sous un champ de saisie.
 */
const MAX_CLUBS_PROPOSES = 5;

/**
 * Y02 — L'ETAPE « CONTRE QUI ? », et elle n'existe QUE pour un match.
 *
 * 🎯 Adel, le 2026-08-19 : « si on ajoute manuellement un evenement match, on
 * rajoute une etape : on demande le nom de l'equipe adverse ».
 *
 * ⛔ C'EST UN CHAMP LIBRE, PAS UNE LISTE. L'adversaire n'est presque jamais dans
 * FoundClub — 7 clubs sur 222 294 ont une equipe (mesure du 2026-08-13).
 * Obliger a choisir une equipe existante fermerait l'etape a presque tout le
 * monde.
 *
 * ✅ AC04 (constat ② d'Adel du 2026-08-20 : « c'est bien si dans l'etape pour
 * choisir l'adversaire on pouvait choisir un club pour le trouver »). Ce qui
 * s'ajoute est une AIDE A LA SAISIE, jamais une contrainte : ce qu'on tape sert
 * de recherche, les clubs trouves s'affichent dessous, et en choisir un remplit
 * le champ. 🔒 Le champ reste libre a la lettre pres — c'est le garde-fou du
 * lot, et le chiffre ci-dessus dit pourquoi.
 *
 * 🆕 S10-B — ET L'INVITATION DE L'EQUIPE ADVERSE (cadre d'Adel du 2026-08-25,
 * reponse 4). Quand l'adversaire EST sur FoundClub, on peut l'inviter d'ici :
 * chercher son club, choisir SON EQUIPE, et le coach d'en face recevra une
 * invitation a ce match. C'est le SEUL endroit du tunnel ou une equipe externe
 * s'invite — les equipes de mon club se convient a l'etape « Participants ».
 *
 * 📌 CE QU'ON STOCKE. Le NOM part au serveur (`opponentName`, le seul champ que
 * le schema porte). L'IDENTIFIANT du club, lui, reste dans le tunnel : il
 * re-montre le club choisi quand on revient sur l'etape, et il est lache des
 * qu'on retouche le nom — un identifiant qui ne correspond plus au texte
 * affiche serait un mensonge silencieux.
 *
 * ✅ ELLE SE SAUTE. On ne connait pas toujours son adversaire a la creation, et
 * le tunnel a deja paye deux fois le defaut du cul-de-sac : « Passer » et
 * « Suivant » menent au meme endroit, et un champ vide n'empeche jamais rien.
 * L'adversaire se rajoute plus tard depuis la fiche.
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
 */
function EventWizardOpponent({ navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();
  const [opponentName, setOpponentName] = useState(state.opponentName || '');
  const [opponentClubId, setOpponentClubId] = useState(state.opponentClubId || null);
  const fieldSurfaceStyle = {
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.26)',
  };

  // 🧩 La recherche de club existe deja et sert ailleurs : on la rappelle telle
  // quelle. Elle ne part qu'a partir de 2 caracteres (`clubQueries.js:73`) :
  // taper un nom court n'appelle donc rien.
  const { data: foundClubs } = useSearchClubs(opponentName);
  const clubSuggestions = (Array.isArray(foundClubs) ? foundClubs : [])
    .slice(0, MAX_CLUBS_PROPOSES);
  const selectedClub = opponentClubId
    ? clubSuggestions.find(
      (/** @type {any} */ club) => String(club?.documentId || club?.id || '') === opponentClubId,
    ) || null
    : null;
  // On ne repropose pas le club qu'on vient de choisir : sa carte est deja
  // affichee juste au-dessus, selectionnee.
  // ⚠️ La condition porte sur `selectedClub`, PAS sur `opponentClubId` : si la
  // recherche ne retrouve plus le club retenu (reseau lent, nom retouche puis
  // remis), on aurait sinon un ecran sans carte NI liste — un cul-de-sac.
  const shouldShowSuggestions = !selectedClub && clubSuggestions.length > 0;

  // 🔒 LE GARDE-FOU : taper reste toujours possible, et taper LACHE le club.
  // ⛔ S10-B : taper ne RETIRE PAS l'invitation deja envoyee. Le nom affiche est
  // du texte libre ; l'invitation, elle, est partie chez un vrai coach. La
  // supprimer en silence parce qu'on a corrige une majuscule serait une perte
  // de donnee — elle se retire explicitement, dans la section ci-dessous.
  const handleChangeName = (/** @type {string} */ valeur) => {
    setOpponentName(valeur);
    setOpponentClubId(null);
  };

  const handleSelectClub = (/** @type {any} */ club) => {
    setOpponentName(String(club?.name || ''));
    setOpponentClubId(String(club?.documentId || club?.id || '') || null);
  };

  /**
   * S10-B — l'equipe adverse vient d'etre invitee : elle donne son nom au match.
   *
   * ⏱️ On ecrit dans le tunnel TOUT DE SUITE, sans attendre « Suivant » : la
   * section vient d'y poser l'invitation. Si le nom attendait la sortie de
   * l'etape, un retour arriere laisserait une invitation partie chez un coach
   * et un adversaire toujours « Pas encore connu » sur le recapitulatif.
   * @param {any} team L'equipe invitee.
   */
  const handleTeamInvited = (team) => {
    const nomDeLEquipe = String(team?.name || '').trim().slice(0, OPPONENT_NAME_MAX_LENGTH);
    if (!nomDeLEquipe) return;
    const clubDeLEquipe = String(team?.club?.documentId || team?.club?.id || '') || null;

    setOpponentName(nomDeLEquipe);
    setOpponentClubId(clubDeLEquipe);
    dispatch({
      payload: { opponentClubId: clubDeLEquipe, opponentName: nomDeLEquipe },
      type: 'SET_META',
    });
  };

  const goNext = (/** @type {string} */ valeur) => {
    dispatch({
      // ⛔ `opponentClubId` ne part PAS au serveur : `buildWizardFormData` ne
      // lit que des champs nommes, et `event` ne porte que `opponentName`.
      payload: { opponentClubId, opponentName: valeur },
      type: 'SET_META',
    });
    navigation.navigate(getEventWizardExitRoute(
      getEventWizardNextRoute(RouteNames.EventWizardOpponent, state),
      route?.params,
    ));
  };

  return (
    <WizardStepLayout
      headerVariant="focus"
      onBack={() => navigation.goBack()}
      onNext={() => goNext(opponentName)}
      // « Passer » n'efface pas ce qui a deja ete saisi a un passage precedent :
      // il avance, c'est tout. Effacer serait une surprise, pas un raccourci.
      onSkip={() => goNext(opponentName)}
      showSkip
      stepCount={getEventWizardStepCount(state)}
      stepIndex={getEventWizardOpponentStepIndex(state)}
      subtitle={t(
        'eventWizard.steps.opponent.subtitle',
        "Le match s'appellera « Match vs » suivi de ce nom.",
      )}
      title={t('eventWizard.steps.opponent.title', 'Contre qui ?')}
    >
      <View style={[Spaces.gap[12], Alignments.fill]}>
        <TextInput
          autoCapitalize="words"
          maxLength={OPPONENT_NAME_MAX_LENGTH}
          onChangeText={handleChangeName}
          placeholder={t(
            'eventWizard.steps.opponent.placeholder',
            'Ex. : US Blaisoise U15',
          )}
          placeholderTextColor={Colors.neutral500}
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Fonts.p1,
            fieldSurfaceStyle,
            { color: Colors.neutral00 },
          ]}
          value={opponentName}
        />
        {selectedClub ? (
          <ClubSearchResultCard
            footer={(
              <Text style={[Fonts.p3, Fonts.primary200]}>
                {t(
                  'eventWizard.steps.opponent.clubSelected',
                  'Club trouvé. Précise son équipe en modifiant le nom si besoin.',
                )}
              </Text>
            )}
            isSelected
            item={selectedClub}
          />
        ) : null}

        {shouldShowSuggestions ? (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('eventWizard.steps.opponent.clubResultsTitle', 'Clubs trouvés')}
            </Text>
            {clubSuggestions.map((/** @type {any} */ club) => (
              <ClubSearchResultCard
                item={club}
                key={club?.documentId || club?.id}
                onPress={() => handleSelectClub(club)}
              />
            ))}
          </View>
        ) : null}

        <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
          {t(
            'eventWizard.steps.opponent.hint',
            'Tu ne le connais pas encore ? Passe cette étape, tu pourras l’ajouter plus tard.',
          )}
        </Text>

        {/* S10-B — L'ADVERSAIRE EST SUR FOUNDCLUB ? On l'invite d'ici, et c'est
            le SEUL endroit du tunnel ou une equipe externe s'invite. */}
        <EventWizardOpponentInvite
          onTeamInvited={handleTeamInvited}
          surfaceStyle={fieldSurfaceStyle}
        />
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardOpponent;
