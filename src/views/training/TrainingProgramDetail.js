import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import accordFrancais from '@/theme/strings/accordFrancais';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import { formatSessionDate } from '@/components/organisms/training/TrainingSessionRow';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useChooseTrainingProgram, useLeaveTrainingProgram, useMyTraining, useTrainingProgram,
} from '@/hooks/useTraining';

/**
 * Une journée du programme, telle que le serveur la rend.
 * @typedef {Record<string, any>} TrainingDay
 * @property {string} [code] - Le code court affiché dans la pastille.
 * @property {string} [documentId] - Identifiant Strapi, clef de la liste.
 * @property {number} [durationMinutes] - Durée annoncée de la journée, en minutes.
 * @property {string} [place] - Le lieu exigé : terrain, salle, extérieur.
 * @property {unknown[]} [tests] - Les tests contenus dans la journée.
 * @property {string} [title] - L'intitulé de la journée.
 */

/**
 * UNE JOURNÉE DU PROGRAMME, résumée sur une seule ligne de la liste.
 *
 * 🔎 CE QU'ELLE PERMET DE JUGER SANS OUVRIR LA JOURNÉE : son code et son intitulé,
 * puis en dessous le lieu, la durée et le nombre de tests. C'est ce trio qui dit
 * s'il faut un terrain, une salle, ou seulement une heure devant soi.
 * @param {object} props
 * @param {TrainingDay} props.day - La journée à résumer.
 * @returns {React.ReactElement} une ligne de journée
 */
function DayRow({ day }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={[
        Spaces.gap[4],
        {
          borderTopColor: Colors.neutral700,
          borderTopWidth: 1,
          paddingVertical: 10,
        },
      ]}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <View style={{
          backgroundColor: Colors.neutral700,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
        >
          <Text style={[Fonts.captionBold, { color: Colors.neutral100 }]}>{day.code}</Text>
        </View>
        <Text style={[Fonts.p2, { color: Colors.neutral00, flex: 1 }]}>{day.title}</Text>
      </View>
      <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
        {[
          day.place,
          day.durationMinutes ? `${day.durationMinutes} min` : null,
          t('training.program.tests', {
            count: Array.isArray(day.tests) ? day.tests.length : 0,
          }),
        ].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );
}

/**
 * LA FICHE D'UN PROGRAMME, et le bouton « Choisir cet entraînement ».
 *
 * 🔎 CE QU'ELLE MONTRE AVANT DE S'ENGAGER : le nombre de journées et de tests, le
 * matériel exigé, et la liste des journées avec leur lieu et leur durée. Quelqu'un
 * qui n'a ni terrain ni salle doit pouvoir le voir ici, pas au troisième jour.
 * @param {object} props
 * @param {{ navigate: (name: string, params?: Record<string, any>) => void }} props.navigation
 *   La navigation, pour filer vers le plan une fois le programme choisi.
 * @param {{ params: { programId: string } }} props.route
 *   La route : `params.programId` désigne le programme à afficher.
 * @returns {React.ReactElement} la fiche d'un programme
 */
function TrainingProgramDetail({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const programId = route?.params?.programId;

  const {
    data: program, error, isLoading, refetch,
  } = useTrainingProgram(programId);
  const { enrollment } = useMyTraining();
  const choose = useChooseTrainingProgram();
  const quitter = useLeaveTrainingProgram();
  // La feuille de confirmation : quitter un programme efface un engagement, ce
  // geste ne se declenche jamais d un seul appui.
  const [confirmeDepart, setConfirmeDepart] = useState(false);
  // Les coches vivent sur l ecran : c est une aide a la preparation, pas une
  // donnee du programme. Les garder au serveur demanderait un champ par personne
  // pour un geste qu on refait de toute facon avant chaque depart.
  const [coches, setCoches] = useState(/** @type {string[]} */ ([]));
  // 🔎 L INSCRIPTION EN DEUX TEMPS. Le bouton inscrivait DIRECTEMENT et filait au
  // planning : personne ne choisissait sa date de depart, et personne ne lisait a
  // quoi il venait de s engager.
  const [choisitLaDate, setChoisitLaDate] = useState(false);
  const [depart, setDepart] = useState('today');
  // Le 3e choix : une date libre. Elle se garde au format JJ/MM/AAAA, celui que
  // le selecteur de date de l app emploie partout ailleurs.
  const [dateLibre, setDateLibre] = useState('');
  const [failed, setFailed] = useState(false);

  const alreadyChosen = enrollment?.program?.documentId === programId;

  // Tous les chiffres de « ce que ca demande » se calculent depuis les journees
  // reellement chargees. Rien n est ecrit en dur : un programme qui change de
  // forme change de fiche tout seul.
  const materiel = Array.isArray(program?.equipmentList) ? program.equipmentList : [];

  const chiffres = useMemo(() => {
    const journees = Array.isArray(program?.days) ? program.days : [];
    const durees = journees.map((j) => j.durationMinutes).filter(Boolean);
    const parLieu = journees.reduce((compte, j) => (
      j.place ? { ...compte, [j.place]: (compte[j.place] || 0) + 1 } : compte
    ), /** @type {Record<string, number>} */ ({}));
    const mesures = journees.reduce((total, j) => total + (Array.isArray(j.tests) ? j.tests : [])
      .reduce((n, test) => n + (Array.isArray(test.measures) ? test.measures.length : 0), 0), 0);
    const minutes = durees.reduce((a, b) => a + b, 0);
    return {
      lieux: Object.entries(parLieu).map(([lieu, n]) => `${n} ${lieu}`).join(', '),
      mesures,
      nb: journees.length,
      plusLongue: durees.length ? Math.max(...durees) : 0,
      total: minutes,
    };
  }, [program]);

  // La progression, quand c est ce programme qu on suit.
  const progression = useMemo(() => {
    const seances = Array.isArray(enrollment?.sessions) ? enrollment.sessions : [];
    const done = seances.filter((s) => s.status === 'done').length;
    return { done, ratio: seances.length ? done / seances.length : 0, total: seances.length };
  }, [enrollment]);

  /**
   * La date de depart choisie, au format que le serveur attend.
   *
   * 🪤 PAS `toISOString()` : il reconvertit en UTC, et minuit local a l est de
   * Greenwich retombe la VEILLE. On recompose la date avec les morceaux LOCAUX.
   * @param {'today'|'tomorrow'} quand le choix retenu
   * @returns {string} la date au format AAAA-MM-JJ
   */
  const dateDeDepart = useCallback((quand) => {
    if (quand === 'custom') {
      // Le selecteur rend JJ/MM/AAAA ; le serveur attend AAAA-MM-JJ.
      const [j, m, a] = String(dateLibre).split('/');
      return a && m && j ? `${a}-${m}-${j}` : '';
    }
    const jour = new Date();
    if (quand === 'tomorrow') jour.setDate(jour.getDate() + 1);
    return [
      jour.getFullYear(),
      String(jour.getMonth() + 1).padStart(2, '0'),
      String(jour.getDate()).padStart(2, '0'),
    ].join('-');
  }, [dateLibre]);

  /**
   * La date de fin que la date de depart entraine.
   * @param {'today'|'tomorrow'} quand le choix retenu
   * @returns {string} la date de fin, lisible
   */
  const finPrevue = useCallback((quand) => {
    const jours = program?.durationDays;
    if (!jours) return '';
    const fin = new Date(`${dateDeDepart(quand)}T00:00:00`);
    fin.setDate(fin.getDate() + jours - 1);
    return fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }, [dateDeDepart, program]);

  const onChoose = useCallback(async () => {
    setFailed(false);
    const startDate = dateDeDepart(depart);
    try {
      const inscription = await choose.mutateAsync({ programDocumentId: programId, startDate });
      setChoisitLaDate(false);
      const seances = Array.isArray(inscription?.sessions) ? inscription.sessions : [];
      navigation.navigate(RouteNames.TrainingEnrolled, {
        endDate: seances.length ? seances[seances.length - 1]?.plannedDate : null,
        firstSession: seances[0]?.day?.title || null,
        programTitle: program?.title || '',
        sessionsCount: seances.length,
        startDate,
      });
    } catch {
      setFailed(true);
    }
  }, [choose, dateDeDepart, depart, navigation, program, programId]);

  // 🔎 LE PIED DE LA FICHE, sorti du defilement. Il vivait a la fin du texte :
  // sur un programme a huit journees, il fallait derouler toute la page pour
  // s inscrire.
  const piedDeFiche = alreadyChosen ? (
    <View style={Spaces.gap[8]}>
      <Button
        onPress={() => navigation.navigate(RouteNames.TrainingPlan)}
        title={t('training.actions.resume')}
        variant="Primary"
      />
      {/*
        🔴 Le depart se pose SOUS « Reprendre », en rouge et en plus discret :
        c est un geste qu on doit pouvoir trouver, jamais faire par erreur.
      */}
      <Button
        onPress={() => setConfirmeDepart(true)}
        title={t('training.actions.abandon')}
        variant="Danger"
      />
    </View>
  ) : (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
        {t('training.program.startsToday')}
      </Text>
      <Button
        onPress={() => setChoisitLaDate(true)}
        title={t('training.actions.choose')}
        variant="Primary"
      />
    </View>
  );

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[40]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
          {program ? (
            <View style={Spaces.gap[16]}>
              <View style={Spaces.gap[4]}>
                {/* La pastille dit, des le haut, que c est CE programme qu on suit. */}
                {alreadyChosen && (
                  <View style={{ alignSelf: 'flex-start' }}>
                    <View style={{
                      backgroundColor: Colors.primary500,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                    >
                      <Text style={[Fonts.caption, { color: Colors.neutral00 }]}>
                        {t('training.status.in_progress')}
                      </Text>
                    </View>
                  </View>
                )}
                <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>{program.title}</Text>
                {Boolean(program.subtitle) && (
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{program.subtitle}</Text>
                )}
              </View>

              {Boolean(program.summary) && (
              <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{program.summary}</Text>
              )}

              {/* Trois GROS paves : journees, tests, et le nombre de MESURES —
                  le troisieme chiffre du dessin, que l app remplacait par le
                  niveau alors qu il est deja affiche en meta. */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  [program.sessionsCount || 0, t('training.catalog.stat.days')],
                  [program.testsCount || 0, t('training.catalog.stat.tests')],
                  [chiffres.mesures, t('training.program.stat.measures')],
                ].map(([valeur, mot]) => (
                  <View
                    key={String(mot)}
                    style={{
                      alignItems: 'center',
                      borderColor: withAlpha(Colors.primary500, 0.25),
                      borderRadius: 10,
                      borderWidth: 1,
                      flex: 1,
                      paddingVertical: 10,
                    }}
                  >
                    <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                      {String(valeur)}
                    </Text>
                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>{mot}</Text>
                  </View>
                ))}
              </View>

              {/*
                CE QUE CA DEMANDE — l ecran ou la personne s engage. Tous les
                chiffres sont CALCULES depuis les journees, jamais ecrits en dur.
                🪤 Le dessin du pack ecrivait « 4 seances sur un terrain, 4 en
                salle » : c est faux, et faux dans le sens qui MINIMISE l effort.
                Le programme reel en compte 3 sur un terrain et 5 en salle.
              */}
              {chiffres.total > 0 && (
                <ClubCardSurface
                  style={[
                    Spaces.gap[4],
                    {
                      borderColor: withAlpha(Colors.primary500, 0.25),
                      borderRadius: 12,
                      borderWidth: 1,
                      padding: 14,
                    },
                  ]}
                >
                  <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                    {t('training.program.demands.title')}
                  </Text>
                  {[
                    t('training.program.demands.days', { count: program.durationDays || 0 }),
                    t('training.program.demands.sessions', {
                      count: chiffres.nb,
                      places: chiffres.lieux,
                    }),
                    t('training.program.demands.total', { total: chiffres.total }),
                    t('training.program.demands.longest', { duration: chiffres.plusLongue }),
                    t('training.program.demands.partner'),
                  ].map((ligne) => (
                    <Text key={ligne} style={[Fonts.p3, { color: Colors.neutral200 }]}>
                      {`\u00b7 ${ligne}`}
                    </Text>
                  ))}
                </ClubCardSurface>
              )}

              {/* La progression, quand on suit deja ce programme. */}
              {alreadyChosen && progression.total > 0 && (
                <View style={Spaces.gap[4]}>
                  <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                    {t('training.plan.progress', {
                      count: accordFrancais(progression.done),
                      done: progression.done,
                      total: progression.total,
                    })}
                  </Text>
                  <View style={{
                    backgroundColor: Colors.neutral700,
                    borderRadius: 3,
                    height: 6,
                    overflow: 'hidden',
                  }}
                  >
                    <View style={{
                      backgroundColor: Colors.primary500,
                      height: 6,
                      width: `${Math.round((progression.ratio || 0) * 100)}%`,
                    }}
                    />
                  </View>
                </View>
              )}

              {/*
                LE MATERIEL, EN LISTE A COCHER. Il arrivait en UNE SEULE PHRASE de
                quinze mots : impossible de verifier qu on a tout avant de partir.
                Le contenu porte desormais une vraie liste, et la phrase resumee
                reste pour le catalogue, ou une liste serait trop longue.
              */}
              {(materiel.length > 0 || Boolean(program.equipmentSummary)) && (
                <View style={Spaces.gap[8]}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                    <Text style={[Fonts.h4Bold, { color: Colors.neutral00, flex: 1 }]}>
                      {t('training.program.equipmentCheck')}
                    </Text>
                    {materiel.length > 0 && (
                      <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                        {t('training.program.equipmentCount', { count: materiel.length })}
                      </Text>
                    )}
                  </View>

                  {/* L avertissement qui coute le plus cher a decouvrir sur place. */}
                  <View style={{
                    backgroundColor: withAlpha(Colors.gold500, 0.12),
                    borderColor: Colors.gold500,
                    borderRadius: 10,
                    borderWidth: 1,
                    padding: 12,
                  }}
                  >
                    <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
                      {t('training.program.equipmentWarning')}
                    </Text>
                  </View>

                  {materiel.length > 0 ? materiel.map((ligne) => (
                    <TouchableOpacity
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: coches.includes(ligne) }}
                      key={ligne}
                      onPress={() => setCoches((avant) => (avant.includes(ligne)
                        ? avant.filter((x) => x !== ligne)
                        : [...avant, ligne]))}
                      style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}
                    >
                      <View style={{
                        backgroundColor: coches.includes(ligne) ? Colors.success500 : 'transparent',
                        borderColor: coches.includes(ligne) ? Colors.success500 : Colors.neutral500,
                        borderRadius: 4,
                        borderWidth: 1,
                        height: 18,
                        width: 18,
                      }}
                      />
                      <Text style={[Fonts.p3, { color: Colors.neutral200, flex: 1 }]}>{ligne}</Text>
                    </TouchableOpacity>
                  )) : (
                    <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                      {program.equipmentSummary}
                    </Text>
                  )}
                </View>
              )}

              <View style={Spaces.gap[4]}>
                <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                  {t('training.program.contains')}
                </Text>
                {(Array.isArray(program.days) ? program.days : []).map((day) => (
                  <DayRow day={day} key={day.documentId || day.code} />
                ))}
              </View>

              {failed && (
              <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                {t('training.program.enrollFailed')}
              </Text>
              )}

            </View>
          ) : null}
        </WithDataWrapper>
      </ScrollView>

      {/*
        LE PIED EST FIXE. Le bouton vivait a la fin du texte : sur un programme a
        huit journees, il fallait derouler toute la page pour s inscrire. Colle en
        bas, il reste sous le pouce quoi qu on lise.
      */}
      {Boolean(program) && (
        <View style={[
          Spaces.gap[8],
          Spaces.paddingTop[12],
          { borderTopColor: withAlpha(Colors.primary500, 0.25), borderTopWidth: 1 },
        ]}
        >
          {piedDeFiche}
        </View>
      )}

      <BottomModal close={() => setChoisitLaDate(false)} isVisible={choisitLaDate}>
        <View style={[Spaces.gap[12], Spaces.paddingBottom[24]]}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('training.enroll.when')}
          </Text>
          {/* La consequence, annoncee EN ENTIER avant de s engager. */}
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {t('training.enroll.consequence', {
              days: program?.durationDays || 0,
              sessions: chiffres.nb,
            })}
          </Text>

          {['today', 'tomorrow', 'custom'].map((quand) => (
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ selected: depart === quand }}
              key={quand}
              onPress={() => setDepart(quand)}
              style={{
                alignItems: 'center',
                backgroundColor: depart === quand
                  ? withAlpha(Colors.primary500, 0.14) : 'transparent',
                borderColor: depart === quand
                  ? Colors.primary500 : withAlpha(Colors.primary500, 0.25),
                borderRadius: 10,
                borderWidth: 1,
                flexDirection: 'row',
                gap: 10,
                padding: 12,
              }}
            >
              <View style={{
                alignItems: 'center',
                backgroundColor: depart === quand ? Colors.primary500 : 'transparent',
                borderColor: Colors.primary500,
                borderRadius: 999,
                borderWidth: 1,
                height: 20,
                justifyContent: 'center',
                width: 20,
              }}
              >
                {depart === quand && (
                  <Text style={[Fonts.caption, { color: Colors.neutral00 }]}>✓</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
                  {t(`training.enroll.${quand}`)}
                </Text>
                {/* La date de fin annoncee A COTE du choix : on sait ou ca mene. */}
                {Boolean(dateDeDepart(quand)) && (
                  <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                    {t('training.enroll.until', {
                      end: finPrevue(quand),
                      start: formatSessionDate(dateDeDepart(quand)),
                    })}
                  </Text>
                )}
                {quand === 'custom' && depart === 'custom' && (
                  <DatePickerInput
                    label={t('training.enroll.pickDate')}
                    minimumDate={new Date()}
                    onChange={setDateLibre}
                    value={dateLibre}
                  />
                )}
              </View>
            </TouchableOpacity>
          ))}

          {failed && (
            <Text style={[Fonts.p3, { color: Colors.error500 }]}>
              {t('training.program.enrollFailed')}
            </Text>
          )}

          <Button
            disabled={depart === 'custom' && !dateLibre}
            isLoading={choose.isPending}
            onPress={onChoose}
            title={t('training.enroll.confirm')}
            variant="Primary"
          />
          <Button
            onPress={() => setChoisitLaDate(false)}
            title={t('training.enroll.notNow')}
            variant="Ghost"
          />
        </View>
      </BottomModal>

      <BottomModal close={() => setConfirmeDepart(false)} isVisible={confirmeDepart}>
        <View style={[Spaces.gap[12], Spaces.paddingBottom[24]]}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('training.plan.abandonConfirm.title')}
          </Text>
          {/*
            LA PHRASE QUI RASSURE, et c est le role meme de cet ecran : personne
            ne quitte un programme s il craint de perdre ce qu il a deja mesure.
          */}
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {t('training.plan.abandonConfirm.description')}
          </Text>
          {Boolean(quitter.isError) && (
            <Text style={[Fonts.p3, { color: Colors.error500 }]}>
              {t('training.plan.abandonConfirm.failed')}
            </Text>
          )}
          <Button
            isLoading={quitter.isPending}
            onPress={() => quitter.mutate(undefined, {
              onSuccess: () => {
                setConfirmeDepart(false);
                navigation.navigate(RouteNames.TrainingPlan);
              },
            })}
            title={t('training.plan.abandonConfirm.confirm')}
            variant="Danger"
          />
          <Button
            onPress={() => setConfirmeDepart(false)}
            title={t('training.plan.abandonConfirm.cancel')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default TrainingProgramDetail;
