import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { lieuLabel, quandLabel, quiLeVoitLabel } from '@/domains/collectivite/evenementDeLaVille';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useEvenementDeLaVille,
  useGestesEvenementDeLaVille,
} from '@/services/collectivite/collectiviteEvenementQueries';

/**
 * 🏛️ R17-EVT-1 (20/10/2026, REC17-005) — LA FICHE D'UN ÉVÉNEMENT DE LA VILLE.
 * Planches : P10-evenement-ordi (état 8 : « son panneau » ; état 9 : « Annuler l'événement »),
 * P11-evenement-v2-tel (état 8 : la fiche côté club). Le serveur ne rend que ce que « Qui le
 * voit ? » permet (sinon 404) :
 *   - la VILLE (vue avec `visibility`) : ce qu'il est, qui le voit, et ses gestes — « Modifier »,
 *     « Voir l'actualité », « Annuler l'événement » (fenêtre ; un ÉTAT, l'installation se libère) ;
 *   - un club, un membre : ce qu'il est, où (vers le planning de l'installation), quand.
 * Portes : le planning d'une installation, « Mon planning » (niveau 3), la recherche (niveau 3),
 * la publication elle-même (le formulaire la remplace par cette fiche).
 * @returns {import('react').ReactElement} L'écran.
 */
function EvenementDeLaVille() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @type {{ evenementId?: string } | undefined} */
  const parametres = route?.params;
  const evenementId = parametres?.evenementId || null;
  const lecture = useEvenementDeLaVille(evenementId);
  const evenement = lecture.data;
  const deLaVille = Boolean(evenement && 'visibility' in evenement);
  const collectiviteId = evenement?.collectivite?.documentId || null;
  const { annuler } = useGestesEvenementDeLaVille(collectiviteId);
  const [confirmer, setConfirmer] = useState(false);

  if (lecture.isLoading) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <Loader />
      </ScreenContainer>
    );
  }
  if (!evenement) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <Text
          style={[Fonts.p2, Fonts.neutral100, Spaces.paddingTop[24]]}
          testID="evenement-introuvable"
        >
          {t(
            'collectiviteEvenement.fiche.introuvable',
            'Cet événement n’existe plus, ou il ne vous est pas montré.',
          )}
        </Text>
      </ScreenContainer>
    );
  }

  const annule = evenement.status === 'cancelled';
  const quand = quandLabel(t, evenement);
  const lieu = lieuLabel(t, {
    address: evenement.address,
    facilityName: evenement.facility?.name || null,
    takesPlace: evenement.takesPlace,
  });
  const ouvrirLePlanning = evenement.facility?.documentId
    ? () => navigation.navigate(RouteNames.PlanningWeekFullscreen, {
      contextDetailLabel: evenement.facility.name,
      date: evenement.startDate,
      facilityId: evenement.facility.documentId,
      sourceType: 'facility',
      ...(deLaVille ? { espace: 'ville' } : {}),
    })
    : null;

  /**
   * Une ligne de la fiche : icône et texte, touchable si elle mène quelque part.
   * @param {{ icone: string, onPress?: () => void, testID: string, texte: string }} props
   * @returns {import('react').ReactElement}
   */
  const ligne = ({
    icone, onPress, testID, texte,
  }) => {
    const contenu = (
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}>
        <SvgIcon color={Colors.primary200} height={18} name={icone} width={18} />
        <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>{texte}</Text>
        {onPress ? (
          <SvgIcon color={Colors.neutral300} height={12} name="arrow-right" width={12} />
        ) : null}
      </View>
    );
    return onPress ? (
      <TouchableOpacity accessibilityRole="link" key={testID} onPress={onPress} testID={testID}>
        {contenu}
      </TouchableOpacity>
    ) : (
      <View key={testID} testID={testID}>
        {contenu}
      </View>
    );
  };

  const voirLActualite = () => {
    navigation.navigate(RouteNames.CollectiviteActualites, { collectiviteId });
  };

  const confirmerLAnnulation = async () => {
    try {
      await annuler.mutateAsync(String(evenement.documentId));
    } finally {
      setConfirmer(false);
    }
  };

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32, paddingTop: 16 }}>
        <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
          <View
            style={{
              backgroundColor: Colors.primary100,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 2,
            }}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary900, textTransform: 'uppercase' }]}>
              {t('collectiviteEvenement.fiche.etiquette', 'Événement de la Ville')}
            </Text>
          </View>
          {annule ? (
            <View
              style={{
                backgroundColor: withAlpha(Colors.error500, 0.16),
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 2,
              }}
              testID="evenement-annule"
            >
              <Text style={[Fonts.p4Bold, { color: Colors.error300 }]}>
                {t('collectiviteEvenement.fiche.annule', 'Annulé')}
              </Text>
            </View>
          ) : null}
        </View>
        {evenement.collectivite?.name ? (
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>{evenement.collectivite.name}</Text>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[Fonts.h2Bold, Fonts.neutral00]}
          testID="evenement-titre"
        >
          {evenement.name}
        </Text>
        <View style={{ gap: 4 }}>
          {ligne({ icone: 'calendar', testID: 'evenement-quand', texte: quand })}
          {ligne({
            icone: 'stadium',
            onPress: ouvrirLePlanning,
            testID: 'evenement-lieu',
            texte: lieu,
          })}
          {deLaVille
            ? ligne({
              icone: 'envelope',
              testID: 'evenement-qui',
              texte: quiLeVoitLabel(t, {
                audience: evenement.audience,
                visibility: evenement.visibility,
              }),
            })
            : null}
        </View>
        {evenement.description ? (
          <Text style={[Fonts.p2, Fonts.neutral100]}>{evenement.description}</Text>
        ) : null}
        {deLaVille && !annule ? (
          <View style={{ gap: 12 }}>
            <Button
              onPress={() => navigation.navigate(RouteNames.CollectiviteEvenement, {
                collectiviteId,
                evenementId: evenement.documentId,
              })}
              title={t('collectiviteEvenement.fiche.modifier', 'Modifier')}
              variant="Secondary"
            />
            {evenement.actualite?.documentId ? (
              <Button
                onPress={voirLActualite}
                title={t('collectiviteEvenement.fiche.voirActualite', 'Voir l’actualité')}
                variant="Ghost"
              />
            ) : null}
            <Button
              onPress={() => setConfirmer(true)}
              title={t('collectiviteEvenement.fiche.annuler', 'Annuler l’événement')}
              variant="Danger"
            />
          </View>
        ) : null}
      </ScrollView>
      <BottomModal close={() => setConfirmer(false)} isVisible={confirmer} webPresentation="dialog">
        <View
          accessibilityRole="alert"
          style={[Spaces.paddingTop[12], Spaces.paddingBottom[16], { gap: 16 }]}
          testID="evenement-confirmation"
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('collectiviteEvenement.annulation.titre', 'Annuler « {{nom}} » ?', {
              interpolation: { escapeValue: false },
              nom: evenement.name,
            })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {evenement.facility?.name && evenement.takesPlace
              ? t(
                'collectiviteEvenement.annulation.libere',
                {
                  installation: evenement.facility.name,
                  interpolation: { escapeValue: false },
                  quand,
                },
              )
              : t(
                'collectiviteEvenement.annulation.prevenus',
                'Ceux qui avaient été prévenus le sont de l’annulation.',
              )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'collectiviteEvenement.annulation.deplacees',
              'Une séance déjà déplacée par son club ne revient pas toute seule.',
            )}
          </Text>
          {/* Les deux libellés sont longs : l'un sous l'autre, jamais coupés (390 px). */}
          <View style={{ gap: 12 }}>
            <Button
              onPress={() => setConfirmer(false)}
              title={t('collectiviteEvenement.annulation.garder', 'Garder l’événement')}
              variant="Secondary"
            />
            <Button
              isLoading={annuler.isPending}
              onPress={confirmerLAnnulation}
              title={t('collectiviteEvenement.fiche.annuler', 'Annuler l’événement')}
              variant="DangerFilled"
            />
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default EvenementDeLaVille;
