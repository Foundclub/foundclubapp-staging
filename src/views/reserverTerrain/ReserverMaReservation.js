import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { formatEuros } from '@/domains/complexe/complexeTerrain';
import {
  contenuDEchec,
  etatAffiche,
  lienAgendaGoogle,
  momentLisible,
  numeroLisible,
  parametresDEchec,
  texteCreneau,
  texteJourLong,
  varianteDEchec,
  varianteDeLaReservation,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BlocDEchec from '@/views/reserverTerrain/components/BlocDEchec';
import PastilleEtat from '@/views/reserverTerrain/components/PastilleEtat';

import { RouteNames } from '@/navigation/routeNames';

import {
  useAnnulerMaReservation,
  useComplexePublic,
  useMaReservation,
} from '@/services/complexe/complexeJoueurQueries';

import { openExternalMap } from '@/platform/maps/externalMap';
import { useIsDesktop } from '@/responsive';

const COLONNE = 640;

/**
 * E-P07 — « LA FICHE DE MA RÉSERVATION » — RESA-L6A (14/10/2026), planches EP07 et OR3, plan E-P07.
 * Pour le réserveur, dans l'ordre de la fiche :
 *   1. l'en-tête « MA RÉSERVATION » et la pastille d'état (P00 bloc 4) ; refusée, sans réponse,
 *      annulée ou fermeture : l'en-tête d'échec (E-P13) et plus d'actions sur la réservation ;
 *   2. « Quand, où » : le jour et les heures, le complexe et le terrain (⇒ E-P02), le prix
 *      indicatif (D4), « Itinéraire » (l'adresse publique du complexe) et « Ajouter à l'agenda » ;
 *   3. annuler : dans le délai FIGÉ (« Gratuit jusqu'au 15/10 à 18 h. ») avec une confirmation ;
 *      une demande en attente se retire toujours (AT-08) ; après le délai, « Le délai est passé :
 *      appelle le complexe » et son numéro (RC-P07) ; jouée : « Réserver à nouveau » ;
 *   4. l'historique (la réservation, le petit mot).
 * Annulée ⇒ E-P13 « annulée par toi » à la place de cet écran.
 * Paramètres : `reservationId` ; `change` et `fermeture` (la notification qui l'a ouverte).
 * Ordinateur (OR3) : la colonne centrée (participants, à droite, viendront avec L6b).
 * ⛔ Pas dans ce lot : participants et présences, « Inviter par lien », « Il me manque des
 * joueurs », « Discussion du groupe », « Écrire au complexe », fidélité, collecte (serveurs
 * L3 / L4, puis L6b). Caché par `COMPLEXES_JOUEUR`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverMaReservation() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @type {{ change?: string, fermeture?: string, reservationId?: string }} */
  const params = /** @type {any} */ (route?.params) || {};
  const surOrdinateur = useIsDesktop();
  const lecture = useMaReservation(params.reservationId);
  const annuler = useAnnulerMaReservation();
  const reservation = lecture?.data || null;
  const complexePublic = useComplexePublic(reservation?.complexe?.slug)?.data;
  const [confirmation, setConfirmation] = useState(false);
  const [refusTropTard, setRefusTropTard] = useState(/** @type {any} */ (null));
  const [bandeau, setBandeau] = useState(/** @type {string | null} */ (null));

  const carte = {
    backgroundColor: withAlpha(Colors.primary800, 0.6),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  };
  const enveloppe = (/** @type {import('react').ReactNode} */ contenu) => (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );

  if (lecture?.isLoading && !reservation) {
    return enveloppe(
      <View style={{ gap: 12 }} testID="reserver-ma-reservation-squelette">
        {[140, 120, 80].map((hauteur) => (
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
  if (lecture?.error && !reservation) {
    const introuvable = varianteDEchec(lecture.error) === 'introuvable';
    return enveloppe(
      <View accessibilityRole="alert" style={carte}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {introuvable
            ? t('reserverTerrain.echec.introuvable', 'Cette réservation n’existe plus.')
            : t('reserverTerrain.maReservation.erreur', 'Impossible de charger ta réservation.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          {introuvable ? (
            <Button
              onPress={() => navigation.popToTop?.()}
              title={t('reserverTerrain.resultat.retourAccueil', 'Retour à l’accueil')}
              variant="Secondary"
            />
          ) : (
            <Button
              onPress={() => lecture.refetch?.()}
              title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          )}
        </View>
      </View>,
    );
  }
  if (!reservation) {
    return enveloppe(
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('reserverTerrain.echec.introuvable', 'Cette réservation n’existe plus.')}
      </Text>,
    );
  }

  const nomDuComplexe = String(reservation?.complexe?.name || '');
  const slug = reservation?.complexe?.slug || null;
  const terrainId = reservation?.terrain?.documentId || null;
  const telephone = String(reservation?.complexe?.phoneNumber || '').trim();
  const etat = etatAffiche(reservation);
  const varianteDEnTete = varianteDeLaReservation(reservation, { change: params.change });
  const demande = etat === 'enAttente';
  const debut = momentLisible(reservation.startsAt);
  const jusquA = momentLisible(reservation.cancellableUntil);
  const echeance = momentLisible(reservation.expiresAt);
  const creation = momentLisible(reservation.createdAt);
  const commence = new Date(String(reservation.startsAt)).getTime() <= Date.now();
  const adresse = complexePublic?.address?.label ? String(complexePublic.address.label) : '';

  const versLeCalendrier = () => navigation.navigate(RouteNames.ReserverCreneau, {
    slug,
    terrainId,
  });
  const appeler = (/** @type {string} */ numero) => {
    if (numero) Linking.openURL(`tel:${numero}`).catch(() => {});
  };
  const confirmerLAnnulation = async () => {
    setBandeau(null);
    try {
      await annuler.mutateAsync(reservation.documentId);
      setConfirmation(false);
      navigation.replace(
        RouteNames.ReserverEchec,
        parametresDEchec({
          complexe: nomDuComplexe,
          creneau: { from: reservation.from, to: reservation.to },
          date: reservation.date,
          slug,
          telephone,
          terrain: reservation.terrain,
          variante: 'annuleeParToi',
        }),
      );
    } catch (erreur) {
      setConfirmation(false);
      const variante = varianteDEchec(erreur);
      if (variante === 'delaiAnnulation') {
        setRefusTropTard(contenuDEchec(t, variante, { erreur, telephone }));
        return;
      }
      setBandeau(contenuDEchec(t, variante, { erreur }).titre);
    }
  };

  // -------------------------------------------------------------------------------------------
  // Les blocs
  // -------------------------------------------------------------------------------------------

  const enTete = (
    <View style={{ gap: 8 }}>
      <Text
        accessibilityRole="header"
        style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
      >
        {t('reserverTerrain.maReservation.titre', 'Ma réservation').toUpperCase()}
      </Text>
      <PastilleEtat etat={etat} />
    </View>
  );

  const enTeteDEchec = varianteDEnTete ? (
    <View style={carte}>
      <BlocDEchec
        contenu={contenuDEchec(t, varianteDEnTete, {
          complexe: nomDuComplexe,
          fermeture: params.fermeture,
          motif: reservation.reason,
          telephone,
        })}
        onAction={(action) => {
          if (action === 'appeler') appeler(telephone);
          else versLeCalendrier();
        }}
      />
    </View>
  ) : null;

  const prix = Number.isFinite(Number(reservation?.price?.amount))
    ? t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
      prix: formatEuros(Number(reservation.price.amount)),
      ...SANS_ECHAPPEMENT,
    })
    : '';
  const lienAgenda = lienAgendaGoogle({
    debut: reservation.startsAt,
    details: t(
      'reserverTerrain.maReservation.agendaDetails',
      'Réservé sur FoundClub. Paiement sur place.',
    ),
    fin: reservation.endsAt,
    lieu: adresse,
    titre: `${String(reservation?.terrain?.name || '')} · ${nomDuComplexe}`,
  });

  const quandOu = (
    <View style={carte}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('reserverTerrain.recapitulatif.quand', '{{jour}} · {{creneau}}', {
          creneau: texteCreneau(reservation.from, reservation.to),
          jour: texteJourLong(t, reservation.date),
          ...SANS_ECHAPPEMENT,
        })}
      </Text>
      <TouchableOpacity
        accessibilityRole="link"
        disabled={!slug}
        onPress={() => navigation.navigate(RouteNames.ReserverComplexe, { slug })}
        style={{ justifyContent: 'center', minHeight: 44 }}
      >
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>
          {[nomDuComplexe, reservation?.terrain?.name].filter(Boolean).join(' · ')}
        </Text>
      </TouchableOpacity>
      {prix ? <Text style={[Fonts.p2, Fonts.neutral100]}>{prix}</Text> : null}
      {!varianteDEnTete ? (
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {adresse ? (
            <Button
              icon="pin"
              onPress={() => openExternalMap({
                label: adresse,
                latitude: complexePublic?.address?.lat,
                longitude: complexePublic?.address?.lng,
              })}
              size="sm"
              title={t('reserverTerrain.complexe.itineraire', 'Itinéraire')}
              variant="Secondary"
            />
          ) : null}
          {lienAgenda && !commence ? (
            <Button
              icon="calendar"
              onPress={() => {
                Linking.openURL(lienAgenda).catch(() => {});
              }}
              size="sm"
              title={t('reserverTerrain.maReservation.agenda', 'Ajouter à l’agenda')}
              variant="Secondary"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  let annulation = null;
  if (!varianteDEnTete && demande && !commence) {
    annulation = (
      <View style={carte}>
        {echeance ? (
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'reserverTerrain.resultat.demandeEcheance',
              '{{complexe}} te répond avant le {{date}} à {{heure}}. '
                + 'Le créneau t’est gardé jusque-là.',
              {
                complexe: nomDuComplexe,
                date: echeance.jour,
                heure: echeance.heure,
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
        ) : null}
        <Button
          onPress={() => setConfirmation(true)}
          title={t('reserverTerrain.maReservation.annulerLaDemande', 'Annuler la demande')}
          variant="Danger"
        />
      </View>
    );
  } else if (!varianteDEnTete && etat === 'confirmee' && reservation.canCancel && !refusTropTard) {
    annulation = (
      <View style={carte}>
        <Button
          onPress={() => setConfirmation(true)}
          title={t('reserverTerrain.maReservation.annuler', 'Annuler la réservation')}
          variant="Danger"
        />
        {jusquA ? (
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t(
              'reserverTerrain.maReservation.gratuitJusqua',
              'Gratuit jusqu’au {{jour}} à {{heure}}.',
              {
                heure: jusquA.heure,
                jour: jusquA.jour,
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
        ) : null}
      </View>
    );
  } else if (!varianteDEnTete && etat === 'confirmee' && !commence) {
    const contenu = refusTropTard || contenuDEchec(t, 'delaiAnnulation', { telephone });
    annulation = (
      <View style={carte}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{contenu.titre}</Text>
        {contenu.telephone ? (
          <Button
            icon="phone"
            onPress={() => appeler(contenu.telephone)}
            title={t('reserverTerrain.telephone.appeler', 'Appeler le {{numero}}', {
              numero: numeroLisible(contenu.telephone),
              ...SANS_ECHAPPEMENT,
            })}
            variant="Primary"
          />
        ) : null}
      </View>
    );
  } else if (etat === 'jouee') {
    annulation = (
      <Button
        onPress={versLeCalendrier}
        title={t('reserverTerrain.maReservation.reserverANouveau', 'Réserver à nouveau')}
        variant="Primary"
      />
    );
  }

  const historique = creation || reservation.note ? (
    <View style={{ gap: 4 }}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('reserverTerrain.maReservation.historique', 'Historique')}
      </Text>
      {creation ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('reserverTerrain.maReservation.reservee', 'Réservée le {{jour}} à {{heure}}', {
            heure: creation.heure,
            jour: creation.jour,
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
      {reservation.note ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('reserverTerrain.maReservation.petitMot', 'Ton petit mot : « {{mot}} »', {
            mot: String(reservation.note),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
    </View>
  ) : null;

  const quand = debut
    ? t('reserverTerrain.maReservation.jourAHeure', '{{jour}} à {{heure}}', {
      heure: debut.heure,
      jour: debut.jour,
      ...SANS_ECHAPPEMENT,
    })
    : '';
  return (
    <>
      {enveloppe(
        <>
          {enTete}
          {enTeteDEchec}
          {quandOu}
          {bandeau ? (
            <View
              accessibilityRole="alert"
              style={{
                ...carte,
                backgroundColor: withAlpha(Colors.error500, 0.1),
                borderColor: withAlpha(Colors.error500, 0.45),
              }}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{bandeau}</Text>
            </View>
          ) : null}
          {annulation}
          {historique}
        </>,
      )}
      <BottomModal
        close={() => setConfirmation(false)}
        isVisible={confirmation}
        webPresentation="dialog"
      >
        <View style={{ gap: 12 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {demande
              ? t(
                'reserverTerrain.maReservation.retirerQuestion',
                'Retirer ta demande du {{quand}} ?',
                {
                  quand,
                  ...SANS_ECHAPPEMENT,
                },
              )
              : t(
                'reserverTerrain.maReservation.annulerQuestion',
                'Annuler ta réservation du {{quand}} ?',
                {
                  quand,
                  ...SANS_ECHAPPEMENT,
                },
              )}
          </Text>
          {!demande && jusquA ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'reserverTerrain.maReservation.annulerTexte',
                'Le complexe sera prévenu. C’est gratuit jusqu’au {{jour}} à {{heure}}.',
                { heure: jusquA.heure, jour: jusquA.jour, ...SANS_ECHAPPEMENT },
              )}
            </Text>
          ) : null}
          <Button
            isLoading={Boolean(annuler?.isPending)}
            onPress={confirmerLAnnulation}
            title={
              demande
                ? t('reserverTerrain.maReservation.ouiRetirer', 'Oui, retirer')
                : t('reserverTerrain.maReservation.ouiAnnuler', 'Oui, annuler')
            }
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

export default ReserverMaReservation;
