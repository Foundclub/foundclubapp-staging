import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Platform, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { texteHeure } from '@/domains/complexe/complexeTerrain';
import {
  annulationHorsDelai,
  estDemain,
  etatDeLaVeille,
} from '@/domains/complexe/reservationsDuJoueur';
import {
  momentLisible,
  texteCreneau,
  texteJourCourt,
  varianteDEchec,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import {
  useMaReservation,
  useRepondreALaVeille,
} from '@/services/complexe/complexeJoueurQueries';

import texteInsecable from '@/utils/texteInsecable';

import { useIsDesktop } from '@/responsive';

/** Planche OR3, gabarit B : la colonne centrée de 560 px. */
const COLONNE = 560;
// Le temps de lire « Merci, c'est confirmé. » avant la fiche (planche EP14, états 5 et 6).
const AVANT_LA_FICHE_MS = 2000;

/**
 * E-P14 — « DEMAIN, TU JOUES ? » — RESA-L6B-1 (19/10/2026), planche EP14 (toile BLG79NHv2), plan
 * E-P14 ; RC-G08, RC-P07, AT-07, RG-VEILLE. Ouvert par la notification N-20 (et la cloche) ; ses
 * boutons « Je confirme » / « J'annule » répondent aussi sans ouvrir l'app (rsvpActions.js).
 * Dans l'ordre de l'écran :
 *   1. le titre « Demain, tu joues ? » ;
 *   2. la carte : le jour et les heures, le complexe et le terrain ;
 *   3. l'aide (ce qu'annuler provoque) et, après le délai d'annulation FIGÉ, la mention
 *      « annulation tardive » (AT-07 : « J'annule » reste accepté, marqué « hors délai ») ;
 *   4. le pied : « Je confirme » · « J'annule » (avec confirmation) · « Voir ma réservation ».
 * Ensuite : « Merci, c'est confirmé. » ou « C'est annulé. », puis la fiche (E-P07). États : déjà
 * confirmée, déjà annulée, annulée par le complexe entre-temps (plus de bouton), créneau commencé,
 * réponse non partie ; rien à demander (aucune question posée) ⇒ la fiche à la place.
 * ⛔ Pas dans ce lot : « 9/10 joueurs présents » et « tes participants sont prévenus » (serveur L3,
 * puis RESA-L6B-2). Caché par `COMPLEXES_JOUEUR`. Paramètre : `reservationId`.
 * Témoin : `__tests__/EP14.veille.test.js`.
 * @returns {import('react').ReactElement | null} L'écran.
 */
function ReserverVeille() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @type {{ reservationId?: string }} */
  const params = /** @type {any} */ (route?.params) || {};
  const reservationId = params.reservationId || null;
  const surOrdinateur = useIsDesktop();
  const { dockClearance } = useBottomDockLayout();
  const lecture = useMaReservation(reservationId);
  const repondre = useRepondreALaVeille();
  const enVol = useRef(false);
  const reservation = lecture?.data || null;
  const [confirmation, setConfirmation] = useState(false);
  const [echec, setEchec] = useState(false);
  const [derniere, setDerniere] = useState(/** @type {'confirme' | 'annule' | null} */ (null));
  const [fin, setFin] = useState(/** @type {'confirme' | 'annule' | null} */ (null));

  const etat = reservation ? etatDeLaVeille(reservation) : null;
  const versLaFiche = () => navigation.navigate(RouteNames.ReserverMaReservation, {
    reservationId,
  });

  // Rien à demander : la fiche, qui dit l'état de la réservation, à la place de cet écran.
  useEffect(() => {
    if (!fin && etat === 'rienADemander') {
      navigation.replace(RouteNames.ReserverMaReservation, { reservationId });
    }
  }, [etat, fin, navigation, reservationId]);

  // Après la réponse : le message, le temps de le lire, puis la fiche.
  useEffect(() => {
    if (!fin) return undefined;
    const minuteur = setTimeout(() => {
      navigation.replace(RouteNames.ReserverMaReservation, { reservationId });
    }, AVANT_LA_FICHE_MS);
    return () => clearTimeout(minuteur);
  }, [fin, navigation, reservationId]);

  const envoyer = async (/** @type {'confirme' | 'annule'} */ reponse) => {
    // BH16 P13-18 : une réponse à la fois ; « Je confirme » et « J'annule » ne partent pas tous deux.
    if (enVol.current) return;
    enVol.current = true;
    setConfirmation(false);
    setDerniere(reponse);
    setEchec(false);
    try {
      await repondre.mutateAsync({ reponse, reservationId });
      setFin(reponse);
    } catch {
      // Le serveur dit peut-être pourquoi (annulée par le complexe entre-temps, commencée) :
      // la réservation se relit, l'écran prend son nouvel état.
      setEchec(true);
      lecture?.refetch?.();
    } finally {
      enVol.current = false;
    }
  };

  const carte = {
    backgroundColor: withAlpha(Colors.primary800, 0.6),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  };
  const colonne = {
    alignSelf: /** @type {const} */ ('center'),
    maxWidth: surOrdinateur ? COLONNE : undefined,
    width: /** @type {const} */ ('100%'),
  };

  /**
   * La page : le contenu qui défile, puis le pied fixe (au-dessus de la barre flottante du site) ;
   * sur ordinateur (OR3, gabarit B), le pied devient le dernier bloc de la colonne.
   * @param {import('react').ReactNode} contenu - Le contenu.
   * @param {import('react').ReactNode} [pied] - Les boutons du bas.
   * @returns {import('react').ReactElement} La page.
   */
  const page = (contenu, pied = null) => (
    // `boundedHeight` : sur le SITE, l'écran prend la hauteur de la fenêtre, pas celle de son
    // contenu ; le pied reste en bas, au-dessus de la barre flottante (`dockClearance`).
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      boundedHeight
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          ...colonne, gap: 16, paddingBottom: 24, paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {contenu}
        {surOrdinateur && pied ? <View style={{ gap: 8 }}>{pied}</View> : null}
      </ScrollView>
      {pied && !surOrdinateur ? (
        <View
          style={{
            ...colonne,
            gap: 8,
            paddingBottom: Platform.OS === 'web' ? dockClearance : 0,
            paddingTop: 12,
          }}
        >
          {pied}
        </View>
      ) : null}
    </ScreenContainer>
  );

  /**
   * Un rond teinté et son icône (planche EP14 : `picto-rond`).
   * @param {string} couleur - La teinte.
   * @param {any} source - L'icône.
   * @returns {import('react').ReactElement} Le rond.
   */
  const picto = (couleur, source) => (
    <View
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          alignSelf: 'center',
          backgroundColor: withAlpha(couleur, 0.16),
          borderRadius: 28,
          height: 56,
          width: 56,
        },
      ]}
    >
      <Image source={source} style={{ height: 24, tintColor: couleur, width: 24 }} />
    </View>
  );

  /**
   * Un bandeau (planche EP14 : `bandeau-b`).
   * @param {string} couleur - La teinte.
   * @param {any} source - L'icône.
   * @param {string} texte - Le texte.
   * @param {boolean} [gras] - Texte en gras.
   * @returns {import('react').ReactElement} Le bandeau.
   */
  const bandeau = (couleur, source, texte, gras = false) => (
    <View
      style={[
        Alignments.row,
        {
          backgroundColor: withAlpha(couleur, 0.1),
          borderColor: withAlpha(couleur, 0.45),
          borderRadius: 16,
          borderWidth: 1,
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
      ]}
    >
      <Image
        source={source}
        style={{
          height: 16, marginTop: 3, tintColor: couleur, width: 16,
        }}
      />
      <Text style={[gras ? Fonts.p2Bold : Fonts.p2, Fonts.neutral00, { flex: 1 }]}>{texte}</Text>
    </View>
  );

  const lienVersLaFiche = (
    <TouchableOpacity
      accessibilityRole="link"
      onPress={versLaFiche}
      style={{ alignSelf: 'center', justifyContent: 'center', minHeight: 44 }}
    >
      <Text style={[Fonts.p2Bold, Fonts.primary200]}>
        {t('reserverTerrain.veille.voirMaReservation', 'Voir ma réservation')}
      </Text>
    </TouchableOpacity>
  );

  if (lecture?.isLoading && !reservation) {
    return page(
      <View style={{ gap: 12 }} testID="reserver-veille-squelette">
        {[56, 120].map((hauteur) => (
          <View
            accessibilityState={{ busy: true }}
            key={hauteur}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.06),
              borderRadius: 20,
              height: hauteur,
            }}
          />
        ))}
      </View>,
    );
  }
  if (!reservation) {
    const introuvable = !lecture?.error || varianteDEchec(lecture.error) === 'introuvable';
    return page(
      <View accessibilityRole="alert" style={carte}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {introuvable
            ? t('reserverTerrain.echec.introuvable', 'Cette réservation n’existe plus.')
            : t('reserverTerrain.maReservation.erreur', 'Impossible de charger ta réservation.')}
        </Text>
        {introuvable ? null : (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              onPress={() => lecture?.refetch?.()}
              title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          </View>
        )}
      </View>,
    );
  }

  // -------------------------------------------------------------------------------------------
  // Après la réponse
  // -------------------------------------------------------------------------------------------

  if (fin) {
    const confirme = fin === 'confirme';
    return page(
      <View style={{ gap: 12, paddingTop: 48 }}>
        {confirme
          ? picto(Colors.success500, Images.check)
          : picto(Colors.primary500, Images.calendar)}
        <Text
          accessibilityRole="header"
          style={[Fonts.h3Bold, Fonts.neutral00, { textAlign: 'center' }]}
        >
          {confirme
            ? t('reserverTerrain.veille.confirme', 'Merci, c’est confirmé.')
            : t('reserverTerrain.veille.annule', 'C’est annulé.')}
        </Text>
        {confirme ? null : (
          <Text style={[Fonts.p2, Fonts.neutral100, { textAlign: 'center' }]}>
            {t('reserverTerrain.veille.annuleTexte', 'Le créneau est libéré.')}
          </Text>
        )}
      </View>,
      lienVersLaFiche,
    );
  }

  if (etat === 'rienADemander') return null;

  if (etat === 'annuleeParLeComplexe') {
    return page(
      <View style={{ gap: 12, paddingTop: 48 }}>
        {picto(Colors.error500, Images.close)}
        <Text style={[Fonts.h4Bold, Fonts.neutral00, { textAlign: 'center' }]}>
          {t(
            'reserverTerrain.veille.annuleeParLeComplexe',
            'Cette réservation a été annulée par le complexe.',
          )}
        </Text>
      </View>,
    );
  }

  // -------------------------------------------------------------------------------------------
  // La question, ou ce qui y a déjà répondu
  // -------------------------------------------------------------------------------------------

  const titre = (
    <Text accessibilityRole="header" style={[Fonts.h1Black, Fonts.neutral00]}>
      {t('reserverTerrain.veille.titre', 'Demain, tu joues ?')}
    </Text>
  );
  const carteDeLaReservation = (
    <View style={carte}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('reserverTerrain.recapitulatif.quand', '{{jour}} · {{creneau}}', {
          creneau: texteCreneau(reservation.from, reservation.to),
          jour: texteJourCourt(t, reservation.date),
          ...SANS_ECHAPPEMENT,
        })}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {[reservation?.complexe?.name, reservation?.terrain?.name].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );

  if (etat === 'dejaConfirmee' || etat === 'dejaAnnulee' || etat === 'tropTard') {
    let message;
    if (etat === 'dejaConfirmee') {
      const heure = momentLisible(reservation.dayBeforeConfirmedAt)?.heure || '';
      message = bandeau(Colors.success500, Images.check, t(
        'reserverTerrain.veille.dejaConfirmee',
        'Tu as confirmé à {{heure}}.',
        { heure, ...SANS_ECHAPPEMENT },
      ), true);
    } else if (etat === 'dejaAnnulee') {
      message = bandeau(Colors.primary500, Images.calendar, t(
        'reserverTerrain.veille.dejaAnnulee',
        'Tu as déjà annulé cette réservation.',
      ));
    } else {
      message = (
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('reserverTerrain.veille.tropTard', 'Trop tard pour confirmer.')}
        </Text>
      );
    }
    return page(
      <>
        {titre}
        {carteDeLaReservation}
        {message}
      </>,
      lienVersLaFiche,
    );
  }

  const quand = estDemain(reservation.date)
    // RESA-FIN-APP (22/10) — l'heure en un seul mot : « demain 17 / h » sur Android 16 (tournée des
    // notifications) ; même parade que les autres textes gras (`texteInsecable`).
    ? t('reserverTerrain.veille.annulerQuestion', 'Annuler ta réservation de demain {{heure}} ?', {
      heure: texteInsecable(texteHeure(reservation.from)),
      ...SANS_ECHAPPEMENT,
    })
    : t('reserverTerrain.maReservation.annulerQuestion', 'Annuler ta réservation du {{quand}} ?', {
      quand: t('reserverTerrain.maReservation.jourAHeure', '{{jour}} à {{heure}}', {
        heure: texteInsecable(texteHeure(reservation.from)),
        jour: texteJourCourt(t, reservation.date),
        ...SANS_ECHAPPEMENT,
      }),
      ...SANS_ECHAPPEMENT,
    });
  const envoiEnCours = Boolean(repondre?.isPending);

  return (
    <>
      {page(
        <>
          {titre}
          {carteDeLaReservation}
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'reserverTerrain.veille.aide',
              'Si tu annules, le créneau est libéré tout de suite.',
            )}
          </Text>
          {annulationHorsDelai(reservation) ? bandeau(Colors.warning500, Images.clock, t(
            'reserverTerrain.veille.horsDelai',
            'Le délai d’annulation est passé : le complexe sera prévenu d’une annulation tardive.',
          )) : null}
          {echec ? (
            <View accessibilityRole="alert" style={{ ...carte, gap: 12 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('reserverTerrain.veille.pasPartie', 'La réponse n’est pas partie.')}
              </Text>
              <View style={{ alignSelf: 'flex-start' }}>
                <Button
                  isLoading={envoiEnCours}
                  onPress={() => {
                    if (derniere) envoyer(derniere);
                  }}
                  size="sm"
                  title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
                  variant="Secondary"
                />
              </View>
            </View>
          ) : null}
        </>,
        <>
          <Button
            disabled={envoiEnCours}
            isLoading={envoiEnCours && derniere === 'confirme'}
            onPress={() => envoyer('confirme')}
            title={t('reserverTerrain.veille.jeConfirme', 'Je confirme')}
            variant="Primary"
          />
          <Button
            disabled={envoiEnCours}
            onPress={() => setConfirmation(true)}
            title={t('reserverTerrain.veille.jAnnule', 'J’annule')}
            variant="Secondary"
          />
          {lienVersLaFiche}
        </>,
      )}
      <BottomModal
        close={() => setConfirmation(false)}
        isVisible={confirmation}
        webPresentation="dialog"
      >
        <View style={{ gap: 12 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{quand}</Text>
          <Button
            isLoading={envoiEnCours && derniere === 'annule'}
            onPress={() => envoyer('annule')}
            title={t('reserverTerrain.maReservation.ouiAnnuler', 'Oui, annuler')}
            variant="Danger"
          />
          <Button
            onPress={() => setConfirmation(false)}
            title={t('reserverTerrain.maReservation.garder', 'Garder')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
    </>
  );
}

export default ReserverVeille;
