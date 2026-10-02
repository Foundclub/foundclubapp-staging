import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  datesDeLaDemande,
  finDeSaison,
  horsOuverture,
} from '@/domains/collectivite/collectiviteDemandes';
import { payloadsDeLaDemande } from '@/domains/collectivite/collectiviteDemandesEnvoi';
import { isTrainingEventType } from '@/domains/event/eventUseCases';
import {
  freeRanges,
  fromMinutes,
  fullRanges,
  isoWeekdayOf,
  isTime,
  toMinutes,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import Input from '@/components/molecules/input/Input';
import { PuceDeChoix } from '@/components/organisms/seasonSlot/SeasonSlotForm';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTypes } from '@/services/event/eventQueries';
import { createEventsSequentially } from '@/services/event/eventService';
import { useClubCollectiviteFacilities } from '@/services/facility/facilityQueries';
import { getFacilityPlanning } from '@/services/facility/facilityService';
import { useClubTeamsForSlot, useSeasonSlotPreview } from '@/services/seasonSlot/seasonSlotQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { getPlanningItemWindow } from '@/utils/planning/planningSlots';

// Au-delà de cette largeur (ordinateur), la saisie et la place côte à côte.
const LARGEUR_DEUX_COLONNES = 1024;

/**
 * Un jour « JJ/MM/AAAA » (le champ date) en « AAAA-MM-JJ », ou ''.
 * @param {string} valeur - La valeur du champ.
 * @returns {string} Le jour ISO, ou ''.
 */
const versIso = (valeur) => {
  const date = parse(String(valeur || ''), 'dd/MM/yyyy', new Date());
  return Number.isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd');
};

/**
 * Un jour « AAAA-MM-JJ » en « JJ/MM/AAAA » (le champ date), ou ''.
 * @param {string | undefined} valeur - Le jour ISO.
 * @returns {string} La valeur du champ.
 */
const versChamp = (valeur) => {
  const date = parse(String(valeur || ''), 'yyyy-MM-dd', new Date());
  return Number.isNaN(date.getTime()) ? '' : format(date, 'dd/MM/yyyy');
};

/**
 * 🏛️ COLL-C3B (02/10) — LE CLUB DEMANDE UN CRÉNEAU (planches P8v2-demande, tel et ordi).
 *
 * Ouvert depuis une heure libre du planning d'une installation de la Ville (déjà rempli), ou
 * depuis « Tes demandes à la Ville ». La PLACE se lit pendant la saisie (contrat C2A §4.2, qui
 * compte aussi les séances datées : D75), avec qui est déjà là : club et équipe, jamais un nom
 * de personne (D71, D2). Complet ⇒ on ne bloque pas (« Tu peux demander quand même : la mairie
 * décidera »), et les heures libres du même jour se choisissent d'un appui. Seul blocage : hors
 * des heures d'ouverture. L'envoi pose l'entraînement (une date, ou chaque semaine jusqu'à la fin
 * de la saison) ; le serveur en fait une demande si la place est prise, « Un mot pour la mairie »
 * en est le motif. Puis l'accusé de réception, et « Tes demandes à la Ville ».
 * Au « tu » : c'est un club qui lit.
 * @returns {import('react').ReactElement} L'écran.
 */
function ClubSlotRequest() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {Record<string, any>} */ (route?.params || {});
  const { userData } = /** @type {any} */ (useAuth()) || {};
  const clubId = params.clubId || userData?.club?.documentId || null;
  const { width } = useWindowDimensions();
  const deuxColonnes = width >= LARGEUR_DEUX_COLONNES;
  const queryClient = useQueryClient();

  const [installationId, setInstallationId] = useState(params.facilityId || null);
  const [equipe, setEquipe] = useState(params.teamId || null);
  const [hebdo, setHebdo] = useState(false);
  const [jour, setJour] = useState(versChamp(params.date));
  const [debut, setDebut] = useState(params.startTime || '');
  const [fin, setFin] = useState(params.endTime || '');
  const [mot, setMot] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(/** @type {any} */ (null));

  const installations = useClubCollectiviteFacilities(clubId);
  /** @type {any[]} */
  const liste = Array.isArray(installations.data) ? installations.data : [];
  const installation = liste.find((f) => f?.documentId === installationId) || null;
  const nomDeLaVille = installation?.collectivite?.name || '';
  const equipes = useClubTeamsForSlot(clubId);
  const typesDEvenement = useGetEventTypes();
  const typeEntrainement = (Array.isArray(typesDEvenement.data) ? typesDEvenement.data : [])
    .find((type) => isTrainingEventType(type?.name)) || null;

  const jourIso = versIso(jour);
  // eslint-disable-next-line max-len
  const heuresLisibles = isTime(debut) && isTime(fin) && (toMinutes(debut) ?? 0) < (toMinutes(fin) ?? 0);
  const ouverture = toMinutes(installation?.openingTime);
  const fermeture = toMinutes(installation?.closingTime);
  const horsHeures = heuresLisibles
    ? horsOuverture({
      debut: toMinutes(debut), fermeture, fin: toMinutes(fin), ouverture,
    })
    : null;

  const parametresApercu = useMemo(() => (
    installationId && jourIso && heuresLisibles
      ? {
        endTime: fin,
        startTime: debut,
        validFrom: jourIso,
        validUntil: hebdo ? finDeSaison(jourIso) : jourIso,
        weekday: isoWeekdayOf(parse(jourIso, 'yyyy-MM-dd', new Date())),
      }
      : null
  ), [debut, fin, hebdo, heuresLisibles, installationId, jourIso]);
  const apercu = useSeasonSlotPreview(installationId, parametresApercu);
  const place = apercu.data?.data || null;

  // Les heures libres du même jour (P8v2, état 2) : l'ouverture moins les moments complets.
  const planningDuJour = useQuery({
    enabled: Boolean(installationId && jourIso),
    queryFn: () => getFacilityPlanning(String(installationId), { from: jourIso, to: jourIso }),
    queryKey: ['planning', 'facility', installationId, jourIso, 'demande'],
    staleTime: 30_000,
  });
  const heuresLibres = useMemo(() => {
    const reponse = /** @type {any} */ (planningDuJour.data);
    /** @type {any[]} */
    const blocs = Array.isArray(reponse?.data) ? reponse.data : [];
    const capacite = Math.max(
      1,
      Number(installation?.maxSlots || reponse?.meta?.facility?.maxSlots || 1),
    );
    const minutes = (/** @type {Date} */ date) => date.getHours() * 60 + date.getMinutes();
    const occupees = blocs.map((bloc) => {
      const fenetre = getPlanningItemWindow(bloc);
      // eslint-disable-next-line max-len
      return fenetre ? { end: minutes(fenetre.endAt), start: minutes(fenetre.startAt) } : { end: 0, start: 0 };
    });
    return freeRanges(fullRanges(occupees, capacite), ouverture ?? 8 * 60, fermeture ?? 22 * 60);
  }, [fermeture, installation?.maxSlots, ouverture, planningDuJour.data]);

  const nombreDEquipes = (/** @type {number} */ nombre) => (nombre === 1
    ? t('collectiviteDemandes.nombre.uneEquipe', '1 équipe')
    : t('collectiviteDemandes.nombre.equipes', '{{nombre}} équipes', { nombre }));
  const nombreDePlaces = (/** @type {number} */ nombre) => (nombre === 1
    ? t('collectiviteDemandes.nombre.unePlace', '1 place')
    : t('collectiviteDemandes.nombre.places', '{{nombre}} places', { nombre }));
  /** @type {any[]} */
  const listeDEquipes = Array.isArray(equipes.data) ? equipes.data : [];
  const nomDeLEquipe = listeDEquipes.find((e) => e?.documentId === equipe)?.name || '';
  const complet = Boolean(place && Number(place.remaining) === 0);

  const envoyer = async () => {
    // eslint-disable-next-line max-len
    if (!clubId || !installationId || !equipe || !typeEntrainement || !jourIso || !heuresLisibles || horsHeures) return;
    setEnvoi(true);
    setErreur('');
    try {
      const corps = payloadsDeLaDemande({
        clubId,
        dates: datesDeLaDemande(jourIso, hebdo),
        debut,
        facilityId: installationId,
        fin,
        groupe: hebdo ? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}` : null,
        mot,
        teamId: equipe,
        type: typeEntrainement.documentId,
        typeName: typeEntrainement.name,
      });
      // eslint-disable-next-line max-len
      const { created, failed } = await createEventsSequentially(corps, { suppressCelebration: true });
      if (!created.length) {
        setErreur(getErrorMessage(/** @type {any} */ (failed[0]?.error)));
        return;
      }
      const statut = (/** @type {any} */ c) => c?.response?.data?.status || c?.response?.status;
      setResultat({
        enAttente: created.some((c) => statut(c) === 'pending_validation'),
        posees: created.length,
        ratees: failed.length,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['facility-override-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['planning'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
      ]);
    } catch (error) {
      setErreur(getErrorMessage(/** @type {any} */ (error)));
    } finally {
      setEnvoi(false);
    }
  };

  const titreDuChamp = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3Bold, Fonts.neutral300]}>{texte}</Text>
  );
  const carte = {
    backgroundColor: withAlpha(Colors.neutral00, 0.04),
    borderColor: withAlpha(Colors.neutral00, 0.09),
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  };
  const leMoment = () => {
    const date = parse(jourIso, 'yyyy-MM-dd', new Date());
    if (hebdo) {
      return t(
        'collectiviteDemandes.club.momentSerie',
        '{{equipe}} · chaque {{jour}}, {{debut}} – {{fin}}, jusqu’au {{jusquAu}} · {{lieu}}',
        {
          debut,
          equipe: nomDeLEquipe,
          fin,
          jour: format(date, 'EEEE', { locale: fr }),
          // eslint-disable-next-line max-len
          jusquAu: format(parse(finDeSaison(jourIso), 'yyyy-MM-dd', new Date()), 'd MMMM', { locale: fr }),
          lieu: installation?.name || '',
          ...SANS_ECHAPPEMENT,
        },
      );
    }
    // eslint-disable-next-line max-len
    return t('collectiviteDemandes.club.momentUnique', '{{equipe}} · {{jour}}, {{debut}} – {{fin}} · {{lieu}}', {
      debut,
      equipe: nomDeLEquipe,
      fin,
      jour: format(date, 'EEE d MMM', { locale: fr }),
      lieu: installation?.name || '',
      ...SANS_ECHAPPEMENT,
    });
  };

  // ─── L'accusé de réception (P8v2, état 4) ────────────────────────────────────────────────
  if (resultat) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 16 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]} testID="demande-accuse-titre">
            {resultat.enAttente
              ? t('collectiviteDemandes.club.envoyee', 'Demande envoyée à la {{ville}}', {
                ville: nomDeLaVille || t('collectiviteDemandes.club.laVille', 'Ville'),
                ...SANS_ECHAPPEMENT,
              })
              : t('collectiviteDemandes.club.posee', 'C’est posé : il restait de la place')}
          </Text>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{leMoment()}</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {resultat.enAttente
              ? t(
                'collectiviteDemandes.club.ensuite',
                // eslint-disable-next-line max-len
                'La mairie l’accepte ou la refuse. Tu reçois sa réponse en notification, avec son mot.',
              )
              : t(
                'collectiviteDemandes.club.confirme',
                'Ton entraînement est confirmé : la Ville n’a pas à décider.',
              )}
          </Text>
          {resultat.enAttente ? (
            <View
              style={[carte, { borderColor: Colors.warning500, borderStyle: 'dashed' }]}
              testID="demande-accuse-attente"
            >
              <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
                {t('collectiviteDemandes.club.enAttenteDeLaMairie', 'En attente de la mairie')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {`${nomDeLEquipe} · ${debut} – ${fin}`}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t('collectiviteDemandes.club.commeDansTonPlanning', 'Comme dans ton planning.')}
              </Text>
            </View>
          ) : null}
          {resultat.ratees ? (
            <Text style={[Fonts.p3Bold, Fonts.error500]}>
              {t(
                'collectiviteDemandes.club.ratees',
                '{{nombre}} date(s) n’ont pas pu être envoyées : réessaie depuis ton planning.',
                { nombre: resultat.ratees },
              )}
            </Text>
          ) : null}
          <Button
            onPress={() => navigation.navigate(RouteNames.ClubSlotRequests, { clubId })}
            title={t('collectiviteDemandes.club.voirMesDemandes', 'Voir mes demandes')}
            variant="Primary"
          />
          <Button
            onPress={() => navigation.goBack?.()}
            title={t('collectiviteDemandes.fenetre.fermer', 'Fermer')}
            variant="Ghost"
          />
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── La place pendant la saisie (P8v2, états 1 et 2) ─────────────────────────────────────
  let carteDeLaPlace = null;
  if (horsHeures) {
    const heure = fromMinutes(horsHeures.heure);
    carteDeLaPlace = (
      <View style={[carte, { borderColor: Colors.error500 }]} testID="demande-hors-ouverture">
        <Text style={[Fonts.p2Bold, Fonts.error500]}>
          {horsHeures.cas === 'ferme'
            // eslint-disable-next-line max-len
            ? t('collectiviteDemandes.club.ferme', 'L’installation ferme à {{heure}}. Termine à {{heure}}, ou commence plus tôt.', { heure })
            // eslint-disable-next-line max-len
            : t('collectiviteDemandes.club.ouvre', 'L’installation ouvre à {{heure}}. Commence à {{heure}}, ou plus tard.', { heure })}
        </Text>
      </View>
    );
  } else if (place) {
    const occupants = Array.isArray(place.occupants) ? place.occupants : [];
    const equipesLa = Math.max(0, Number(place.capacity) - Number(place.remaining));
    let phrase;
    if (equipesLa === 0 && !occupants.length) {
      phrase = t('collectiviteDemandes.place.personne', 'Personne n’y est : il reste {{places}}.', {
        places: nombreDePlaces(Number(place.remaining)), ...SANS_ECHAPPEMENT,
      });
    } else if (complet) {
      phrase = t('collectiviteDemandes.place.complet', 'Il y a déjà {{equipes}} : c’est complet.', {
        equipes: nombreDEquipes(Math.max(equipesLa, occupants.length)), ...SANS_ECHAPPEMENT,
      });
    } else {
      // eslint-disable-next-line max-len
      phrase = t('collectiviteDemandes.place.reste', 'Il y a déjà {{equipes}} : il reste {{places}}.', {
        // eslint-disable-next-line max-len
        equipes: nombreDEquipes(equipesLa), places: nombreDePlaces(Number(place.remaining)), ...SANS_ECHAPPEMENT,
      });
    }
    const noms = occupants.slice(0, 4).map((/** @type {any} */ occupant) => {
      const nom = [occupant?.club?.name, occupant?.team?.name].filter(Boolean).join(' · ');
      const tonClub = occupant?.club?.documentId && occupant.club.documentId === clubId
        ? t('collectiviteDemandes.club.tonClub', ' (ton club)')
        : '';
      return t('collectiviteDemandes.club.dejaLa', '{{nom}}{{tonClub}}, de {{debut}} à {{fin}}', {
        // eslint-disable-next-line max-len
        debut: occupant?.startTime || '', fin: occupant?.endTime || '', nom, tonClub, ...SANS_ECHAPPEMENT,
      });
    });
    carteDeLaPlace = (
      <View
        style={[carte, { borderColor: complet ? Colors.warning500 : Colors.success500 }]}
        testID="demande-place"
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{phrase}</Text>
        {noms.length ? (
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('collectiviteDemandes.club.dejaLaListe', 'Déjà là : {{noms}}.', {
              noms: noms.join(t('collectiviteDemandes.liaison.et', ' et ')), ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        {complet ? (
          <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
            {t(
              'collectiviteDemandes.club.quandMeme',
              'Tu peux demander quand même : la mairie décidera.',
            )}
          </Text>
        ) : null}
      </View>
    );
  }

  const saisie = (
    <View style={{ gap: 16 }}>
      {installation ? (
        <View style={carte} testID="demande-installation">
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{installation.name}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectiviteDemandes.club.installation', '{{ville}} · {{equipes}} à la fois', {
              equipes: nombreDEquipes(Math.max(1, Number(installation.maxSlots || 1))),
              ville: nomDeLaVille,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {titreDuChamp(t(
            'collectiviteDemandes.club.choisirInstallation',
            'Installation de la Ville',
          ))}
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
            {liste.map((f) => (
              <PuceDeChoix
                actif={false}
                key={f.documentId}
                libelle={String(f.name || '')}
                onPress={() => setInstallationId(f.documentId)}
                testID={`demande-installation-${f.documentId}`}
              />
            ))}
          </View>
          {installations.isLoading || liste.length ? null : (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'collectiviteDemandes.club.aucuneInstallation',
                'Ton club n’est rattaché à aucune Ville pour l’instant.',
              )}
            </Text>
          )}
        </View>
      )}

      <View style={{ gap: 8 }}>
        {titreDuChamp(t('collectiviteDemandes.club.equipe', 'Équipe'))}
        <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
          {listeDEquipes.map((e) => (
            <PuceDeChoix
              actif={e.documentId === equipe}
              key={e.documentId}
              libelle={String(e.name || '')}
              onPress={() => setEquipe(e.documentId)}
              testID={`demande-equipe-${e.documentId}`}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {titreDuChamp(t('collectiviteDemandes.club.combienDeFois', 'Combien de fois'))}
        <View style={[Alignments.row, { gap: 8 }]}>
          <PuceDeChoix
            actif={!hebdo}
            libelle={t('collectiviteDemandes.pastille.uneFois', 'Une fois')}
            onPress={() => setHebdo(false)}
            testID="demande-une-fois"
          />
          <PuceDeChoix
            actif={hebdo}
            libelle={t('collectiviteDemandes.pastille.chaqueSemaine', 'Chaque semaine')}
            onPress={() => setHebdo(true)}
            testID="demande-chaque-semaine"
          />
        </View>
      </View>

      <DatePickerInput
        label={t('collectiviteDemandes.club.jour', 'Jour')}
        minimumDate={new Date()}
        onChange={(/** @type {string} */ valeur) => setJour(valeur)}
        value={jour}
      />
      <View style={[Alignments.row, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <Input
            density="compact"
            label={t('collectiviteCreneaux.attribuer.debut', 'Début')}
            onChangeText={(/** @type {string} */ valeur) => setDebut(valeur.trim())}
            placeholder="18:00"
            testID="demande-debut"
            value={debut}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            density="compact"
            label={t('collectiviteCreneaux.attribuer.fin', 'Fin')}
            onChangeText={(/** @type {string} */ valeur) => setFin(valeur.trim())}
            placeholder="19:30"
            testID="demande-fin"
            value={fin}
          />
        </View>
      </View>
    </View>
  );

  const placeEtEnvoi = (
    <View style={{ gap: 16 }}>
      {carteDeLaPlace}
      {jourIso && heuresLibres.length && complet ? (
        <View style={{ gap: 8 }} testID="demande-heures-libres">
          {titreDuChamp(t('collectiviteDemandes.club.libreCeJour', 'Libre ce {{jour}} :', {
            jour: format(parse(jourIso, 'yyyy-MM-dd', new Date()), 'EEEE', { locale: fr }),
            ...SANS_ECHAPPEMENT,
          }))}
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
            {heuresLibres.map((plage) => (
              <PuceDeChoix
                actif={false}
                key={`${plage.start}-${plage.end}`}
                libelle={`${fromMinutes(plage.start)} – ${fromMinutes(plage.end)}`}
                onPress={() => {
                  setDebut(fromMinutes(plage.start));
                  setFin(fromMinutes(Math.min(plage.start + 90, plage.end)));
                }}
                testID={`demande-libre-${fromMinutes(plage.start)}`}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Input
        label={t('collectiviteDemandes.club.motPourLaMairie', 'Un mot pour la mairie (facultatif)')}
        multiline
        onChangeText={(/** @type {string} */ valeur) => setMot(valeur)}
        testID="demande-mot"
        value={mot}
      />
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'collectiviteDemandes.club.quiDecide',
          'La {{ville}} accepte ou refuse ; tu reçois sa réponse en notification.',
          // eslint-disable-next-line max-len
          { ville: nomDeLaVille || t('collectiviteDemandes.club.laVille', 'Ville'), ...SANS_ECHAPPEMENT },
        )}
      </Text>
      {erreur ? <Text style={[Fonts.p3Bold, Fonts.error500]}>{erreur}</Text> : null}
      <Button
        // eslint-disable-next-line max-len
        disabled={envoi || Boolean(horsHeures) || !equipe || !installationId || !jourIso || !heuresLisibles || !typeEntrainement}
        isLoading={envoi}
        onPress={envoyer}
        title={complet
          ? t('collectiviteDemandes.club.envoyerQuandMeme', 'Envoyer quand même')
          : t('collectiviteDemandes.club.envoyer', 'Envoyer la demande')}
        variant="Primary"
      />
    </View>
  );

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 16 }}>
        <Text style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('collectiviteDemandes.club.titre', 'Demander un créneau')}
        </Text>
        {deuxColonnes ? (
          <View style={[Alignments.row, { alignItems: 'flex-start', gap: 24 }]}>
            <View style={{ flex: 1 }}>{saisie}</View>
            <View style={[ApplicationStyle.borderRadius16, Spaces.padding[0], { flex: 1 }]}>
              {placeEtEnvoi}
            </View>
          </View>
        ) : (
          <>
            {saisie}
            {placeEtEnvoi}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

export default ClubSlotRequest;
