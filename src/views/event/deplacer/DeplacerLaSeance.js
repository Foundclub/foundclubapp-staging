import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parse } from 'date-fns';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import {
  closedThatDayText,
  hoursLabel,
  isRelocationRouteMissing,
  isSelectableState,
  placeDetail,
  placeWithPreposition,
  relocationErrorMessage,
  relocationStateColor,
  relocationStateLabel,
  shortDay,
} from '@/domains/relocation/relocationDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import {
  decideRelocation, getRelocationOptions, proposeRelocation, updateEvent,
} from '@/services/event/eventService';

/**
 * COLL-R-DEPLACER A8 (14/10, COL-013, décision d'Adel « D9 = b ») — « DÉPLACER LA SÉANCE »
 * (planches P5v4-deplacer-tel écrans 1 à 12, P5v4-deplacer-ville-tel écrans 1 (b) et 4 (b)).
 *
 * Un tunnel de 4 étapes, en mode « déplacer » de l'écran de modification (aucune route neuve) :
 * Où ?* (même jour, même heure : chaque installation avec son état) → *Quel jour ?* → *À quelle
 * heure ?* → *Récapitulatif* (avant barré, après). UNE séance, jamais la série.
 *   - Le CLUB déplace par la modification de la séance (`PUT /events/:id`, sans `recurrenceMode`) :
 *     le serveur rejuge comme toujours (hors créneau : la demande part à la Ville, avec les deux
 *     phrases validées de « deplacer A » dites avant d'envoyer).
 *   - La VILLE (`viewer: 'ville'`) ne déplace pas : elle PROPOSE (`POST
 *     /events/:id/relocation-proposals`), le club accepte d'un appui.
 * Le serveur est le SEUL juge des places (`GET /events/:id/relocation-options`). Un serveur d'avant
 * ce lot ne connaît pas la route : `onIndisponible` rend la modification de la séance, comme avant.
 * @param {{
 *   eventId: string,
 *   navigation: any,
 *   onIndisponible?: () => void,
 *   proposalId?: string,
 *   viewer?: 'club' | 'ville',
 * }} props - `viewer` : qui déplace (le club, par défaut) ou propose (la Ville). `proposalId` :
 *   le club a touché « Choisir une autre place » sur une proposition de la Ville ; il la décline au
 *   moment de déplacer (la Ville l'apprend), pas avant (s'il renonce, elle attend toujours).
 * @returns {import('react').ReactElement} Le tunnel.
 */
function DeplacerLaSeance({
  eventId, navigation, onIndisponible, proposalId, viewer = 'club',
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const queryClient = useQueryClient();
  const ville = viewer === 'ville';
  const as = ville ? 'ville' : undefined;

  const [etape, setEtape] = useState(1);
  const [lieu, setLieu] = useState(/** @type {any} */ (null));
  const [jour, setJour] = useState(/** @type {string | null} */ (null));
  const [autreDate, setAutreDate] = useState('');
  const [debut, setDebut] = useState(/** @type {string | null} */ (null));
  const [fin, setFin] = useState(/** @type {string | null} */ (null));
  const [envoi, setEnvoi] = useState(false);

  // 1/4 — « Où ? » : la fenêtre de la séance (jour, heures), chaque installation et son état.
  const places = useQuery({
    queryFn: () => getRelocationOptions(eventId, { as }),
    queryKey: ['relocation-options', eventId, viewer],
    retry: false,
  });
  const routeAbsente = places.isError && isRelocationRouteMissing(places.error);
  useEffect(() => {
    if (routeAbsente) onIndisponible?.();
  }, [onIndisponible, routeAbsente]);

  const donnees = /** @type {any} */ (places.data);
  const fenetre = donnees?.window || null;
  const seance = donnees?.event || null;
  const jourChoisi = jour || fenetre?.date || null;
  const heureDebut = debut || fenetre?.start || null;
  const heureFin = fin || fenetre?.end || null;
  const autreJour = autreDate
    ? format(parse(autreDate, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd')
    : null;

  // 2/4 — « Quel jour ? » : l'installation choisie, sept jours à la même heure ; une autre date.
  const jours = useQuery({
    enabled: etape >= 2 && Boolean(lieu?.documentId && fenetre),
    queryFn: () => getRelocationOptions(eventId, {
      as,
      date: fenetre?.date,
      days: 7,
      end: fenetre?.end,
      facility: lieu?.documentId,
      start: fenetre?.start,
    }),
    queryKey: ['relocation-options', eventId, viewer, 'jours', lieu?.documentId, fenetre?.date],
    retry: false,
  });
  const ceJourLa = useQuery({
    enabled: etape >= 2 && Boolean(lieu?.documentId && autreJour && fenetre),
    queryFn: () => getRelocationOptions(eventId, {
      as,
      date: autreJour,
      days: 1,
      end: fenetre?.end,
      facility: lieu?.documentId,
      start: fenetre?.start,
    }),
    queryKey: ['relocation-options', eventId, viewer, 'jour', lieu?.documentId, autreJour],
    retry: false,
  });

  // 3/4 — « À quelle heure ? » : la place se lit pendant la saisie.
  const heuresLisibles = Boolean(heureDebut && heureFin && heureDebut < heureFin);
  const verdict = useQuery({
    enabled: etape >= 3 && Boolean(lieu?.documentId && jourChoisi) && heuresLisibles,
    queryFn: () => getRelocationOptions(eventId, {
      as, date: jourChoisi, days: 1, end: heureFin, facility: lieu?.documentId, start: heureDebut,
    }),
    queryKey: [
      'relocation-options', eventId, viewer, 'verdict',
      lieu?.documentId, jourChoisi, heureDebut, heureFin,
    ],
    retry: false,
  });
  const placeFinale = /** @type {any} */ (verdict.data)?.days?.[0] || null;

  const fermer = () => navigation?.goBack?.();
  const retour = () => (etape > 1 ? setEtape(etape - 1) : fermer());
  const avecVous = (/** @type {string} */ club, /** @type {string} */ laVille) => (
    ville ? laVille : club
  );
  const resume = [
    ville ? seance?.club?.name : null,
    seance?.team?.name,
    shortDay(seance?.date),
    hoursLabel(seance?.startTime, seance?.endTime),
  ].filter(Boolean).join(' · ');

  /**
   * Une pastille d'état : texte et fond de la couleur de l'état (jamais gris).
   * @param {string} state - L'état de la place.
   * @returns {import('react').ReactElement} La pastille.
   */
  const pastille = (state) => {
    const couleur = relocationStateColor(Colors, state);
    return (
      <View
        style={{
          backgroundColor: withAlpha(couleur, 0.14),
          borderColor: withAlpha(couleur, 0.45),
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 10,
          paddingVertical: 2,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: couleur }]}>{relocationStateLabel(t, state)}</Text>
      </View>
    );
  };

  /**
   * Une ligne à choisir (installation ou jour) : son nom, sa ligne d'explication, sa pastille. Une
   * ligne impossible garde ses couleurs, avec un bord pointillé orange (planche v53).
   * @param {{ choisi: boolean, detail?: string, id: string, nom: string, onPress?: () => void,
   *   state: string, testID: string }} options - La ligne.
   * @returns {import('react').ReactElement} La ligne.
   */
  const ligne = ({
    choisi, detail, id, nom, onPress, state, testID,
  }) => {
    const possible = isSelectableState(state);
    return (
      <TouchableOpacity
        accessibilityRole="radio"
        accessibilityState={{ checked: choisi, disabled: !possible }}
        disabled={!possible}
        key={id}
        onPress={onPress}
        style={{
          alignItems: 'center',
          backgroundColor: choisi
            ? withAlpha(Colors.primary500, 0.1)
            : withAlpha(Colors.primary800, 0.6),
          borderColor: (() => {
            if (choisi) return Colors.primary500;
            return possible
              ? withAlpha(Colors.primary500, 0.3)
              : withAlpha(Colors.warning500, 0.45);
          })(),
          borderRadius: 12,
          borderStyle: possible ? 'solid' : 'dashed',
          borderWidth: 1,
          flexDirection: 'row',
          gap: 10,
          minHeight: 52,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
        testID={testID}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{nom}</Text>
          {detail ? <Text style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text> : null}
        </View>
        {pastille(state)}
      </TouchableOpacity>
    );
  };

  // Une ligne en attente de lecture (planche, écran 10) : en teinte de cyan, jamais en gris.
  const squelette = {
    backgroundColor: withAlpha(Colors.primary500, 0.14), borderRadius: 12, height: 52,
  };

  const titreDeGroupe = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>{texte}</Text>
  );

  const noteFermee = donnees?.closure ? (
    <View
      accessibilityRole="text"
      style={{
        backgroundColor: withAlpha(Colors.warning500, 0.12),
        borderColor: withAlpha(Colors.warning500, 0.45),
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
      }}
      testID="deplacer-ferme-ce-jour"
    >
      <Text style={[Fonts.p3, Fonts.neutral100]}>
        {closedThatDayText(t, donnees.closure, seance?.facility?.name)}
      </Text>
    </View>
  ) : null;

  // ---------------------------------------------------------------------------------------------
  // 1/4 — Où la déplacer ?
  // ---------------------------------------------------------------------------------------------
  if (etape === 1) {
    const liste = /** @type {any[]} */ (donnees?.facilities || []);
    const libres = liste.filter((place) => isSelectableState(place.state));
    const impossibles = liste.filter((place) => !isSelectableState(place.state));
    let corps;
    if (places.isLoading || routeAbsente) {
      corps = (
        <View style={{ gap: 12 }} testID="deplacer-chargement">
          {[0, 1, 2].map((rang) => <View key={rang} style={squelette} />)}
        </View>
      );
    } else if (places.isError) {
      corps = (
        <View style={{ gap: 12 }} testID="deplacer-erreur">
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {avecVous(
              t(
                'deplacerSeance.ou.erreur',
                'Les places libres n’ont pas pu être lues. Vérifie la connexion, puis réessaie. '
                  + 'Ta séance n’a pas bougé.',
              ),
              t(
                'deplacerSeance.ou.erreurVille',
                'Les places libres n’ont pas pu être lues. Vérifiez la connexion, puis réessayez. '
                  + 'La séance n’a pas bougé.',
              ),
            )}
          </Text>
          <Button
            onPress={() => places.refetch()}
            testID="deplacer-reessayer"
            title={t('common.actions.retry', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      );
    } else {
      const actuelle = liste.find((place) => place.current) || liste[0] || null;
      corps = (
        <View style={{ gap: 12 }}>
          {noteFermee}
          {libres.length ? (
            <View style={{ gap: 8 }}>
              {titreDeGroupe(t('deplacerSeance.ou.libres', 'Libres à cette heure'))}
              {libres.map((place) => ligne({
                choisi: lieu?.documentId === place.documentId,
                detail: placeDetail(t, place, { jour: fenetre?.date, viewer }),
                id: place.documentId,
                nom: place.name,
                onPress: () => setLieu(place),
                state: place.state,
                testID: `deplacer-lieu-${place.documentId}`,
              }))}
            </View>
          ) : (
            <View style={{ gap: 8 }} testID="deplacer-aucune-libre">
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t(
                  'deplacerSeance.ou.aucuneLibre',
                  'Aucune installation libre {{jour}} à {{heure}}',
                  {
                    ...SANS_ECHAPPEMENT, heure: fenetre?.start || '', jour: shortDay(fenetre?.date),
                  },
                )}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {avecVous(
                  t('deplacerSeance.ou.aucuneLibreAide', 'Garde un lieu et choisis un autre jour.'),
                  t(
                    'deplacerSeance.ou.aucuneLibreAideVille',
                    'Gardez un lieu et choisissez un autre jour.',
                  ),
                )}
              </Text>
              {actuelle ? (
                <Button
                  onPress={() => {
                    setLieu(actuelle);
                    setEtape(2);
                  }}
                  testID="deplacer-autre-jour"
                  title={t('deplacerSeance.ou.autreJour', 'Choisir un autre jour')}
                  variant="Secondary"
                />
              ) : null}
            </View>
          )}
          {impossibles.length ? (
            <View style={{ gap: 8 }}>
              {titreDeGroupe(t('deplacerSeance.ou.impossibles', 'Pas possible à cette heure'))}
              {impossibles.map((place) => ligne({
                choisi: false,
                detail: placeDetail(t, place, { jour: fenetre?.date, viewer }),
                id: place.documentId,
                nom: place.name,
                state: place.state,
                testID: `deplacer-lieu-${place.documentId}`,
              }))}
            </View>
          ) : null}
        </View>
      );
    }
    return (
      <WizardStepLayout
        headerVariant="focus"
        isNextDisabled={!lieu}
        onBack={retour}
        onClose={fermer}
        onNext={() => setEtape(2)}
        stepCount={4}
        stepIndex={1}
        subtitle={resume}
        title={t('deplacerSeance.ou.titre', 'Où la déplacer ?')}
      >
        {corps}
      </WizardStepLayout>
    );
  }

  // ---------------------------------------------------------------------------------------------
  // 2/4 — Quel jour ?
  // ---------------------------------------------------------------------------------------------
  if (etape === 2) {
    const liste = [
      ...(/** @type {any} */ (jours.data)?.days || []),
      ...(/** @type {any} */ (ceJourLa.data)?.days || []),
    ].filter((un, rang, tous) => tous.findIndex((autre) => autre.date === un.date) === rang);
    const jourPossible = liste.some((un) => un.date === jourChoisi && isSelectableState(un.state));
    return (
      <WizardStepLayout
        headerVariant="focus"
        isNextDisabled={!jourChoisi || !jourPossible}
        onBack={retour}
        onClose={fermer}
        onNext={() => setEtape(3)}
        stepCount={4}
        stepIndex={2}
        subtitle={[lieu?.name, hoursLabel(fenetre?.start, fenetre?.end)]
          .filter(Boolean).join(' · ')}
        title={t('deplacerSeance.jour.titre', 'Quel jour ?')}
      >
        <View style={{ gap: 8 }}>
          {jours.isLoading ? <View style={squelette} /> : null}
          {jours.isError ? (
            <Text style={[Fonts.p3, { color: Colors.warning400 }]}>
              {relocationErrorMessage(t, jours.error, { viewer })}
            </Text>
          ) : null}
          {liste.map((un) => ligne({
            choisi: jourChoisi === un.date,
            detail: un.date === seance?.date
              ? t('deplacerSeance.jour.prevu', 'Le jour prévu')
              : placeDetail(t, un, { jour: un.date, viewer }),
            id: un.date,
            nom: shortDay(un.date, { capital: true }),
            onPress: () => setJour(un.date),
            state: un.state,
            testID: `deplacer-jour-${un.date}`,
          }))}
          <DatePickerInput
            label={t('deplacerSeance.jour.autreDate', 'Une autre date')}
            minimumDate={new Date()}
            onChange={(/** @type {string} */ texte) => {
              setAutreDate(texte);
              setJour(format(parse(texte, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd'));
            }}
            testID="deplacer-autre-date"
            value={autreDate}
          />
        </View>
      </WizardStepLayout>
    );
  }

  // ---------------------------------------------------------------------------------------------
  // 3/4 — À quelle heure ?
  // ---------------------------------------------------------------------------------------------
  if (etape === 3) {
    let lecture = null;
    if (!heuresLisibles) {
      lecture = (
        <Text style={[Fonts.p3, { color: Colors.warning400 }]}>
          {t('deplacerSeance.heure.finApres', 'La fin vient après le début.')}
        </Text>
      );
    } else if (placeFinale) {
      const detail = placeDetail(t, placeFinale, { jour: jourChoisi, viewer });
      lecture = (
        <View
          style={{
            backgroundColor: withAlpha(relocationStateColor(Colors, placeFinale.state), 0.1),
            borderColor: withAlpha(relocationStateColor(Colors, placeFinale.state), 0.45),
            borderRadius: 12,
            borderWidth: 1,
            gap: 2,
            padding: 12,
          }}
          testID="deplacer-verdict"
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('deplacerSeance.heure.verdict', '{{jour}} {{heures}} : {{etat}}', {
              ...SANS_ECHAPPEMENT,
              etat: relocationStateLabel(t, placeFinale.state).toLocaleLowerCase(),
              heures: hoursLabel(heureDebut, heureFin),
              jour: shortDay(jourChoisi, { capital: true }),
            })}
          </Text>
          {detail ? <Text style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text> : null}
        </View>
      );
    } else if (verdict.isError) {
      lecture = (
        <Text style={[Fonts.p3, { color: Colors.warning400 }]}>
          {relocationErrorMessage(t, verdict.error, { viewer })}
        </Text>
      );
    }
    return (
      <WizardStepLayout
        headerVariant="focus"
        isNextDisabled={!placeFinale || !isSelectableState(placeFinale.state)}
        isNextLoading={verdict.isFetching}
        onBack={retour}
        onClose={fermer}
        onNext={() => setEtape(4)}
        stepCount={4}
        stepIndex={3}
        subtitle={[lieu?.name, shortDay(jourChoisi)].filter(Boolean).join(' · ')}
        title={t('deplacerSeance.heure.titre', 'À quelle heure ?')}
      >
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TimePickerInput
                label={t('deplacerSeance.heure.debut', 'Début')}
                onChange={setDebut}
                testID="deplacer-debut"
                value={heureDebut || ''}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TimePickerInput
                label={t('deplacerSeance.heure.fin', 'Fin')}
                onChange={setFin}
                testID="deplacer-fin"
                value={heureFin || ''}
              />
            </View>
          </View>
          {lecture}
        </View>
      </WizardStepLayout>
    );
  }

  // ---------------------------------------------------------------------------------------------
  // 4/4 — Récapitulatif : avant (barré), après ; ce qui va se passer ; le geste.
  // ---------------------------------------------------------------------------------------------
  const demande = !ville && placeFinale?.state === 'villeDecidera';
  const avant = [
    seance?.facility?.name, shortDay(seance?.date), hoursLabel(seance?.startTime, seance?.endTime),
  ].filter(Boolean).join(' · ');
  const apres = [lieu?.name, shortDay(jourChoisi), hoursLabel(heureDebut, heureFin)]
    .filter(Boolean).join(' · ');
  const attente = t(
    'deplacerSeance.recap.attenteVille',
    'D’ici sa réponse, la séance reste « à déplacer » ; tu es prévenu dès qu’elle répond.',
  );
  let consigne = t(
    'deplacerSeance.recap.relisDeplace',
    'Relis, puis déplace. Tes joueurs sont prévenus.',
  );
  if (demande) {
    consigne = t('deplacerSeance.recap.relisEnvoie', 'Relis, puis envoie. La Ville répond.');
  }
  if (ville) {
    consigne = t('deplacerSeance.recap.relisezProposez', 'Relisez, puis proposez. Le club répond.');
  }
  let geste = t('deplacerSeance.recap.deplacer', 'Déplacer la séance');
  if (demande) geste = t('deplacerSeance.recap.envoyerDemande', 'Envoyer la demande');
  if (ville) geste = t('deplacerSeance.recap.envoyerProposition', 'Envoyer la proposition');

  const phrases = [];
  if (ville) {
    phrases.push(t(
      'deplacerSeance.recap.villeRecoit',
      '{{club}} reçoit votre proposition. Il l’accepte d’un appui, ou choisit une autre place. '
        + 'D’ici là, la séance reste « à déplacer ».',
      { ...SANS_ECHAPPEMENT, club: seance?.club?.name || '' },
    ));
  } else if (demande) {
    // Les deux phrases validées de « deplacer A » (fr.js, collectiviteDemandes.decision), dites
    // AVANT d'envoyer.
    phrases.push(t(
      'collectiviteDemandes.decision.mairieLibre',
      'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.',
    ));
    phrases.push(t(
      'collectiviteDemandes.decision.siRefusAnnulee',
      'Si la mairie refuse, la séance sera annulée.',
    ));
    phrases.push(attente);
  } else {
    phrases.push(placeFinale?.inClubSlot
      ? t('deplacerSeance.recap.placeLibreCreneau', 'Place libre, dans ton créneau')
      : t('deplacerSeance.recap.placeLibre', 'Place libre'));
  }
  if (seance?.series) {
    phrases.push(t(
      'deplacerSeance.recap.serie',
      'Cette séance fait partie d’une série. Seule celle du {{jour}} est déplacée.',
      { ...SANS_ECHAPPEMENT, jour: shortDay(seance?.date) },
    ));
  } else {
    phrases.push(t('deplacerSeance.recap.seuleCetteSeance', 'Seule cette séance bouge.'));
  }

  const envoyer = async () => {
    if (!lieu?.documentId || !jourChoisi || !heureDebut || !heureFin) return;
    setEnvoi(true);
    try {
      if (ville) {
        await proposeRelocation(eventId, {
          date: jourChoisi, end: heureFin, facility: lieu.documentId, start: heureDebut,
        });
      } else {
        // « Choisir une autre place » : la proposition de la Ville est déclinée AVANT que la
        // séance ne bouge (après, elle serait déjà tombée et la Ville n'apprendrait rien). Un refus
        // du serveur (déjà tombée, déjà traitée) n'arrête pas le déplacement.
        if (proposalId) {
          await Promise.resolve()
            .then(() => decideRelocation(proposalId, 'refuse'))
            .catch(() => null);
        }
        // UNE séance : aucun `recurrenceMode`. Le serveur rejuge (créneau, Ville, fermeture).
        await updateEvent({
          documentId: eventId,
          eventData: {
            date: placeFinale?.startAt || new Date(`${jourChoisi}T${heureDebut}:00`).toISOString(),
            endTime: `${heureFin}:00.000`,
            facility: lieu.documentId,
            startTime: `${heureDebut}:00.000`,
          },
        });
      }
      await Promise.all(['event', 'events', 'planning', 'relocation-options']
        .map((cle) => queryClient.invalidateQueries({ queryKey: [cle] })));
      let titre = t('deplacerSeance.fait.deplacee', 'Séance déplacée {{lieu}}', {
        ...SANS_ECHAPPEMENT, lieu: placeWithPreposition(t, lieu.name),
      });
      let texte = seance?.team?.name
        ? t('deplacerSeance.fait.joueursPrevenus', 'Les joueurs de {{equipe}} sont prévenus.', {
          ...SANS_ECHAPPEMENT, equipe: seance.team.name,
        })
        : t('deplacerSeance.fait.joueursPrevenusSansEquipe', 'Les joueurs sont prévenus.');
      if (demande) {
        titre = t('deplacerSeance.fait.demandeEnvoyee', 'Demande envoyée à la Ville');
        texte = attente;
      }
      if (ville) {
        titre = t('deplacerSeance.fait.propositionEnvoyee', 'Proposition envoyée');
        texte = t(
          'deplacerSeance.fait.leClubRepond',
          '{{club}} l’accepte d’un appui, ou choisit une autre place.',
          { ...SANS_ECHAPPEMENT, club: seance?.club?.name || '' },
        );
      }
      Alert.alert(titre, texte);
      fermer();
    } catch (erreur) {
      Alert.alert(
        avecVous(
          t('deplacerSeance.erreurs.titre', 'La séance n’a pas bougé'),
          t('deplacerSeance.erreurs.titreVille', 'Rien n’a été envoyé'),
        ),
        relocationErrorMessage(t, erreur, { viewer }),
      );
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <WizardStepLayout
      headerVariant="focus"
      isNextDisabled={!placeFinale || !isSelectableState(placeFinale.state)}
      isNextLoading={envoi}
      nextLabel={geste}
      onBack={retour}
      onClose={fermer}
      onNext={envoyer}
      stepCount={4}
      stepIndex={4}
      subtitle={consigne}
      title={t('deplacerSeance.recap.titre', 'Récapitulatif')}
    >
      <View
        style={{
          backgroundColor: withAlpha(Colors.primary800, 0.82),
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderRadius: 16,
          borderWidth: 1,
          gap: 12,
          padding: 16,
        }}
        testID="deplacer-recap"
      >
        <View style={{ gap: 2 }}>
          {titreDeGroupe(t('deplacerSeance.recap.seance', 'Séance'))}
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {[seance?.club?.name, seance?.team?.name].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {ville ? null : (
          <View style={{ gap: 2 }}>
            {titreDeGroupe(t('deplacerSeance.recap.avant', 'Avant'))}
            <Text
              style={[Fonts.p2, Fonts.neutral200, { textDecorationLine: 'line-through' }]}
              testID="deplacer-avant"
            >
              {avant}
            </Text>
          </View>
        )}
        <View style={{ gap: 2 }}>
          {titreDeGroupe(ville
            ? t('deplacerSeance.recap.placeProposee', 'Place proposée')
            : t('deplacerSeance.recap.apres', 'Après'))}
          <Text style={[Fonts.p2Bold, { color: Colors.primary200 }]} testID="deplacer-apres">
            {apres}
          </Text>
        </View>
      </View>
      <View style={[Spaces.marginTop[12], { gap: 6 }]} testID="deplacer-phrases">
        {phrases.map((phrase) => (
          <Text key={phrase} style={[Fonts.p3, Fonts.neutral200]}>{phrase}</Text>
        ))}
      </View>
    </WizardStepLayout>
  );
}

export default DeplacerLaSeance;
