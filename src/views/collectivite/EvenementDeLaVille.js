import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { publicationDateLabel } from '@/domains/collectivite/collectiviteActualites';
import {
  lieuLabel, placesLabel, quandLabel, quiLeVoitLabel, repetitionLabel,
} from '@/domains/collectivite/evenementDeLaVille';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import SeancesTouchees from '@/components/organisms/evenementVille/SeancesTouchees';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useApercuEvenement,
  useEvenementDeLaVille,
  useGestesEvenementDeLaVille,
} from '@/services/collectivite/collectiviteEvenementQueries';

import { resolveMediaUrl } from '@/utils/mediaUrl';

import { openExternalMap } from '@/platform/maps/externalMap';

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
  // R17-EVT-1-BIS (h) (20/10) : les séances que son blocage touche ENCORE (lues comme avant de
  // publier ; celles que leur club a déplacées en sortent). La Ville seule, blocage actif.
  const blocageActif = deLaVille && evenement?.closure?.status === 'active';
  const touchees = useApercuEvenement(blocageActif ? collectiviteId : null, {
    endDate: evenement?.endDate,
    endTime: evenement?.endTime,
    facilityId: evenement?.facility?.documentId,
    startDate: evenement?.startDate,
    startTime: evenement?.startTime,
    takesPlace: evenement?.takesPlace,
  });

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
  // R17-EVT-1-BIS (e) : « ailleurs », placé sur la carte : le lieu s'ouvre dans l'appli de cartes
  // (comme le lieu d'une séance).
  const ouvrirLaCarte = !ouvrirLePlanning && evenement.addressLocation
    ? () => openExternalMap({
      label: evenement.address || '',
      latitude: evenement.addressLocation.lat,
      longitude: evenement.addressLocation.lng,
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

  // VILLEEVT-CODE (2B) : une date d'une série s'annule seule, ou avec les suivantes.
  const confirmerLAnnulation = async (/** @type {boolean} */ toute = false) => {
    try {
      await annuler.mutateAsync(toute
        ? { evenementId: String(evenement.documentId), serie: true }
        : String(evenement.documentId));
    } finally {
      setConfirmer(false);
    }
  };
  const regle = evenement.serie?.regle ? repetitionLabel(t, evenement.serie.regle) : '';
  const places = placesLabel(t, evenement.capacity);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32, paddingTop: 16 }}>
        {/* R17-EVT-1-BIS (f) (20/10) : l'affiche, en tête, pour tous ceux qui la lisent. */}
        {evenement.poster?.url ? (
          <Image
            accessibilityLabel={t('collectiviteEvenement.fiche.affiche', 'Affiche de « {{nom}} »', {
              interpolation: { escapeValue: false },
              nom: evenement.name,
            })}
            resizeMode="cover"
            source={{
              uri: resolveMediaUrl(evenement.poster.formats?.medium?.url || evenement.poster.url),
            }}
            style={{
              alignSelf: 'center',
              aspectRatio: Number(evenement.poster.width) > 0 && Number(evenement.poster.height) > 0
                ? Number(evenement.poster.width) / Number(evenement.poster.height)
                : 3 / 4,
              borderRadius: 16,
              maxWidth: 360,
              width: '100%',
            }}
            testID="evenement-affiche"
          />
        ) : null}
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
          {/* VILLEEVT-CODE (2B, 3B) : le rythme de sa série ; ses places. */}
          {regle ? ligne({
            icone: 'calendar',
            testID: 'evenement-repetition',
            texte: t('collectiviteEvenement.fiche.repetition', 'Se répète : {{regle}}', {
              interpolation: { escapeValue: false },
              regle,
            }),
          }) : null}
          {places ? ligne({ icone: 'users', testID: 'evenement-places', texte: places }) : null}
          {ligne({
            icone: 'stadium',
            onPress: ouvrirLePlanning || ouvrirLaCarte,
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
        {deLaVille && evenement.actualite?.publishedAt ? (
          <Text style={[Fonts.p3, Fonts.neutral200]} testID="evenement-actualite-date">
            {/* CORR-COLLECTIVITES 108 (31/10, Adel A) : annulé, la ligne parle de l'annonce de
                l'annulation (le serveur pointe alors `actualite` sur elle). */}
            {annule
              ? t('collectiviteEvenement.fiche.annulationPubliee', 'Annonce de l’annulation publiée : {{quand}}', {
                interpolation: { escapeValue: false },
                quand: publicationDateLabel(t, evenement.actualite.publishedAt),
              })
              : t('collectiviteEvenement.fiche.actualitePubliee', 'Actualité publiée : {{quand}}', {
                interpolation: { escapeValue: false },
                quand: publicationDateLabel(t, evenement.actualite.publishedAt),
              })}
          </Text>
        ) : null}
        {blocageActif && !annule ? (
          <SeancesTouchees
            explication={t('collectiviteEvenement.fiche.toucheesExplication', {
              count: Number(touchees.data?.sessionsCount) || 0,
            })}
            touchees={touchees.data}
          />
        ) : null}
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
            {regle ? (
              <>
                <Text style={[Fonts.p3, Fonts.neutral200]} testID="evenement-annulation-serie">
                  {t(
                    'collectiviteEvenement.annulation.serieAide',
                    'Cette date fait partie d’une série : {{regle}}',
                    { interpolation: { escapeValue: false }, regle },
                  )}
                </Text>
                <Button
                  isLoading={annuler.isPending}
                  onPress={() => confirmerLAnnulation(false)}
                  title={t('collectiviteEvenement.annulation.uneDate', 'Annuler cette date seulement')}
                  variant="Danger"
                />
                <Button
                  isLoading={annuler.isPending}
                  onPress={() => confirmerLAnnulation(true)}
                  title={t('collectiviteEvenement.annulation.serie', 'Annuler celle-ci et la suite')}
                  variant="DangerFilled"
                />
              </>
            ) : (
              <Button
                isLoading={annuler.isPending}
                onPress={() => confirmerLAnnulation(false)}
                title={t('collectiviteEvenement.fiche.annuler', 'Annuler l’événement')}
                variant="DangerFilled"
              />
            )}
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default EvenementDeLaVille;
