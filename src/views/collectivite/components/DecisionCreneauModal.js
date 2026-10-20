import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  estDemandeHebdo,
  etatDeLaPlace,
  momentDeLaDemande,
  MOTIFS_DE_REFUS,
  prevenusDe,
} from '@/domains/collectivite/collectiviteDemandes';
import { MOTIFS_DE_REFUS_RATTACHEMENT } from '@/domains/collectivite/collectiviteRattachement';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import {
  useApproveFacilityOverrideRequest,
  useRefuseFacilityOverrideRequest,
} from '@/services/facility/facilityQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/** @typedef {{ kind: 'approve' | 'refuse', request: any }} Decision */

// Au-delà de cette largeur (ordinateur), la feuille devient une fenêtre centrée (P6-ordi, état 3).
const LARGEUR_FENETRE = 1024;
const PLACE_PRISE_ENTRE_TEMPS = 'FACILITY_OVERRIDE_CAPACITY_CHANGED';

/**
 * 🏛️ LA FENÊTRE « ACCEPTER / REFUSER » D'UNE DEMANDE DE CRÉNEAU, côté mairie.
 *
 * COLL-ACCUEIL (01/10) : sortie de « Demandes de la Ville » (lot 1c) pour que l'accueil de la
 * Ville tranche avec la MÊME fenêtre, les mêmes routes (lot 3a) et les mêmes textes.
 * COLL-C3B (02/10) — planche P6-fenetre : la feuille RAPPELLE la demande (club · équipe, qui
 * demande, où, quand, la conséquence) ; pour accepter, elle dit QUI SERA PRÉVENU (l'encadrant
 * qui demande et les clubs déjà là) ; pour refuser, TROIS MOTIFS EN UN APPUI remplissent le
 * champ, qu'on peut compléter, et le bouton rouge dit la conséquence (« Refuser et annuler
 * l'entraînement »). Une série se tranche d'un geste (`series: true` : contrat §10, elle devient
 * un créneau de saison). Si la place a été prise entre-temps (409), la fenêtre le dit et ne
 * propose plus que de refuser. Sur téléphone, une feuille du bas ; sur ordinateur, centrée.
 * COLL-C3B-BIS (03/10) — planche 33 : la feuille du téléphone a sa POIGNÉE (la glisser vers le bas,
 * ou l'appuyer, la ferme) ; « Demandé par Karim Benali, dirigeant » ; et une série s'accepte DATE
 * PAR DATE : chaque date en attente se coche, avec sa place ; une partie cochée envoie `dates`, et
 * le serveur refuse les autres (« Date non retenue »).
 * FINITIONS12-COLL (03/10) — `collectiviteId` : si la réponse se perd (délai dépassé, réseau),
 * la mutation relit la file de cette Ville avant de dire « Erreur » (tournée T11 : une décision
 * écrite affichée en erreur, fenêtre ouverte).
 * FINITIONS-VILLE (T20, 08/10) — `refusDeRattachement` : la MÊME fenêtre refuse une demande de
 * RATTACHEMENT d'un club (motifs fréquents du rattachement, motif obligatoire) ;
 * `onRefuse(motif)` l'envoie (le serveur le donne au club). Le rappel dit le club et `ligne`
 * (« Demande du club · … »).
 * @param {{ collectiviteId?: string | null, decision: Decision | null,
 *   onClose: () => void,
 *   refusDeRattachement?: { ligne: string, onRefuse: (motif: string) => Promise<any> } | null,
 * }} props - La Ville, la décision en cours (null : fenêtre fermée), sa fermeture, et le refus
 *   d'un rattachement.
 * @returns {import('react').ReactElement} La fenêtre.
 */
function DecisionCreneauModal({
  collectiviteId = null, decision, onClose, refusDeRattachement = null,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { width } = useWindowDimensions();
  const centree = width >= LARGEUR_FENETRE;
  const [message, setMessage] = useState('');
  const [saisieActive, setSaisieActive] = useState(false);
  const [erreur, setErreur] = useState('');
  const [placePrise, setPlacePrise] = useState(false);
  const [refusForce, setRefusForce] = useState(false);
  // COLL-C3B-BIS : les dates d'une série que la mairie a DÉCOCHÉES (toutes cochées à l'ouverture).
  const [decochees, setDecochees] = useState(/** @type {string[]} */ ([]));
  const approve = /** @type {any} */ (useApproveFacilityOverrideRequest());
  const refuse = /** @type {any} */ (useRefuseFacilityOverrideRequest());
  const [envoiRattachement, setEnvoiRattachement] = useState(false);
  const enCours = Boolean(approve.isPending || refuse.isPending || envoiRattachement);
  const contenuRef = useRef(/** @type {import('react-native').ScrollView | null} */ (null));
  const champActifRef = useRef(false);
  // FC-007 : après le redimensionnement par le clavier, remontrer le motif et
  // les actions. Aucun minuteur : la nouvelle mesure de la vue déclenche le défilement.
  const montrerMotif = () => {
    if (champActifRef.current) contenuRef.current?.scrollToEnd({ animated: true });
  };

  // Chaque ouverture repart d'une fenêtre vide.
  useEffect(() => {
    setMessage('');
    setSaisieActive(false);
    champActifRef.current = false;
    setErreur('');
    setPlacePrise(false);
    setRefusForce(false);
    setDecochees([]);
  }, [decision]);

  const demande = decision?.request;
  const serie = estDemandeHebdo(demande) && Boolean(demande?.series);
  const estRefus = decision?.kind === 'refuse' || refusForce || Boolean(refusDeRattachement);

  const fermer = () => {
    if (enCours) return;
    setErreur('');
    onClose();
  };
  // La poignée : glisser la feuille vers le bas la ferme (planche 33, « poignee »).
  const fermerRef = useRef(fermer);
  fermerRef.current = fermer;
  const glisser = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_evt, geste) => geste.dy > 8,
    onPanResponderRelease: (_evt, geste) => { if (geste.dy > 60) fermerRef.current(); },
  })).current;

  // Les dates d'une série, chacune avec sa place (serveur, `seriesDates`) : à cocher pour accepter.
  const datesDeLaSerie = !estRefus && serie && Array.isArray(demande?.seriesDates)
    && demande.seriesDates.length > 1
    ? demande.seriesDates
    : [];
  const cochees = datesDeLaSerie
    .map((/** @type {any} */ date) => String(date?.documentId || ''))
    .filter((/** @type {string} */ documentId) => documentId && !decochees.includes(documentId));
  const enPartie = datesDeLaSerie.length > 0 && cochees.length < datesDeLaSerie.length;
  const aucuneCochee = datesDeLaSerie.length > 0 && cochees.length === 0;
  const basculer = (/** @type {string} */ documentId) => {
    setDecochees((avant) => (avant.includes(documentId)
      ? avant.filter((id) => id !== documentId)
      : [...avant, documentId]));
  };

  const confirmer = async () => {
    if (!decision) return;
    if (aucuneCochee) return;
    const decisionReason = message.trim();
    if (estRefus && !decisionReason) {
      setErreur(t(
        'collectivite.requests.modal.reasonRequired',
        'Écrivez le motif : le club le lira.',
      ));
      return;
    }
    if (refusDeRattachement) {
      setEnvoiRattachement(true);
      try {
        await refusDeRattachement.onRefuse(decisionReason);
        onClose();
      } catch (error) {
        setErreur(getErrorMessage(/** @type {any} */ (error)));
      } finally {
        setEnvoiRattachement(false);
      }
      return;
    }
    const mutation = estRefus ? refuse : approve;
    try {
      await mutation.mutateAsync({
        collectiviteId,
        decisionReason,
        requestId: demande?.documentId,
        series: serie,
        ...(!estRefus && enPartie ? { dates: cochees } : {}),
      });
      onClose();
    } catch (error) {
      const code = /** @type {any} */ (error)?.details?.code
        || /** @type {any} */ (error)?.response?.data?.error?.details?.code;
      if (!estRefus && code === PLACE_PRISE_ENTRE_TEMPS) {
        // P6-fenetre, état 4 : la place est prise ; la demande ne peut plus qu'être refusée.
        setPlacePrise(true);
        setRefusForce(true);
        setErreur('');
        return;
      }
      setErreur(getErrorMessage(/** @type {any} */ (error)));
    }
  };

  // ─── Le rappel de la demande ─────────────────────────────────────────────────────────────
  const moment = momentDeLaDemande(demande);
  const place = etatDeLaPlace(demande?.conflict);
  const prevenus = prevenusDe(demande);
  // COLL-C3B-BIS (planche 33) : l'encadrant qui demande, AVEC sa fonction (décision « nom B »).
  let fonction = '';
  if (demande?.requesterFunction === 'manager') {
    fonction = t('collectiviteDemandes.fonction.manager', 'dirigeant');
  }
  if (demande?.requesterFunction === 'trainer') {
    fonction = t('collectiviteDemandes.fonction.trainer', 'coach / prof');
  }
  const demandeur = refusDeRattachement
    ? '' : [prevenus.personne, fonction].filter(Boolean).join(', ');
  const qui = [demande?.club?.name, demande?.team?.name].filter(Boolean).join(' · ');
  // eslint-disable-next-line max-len
  const ou = refusDeRattachement?.ligne || [demande?.facility?.name, moment?.jourCourt, moment ? `${moment.debut} – ${moment.fin}` : '']
    .filter(Boolean).join(' · ');
  const nombreDEquipes = (/** @type {number} */ nombre) => (nombre === 1
    ? t('collectiviteDemandes.nombre.uneEquipe', '1 équipe')
    : t('collectiviteDemandes.nombre.equipes', '{{nombre}} équipes', { nombre }));
  const nombreDePlaces = (/** @type {number} */ nombre) => (nombre === 1
    ? t('collectiviteDemandes.nombre.unePlace', '1 place')
    : t('collectiviteDemandes.nombre.places', '{{nombre}} places', { nombre }));

  let titre = t('collectivite.requests.modal.approveTitle', 'Accepter la demande');
  if (estRefus) {
    titre = serie
      ? t('collectiviteDemandes.fenetre.refuserSerie', 'Refuser la série')
      : t('collectivite.requests.modal.refuseTitle', 'Refuser la demande');
  } else if (serie) {
    titre = t('collectiviteDemandes.fenetre.accepterSerie', 'Accepter la série');
  }
  let boutonPrincipal = serie
    ? t('collectiviteDemandes.actions.accepterSerie', 'Accepter la série')
    : t('collectivite.requests.actions.approve', 'Accepter');
  if (enPartie && !aucuneCochee) {
    boutonPrincipal = cochees.length === 1
      ? t('collectiviteDemandes.dates.accepterUne', 'Accepter 1 date sur {{total}}', {
        total: datesDeLaSerie.length,
      })
      // eslint-disable-next-line max-len
      : t('collectiviteDemandes.dates.accepterCertaines', 'Accepter {{nombre}} dates sur {{total}}', {
        nombre: cochees.length, total: datesDeLaSerie.length,
      });
  }
  if (estRefus && refusDeRattachement) {
    boutonPrincipal = t('collectiviteRattachement.demandes.refuseWindowYes', 'Refuser la demande');
  } else if (estRefus) {
    boutonPrincipal = serie
      // eslint-disable-next-line max-len
      ? t('collectiviteDemandes.fenetre.refuserSerieEtAnnuler', 'Refuser et annuler les entraînements')
      : t('collectiviteDemandes.fenetre.refuserEtAnnuler', 'Refuser et annuler l’entraînement');
  }

  let aideDuRefus = serie
    // eslint-disable-next-line max-len
    ? t('collectiviteDemandes.fenetre.refusAideSerie', 'Le club reçoit votre motif ; les entraînements de la série sont annulés.')
    // eslint-disable-next-line max-len
    : t('collectivite.requests.modal.refuseHint', 'Le club reçoit votre motif ; son entraînement est annulé.');
  if (refusDeRattachement) {
    aideDuRefus = t(
      'collectiviteRattachement.demandes.refuseHint',
      'Le club reçoit votre motif ; il n’est pas rattaché.',
    );
  }

  const rappel = (
    <View
      style={[
        ApplicationStyle.borderRadius12,
        Spaces.padding[12],
        {
          // eslint-disable-next-line max-len
          backgroundColor: `${Colors.neutral00}0D`, borderColor: `${Colors.neutral00}1A`, borderWidth: 1, gap: 4,
        },
      ]}
      testID="fenetre-rappel"
    >
      {qui ? <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{qui}</Text> : null}
      {demandeur ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('collectiviteDemandes.fenetre.demandePar', 'Demandé par {{personne}}', {
            personne: demandeur, ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
      {ou ? <Text style={[Fonts.p3, Fonts.neutral200]}>{ou}</Text> : null}
      {!estRefus && place?.depasse ? (
        <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
          {t('collectiviteDemandes.fenetre.depasse', '{{equipes}} pour {{places}} à ce moment.', {
            // eslint-disable-next-line max-len
            equipes: nombreDEquipes(place.apres), places: nombreDePlaces(place.capacite), ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
    </View>
  );

  // Les motifs en un appui, chacun par sa clé (le texte vit dans les traductions).
  const motifsFrequents = refusDeRattachement ? MOTIFS_DE_REFUS_RATTACHEMENT : MOTIFS_DE_REFUS;
  const texteDuMotif = (/** @type {string} */ motif) => {
    if (motif === 'horsCommune') {
      return t('collectiviteRattachement.demandes.motifs.horsCommune', 'Club hors de la commune');
    }
    if (motif === 'inconnu') {
      return t('collectiviteRattachement.demandes.motifs.inconnu', 'Club inconnu de nos services');
    }
    if (motif === 'doublon') {
      return t('collectiviteRattachement.demandes.motifs.doublon', 'Demande en double');
    }
    if (motif === 'fermeture') return t('collectiviteDemandes.motifs.fermeture', 'Fermeture');
    if (motif === 'manifestation') {
      return t('collectiviteDemandes.motifs.manifestation', 'Manifestation de la Ville');
    }
    return t('collectiviteDemandes.motifs.complet', 'Installation complète');
  };

  const quiSeraPrevenu = () => {
    const morceaux = [];
    if (prevenus.personne || prevenus.club) {
      // eslint-disable-next-line max-len
      morceaux.push(t('collectiviteDemandes.fenetre.prevenuDemandeur', '{{personne}} ({{club}}), qui demande', {
        club: prevenus.club, personne: prevenus.personne || prevenus.club, ...SANS_ECHAPPEMENT,
      }));
    }
    if (prevenus.clubsDejaLa.length) {
      // eslint-disable-next-line max-len
      morceaux.push(t('collectiviteDemandes.fenetre.prevenusDejaLa', 'et les clubs déjà là : {{clubs}}', {
        clubs: prevenus.clubsDejaLa.join(', '), ...SANS_ECHAPPEMENT,
      }));
    }
    return morceaux.length ? `${morceaux.join(' ; ')}.` : '';
  };

  // COLL-C3B-BIS (planche 33) — les dates de la série, chacune avec sa place, à cocher.
  const placeDeLaDate = (/** @type {any} */ date) => {
    const places = Number(date?.maxSlots || 1);
    const pris = Number(date?.taken || 0);
    if (pris >= places) {
      return {
        couleur: Colors.warning500,
        texte: t('collectiviteDemandes.dates.complet', 'Complet · {{pris}} sur {{places}}', {
          places, pris,
        }),
      };
    }
    const restantes = Math.max(0, Number(date?.remaining ?? places - pris));
    return {
      couleur: Colors.success500,
      texte: restantes === 1
        ? t('collectiviteDemandes.pastille.unePlaceLibre', '1 place libre')
        : t('collectiviteDemandes.pastille.placesLibres', '{{nombre}} places libres', {
          nombre: restantes,
        }),
    };
  };
  const refusees = datesDeLaSerie.length - cochees.length;
  let sortDesAutres = '';
  if (enPartie && !aucuneCochee) {
    sortDesAutres = refusees === 1
      // eslint-disable-next-line max-len
      ? t('collectiviteDemandes.dates.refusUne', 'L’autre date sera refusée : le club lira « Date non retenue ».')
      // eslint-disable-next-line max-len
      : t('collectiviteDemandes.dates.refusPlusieurs', 'Les {{nombre}} autres dates seront refusées : le club lira « Date non retenue ».', {
        nombre: refusees,
      });
  }
  const choixDesDates = datesDeLaSerie.length ? (
    <View style={{ gap: 8 }} testID="fenetre-dates">
      <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
        {t('collectiviteDemandes.dates.titre', 'Les dates de la série')}
      </Text>
      <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
        {datesDeLaSerie.map((/** @type {any} */ date) => {
          const documentId = String(date?.documentId || '');
          const cochee = cochees.includes(documentId);
          const jour = momentDeLaDemande(date)?.jourCourt || '';
          const placeDuJour = placeDeLaDate(date);
          return (
            <Pressable
              accessibilityLabel={`${jour}, ${placeDuJour.texte}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: cochee }}
              key={documentId}
              onPress={() => basculer(documentId)}
              style={[Alignments.row, Alignments.alignCenter, { gap: 12, paddingVertical: 8 }]}
              testID={`date-serie-${documentId}`}
            >
              <View
                style={[
                  Alignments.center,
                  {
                    backgroundColor: cochee ? Colors.primary500 : 'transparent',
                    borderColor: cochee ? Colors.primary500 : `${Colors.neutral00}66`,
                    borderRadius: 6,
                    borderWidth: 1.5,
                    height: 20,
                    width: 20,
                  },
                ]}
              >
                {cochee ? (
                  <SvgIcon color={Colors.primary900} height={12} name="check" width={12} />
                ) : null}
              </View>
              <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{jour}</Text>
              <Text style={[Fonts.p3Bold, { color: placeDuJour.couleur }]}>
                {placeDuJour.texte}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {sortDesAutres ? <Text style={[Fonts.p3, Fonts.neutral200]}>{sortDesAutres}</Text> : null}
      {aucuneCochee ? (
        <Text style={[Fonts.p3Bold, Fonts.warning500]}>
          {t('collectiviteDemandes.dates.aucune', 'Cochez au moins une date.')}
        </Text>
      ) : null}
    </View>
  ) : null;

  const champStyle = {
    borderColor: erreur ? Colors.error500 : `${Colors.primary500}44`,
    minHeight: 96,
    textAlignVertical: /** @type {const} */ ('top'),
  };
  const fenetreStyle = centree
    ? [ApplicationStyle.borderRadius16, { maxWidth: 560, width: /** @type {const} */ ('100%') }]
    : [{ borderTopLeftRadius: 24, borderTopRightRadius: 24, width: /** @type {const} */ ('100%') }];

  return (
    <Modal animationType="fade" onRequestClose={fermer} transparent visible={Boolean(decision)}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled={Platform.OS !== 'web'}
        keyboardVerticalOffset={0}
        style={[
          Alignments.fill,
          centree ? Alignments.justifyCenter : { justifyContent: 'flex-end' },
          Alignments.alignCenter,
          centree ? Spaces.padding[24] : null,
          { backgroundColor: `${Colors.neutral900}B3` },
        ]}
      >
        <ScrollView
          accessibilityViewIsModal
          contentContainerStyle={{ gap: 16, padding: 20 }}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={montrerMotif}
          onLayout={montrerMotif}
          ref={contenuRef}
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderWidth1,
            {
              borderColor: `${Colors.primary500}66`, flexGrow: 0, flexShrink: 1, maxHeight: '100%',
            },
            ...fenetreStyle,
          ]}
        >
          {centree ? null : (
            // La poignée (planche 33) : glisser vers le bas, ou l'appuyer, ferme la feuille.
            // eslint-disable-next-line react/jsx-props-no-spreading
            <View style={[Alignments.alignCenter, { marginTop: -8 }]} {...glisser.panHandlers}>
              <Pressable
                accessibilityLabel={t('collectiviteDemandes.fenetre.poignee', 'Fermer la fenêtre')}
                accessibilityRole="button"
                hitSlop={12}
                onPress={fermer}
                testID="fenetre-poignee"
              >
                <View
                  style={{
                    backgroundColor: `${Colors.neutral00}4D`, borderRadius: 2, height: 4, width: 40,
                  }}
                />
              </Pressable>
            </View>
          )}
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{titre}</Text>
          {demande ? rappel : null}
          {choixDesDates}

          {placePrise ? (
            <View
              style={[
                ApplicationStyle.borderRadius12,
                Spaces.padding[12],
                { backgroundColor: `${Colors.error500}1F` },
              ]}
              testID="fenetre-place-prise"
            >
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t(
                  'APIerrors.FACILITY_OVERRIDE_CAPACITY_CHANGED',
                  // eslint-disable-next-line max-len
                  'Plus de place : une autre demande a été acceptée sur ce moment entre-temps. Celle-ci ne peut plus qu’être refusée.',
                )}
              </Text>
            </View>
          ) : null}

          {!estRefus ? (
            <View style={{ gap: 4 }}>
              <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
                {t('collectiviteDemandes.fenetre.serontPrevenus', 'Seront prévenus')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>{quiSeraPrevenu()}</Text>
            </View>
          ) : (
            <Text style={[Fonts.p3, Fonts.neutral200]}>{aideDuRefus}</Text>
          )}

          {estRefus ? (
            <View style={{ gap: 8 }}>
              <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
                {t('collectiviteDemandes.fenetre.motifsFrequents', 'Motifs fréquents')}
              </Text>
              <View
                accessibilityRole="radiogroup"
                style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}
              >
                {motifsFrequents.map((motif) => {
                  const texte = texteDuMotif(motif);
                  const choisi = message.trim() === texte;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: choisi }}
                      key={motif}
                      onPress={() => { setMessage(texte); setErreur(''); }}
                      style={[
                        ApplicationStyle.borderRadius16,
                        {
                          // eslint-disable-next-line max-len
                          backgroundColor: choisi ? `${Colors.primary500}33` : `${Colors.neutral00}0D`,
                          borderColor: choisi ? Colors.primary500 : `${Colors.neutral00}26`,
                          borderWidth: 1,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        },
                      ]}
                      testID={`motif-${motif}`}
                    >
                      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{texte}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <TextInput
            accessibilityLabel={estRefus
              // eslint-disable-next-line max-len
              ? t('collectivite.requests.modal.refusePlaceholder', 'Le motif du refus (obligatoire)')
              // eslint-disable-next-line max-len
              : t('collectivite.requests.modal.approvePlaceholder', 'Un mot pour le club (facultatif)')}
            multiline
            onBlur={() => { champActifRef.current = false; setSaisieActive(false); }}
            onChangeText={(texte) => { setMessage(texte); if (erreur) setErreur(''); }}
            onFocus={() => {
              champActifRef.current = true;
              setSaisieActive(true);
              montrerMotif();
            }}
            placeholder={estRefus
              // eslint-disable-next-line max-len
              ? t('collectivite.requests.modal.refusePlaceholder', 'Le motif du refus (obligatoire)')
              // eslint-disable-next-line max-len
              : t('collectivite.requests.modal.approvePlaceholder', 'Un mot pour le club (facultatif)')}
            placeholderTextColor={Colors.neutral400}
            style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Fonts.p2,
              Fonts.neutral00,
              Spaces.padding[16],
              champStyle,
            ]}
            testID="collectivite-request-message"
            value={message}
          />
          {Platform.OS === 'ios' && saisieActive ? (
            <Button
              onPress={() => Keyboard.dismiss()}
              title={t('common.finish', 'Terminer')}
              variant="Ghost"
            />
          ) : null}
          {erreur ? <Text style={[Fonts.p3Bold, Fonts.error500]}>{erreur}</Text> : null}
          {/* ⏳ VILLE-T18C (07/10, tournée T18 G49c) — une série se tranche en quelques secondes
              (36 dates : 15,3 s au refus) : la fenêtre dit ce qui s'écrit, pas seulement un
              bouton qui tourne. */}
          {enCours && serie ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[Fonts.p3Bold, Fonts.neutral100]}
              testID="decision-serie-en-cours"
            >
              {estRefus
                ? t(
                  'collectiviteDemandes.fenetre.refusEnCours',
                  // eslint-disable-next-line max-len
                  'Refus des {{nombre}} dates en cours : patientez quelques secondes, la fenêtre se fermera seule.',
                  { nombre: Number(demande?.seriesCount || 1) },
                )
                : t(
                  'collectiviteDemandes.fenetre.accordEnCours',
                  // eslint-disable-next-line max-len
                  'Accord des {{nombre}} dates en cours : patientez quelques secondes, la fenêtre se fermera seule.',
                  { nombre: enPartie ? cochees.length : Number(demande?.seriesCount || 1) },
                )}
            </Text>
          ) : null}

          {/* Deux boutons EMPILÉS, libellés entiers (P6-fenetre). */}
          <View style={{ gap: 12 }}>
            <Button
              disabled={enCours || aucuneCochee}
              isLoading={enCours}
              onPress={confirmer}
              title={boutonPrincipal}
              variant={estRefus ? 'Danger' : 'Primary'}
            />
            <Button
              disabled={enCours}
              onPress={fermer}
              title={placePrise
                ? t('collectiviteDemandes.fenetre.fermer', 'Fermer')
                : t('collectivite.requests.modal.cancel', 'Annuler')}
              variant="Ghost"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default DecisionCreneauModal;
