import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  expireDans,
  historiqueLisible,
  initialesDe,
  messageDeRefusResa,
  nomCourt,
  plageHoraire,
  STATUTS,
  telephoneLisible,
  titreDuJour,
} from '@/domains/complexe/complexeReservation';
import { formatEuros } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import FeuilleMotif from '@/views/complexe/components/FeuilleMotif';
import PastillesReservation from '@/views/complexe/components/PastillesReservation';

import {
  useAnnulerReservation,
  useDeciderDemande,
  useModifierExterieur,
  useReservationGeree,
} from '@/services/complexe/complexeQueries';

import { getServerErrorCode } from '@/utils/errors/displayError';

/**
 * E-G05 — LA FICHE D'UNE RÉSERVATION, CÔTÉ GÉRANT — RESA-L5A2 (14/10/2026), planche EG05 : l'écran
 * `ComplexeReservation` sur téléphone, le volet droit de E-G04 et de E-G06 sur ordinateur (OR1).
 * Dans l'ordre : l'en-tête (pastilles d'état et de source), « Quand, où » (jour, heure, terrain,
 * sport, joueurs, prix indicatif « à régler sur place », petit mot, échéance d'une demande, motif),
 * « Qui » (nom, réservations ici, téléphone SEULEMENT s'il est accordé — D7 ; « Au nom de » pour
 * une note extérieure), « Historique », puis le pied selon l'état et la source :
 *   · en attente : Refuser (motif obligatoire) · Accepter ; créneau pris entre-temps (409) : « Ce
 *     créneau vient d'être pris. », seulement « Refuser avec un mot » ;
 *   · confirmée, à venir, de l'app : « Annuler la réservation » (motif obligatoire, N-18) ;
 *   · confirmée, à venir, extérieure : « Modifier le nom » · « Supprimer » (le créneau se libère).
 * Pas encore servi (dit dans le compte rendu du lot) : « 0 non honorée », « Marquer non honorée »
 * et « Annuler le marquage » (lot L5b, après RESA-L2B) ; « Participants · 8/10 » (lot L3) ;
 * « Écrire au réserveur » (conversation de la réservation, lot L3) ; « Récompense disponible » et
 * « Valider la partie offerte » (fidélité, lot L4) ; la fiche client E-G15 (lot L5b).
 * @param {object} props - Les propriétés.
 * @param {string | null} props.complexeId - Le complexe.
 * @param {(fiche: any) => void} [props.onVoirPlanning] - « Voir dans le planning ».
 * @param {string} props.reservationId - La réservation.
 * @returns {import('react').ReactElement} La fiche.
 */
function FicheReservation({ complexeId, onVoirPlanning = undefined, reservationId }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const lecture = useReservationGeree(complexeId, reservationId);
  const decider = useDeciderDemande();
  const annuler = useAnnulerReservation();
  const modifier = useModifierExterieur();
  /** @typedef {'' | 'annuler' | 'nom' | 'refuser' | 'supprimer'} FeuilleDeLaFiche */
  const [feuille, setFeuille] = useState(/** @type {FeuilleDeLaFiche} */ (''));
  const [erreurFeuille, setErreurFeuille] = useState('');
  const [conflit, setConflit] = useState('');
  const [message, setMessage] = useState('');
  const [nom, setNom] = useState('');

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };
  const legende = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>{texte}</Text>
  );

  if (lecture.isLoading) {
    return (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="fiche-squelette">
        {[96, 132, 96].map((hauteur, index) => (
          <View
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: hauteur },
            ]}
          />
        ))}
      </View>
    );
  }

  const r = lecture.data;
  if (!r) {
    const disparue = getServerErrorCode(lecture.error) === 'COMPLEXE_RESERVATION_NOT_FOUND';
    return (
      <View
        accessibilityRole="alert"
        style={[carte, Spaces.padding[24], Alignments.alignCenter, { gap: 12 }]}
      >
        <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
          {disparue
            ? t('complexeReservations.refus.introuvable', 'Cette réservation n’existe plus.')
            : t('complexeReservations.fiche.erreur', 'Impossible de charger la réservation.')}
        </Text>
        {disparue ? null : (
          <Button
            onPress={() => lecture.refetch?.()}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        )}
      </View>
    );
  }

  const exterieur = r.source === 'exterieur';
  const reserveur = exterieur ? String(r.externalName || '') : nomCourt(r.booker);
  const aVenir = new Date(r.startsAt).getTime() > Date.now();
  const enAttente = r.status === STATUTS.enAttente;
  const confirmeeAVenir = r.status === STATUTS.confirmee && aVenir;
  const repli = t('complexeReservations.fiche.erreurGeste', 'Le geste n’a pas pu être fait.');
  const options = { nom: reserveur, ...SANS_ECHAPPEMENT };

  const fermerLaFeuille = () => {
    setErreurFeuille('');
    setFeuille('');
  };
  const ouvrir = (/** @type {'annuler' | 'nom' | 'refuser' | 'supprimer'} */ quoi) => {
    setErreurFeuille('');
    setMessage('');
    if (quoi === 'nom') setNom(String(r.externalName || ''));
    setFeuille(quoi);
  };
  /**
   * Un geste depuis une feuille : la feuille se ferme et le message s'affiche ; un refus reste
   * dans la feuille.
   * @param {() => Promise<any>} geste - Le geste.
   * @param {string} reussite - Le message.
   * @returns {Promise<void>} Fini.
   */
  const depuisLaFeuille = async (geste, reussite) => {
    setErreurFeuille('');
    try {
      await geste();
      setFeuille('');
      setMessage(reussite);
    } catch (erreur) {
      setErreurFeuille(messageDeRefusResa(t, erreur, repli));
    }
  };

  const accepter = async () => {
    setMessage('');
    try {
      await decider.mutateAsync({ complexeId, decision: 'accepter', reservationId });
      setMessage(t(
        'complexeReservations.demandes.acceptee',
        'Demande acceptée. {{nom}} est prévenu.',
        options,
      ));
    } catch (erreur) {
      setConflit(messageDeRefusResa(t, erreur, repli));
    }
  };

  // ── Le prix indicatif (D4) ─────────────────────────────────────────────────────────────
  let prix = '';
  if (r.price?.amount !== null && r.price?.amount !== undefined) {
    prix = r.price.unit === 'joueur'
      ? t('complexeReservations.fiche.prixJoueur', '{{montant}} par joueur, à régler sur place', {
        montant: formatEuros(r.price.amount), ...SANS_ECHAPPEMENT,
      })
      : t('complexeReservations.fiche.prixCreneau', '{{montant}}, à régler sur place', {
        montant: formatEuros(r.price.amount), ...SANS_ECHAPPEMENT,
      });
  }
  const ligneTerrain = [
    String(r.terrain?.name || ''),
    String(r.terrain?.sport?.name || ''),
    r.players ? t('complexeReservations.fiche.joueurs', '{{nombre}} joueurs', {
      nombre: r.players, ...SANS_ECHAPPEMENT,
    }) : '',
  ].filter(Boolean).join(' · ');
  const echeance = enAttente ? expireDans(t, r.expiresAt) : '';
  const historique = historiqueLisible(t, r.history, { reserveur });

  // ── « Qui » ────────────────────────────────────────────────────────────────────────────
  const qui = exterieur ? (
    <View style={[carte, Spaces.padding[16], { gap: 8 }]}>
      {legende(t('complexeReservations.fiche.qui', 'Qui'))}
      <Text style={[Fonts.p2, Fonts.neutral00]}>
        {t('complexeReservations.fiche.auNomDe', 'Au nom de : {{nom}}', options)}
      </Text>
    </View>
  ) : (
    <View style={[carte, Spaces.padding[16], { gap: 12 }]}>
      {legende(t('complexeReservations.fiche.qui', 'Qui'))}
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: Colors.primary700, borderRadius: 999, height: 44, width: 44,
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{initialesDe(r.booker)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {[r.booker?.firstname, r.booker?.lastname].filter(Boolean).join(' ')}
          </Text>
          {Number.isFinite(r.booker?.bookingsHere) ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('complexeReservations.fiche.reservationsIci', '{{count}} réservations ici', {
                count: r.booker.bookingsHere,
                defaultValue_one: '{{count}} réservation ici',
                defaultValue_other: '{{count}} réservations ici',
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
        </View>
      </View>
      {r.booker?.phone ? (
        <View
          style={[
            Alignments.row, Alignments.alignCenter, { gap: 12, justifyContent: 'space-between' },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{telephoneLisible(r.booker.phone)}</Text>
          <Button
            onPress={() => {
              Promise.resolve(Linking.openURL(`tel:${r.booker.phone}`)).catch(() => {});
            }}
            size="sm"
            title={t('complexeReservations.fiche.appeler', 'Appeler')}
            variant="Secondary"
          />
        </View>
      ) : (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('complexeReservations.fiche.numeroNonPartage', 'Numéro non partagé')}
        </Text>
      )}
    </View>
  );

  // ── Le pied, selon l'état et la source ─────────────────────────────────────────────────
  let pied = null;
  if (enAttente) {
    pied = (
      <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
        <View style={{ flexBasis: 140, flexGrow: 1 }} testID="fiche-refuser">
          <Button
            onPress={() => ouvrir('refuser')}
            title={conflit
              ? t('complexeReservations.demandes.refuserAvecUnMot', 'Refuser avec un mot')
              : t('complexeReservations.demandes.refuser', 'Refuser')}
            variant="Secondary"
          />
        </View>
        {conflit ? null : (
          <View style={{ flexBasis: 140, flexGrow: 1 }} testID="fiche-accepter">
            <Button
              isLoading={Boolean(decider.isPending)}
              onPress={accepter}
              title={t('complexeReservations.demandes.accepter', 'Accepter')}
            />
          </View>
        )}
      </View>
    );
  } else if (confirmeeAVenir && exterieur) {
    pied = (
      <View style={{ gap: 8 }}>
        <View testID="fiche-modifier-nom">
          <Button
            onPress={() => ouvrir('nom')}
            title={t('complexeReservations.fiche.modifierNom', 'Modifier le nom')}
            variant="Secondary"
          />
        </View>
        <View testID="fiche-supprimer">
          <Button
            onPress={() => ouvrir('supprimer')}
            title={t('complexeReservations.fiche.supprimer', 'Supprimer')}
            variant="Danger"
          />
        </View>
      </View>
    );
  } else if (confirmeeAVenir) {
    pied = (
      <View testID="fiche-annuler">
        <Button
          onPress={() => ouvrir('annuler')}
          title={t('complexeReservations.fiche.annulerLaReservation', 'Annuler la réservation')}
          variant="Danger"
        />
      </View>
    );
  }

  return (
    <View style={[Alignments.fill, { gap: 12 }]}>
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 8 }}>
          <Text
            accessibilityRole="header"
            style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
          >
            {t('complexeReservations.fiche.titre', 'Réservation').toUpperCase()}
          </Text>
          <PastillesReservation
            sansEtat={exterieur && r.status === STATUTS.confirmee}
            source={r.source}
            statut={r.status}
          />
        </View>
        {message ? <BandeauComplexe texte={message} ton="ok" /> : null}
        {conflit ? <BandeauComplexe texte={conflit} ton="erreur" /> : null}
        <View style={[carte, Spaces.padding[16], { gap: 6 }]}>
          {legende(t('complexeReservations.fiche.quandOu', 'Quand, où'))}
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {`${titreDuJour(r.date)} · ${plageHoraire(r.from, r.to)}`}
          </Text>
          {ligneTerrain ? <Text style={[Fonts.p2, Fonts.neutral100]}>{ligneTerrain}</Text> : null}
          {prix ? <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{prix}</Text> : null}
          {r.note ? (
            <Text style={[Fonts.p2, Fonts.neutral100, { fontStyle: 'italic' }]}>
              {`« ${r.note} »`}
            </Text>
          ) : null}
          {echeance ? (
            <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>{echeance}</Text>
          ) : null}
          {r.reason ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('complexeReservations.fiche.motif', 'Motif : {{motif}}', {
                motif: String(r.reason), ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
        </View>
        {qui}
        {historique.length ? (
          <View style={{ gap: 6 }}>
            {legende(t('complexeReservations.fiche.historique', 'Historique'))}
            <View
              style={{
                borderLeftColor: withAlpha(Colors.primary500, 0.35),
                borderLeftWidth: 2,
                gap: 4,
                paddingLeft: 12,
              }}
            >
              {historique.map((ligne) => (
                <Text key={ligne} style={[Fonts.p3, Fonts.neutral100]}>{ligne}</Text>
              ))}
            </View>
          </View>
        ) : null}
        {onVoirPlanning ? (
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => onVoirPlanning(r)}
            style={[Alignments.justifyCenter, { alignSelf: 'flex-start', minHeight: 44 }]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t('complexeReservations.fiche.voirPlanning', 'Voir dans le planning')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      {pied}

      <FeuilleMotif
        enCours={Boolean(decider.isPending)}
        erreur={erreurFeuille}
        libelleChamp={t(
          'complexeReservations.demandes.motif',
          'Le motif, que {{nom}} lira',
          options,
        )}
        libelleConfirmer={t('complexeReservations.demandes.refuser', 'Refuser')}
        motifs
        obligatoire
        onConfirmer={(motif) => depuisLaFeuille(
          () => decider.mutateAsync({
            complexeId, decision: 'refuser', reason: motif, reservationId,
          }),
          t(
            'complexeReservations.demandes.refusee',
            'Demande refusée. {{nom}} est prévenu.',
            options,
          ),
        )}
        onFermer={fermerLaFeuille}
        sousTitre={`${titreDuJour(r.date)} · ${plageHoraire(r.from, r.to)}`}
        titre={t(
          'complexeReservations.demandes.refuserLaDemande',
          'Refuser la demande de {{nom}}',
          options,
        )}
        visible={feuille === 'refuser'}
      />
      <FeuilleMotif
        enCours={Boolean(annuler.isPending)}
        erreur={erreurFeuille}
        libelleChamp={t(
          'complexeReservations.fiche.motifAnnulation',
          'Motif, que {{nom}} lira',
          options,
        )}
        libelleConfirmer={t(
          'complexeReservations.fiche.annulerLaReservation',
          'Annuler la réservation',
        )}
        libelleGarder={t('complexeReservations.fiche.garder', 'Garder')}
        obligatoire
        onConfirmer={(motif) => depuisLaFeuille(
          () => annuler.mutateAsync({ complexeId, motif, reservationId }),
          t(
            'complexeReservations.fiche.annulee',
            'Réservation annulée. {{nom}} est prévenu.',
            options,
          ),
        )}
        onFermer={fermerLaFeuille}
        sousTitre={t('complexeReservations.fiche.seraPrevenu', '{{nom}} sera prévenu.', options)}
        titre={t(
          'complexeReservations.fiche.annulerLaReservationDe',
          'Annuler la réservation de {{nom}} ?',
          options,
        )}
        visible={feuille === 'annuler'}
      />
      <BottomModal close={fermerLaFeuille} isVisible={feuille === 'nom'} webPresentation="dialog">
        <View style={{ gap: 16 }}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('complexeReservations.fiche.modifierNom', 'Modifier le nom')}
          </Text>
          <Input
            label={t('complexeReservations.fiche.auNomDeChamp', 'Au nom de')}
            onChangeText={setNom}
            value={nom}
          />
          {erreurFeuille ? (
            <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>
              {erreurFeuille}
            </Text>
          ) : null}
          <View testID="fiche-enregistrer-nom">
            <Button
              disabled={nom.trim().length < 2}
              isLoading={Boolean(modifier.isPending)}
              onPress={() => depuisLaFeuille(
                () => modifier.mutateAsync({ complexeId, nom: nom.trim(), reservationId }),
                t('complexeReservations.fiche.nomModifie', 'Nom modifié.'),
              )}
              title={t('complexeReservations.fiche.enregistrer', 'Enregistrer')}
            />
          </View>
          <Button
            onPress={fermerLaFeuille}
            title={t('complexeReservations.feuille.annuler', 'Annuler')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
      <BottomModal
        close={fermerLaFeuille}
        isVisible={feuille === 'supprimer'}
        webPresentation="dialog"
      >
        <View style={{ gap: 16 }}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t(
              'complexeReservations.fiche.supprimerQuestion',
              'Supprimer la réservation de {{nom}} ?',
              options,
            )}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('complexeReservations.fiche.supprimerDit', 'Le créneau redevient libre.')}
          </Text>
          {erreurFeuille ? (
            <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>
              {erreurFeuille}
            </Text>
          ) : null}
          <View testID="fiche-confirmer-suppression">
            <Button
              isLoading={Boolean(annuler.isPending)}
              onPress={() => depuisLaFeuille(
                () => annuler.mutateAsync({ complexeId, motif: null, reservationId }),
                t(
                  'complexeReservations.fiche.supprimee',
                  'Réservation supprimée : le créneau est libre.',
                ),
              )}
              title={t('complexeReservations.fiche.supprimer', 'Supprimer')}
              variant="DangerFilled"
            />
          </View>
          <Button
            onPress={fermerLaFeuille}
            title={t('complexeReservations.fiche.garder', 'Garder')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
    </View>
  );
}

export default FicheReservation;
