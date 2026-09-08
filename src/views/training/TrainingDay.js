import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import TrainingBlocks, { RichText } from '@/components/organisms/training/TrainingBlocks';
import TrainingProgressBar from '@/components/organisms/training/TrainingProgressBar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useUpdateTrainingSession } from '@/hooks/useTraining';

/**
 * UNE JOURNÉE — ce qu'on fait, dans quel ordre, et ce qui la rend valide.
 *
 * 🔎 LA BASCULE « PRÉPARER » / « SUR PLACE » EST LE CŒUR DE CET ÉCRAN, pas une
 * décoration. Une journée porte deux choses qui ne se lisent jamais au même moment :
 * du TEXTE long (l'accroche, les repères, le déroulé minute par minute, ce qu'il
 * faudra noter) et une LISTE DE TESTS à cocher. Le texte se lit la veille, assis. La
 * liste se manipule debout, sur le terrain, avec un partenaire qui attend. Les
 * mettre sur le même écran obligeait à faire défiler quarante lignes de protocole
 * pour trouver le test qu'on commence — et le bouton du bas était encore plus loin.
 *
 * 🔎 L'ORDRE DES SECTIONS N'EST PAS DÉCORATIF NON PLUS : les repères (« à savoir
 * avant de partir ») viennent AVANT la chronologie, parce qu'ils disent ce qui
 * invalide la séance. Lire « pas de café ce matin » après le premier test ne sert
 * à rien.
 *
 * 🔎 CE QUI SE COMPTE ICI, ET POURQUOI. Chaque titre de section annonce son volume
 * avant qu'on déplie. Sur le terrain, ouvrir un pavé de quarante-trois lignes pour
 * y chercher une phrase est exactement ce qu'on n'a pas le temps de faire.
 */

/**
 * LES QUATRE SECTIONS DE CONTENU, dans l'ordre, avec l'unité de leur compteur.
 *
 * 🪤 L'UNITÉ CHANGE D'UNE SECTION À L'AUTRE, et ce n'est pas cosmétique : les
 * repères se comptent en points (cinq choses à savoir), le déroulé en lignes (une
 * ligne par créneau horaire), l'échauffement en blocs (un bloc par exercice). Un
 * compteur qui annoncerait « 3 éléments » partout ne dirait plus rien.
 */
const SECTIONS = [
  { clef: 'markers', ouverteAuDepart: true, unite: 'points' },
  { clef: 'timeline', ouverteAuDepart: false, unite: 'lines' },
  { clef: 'warmup', ouverteAuDepart: false, unite: 'blocks' },
  { clef: 'logbook', ouverteAuDepart: false, unite: 'lines' },
];

/**
 * Combien d'éléments porte une section de contenu.
 * @param {any} contenu la valeur brute venue du serveur
 * @returns {number} le nombre d'éléments, 0 si la section est vide
 */
const compter = (contenu) => (Array.isArray(contenu) ? contenu.length : 0);

/**
 * Section repliable : une journée porte beaucoup de texte, l'écran doit rester lisible.
 * @param {object} props Les propriétés de la section.
 * @param {React.ReactNode} props.children Le contenu montré uniquement quand la section
 *   est dépliée.
 * @param {number} props.compte Le nombre d'éléments, annoncé avant qu'on déplie.
 * @param {boolean} [props.defaultOpen] Déplie la section dès le premier affichage.
 * @param {string} props.title L'intitulé cliquable qui plie et déplie la section.
 * @param {string} props.unite La clef de traduction du compteur (`points`, `lines`, `blocks`).
 * @returns {React.ReactElement} une section dépliable avec son entête cliquable
 */
function Section({
  children, compte, defaultOpen = false, title, unite,
}) {
  const {
    Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View
      style={[
        Spaces.gap[8],
        { borderTopColor: Colors.neutral700, borderTopWidth: 1, paddingTop: 12 },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: 8,
          // 44 points : la zone d'appui minimale. On déplie ces sections debout,
          // sur un terrain, souvent avec des gants ou les mains froides — un
          // entête de 20 points de haut se rate une fois sur trois.
          minHeight: 44,
        }}
      >
        <Text style={[Fonts.h4Bold, { color: Colors.neutral00, flex: 1 }]}>{title}</Text>
        <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
          {t(`training.day.${unite}`, { count: compte })}
        </Text>
        {/*
          🪤 Le signe était « + » et « − », deux caractères typographiques : le
          moins se rendait comme un tiret cadratin sur certains Android, et
          l'entête semblait porter une puce de liste. Le chevron du thème pivote,
          il est le même que dans les six autres accordéons de l'app.
        */}
        <Image
          resizeMode="contain"
          source={Images.chevronDown}
          style={{
            height: 12,
            tintColor: Colors.neutral300,
            transform: [{ rotate: open ? '180deg' : '0deg' }],
            width: 12,
          }}
        />
      </TouchableOpacity>
      {open ? children : null}
    </View>
  );
}

/**
 * Ligne cliquable d'un test dans la liste du jour.
 * @param {object} props Les propriétés de la ligne.
 * @param {'done'|'in_progress'|'todo'} props.etat Où en est ce test.
 * @param {(index: number) => void} props.onPress Ouvre l'écran de saisie du test.
 * @param {number} props.rang La position du test dans la journée, pour l'ouvrir.
 * @param {Record<string, any>} props.test Le test du catalogue.
 * @returns {React.ReactElement} une ligne cliquable décrivant un test
 */
function TestRow({
  etat, onPress, rang, test,
}) {
  const {
    Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const mesures = Array.isArray(test.measures) ? test.measures : [];
  /**
   * 🪤 « CALCUL SEUL » NE SE DEVINE PAS AU NOM DU TEST : il se déduit du fait
   * qu'aucune de ses mesures ne se prend sur le terrain. Un test dont tout se
   * calcule au bureau n'a pas besoin du partenaire ni du trépied — le dire évite
   * de l'emporter au stade. La règle ne se déclenche sur aucun test du programme
   * d'aujourd'hui : elle attend le premier qui sera vraiment un calcul.
   */
  const calculSeul = mesures.length > 0 && mesures.every((m) => m?.moment === 'differe');

  // 🎨 TROIS COULEURS, PAS CINQ : vert quand c'est fait, cyan quand c'est entamé,
  // gris sinon. Un coup d'œil sur la colonne de gauche doit suffire.
  const teinte = {
    done: Colors.success500,
    in_progress: Colors.primary500,
    todo: Colors.neutral600,
  }[etat];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => onPress(rang)}
      style={[
        Spaces.gap[4],
        {
          backgroundColor: Colors.neutral800,
          // Le cadre cyan est réservé au test EN COURS : c'est le seul de la liste
          // qu'on peut reprendre là où on l'a laissé.
          borderColor: etat === 'todo' ? Colors.neutral700 : teinte,
          borderRadius: 10,
          borderWidth: etat === 'in_progress' ? 2 : 1,
          padding: 12,
        },
      ]}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <View style={{
          backgroundColor: teinte,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
        >
          <Text style={[Fonts.captionBold, { color: Colors.neutral00 }]}>{test.code}</Text>
        </View>
        <Text
          numberOfLines={2}
          style={[Fonts.p2, { color: Colors.neutral00, flex: 1 }]}
        >
          {test.name}
        </Text>
        {/* La flèche dit que la ligne s'ouvre. Sans elle, la carte se lit comme
            une étiquette, et on cherche un bouton qui n'existe pas. */}
        <Image
          resizeMode="contain"
          source={Images.chevronDown}
          style={{
            height: 12,
            tintColor: Colors.neutral400,
            transform: [{ rotate: '-90deg' }],
            width: 12,
          }}
        />
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
        {Boolean(test.estimatedMinutes) && (
          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
            {/* Le « ≈ » n'est pas une coquetterie : ces durées sont des estimations
                du programme, et un joueur qui lit « 10 min » sec se croit en retard. */}
            {`≈ ${test.estimatedMinutes} min`}
          </Text>
        )}
        {mesures.length > 0 && (
          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
            {t('training.day.measures', { count: mesures.length })}
          </Text>
        )}
        {etat === 'in_progress' && (
          <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
            {t('training.day.inProgress')}
          </Text>
        )}
        {calculSeul && (
          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
            {t('training.day.computeOnly')}
          </Text>
        )}
        {test.isOptional && (
          <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
            {t('training.test.optional')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Écran d'une journée du programme.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} props.route
 * @returns {React.ReactElement} l'écran d'une journée
 */
function TrainingDay({ navigation, route }) {
  const {
    Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const sessionId = route?.params?.sessionId;

  const {
    enrollment, error, isLoading, refetch, sessions,
  } = useMyTraining();
  const updateSession = useUpdateTrainingSession();

  const session = useMemo(
    () => sessions.find((item) => item.documentId === sessionId) || null,
    [sessionId, sessions],
  );

  /** La journée du catalogue porte le contenu ; la séance ne porte que l'état. */
  const day = useMemo(() => {
    const dayId = session?.day?.documentId || route?.params?.dayId;
    /** @type {Record<string, any>[]} */
    const days = Array.isArray(enrollment?.program?.days) ? enrollment?.program?.days : [];
    return days.find((item) => item.documentId === dayId) || session?.day || null;
  }, [enrollment, route?.params?.dayId, session]);

  const tests = useMemo(() => (Array.isArray(day?.tests) ? day.tests : []), [day]);
  const finie = session?.status === 'done';
  const enCours = session?.status === 'in_progress';

  /**
   * 🪤 L'ONGLET DE DÉPART SE DÉDUIT DE L'ÉTAT, il ne se choisit pas au hasard.
   * Tant que la séance n'a pas commencé, on est chez soi la veille : on prépare.
   * Dès qu'elle est lancée — ou finie — on est sur place, et la seule chose qui
   * compte est la liste des tests. Ouvrir « Préparer » à quelqu'un qui a déjà un
   * chronomètre en main lui coûte un geste à chaque fois qu'il rouvre l'écran.
   */
  const [ongletChoisi, setOngletChoisi] = useState(/** @type {string|null} */ (null));
  const onglet = ongletChoisi || (enCours || finie ? 'onSite' : 'prepare');

  /**
   * OÙ EN EST CHAQUE TEST, en un seul passage sur les résultats.
   *
   * 🪤 « FAIT » N'EST PAS « A UNE LIGNE » : un test qui porte vingt mesures et dont
   * une seule est saisie n'est pas fait, il est ENTAMÉ. La version précédente les
   * confondait, et la barre annonçait une journée terminée dès le premier chiffre.
   */
  const etats = useMemo(() => {
    /** @type {Record<string, any>[]} */
    const brutes = Array.isArray(session?.results) ? session.results : [];
    /** @type {Record<string, number>} */
    const parTest = {};
    brutes.forEach((row) => {
      const code = row?.test?.code;
      if (!code) return;
      parTest[code] = (parTest[code] || 0) + 1;
    });
    /** @type {Record<string, 'done'|'in_progress'|'todo'>} */
    const sortie = {};
    /** @type {Record<string, any>[]} */ (tests).forEach((test) => {
      const attendues = Array.isArray(test.measures) ? test.measures.length : 0;
      const saisies = parTest[test.code] || 0;
      if (saisies === 0) sortie[test.code] = 'todo';
      else if (attendues && saisies < attendues) sortie[test.code] = 'in_progress';
      else sortie[test.code] = 'done';
    });
    return sortie;
  }, [session, tests]);

  const chiffres = useMemo(() => {
    const codes = Object.values(etats);
    const faits = codes.filter((etat) => etat === 'done').length;
    const mesures = /** @type {Record<string, any>[]} */ (tests)
      .reduce((n, test) => n + (Array.isArray(test.measures) ? test.measures.length : 0), 0);
    return {
      faits,
      mesures,
      ratio: tests.length ? faits / tests.length : 0,
      total: tests.length,
    };
  }, [etats, tests]);

  /** La ligne sous le titre : la date, puis le lieu, reliés par un point médian. */
  const sousTitre = useMemo(() => {
    const iso = session?.plannedDate;
    const date = iso
      ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', weekday: 'long',
      })
      : '';
    const lieu = day?.place ? String(day.place).toLowerCase() : '';
    if (date && lieu) return t('training.day.heading', { date, place: lieu });
    return date || lieu;
  }, [day, session, t]);

  const start = useCallback(async () => {
    if (!session?.documentId) return;
    // ⛔ LA BARRIÈRE EST OBLIGATOIRE quand la journée la réclame : on ne mesure pas
    // quelqu'un sans savoir dans quel état il est. Le bouton ne démarre donc pas la
    // séance, il emmène aux cinq questions — ce sont elles qui la démarrent.
    if (day?.requiresFreshnessCheck) {
      navigation.navigate(RouteNames.TrainingFreshness, { sessionId: session.documentId });
      return;
    }
    await updateSession.mutateAsync({
      payload: { status: 'in_progress' },
      sessionDocumentId: session.documentId,
    });
  }, [day, navigation, session, updateSession]);

  const finish = useCallback(async () => {
    if (!session?.documentId) return;
    // 🪤 ON NE QUITTE PLUS L'ÉCRAN. La version précédente renvoyait au planning dès
    // la journée terminée : l'état « finie » — celui qui montre le récapitulatif et
    // la porte vers le carnet — n'était donc jamais visible, sauf à revenir à la
    // main sur une journée qu'on croyait close.
    await updateSession.mutateAsync({
      payload: { status: 'done' },
      sessionDocumentId: session.documentId,
    });
  }, [session, updateSession]);

  const openTest = useCallback((/** @type {number} */ index) => {
    navigation.navigate(RouteNames.TrainingTest, {
      dayId: day?.documentId,
      sessionId,
      testIndex: index,
    });
  }, [day, navigation, sessionId]);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
            {day ? (
              <View style={Spaces.gap[16]}>
                {/* ─── LE CHAPEAU ────────────────────────────────────────────
                    Le CODE est le titre, pas le nom de la journée : c'est ce
                    qu'on cherche quand on ouvre l'écran au bord du terrain
                    (« c'est bien le jour B ? »), et c'est ce qui est écrit sur
                    la feuille de route du programme. Le nom vient dessous. */}
                <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 12 }}>
                  <View style={[Spaces.gap[4], { flex: 1 }]}>
                    <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>
                      {day.code ? t('training.day.code', { code: day.code }) : day.title}
                    </Text>
                    {Boolean(sousTitre) && (
                      <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{sousTitre}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {Boolean(day.durationMinutes) && (
                      <Text style={[Fonts.p2Bold, { color: Colors.primary400 }]}>
                        {t('training.day.duration', { count: day.durationMinutes })}
                      </Text>
                    )}
                    {finie && (
                      <Text style={[Fonts.caption, { color: Colors.success500 }]}>
                        {t('training.day.alreadyDone')}
                      </Text>
                    )}
                    {/*
                      🎯 LA DEUXIEME PORTE vers la feuille de decalage. On decide de
                      repousser en LISANT la journee — « 120 min en salle un mercredi,
                      non » — pas en regardant la liste. Elle mene a l unique feuille
                      de decalage de l app plutot que d en poser une seconde : deux
                      feuilles divergent, et celle-ci porte la regle des ecarts.
                    */}
                    {!finie && !enCours && Boolean(session?.documentId) && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => navigation.navigate(RouteNames.TrainingSessions, {
                          postponeSessionId: session.documentId,
                        })}
                        style={{
                          borderColor: withAlpha(Colors.primary500, 0.5),
                          borderRadius: 999,
                          borderWidth: 1,
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                        }}
                      >
                        <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
                          {t('training.actions.postpone')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {Boolean(day.title) && Boolean(day.code) && (
                  <Text style={[Fonts.h4Bold, { color: Colors.neutral100, marginTop: -12 }]}>
                    {day.title}
                  </Text>
                )}

                {/* ─── LA BASCULE ───────────────────────────────────────────── */}
                <View style={{
                  backgroundColor: withAlpha(Colors.primary500, 0.1),
                  borderRadius: 10,
                  flexDirection: 'row',
                  padding: 3,
                }}
                >
                  {['prepare', 'onSite'].map((clef) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ selected: onglet === clef }}
                      key={clef}
                      onPress={() => setOngletChoisi(clef)}
                      style={{
                        alignItems: 'center',
                        backgroundColor: onglet === clef ? Colors.primary500 : 'transparent',
                        borderRadius: 8,
                        flex: 1,
                        justifyContent: 'center',
                        minHeight: 40,
                      }}
                    >
                      <Text
                        style={[
                          Fonts.p3Bold,
                          { color: onglet === clef ? Colors.neutral00 : Colors.neutral300 },
                        ]}
                      >
                        {t(`training.day.tab.${clef}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {onglet === 'prepare' ? (
                  <View style={Spaces.gap[16]}>
                    <View style={Spaces.gap[4]}>
                      {Boolean(day.kicker) && (
                        <RichText
                          color={Colors.neutral00}
                          style={[Fonts.caption, { color: Colors.primary400 }]}
                          text={day.kicker}
                        />
                      )}
                      {Boolean(day.lead) && (
                        <RichText
                          color={Colors.neutral00}
                          style={[Fonts.p3, { color: Colors.neutral300 }]}
                          text={day.lead}
                        />
                      )}
                    </View>

                    {/* 🪤 L'ENCART EST UN BOUTON, pas un pavé de texte. Il annonce
                        la barrière ET il y mène : c'est le seul endroit où on peut
                        répondre aux questions avant d'appuyer sur « Commencer ». */}
                    {Boolean(day.requiresFreshnessCheck) && !finie && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => navigation.navigate(RouteNames.TrainingFreshness, {
                          sessionId: session?.documentId,
                        })}
                        style={{
                          backgroundColor: withAlpha(Colors.gold500, 0.12),
                          borderLeftColor: Colors.gold500,
                          borderLeftWidth: 3,
                          borderRadius: 8,
                          gap: 6,
                          padding: 12,
                        }}
                      >
                        <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
                          {t('training.day.freshnessRequired')}
                        </Text>
                        <Text style={[Fonts.captionBold, { color: Colors.gold500 }]}>
                          {t('training.day.freshnessAction')}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* 🪤 UN TITRE SANS CONTENU NE S'AFFICHE PAS. Trois des quatre
                        sections s'affichaient toujours : on dépliait « Le déroulé »
                        sur du vide, et on en concluait que l'app avait perdu les
                        données du programme. */}
                    {SECTIONS.map(({ clef, ouverteAuDepart, unite }) => {
                      const compte = compter(day[clef]);
                      if (compte === 0) return null;
                      return (
                        <Section
                          compte={compte}
                          defaultOpen={ouverteAuDepart}
                          key={clef}
                          title={t(`training.day.${clef}`)}
                          unite={unite}
                        >
                          {clef === 'markers' ? (
                            <View style={Spaces.gap[8]}>
                              {/** @type {Record<string, any>[]} */ (day.markers).map((marker) => (
                                <View key={marker.label} style={Spaces.gap[4]}>
                                  <Text style={[Fonts.captionBold, { color: Colors.primary400 }]}>
                                    {marker.label}
                                  </Text>
                                  <RichText
                                    color={Colors.neutral00}
                                    style={[Fonts.p3, { color: Colors.neutral300 }]}
                                    text={marker.value}
                                  />
                                </View>
                              ))}
                            </View>
                          ) : (
                            <TrainingBlocks blocks={day[clef]} />
                          )}
                        </Section>
                      );
                    })}
                  </View>
                ) : (
                  <View style={Spaces.gap[16]}>
                    {/* ─── OÙ J'EN SUIS ─────────────────────────────────────── */}
                    <View style={Spaces.gap[4]}>
                      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                        <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>
                          {t('training.day.progress', {
                            count: chiffres.faits,
                            done: chiffres.faits,
                            total: chiffres.total,
                          })}
                        </Text>
                        {chiffres.mesures > 0 && (
                          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                            {t('training.day.measures', { count: chiffres.mesures })}
                          </Text>
                        )}
                      </View>
                      <TrainingProgressBar
                        color={finie ? Colors.success500 : Colors.primary500}
                        ratio={chiffres.ratio}
                      />
                    </View>

                    <View style={Spaces.gap[8]}>
                      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                        <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                          {t('training.day.testsTitle')}
                        </Text>
                        {/* Le compteur dit d'emblée combien il y en a : c'est ce
                            qui permet de décider si on a le temps de tout faire. */}
                        <View style={{
                          backgroundColor: withAlpha(Colors.primary500, 0.2),
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 1,
                        }}
                        >
                          <Text style={[Fonts.captionBold, { color: Colors.primary400 }]}>
                            {chiffres.total}
                          </Text>
                        </View>
                      </View>
                      {/** @type {Record<string, any>[]} */ (tests).map((test, index) => (
                        <TestRow
                          etat={etats[test.code] || 'todo'}
                          key={test.documentId || test.code}
                          onPress={openTest}
                          rang={index}
                          test={test}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : null}
          </WithDataWrapper>
        </ScrollView>

        {/* ─── LE PIED, COLLÉ EN BAS ────────────────────────────────────────
            Il sort du défilement. Sur une journée de six tests avec ses quatre
            sections dépliées, « Commencer » se trouvait à quarante lignes du
            bas : on arrivait au terrain et on cherchait le bouton. */}
        {day ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.neutral900, 0.92),
              borderTopColor: withAlpha(Colors.primary500, 0.2),
              borderTopWidth: 1,
              paddingHorizontal: 16,
              paddingTop: 12,
            }}
          >
            {finie ? (
              /* LA TROISIÈME FORME DU PIED. Une ligne « journée terminée » était
                 un cul-de-sac : la seule chose qu'on veut faire après une séance,
                 c'est aller voir ce qu'elle a produit. */
              <Button
                onPress={() => navigation.navigate(RouteNames.TrainingLogbook)}
                title={t('training.day.seeMeasures', { count: chiffres.mesures })}
                variant="Secondary"
              />
            ) : (
              <Button
                isLoading={updateSession.isPending}
                onPress={enCours ? finish : start}
                title={t(enCours ? 'training.actions.finishDay' : 'training.actions.startDay')}
                variant={enCours ? 'Secondary' : 'Primary'}
              />
            )}
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

export default TrainingDay;
