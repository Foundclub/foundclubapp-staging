import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, View,
} from 'react-native';

import { formatEuros, texteHeure } from '@/domains/complexe/complexeTerrain';
import {
  dateEtHeureDeParis,
  etatAffiche,
  texteCreneau,
  texteJourCourt,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import ScreenContainer from '@/components/templates/ScreenContainer';
import PastilleEtat from '@/views/reserverTerrain/components/PastilleEtat';

import { RouteNames } from '@/navigation/routeNames';

import { useIsDesktop } from '@/responsive';

const COLONNE = 560;
const PICTO = 72;

/**
 * E-P05 — « LE RÉSULTAT » — RESA-L6A (14/10/2026), planches EP05 et P00 bloc 4, plan E-P05. Un même
 * gabarit (pictogramme sans emoji, titre, phrase, carte résumé, boutons), deux variantes :
 *   · « C'est réservé ! » (terrain automatique) ;
 *   · « Demande envoyée » (sur demande) : « Le Five de Montrivage te répond avant le 16/10 à
 *     16 h. Le créneau t'est gardé jusque-là. » (AT-08 : une demande tient le créneau).
 * Puis « Voir ma réservation » / « Voir ma demande » (E-P07) et « Retour à l'accueil » (pas de
 * retour au récapitulatif : E-P04 a cédé sa place à cet écran). Aucun chargement : l'écran arrive
 * avec la réponse du serveur (paramètre `reservation`).
 * Ordinateur (OR3, gabarit B) : la colonne centrée.
 * ⛔ Pas dans ce lot : « Inviter par lien », « Il me manque des joueurs », la collecte, la
 * réservation d'équipe, « Tu as rejoint le canal » (serveurs L3 / L4, puis L6b). Caché par
 * `COMPLEXES_JOUEUR`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverResultat() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const reservation = /** @type {any} */ (route?.params)?.reservation || null;
  const surOrdinateur = useIsDesktop();

  const versLAccueil = () => navigation.popToTop?.();
  const etat = etatAffiche(reservation);
  const demande = etat === 'enAttente';
  const echeance = dateEtHeureDeParis(reservation?.expiresAt);

  let corps;
  if (!reservation) {
    corps = (
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
          {t('reserverTerrain.echec.introuvable', 'Cette réservation n’existe plus.')}
        </Text>
      </View>
    );
  } else {
    const complexe = String(reservation?.complexe?.name || '');
    const prix = Number.isFinite(Number(reservation?.price?.amount))
      ? t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
        prix: formatEuros(Number(reservation.price.amount)),
        ...SANS_ECHAPPEMENT,
      })
      : '';
    let phrase = null;
    if (demande && echeance) {
      const [, mois, jour] = echeance.date.split('-');
      phrase = t(
        'reserverTerrain.resultat.demandeEcheance',
        '{{complexe}} te répond avant le {{date}} à {{heure}}. Le créneau t’est gardé jusque-là.',
        {
          complexe,
          date: `${jour}/${mois}`,
          heure: texteHeure(echeance.heure),
          ...SANS_ECHAPPEMENT,
        },
      );
    } else if (demande) {
      phrase = t(
        'reserverTerrain.resultat.demandeSansEcheance',
        '{{complexe}} te répond bientôt. Le créneau t’est gardé jusque-là.',
        { complexe, ...SANS_ECHAPPEMENT },
      );
    }
    corps = (
      <View style={{ alignItems: 'center', gap: 16 }}>
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: withAlpha(demande ? Colors.warning500 : Colors.success500, 0.16),
              borderRadius: PICTO / 2,
              height: PICTO,
              width: PICTO,
            },
          ]}
        >
          {demande ? (
            <GlyphIcon color={Colors.warning500} name="hourglass" size={32} />
          ) : (
            <Image
              source={Images.check}
              style={[{ height: 32, width: 32 }, ApplicationStyle.tintColor.success500]}
            />
          )}
        </View>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00, Fonts.textCenter]}>
          {demande
            ? t('reserverTerrain.resultat.demandeEnvoyee', 'Demande envoyée')
            : t('reserverTerrain.resultat.reserve', 'C’est réservé !')}
        </Text>
        {phrase ? (
          <Text style={[Fonts.p1, Fonts.neutral100, Fonts.textCenter]}>{phrase}</Text>
        ) : null}
        <View
          style={{
            alignSelf: 'stretch',
            backgroundColor: withAlpha(Colors.primary800, 0.6),
            borderColor: withAlpha(Colors.primary500, 0.24),
            borderRadius: 20,
            borderWidth: 1,
            gap: 6,
            padding: 16,
          }}
        >
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('reserverTerrain.resultat.resume', '{{jour}} · {{creneau}} · {{terrain}}', {
              creneau: texteCreneau(reservation.from, reservation.to),
              jour: texteJourCourt(t, reservation.date),
              terrain: String(reservation?.terrain?.name || ''),
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {[complexe, prix].filter(Boolean).join(' · ')}
          </Text>
          <PastilleEtat etat={etat} />
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 20,
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 24,
          paddingTop: 48,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {corps}
        <View style={{ gap: 10 }}>
          {reservation?.documentId ? (
            <Button
              onPress={() => navigation.navigate(RouteNames.ReserverMaReservation, {
                reservationId: reservation.documentId,
              })}
              title={
                demande
                  ? t('reserverTerrain.resultat.voirMaDemande', 'Voir ma demande')
                  : t('reserverTerrain.resultat.voirMaReservation', 'Voir ma réservation')
              }
              variant="Primary"
            />
          ) : null}
          <Button
            onPress={versLAccueil}
            title={t('reserverTerrain.resultat.retourAccueil', 'Retour à l’accueil')}
            variant="Ghost"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default ReserverResultat;
