import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { createTournamentDesignSystem } from '../tournamentDesignSystem';
import { getTournamentEntryFeeLabel, getTournamentMinAge } from '../tournamentUtils';
import { isPaidTournament, tournamentPaidThreshold } from './tournamentTerms';

/**
 * T-PAGES-4 (17/11, maquette validée (a) et (b), téléphone) — « Comment ça marche » et « Avant de
 * t'inscrire » sur la fiche du tournoi. Les textes sont ceux du site, clé pour clé
 * (`tournamentFicheWeb.how.*`, `tournamentFicheWeb.before.*`, T-PAGES-3) ; les blocs du site sont
 * en balises du navigateur (`section`, `ol`), d'où ces deux blocs natifs.
 * ponytail: la liste des étapes et des lignes suit celle de TournamentFicheWeb.js ; si le site en
 * change une, changer ici aussi. Sortie : exporter ces deux listes du fichier du site.
 */

/**
 * Le style commun des deux cartes.
 * @returns {{ ds: any, Fonts: any, Spaces: any }} Ce qu'il faut pour les dessiner.
 */
const useCarte = () => {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  return {
    ds: createTournamentDesignSystem({
      ApplicationStyle, Colors, Fonts, Spaces,
    }),
    Fonts,
    Spaces,
  };
};

/**
 * « Comment ça marche », en 3 étapes (la 3ᵉ seulement pour un tournoi payant).
 * @param {object} props - Les propriétés.
 * @param {any} props.event - Le tournoi.
 * @returns {import('react').ReactElement} Le bloc.
 */
export function TournamentHowItWorksCard({ event }) {
  const { t } = useTranslation();
  const { ds, Fonts, Spaces } = useCarte();
  const config = event?.tournamentConfig || {};
  const minimum = Math.round(Number(config.minRosterSize));
  const prix = getTournamentEntryFeeLabel(event);
  const etapes = [
    [t('tournamentFicheWeb.how.step1Title'), t('tournamentFicheWeb.how.step1')],
    [
      minimum > 1
        ? t('tournamentFicheWeb.how.step2Title', { count: minimum - 1 })
        : t('tournamentFicheWeb.how.step2TitleFree'),
      t('tournamentFicheWeb.how.step2'),
    ],
    ...(prix ? [[
      t('tournamentFicheWeb.how.step3Title', { price: prix, ...SANS_ECHAPPEMENT }),
      config.jerseySizeRequired === true
        ? t('tournamentFicheWeb.how.step3Jersey', { count: tournamentPaidThreshold(event) })
        : t('tournamentFicheWeb.how.step3', { count: tournamentPaidThreshold(event) }),
    ]] : []),
  ];
  return (
    <View style={[...ds.styles.panelCard, Spaces.gap[12]]} testID="tournament-how-it-works">
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{t('tournamentFicheWeb.how.title')}</Text>
      {etapes.map(([titre, detail], index) => (
        <View key={titre} style={Spaces.gap[4]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{`${index + 1}. ${titre}`}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * « Avant de t'inscrire » (« Avant le match » pour qui a une équipe) : l'âge, le maillot, la
 * rétractation, le lien des conditions (tournoi payant). Rien à dire : rien.
 * @param {object} props - Les propriétés.
 * @param {any} props.event - Le tournoi.
 * @param {() => void} props.onOpenTerms - Ouvre les conditions d'inscription.
 * @param {string} [props.title] - Le titre, s'il n'est pas « Avant de t'inscrire ».
 * @returns {import('react').ReactElement | null} Le bloc, ou rien.
 */
export function TournamentBeforeSignUpCard({ event, onOpenTerms, title }) {
  const { t } = useTranslation();
  const { ds, Fonts, Spaces } = useCarte();
  const minAge = getTournamentMinAge(event);
  const payant = isPaidTournament(event);
  const lignes = [
    minAge ? [
      t('tournamentFicheWeb.before.age', { minAge }),
      minAge < 18 ? t('tournamentFicheWeb.before.ageConsent') : '',
    ] : null,
    event?.tournamentConfig?.jerseySizeRequired === true
      ? [t('tournamentFicheWeb.before.jersey'), t('tournamentFicheWeb.before.jerseyDetail')]
      : null,
    payant ? ['', t('tournamentFicheWeb.before.withdrawal')] : null,
  ].filter(Boolean);
  if (lignes.length === 0 && !payant) return null;
  return (
    <View style={[...ds.styles.panelCard, Spaces.gap[12]]} testID="tournament-before-sign-up">
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
        {title || t('tournamentFicheWeb.before.title')}
      </Text>
      {lignes.map((ligne) => {
        const [gras, reste] = /** @type {string[]} */ (ligne);
        return (
          <Text key={`${gras}${reste}`} style={[Fonts.p3, Fonts.neutral200]}>
            {gras ? <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{gras}</Text> : null}
            {gras && reste ? ' ' : null}
            {reste}
          </Text>
        );
      })}
      {payant ? (
        // L'identifiant des témoins sur une enveloppe : le bouton commun ne le déclare pas.
        <View testID="event-tournament-terms-link">
          <Button
            onPress={onOpenTerms}
            style={{ minHeight: 44 }}
            title={t('tournamentFicheWeb.before.termsLink')}
            variant="SecondaryLight"
          />
        </View>
      ) : null}
    </View>
  );
}
