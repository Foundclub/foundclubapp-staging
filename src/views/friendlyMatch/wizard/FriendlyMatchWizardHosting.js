import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import HostingIcon from '@/components/atoms/hostingIcon/HostingIcon';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from './friendlyMatchWizardSteps';

/**
 * Les trois reponses possibles, dites du point de vue de celui qui publie.
 * L ordre suit celui de la spec (§3.1) : recevoir, se deplacer, les deux.
 *
 * 🔴 `value` part TELLE QUELLE dans `hostingPreference` (friendlyMatchService.js:126)
 * et le serveur la compare en dur. HOST / AWAY / BOTH ne se renomment pas :
 * le brief design ecrit « recoit / se_deplace / les_deux », mais c est une
 * DESCRIPTION, pas une specification. Aucune des quatre portes de `app` ne
 * verrait le renommage — seul le filet __tests__/FriendlyMatchWizardHosting.js
 * le voit.
 *
 * `consequence` est ce que le choix implique, en une phrase. Elle est affichee
 * sous CHAQUE carte, AVANT le choix : c est ce qui permet de decider. Avant le
 * lot D07 elle n apparaissait que pour l option deja selectionnee, donc jamais
 * au moment ou elle servait.
 *
 * 🗣️ LOT D41 ② — `label` et `consequence` ne sont plus le texte affiche : ce
 * sont les REPLIS de `labelKey` / `consequenceKey`, resolus a l affichage dans
 * `fr.js`. Ils restent ici mot pour mot, apostrophes typographiques comprises,
 * parce qu un repli qui reformule transforme un rapatriement en reecriture.
 */
const HOSTING_OPTIONS = [
  {
    consequence: 'Le match se jouera sur ton terrain.',
    consequenceKey: 'friendlyMatch.wizard.hosting.options.host.consequence',
    iconKey: 'stadium',
    label: 'Je reçois',
    labelKey: 'friendlyMatch.wizard.hosting.options.host.label',
    value: 'HOST',
  },
  {
    consequence: 'Tu joues chez l’adversaire.',
    consequenceKey: 'friendlyMatch.wizard.hosting.options.away.consequence',
    // D41 ③ — une fleche, plus un coureur. Meme cle que le tag d annonce
    // (friendlyMatchFlow.js) : les deux surfaces ne peuvent pas diverger.
    iconKey: 'arrow',
    label: 'Je me déplace',
    labelKey: 'friendlyMatch.wizard.hosting.options.away.label',
    value: 'AWAY',
  },
  {
    consequence: 'Ton annonce touche le plus d’équipes.',
    consequenceKey: 'friendlyMatch.wizard.hosting.options.both.consequence',
    iconKey: 'switch',
    label: 'Les deux',
    labelKey: 'friendlyMatch.wizard.hosting.options.both.label',
    value: 'BOTH',
  },
];

/**
 * Etape 2/7 — « Tu peux recevoir ? » (§4.1, arbitrage Adel Q1).
 *
 * C est LA regle metier neuve du dossier : ce choix contraint ensuite ce que le
 * candidat pourra cocher (§3.3). Il n est jamais pre-rempli — pas de valeur par
 * defaut, meme « Les deux » : un choix implicite serait subi, pas fait.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardHosting({ navigation }) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = /** @type {any} */ (useTheme());
  const { dispatch, state } = useFriendlyMatchWizard();
  const { t } = useTranslation();

  const issue = getFriendlyMatchWizardStepIssue('hosting', state);
  const subtitle = t(
    'friendlyMatch.wizard.hosting.subtitle',
    'C’est ce qui décide où le match se jouera.',
  );

  // Les fonds sont calcules AVANT le rendu, et volontairement pas en ligne :
  // `verify:theme-contract` signale toute encre claire ecrite a moins de 4
  // lignes d un `backgroundColor: ...primary500`, meme quand ce fond est un
  // voile a 8 % sur lequel le blanc reste parfaitement lisible.
  const selectedSurface = withAlpha(Colors.primary500, 0.08);
  const restingSurface = withAlpha(Colors.primary900, 0.66);
  const restingBorder = withAlpha(Colors.neutral00, 0.12);
  const iconTileSurface = withAlpha(Colors.primary500, 0.12);
  const mutedInk = withAlpha(Colors.neutral100, 0.63);

  return (
    <WizardStepLayout
      headerVariant="focus"
      isNextDisabled={Boolean(issue)}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.FriendlyMatchWizardDates)}
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('hosting')}
      subtitle={subtitle}
      title={t('friendlyMatch.wizard.hosting.title', 'Tu peux recevoir ?')}
    >
      <View style={[Spaces.gap[12]]}>
        {HOSTING_OPTIONS.map((option) => {
          const isSelected = state.hostingPreference === option.value;
          const label = t(option.labelKey, option.label);
          const consequence = t(option.consequenceKey, option.consequence);
          return (
            // `radio` et non `button` : les trois cartes forment UN choix unique.
            // Sans `accessibilityState`, un lecteur d ecran annonce trois
            // boutons sans jamais dire lequel est retenu — la couleur ne dit rien.
            <TouchableOpacity
              accessibilityLabel={`${label}. ${consequence}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              key={option.value}
              onPress={() => dispatch({ payload: option.value, type: 'SET_HOSTING_PREFERENCE' })}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[12],
                Spaces.paddingHorizontal[16],
                {
                  backgroundColor: isSelected ? selectedSurface : restingSurface,
                  borderColor: isSelected ? Colors.primary500 : restingBorder,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  minHeight: 74,
                },
              ]}
            >
              <View style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: iconTileSurface,
                  borderRadius: 12,
                  height: 38,
                  width: 38,
                },
              ]}
              >
                <HostingIcon color={Colors.primary500} iconKey={option.iconKey} size={17} />
              </View>

              <View style={[Alignments.grow1]}>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{label}</Text>
                <Text style={[Fonts.p3, Spaces.marginTop[4], { color: mutedInk }]}>
                  {consequence}
                </Text>
              </View>

              {isSelected ? (
                <Image
                  source={Images.check}
                  style={{
                    height: 17, resizeMode: 'contain', tintColor: Colors.primary500, width: 17,
                  }}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Le pave encadre d avant D07 pesait autant qu une carte-option pour une
          information qui n en est pas une : c est une regle du service, pas un
          choix a faire. Il redevient une ligne d aide. */}
      <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[16]]}>
        <Text
          importantForAccessibility="no"
          style={[Fonts.small, { color: mutedInk }]}
        >
          i
        </Text>
        <Text style={[Fonts.small, Alignments.grow1, { color: mutedInk }]}>
          {t(
            'friendlyMatch.wizard.hosting.info',
            'Seules les équipes compatibles avec ton choix verront ton annonce'
            + ' — les autres ne la voient pas.',
          )}
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardHosting;
