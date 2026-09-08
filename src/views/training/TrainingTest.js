import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import TrainingAttemptCard from '@/components/organisms/training/TrainingAttemptCard';
import TrainingBlocks from '@/components/organisms/training/TrainingBlocks';
import TrainingMeasureInput from '@/components/organisms/training/TrainingMeasureInput';
import TrainingProgressBar from '@/components/organisms/training/TrainingProgressBar';
import TrainingTimer from '@/components/organisms/training/TrainingTimer';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  aSaisirPlusTard, ceQueCeTestAlimente, mesuresParFamille,
} from '@/views/training/trainingTestModel';

import allerDansLOnglet from '@/navigation/allerDansLOnglet';
import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useTrainingResults } from '@/hooks/useTraining';

/**
 * LE TUNNEL D'UN TEST — l'écran qu'on tient à la main sur un terrain.
 *
 * 🔎 DEUX ONGLETS, ET C'EST LA DÉCISION D'ERGONOMIE LA PLUS IMPORTANTE DE L'ÉCRAN.
 *   · « Faire » : le protocole, le chronomètre, la saisie. C'est ce qu'on regarde
 *     entre deux essais, avec les mains sales et trente secondes devant soi.
 *   · « Comprendre » : pourquoi ce test, la mise en place cotée, comment lire le
 *     résultat, la vidéo du geste. Ça se lit avant de partir, ou une fois.
 *
 * 🔎 ET « FAIRE » SE FAIT EN DEUX TEMPS. On lit le protocole, on appuie sur « Passer
 * à la saisie », on arrive sur la boucle d'essais. Tout sur une seule page obligeait
 * à faire défiler quatre écrans de texte pour retrouver la case où taper 31,4 — à
 * chaque essai, huit fois de suite.
 *
 * 🪤 LA BOUCLE D'ESSAIS EST DANS LE BON SENS DEPUIS LE 2026-09-08 : une carte par
 * essai, contenant toutes les mesures de cet essai-là. L'inverse — une mesure et tous
 * ses essais — obligeait à remonter et redescendre l'écran entre chaque saut, avec le
 * risque de taper la hauteur du saut 2 dans la case du saut 1.
 *
 * 📴 CHAQUE SAISIE EST ÉCRITE EN LOCAL D'ABORD. L'envoi au serveur est un geste
 * séparé, et son échec n'efface rien : le compteur « en attente » reste visible et
 * les mesures repartiront plus tard.
 */

/**
 * Les durées de récupération proposées d'un geste, en secondes.
 *
 * 🪤 Les trois plus COURTES manquaient (10, 15, 45 s), et ce sont celles des
 * récupérations entre deux tirs ou deux appuis — exactement les cas où on n'a pas le
 * temps de régler une minuterie à la main.
 */
const RECOVERY_PRESETS = [10, 15, 30, 45, 60, 90, 120, 180, 240, 300, 480];

/** Les couleurs de la frise des essais : fait, nul, à faire. */
const TEINTES_ESSAI = { done: 'success500', todo: 'neutral600', void: 'gold500' };

/**
 * Un onglet du bandeau « Faire / Comprendre » : il annonce aux lecteurs d'écran
 * lequel des deux est sélectionné, et se remplit de couleur quand c'est le sien.
 * @param {object} props
 * @param {boolean} props.active vrai quand c'est l'onglet actuellement affiché
 * @param {string} props.label le libellé visible de l'onglet
 * @param {() => void} props.onPress appelé quand on appuie sur l'onglet
 * @returns {React.ReactElement} l'onglet cliquable
 */
function Tab({ active, label, onPress }) {
  const { Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        backgroundColor: active ? Colors.primary500 : 'transparent',
        borderRadius: 8,
        flex: 1,
        justifyContent: 'center',
        // 44 points : on change d'onglet debout, entre deux essais.
        minHeight: 44,
      }}
    >
      <Text
        style={[
          Fonts.p3,
          { color: active ? Colors.neutral00 : Colors.neutral300, textAlign: 'center' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Une rubrique titrée du test (protocole, cas d'invalidation, mise en place…) :
 * elle disparaît entièrement quand le serveur n'a envoyé aucun bloc pour elle.
 * @param {object} props
 * @param {Array<Record<string, any>>} props.blocks les blocs de contenu riche à afficher
 * @param {string} props.title le titre posé au-dessus des blocs
 * @returns {React.ReactElement|null} la rubrique titrée, ou rien s'il n'y a aucun bloc
 */
function Block({ blocks, title }) {
  const { Colors, Fonts, Spaces } = useTheme();
  if (!Array.isArray(blocks) || !blocks.length) return null;
  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{title}</Text>
      <TrainingBlocks blocks={blocks} />
    </View>
  );
}

/**
 * Une rubrique repliable : le titre reste, le contenu se range.
 * @param {object} props
 * @param {React.ReactNode} props.children ce qui se replie
 * @param {number} props.compte combien d'éléments elle porte, annoncé avant de déplier
 * @param {string} props.title l'intitulé cliquable
 * @returns {React.ReactElement} la rubrique repliable
 */
function Repliable({ children, compte, title }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const [ouvert, setOuvert] = useState(false);

  return (
    <View style={Spaces.gap[8]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: ouvert }}
        onPress={() => setOuvert((v) => !v)}
        style={{
          alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 44,
        }}
      >
        <Text style={[Fonts.h4Bold, { color: Colors.neutral00, flex: 1 }]}>{title}</Text>
        <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
          {t('training.day.lines', { count: compte })}
        </Text>
      </TouchableOpacity>
      {ouvert ? children : null}
    </View>
  );
}

/**
 * Un lien du test : sa nature, son titre, sa description, et le chevron qui dit qu'il ouvre.
 * @param {object} props
 * @param {Record<string, any>} props.link le lien venu du serveur
 * @returns {React.ReactElement} la rangée du lien
 */
function LienRange({ link }) {
  const {
    Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      accessibilityRole="link"
      onPress={() => link.url && Linking.openURL(link.url).catch(() => {})}
      style={[
        Spaces.gap[4],
        {
          alignItems: 'center',
          borderColor: withAlpha(Colors.primary500, 0.2),
          borderRadius: 10,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 10,
          // 64 points : ces rangées s'ouvrent une main sur le téléphone, l'autre
          // sur un trépied. Le pack impose cette hauteur, et il a raison.
          minHeight: 64,
          paddingHorizontal: 12,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        {/* L'ÉTIQUETTE DE NATURE dit ce qu'on va ouvrir avant de l'ouvrir : une
            vidéo de geste, un logiciel à installer, ou la source scientifique.
            Sans elle, trois liens bleus se ressemblent tous. */}
        {Boolean(link.nature) && (
          <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
            {t(`training.links.nature.${link.nature}`)}
          </Text>
        )}
        <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
          {/* 🪤 Le serveur ecrit `titre`, en francais : les 105 liens du
              programme portent ce champ-la. `title` et `label` restent en
              secours pour un programme ecrit autrement. */}
          {link.titre || link.title || link.label || link.url}
        </Text>
        {Boolean(link.description) && (
          <Text numberOfLines={2} style={[Fonts.caption, { color: Colors.neutral400 }]}>
            {link.description}
          </Text>
        )}
      </View>
      <Image
        resizeMode="contain"
        source={Images.chevronDown}
        style={{
          height: 12, tintColor: Colors.neutral400, transform: [{ rotate: '-90deg' }], width: 12,
        }}
      />
    </TouchableOpacity>
  );
}

/**
 * L'écran d'un test sur le terrain.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} props.route
 * @returns {React.ReactElement} le tunnel d'un test
 */
function TrainingTest({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  const sessionId = route?.params?.sessionId;
  const [index, setIndex] = useState(Number(route?.params?.testIndex) || 0);
  // On peut arriver ici pour COMPRENDRE, pas pour faire : la fiche d une journee
  // ouvre le « Pourquoi » depuis sa liste, la veille, quand on a le temps de lire.
  const [tab, setTab] = useState(route?.params?.tab === 'learn' ? 'learn' : 'do');
  const [saisieOuverte, setSaisieOuverte] = useState(false);
  /**
   * LA MINUTERIE PART SUR LA DUREE PRESCRITE, plus sur 2:00 en dur.
   *
   * 🪤 La donnee existait deja, mais pas au bon endroit : le TABLEAU DU DEROULE de
   * chaque journee porte une recuperation par BLOC, et chaque ligne commence par le
   * code du test. Le lien n etait jamais fait. Il l est desormais a l ecriture des
   * donnees (`enrichir-recuperations.js`), pas a chaque affichage.
   *
   * ⚠️ 14 des 33 tests n apparaissent dans aucun tableau de deroule : ils gardent
   * les 2 minutes. Mieux vaut un defaut assume qu un chiffre invente — une
   * recuperation fausse est pire qu une recuperation generique.
   */
  const [recovery, setRecovery] = useState(120);
  /** @type {[Record<string, Record<string, any>>, Function]} */
  const [values, setValues] = useState({});
  const [saveFailed, setSaveFailed] = useState(false);
  const [syncError, setSyncError] = useState(false);

  const {
    enrollment, error, isLoading, refetch, sessions,
  } = useMyTraining();
  const results = useTrainingResults(sessionId);

  const session = useMemo(
    () => sessions.find((item) => item.documentId === sessionId) || null,
    [sessionId, sessions],
  );

  const day = useMemo(() => {
    const dayId = session?.day?.documentId || route?.params?.dayId;
    /** @type {Record<string, any>[]} */
    const days = Array.isArray(enrollment?.program?.days) ? enrollment?.program?.days : [];
    return days.find((item) => item.documentId === dayId) || null;
  }, [enrollment, route?.params?.dayId, session]);

  /** @type {Record<string, any>[]} */
  const tests = useMemo(() => {
    const brutes = day?.tests;
    return Array.isArray(brutes) ? [...brutes] : [];
  }, [day]);
  const test = tests[index] || null;

  const familles = useMemo(() => mesuresParFamille(test), [test]);
  const essais = useMemo(
    () => Math.max(1, ...familles.parEssai.map((m) => Number(m.attempts) || 1)),
    [familles],
  );

  // Chaque test a SA recuperation : passer au suivant sans remettre la minuterie
  // laisserait le chrono du sprint sur un test de force.
  useEffect(() => {
    const prescrite = Number(test?.recoverySeconds);
    setRecovery(Number.isFinite(prescrite) && prescrite > 0 ? prescrite : 120);
  }, [test?.recoverySeconds]);

  /** Les valeurs affichées viennent du serveur ET du local, le local non envoyé gagnant. */
  useEffect(() => {
    if (!test?.documentId || !sessionId) return;
    const brutes = session?.results;
    const merged = results.merge(Array.isArray(brutes) ? [...brutes] : []);
    /** @type {Record<string, Record<string, any>>} */
    const forThisTest = {};
    /** @type {Record<string, any>[]} */ (Object.values(merged)).forEach((row) => {
      const rowTestId = row.test?.documentId || row.testDocumentId;
      if (rowTestId !== test.documentId) return;
      forThisTest[`${row.measureKey}|${row.attempt ?? 1}|${row.side || 'none'}`] = row;
    });
    setValues(forThisTest);
    // `results` est recréé à chaque rendu : le dépendre relancerait la boucle sans fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.results, sessionId, test?.documentId]);

  const record = useCallback((/** @type {Record<string, any>} */ row) => {
    if (!test?.documentId) return;
    const full = { ...row, testDocumentId: test.documentId };
    // Si le telephone refuse d'ecrire, on le DIT et on n'affiche pas la valeur
    // comme enregistree : un chiffre vert sur une saisie perdue est le pire cas.
    try {
      results.record(full);
    } catch {
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);
    setValues((/** @type {Record<string, any>} */ previous) => ({
      ...previous,
      [`${row.measureKey}|${row.attempt ?? 1}|${row.side || 'none'}`]: { ...full, isValid: true },
    }));
  }, [results, test]);

  /**
   * Écrit plusieurs lignes d'un coup, sans perdre celles qui suivent.
   * @param {Record<string, any>[]} lignes les lignes à enregistrer
   * @returns {void} rien
   */
  const enregistrerPlusieurs = useCallback((lignes) => {
    if (!test?.documentId) return;
    /** @type {Record<string, any>} */
    const ajouts = {};
    try {
      lignes.forEach((row) => {
        const full = { ...row, testDocumentId: test.documentId };
        results.record(full);
        ajouts[`${row.measureKey}|${row.attempt ?? 1}|${row.side || 'none'}`] = full;
      });
    } catch {
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);
    setValues((previous) => ({ ...previous, ...ajouts }));
  }, [results, test]);

  const valuesFor = useCallback((/** @type {string} */ measureKey) => {
    /** @type {Record<string, Record<string, any>>} */
    const out = {};
    Object.entries(values).forEach(([key, row]) => {
      const [rowKey, attempt, side] = key.split('|');
      if (rowKey === measureKey) out[`${attempt}|${side}`] = row;
    });
    return out;
  }, [values]);

  /**
   * Les lignes déjà saisies pour un essai donné.
   * @param {number} essai le numéro de l'essai
   * @returns {Record<string, any>[]} les lignes de cet essai
   */
  const lignesDeLEssai = useCallback((essai) => Object.entries(values)
    .filter(([clef]) => Number(clef.split('|')[1]) === essai)
    .map(([, row]) => row), [values]);

  /**
   * 🪤 « ESSAI NUL » BASCULE TOUT L'ESSAI, pas une mesure. Un faux départ annule le
   * saut entier ; marquer une seule de ses mesures laisserait au carnet un essai à
   * moitié valide, qui fausse toutes les moyennes sans que rien ne le signale.
   * @param {number} essai le numéro de l'essai à basculer
   * @returns {void} rien
   */
  const basculerEssai = useCallback((essai) => {
    const lignes = lignesDeLEssai(essai);
    // Sans aucune ligne saisie, il n'y a rien à annuler : on marque quand même
    // l'intention sur les mesures du test, pour que la carte passe en or.
    const cibles = lignes.length
      ? lignes
      : familles.parEssai.map((m) => ({
        attempt: essai, measureKey: m.key, side: m.sides ? 'left' : 'none',
      }));
    const devientNul = !lignes.some((row) => row.isValid === false);
    // 🧑‍⚖️ ON SIGNE LE VERDICT. Cette bascule est celle du TERRAIN : on l'actionne
    // sur place, parce qu'on a VU quelque chose (un plot touché, un départ anticipé).
    // L'autre juge est la vidéo, le soir, sur l'écran des relevés — et sur 22 des
    // 33 tests du programme, les deux sortes de critères coexistent sur le même
    // essai. Sans signature, le carnet garde le verdict mais pas son auteur.
    enregistrerPlusieurs(cibles.map((row) => ({
      ...row,
      invalidatedBy: devientNul ? 'terrain' : null,
      isValid: !devientNul,
    })));
  }, [enregistrerPlusieurs, familles, lignesDeLEssai]);

  /**
   * Note le motif sur TOUTES les lignes de l'essai : le carnet en garde une par ligne.
   * @param {number} essai le numéro de l'essai
   * @param {string} raison pourquoi il est nul
   * @returns {void} rien
   */
  const noterMotif = useCallback((essai, raison) => {
    const lignes = lignesDeLEssai(essai);
    if (!lignes.length) return;
    enregistrerPlusieurs(lignes.map((row) => ({ ...row, invalidReason: raison })));
  }, [enregistrerPlusieurs, lignesDeLEssai]);

  const send = useCallback(async () => {
    setSyncError(false);
    try {
      await results.sync.mutateAsync();
    } catch {
      setSyncError(true);
    }
  }, [results]);

  const pending = results.pendingCount();
  const alimente = useMemo(
    () => ceQueCeTestAlimente(test, (enrollment?.program?.days || [])
      .flatMap((/** @type {Record<string, any>} */ j) => j.tests || [])),
    [enrollment, test],
  );

  /** L'ÉTAT DE CHAQUE ESSAI, pour la frise : fait, nul, ou à faire. */
  const etatsDesEssais = useMemo(() => Array.from({ length: essais }, (_, i) => {
    const lignes = lignesDeLEssai(i + 1);
    if (!lignes.length) return 'todo';
    if (lignes.some((row) => row.isValid === false)) return 'void';
    return 'done';
  }), [essais, lignesDeLEssai]);

  const premierAFaire = etatsDesEssais.indexOf('todo');

  /**
   * COMBIEN DE CASES CE TEST DEMANDE, ET COMBIEN SONT REMPLIES.
   *
   * 🪤 CE N'EST PAS LE NOMBRE D'ESSAIS. Le test T4 du programme demande 61 cases :
   * onze essais qui portent chacun plusieurs mesures. Sur un écran de téléphone, on
   * en voit six à la fois — donc au bout de trois minutes on ne sait plus si on en
   * a rempli vingt ou quarante, et on recommence par sécurité. Le compteur ne
   * s'affiche QUE quand il y a de quoi se perdre : sur trois cases, il est du bruit.
   */
  const cases = useMemo(() => {
    const parCote = familles.parEssai.reduce(
      (n, m) => n + (m?.sides ? 2 : 1),
      0,
    );
    const total = parCote * essais + familles.calculees.length + familles.uneFois.length;
    const remplies = Object.values(values)
      .filter((row) => (row?.value !== null && row?.value !== undefined
        ? true : Boolean(row?.textValue))).length;
    return { remplies, total };
  }, [essais, familles, values]);

  /** Le seuil au-delà duquel on ne compte plus de tête. */
  const BEAUCOUP_DE_CASES = 12;

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      // ⌨️ LE CLAVIER CACHAIT LE CHAMP EN COURS. Sur la dernière carte d'essai,
      // taper une valeur ouvrait un clavier qui recouvrait exactement la case
      // qu'on remplissait : on tapait à l'aveugle. Le défilement au clavier est
      // l'option que ce gabarit expose, et elle était laissée à « non ».
      keyboardScroll
    >
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[40]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
          {/*
            📴 CE TEST N'EST PAS SUR LE TÉLÉPHONE. Ça arrive : on ouvre un test
            depuis une notification, ou après avoir vidé le cache, sans réseau au
            stade. L'écran rendait alors une PAGE BLANCHE — on croyait l'app
            cassée. La carte dit ce qui se passe, propose de réessayer, ET
            rappelle ce qui marche quand même : les mesures déjà saisies sont sur
            le téléphone et repartiront toutes seules.
          */}
          {!test && !isLoading && (
            <View
              style={{
                backgroundColor: withAlpha(Colors.gold500, 0.12),
                borderColor: withAlpha(Colors.gold500, 0.4),
                borderRadius: 12,
                borderWidth: 1,
                gap: 10,
                padding: 16,
              }}
            >
              <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>
                {t('training.test.offlineTitle')}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                {t('training.test.offlineBody', { count: pending })}
              </Text>
              <Button
                onPress={refetch}
                title={t('training.actions.retry')}
                variant="Secondary"
              />
            </View>
          )}
          {test ? (
            <View style={Spaces.gap[16]}>
              <View style={Spaces.gap[4]}>
                <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
                  {t('training.test.step', { current: index + 1, total: tests.length })}
                </Text>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                  <View style={{
                    backgroundColor: Colors.primary500,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                  >
                    <Text style={[Fonts.captionBold, { color: Colors.neutral00 }]}>
                      {test.code}
                    </Text>
                  </View>
                  <Text style={[Fonts.h3Bold, { color: Colors.neutral00, flex: 1 }]}>
                    {test.name}
                  </Text>
                </View>
                {/* LA LIGNE D'IDENTITÉ. Trois chiffres qui décident si on lance le
                    test maintenant ou après : combien de temps, combien d'essais,
                    et combien de mesures il faudra noter. */}
                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {[
                    test.estimatedMinutes ? `≈ ${test.estimatedMinutes} min` : null,
                    t('training.test.attempts', { count: essais }),
                    t('training.day.measures', {
                      count: Array.isArray(test.measures) ? test.measures.length : 0,
                    }),
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>

              <View style={{
                backgroundColor: Colors.neutral800,
                borderRadius: 10,
                flexDirection: 'row',
                padding: 4,
              }}
              >
                <Tab
                  active={tab === 'do'}
                  label={t('training.test.tabDo')}
                  onPress={() => setTab('do')}
                />
                <Tab
                  active={tab === 'learn'}
                  label={t('training.test.tabLearn')}
                  onPress={() => setTab('learn')}
                />
              </View>

              {tab === 'do' && !saisieOuverte && (
                <View style={Spaces.gap[16]}>
                  {/* 🔎 LE SCHÉMA COTÉ EST ICI, pas dans l'autre onglet. C'est ce
                      qu'on regarde en installant le matériel — donc pendant qu'on
                      FAIT, pas pendant qu'on comprend. */}
                  {Array.isArray(test.setup) && (
                    <TrainingBlocks
                      blocks={test.setup.filter((b) => b?.type === 'svg')}
                      onZoom={(bloc) => navigation.navigate(RouteNames.TrainingSchema, {
                        caption: bloc.caption, svg: bloc.svg, title: test.name,
                      })}
                    />
                  )}
                  <Block blocks={test.protocol} title={t('training.test.protocol')} />
                  <Block blocks={test.invalidIf} title={t('training.test.invalidIf')} />
                  <Button
                    onPress={() => setSaisieOuverte(true)}
                    title={t('training.test.toEntry')}
                    variant="Primary"
                  />
                </View>
              )}

              {tab === 'do' && saisieOuverte && (
                <View style={Spaces.gap[16]}>
                  {/* ─── LA FRISE DES ESSAIS ─────────────────────────────────
                      Elle dit d'un coup d'œil combien d'essais sont faits, lequel
                      est nul, et lequel vient. Sans elle, il fallait dérouler
                      toutes les cartes pour compter. */}
                  {essais > 1 && (
                    <View style={Spaces.gap[4]}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {etatsDesEssais.map((etat, rang) => (
                          <View
                            key={`essai-${rang + 1}`}
                            style={{
                              alignItems: 'center',
                              backgroundColor: etat === 'todo'
                                ? 'transparent'
                                : Colors[/** @type {keyof Colors} */ (TEINTES_ESSAI[etat])],
                              borderColor: Colors[
                                /** @type {keyof Colors} */ (TEINTES_ESSAI[etat])],
                              borderRadius: 6,
                              borderWidth: 1,
                              flexGrow: 1,
                              minWidth: 28,
                              paddingVertical: 5,
                            }}
                          >
                            <Text style={[Fonts.caption, {
                              color: etat === 'todo' ? Colors.neutral400 : Colors.neutral00,
                            }]}
                            >
                              {rang + 1}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                        {t('training.test.attemptsDone', {
                          done: etatsDesEssais.filter((e) => e !== 'todo').length,
                          left: etatsDesEssais.filter((e) => e === 'todo').length,
                        })}
                      </Text>
                    </View>
                  )}

                  <TrainingTimer
                    onPick={setRecovery}
                    presets={RECOVERY_PRESETS}
                    seconds={recovery}
                  />

                  {saveFailed && (
                    <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                      {t('training.sync.localFailed')}
                    </Text>
                  )}

                  {/* ─── LES CARTES D'ESSAI ─────────────────────────────────── */}
                  {familles.parEssai.length > 0 && (
                    <View style={Spaces.gap[12]}>
                      {Array.from({ length: essais }, (_, i) => i + 1).map((essai) => (
                        <TrainingAttemptCard
                          enCours={premierAFaire === essai - 1}
                          essai={essai}
                          key={`carte-${essai}`}
                          measures={familles.parEssai}
                          nul={etatsDesEssais[essai - 1] === 'void'}
                          onReason={(raison) => noterMotif(essai, raison)}
                          onRecord={record}
                          onToggleInvalid={() => basculerEssai(essai)}
                          raison={lignesDeLEssai(essai)[0]?.invalidReason || ''}
                          total={essais}
                          valuesFor={valuesFor}
                        />
                      ))}
                    </View>
                  )}

                  {/* ─── CE QUI EST DÉJÀ NOTÉ ────────────────────────────────
                      Sur un test à douze tirs, remonter les douze cartes pour
                      relire les valeurs prend plus de temps que le tir suivant.
                      La liste les met à plat, dans l'ordre, en une ligne chacune. */}
                  {cases.total > BEAUCOUP_DE_CASES && cases.remplies > 0 && (
                    <Repliable
                      compte={cases.remplies}
                      title={t('training.test.recap')}
                    >
                      <View style={Spaces.gap[4]}>
                        {Object.entries(values)
                          .filter(([, row]) => row?.value != null || row?.textValue)
                          .map(([clef, row]) => (
                            <Text
                              key={clef}
                              style={[Fonts.caption, {
                                color: row.isValid === false
                                  ? Colors.gold500 : Colors.neutral300,
                                textDecorationLine: row.isValid === false
                                  ? 'line-through' : 'none',
                              }]}
                            >
                              {[
                                t('training.measures.attempt', { number: row.attempt ?? 1 }),
                                row.side && row.side !== 'none'
                                  ? t(`training.measures.side.${row.side}`) : null,
                                `${row.value ?? row.textValue}${row.unit ? ` ${row.unit}` : ''}`,
                              ].filter(Boolean).join(' · ')}
                            </Text>
                          ))}
                      </View>
                    </Repliable>
                  )}

                  {/* ─── À NOTER UNE FOIS ────────────────────────────────────
                      Repliée : ce sont des cases qu'on remplit au début et qu'on
                      ne rouvre plus. Déployées, elles séparaient les cartes
                      d'essai les unes des autres. */}
                  {familles.uneFois.length > 0 && (
                    <Repliable
                      compte={familles.uneFois.length}
                      title={t('training.measures.context')}
                    >
                      <View style={Spaces.gap[12]}>
                        {familles.uneFois.map((measure) => (
                          <View key={measure.key} style={Spaces.gap[4]}>
                            {aSaisirPlusTard(measure) && (
                              <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
                                {t('training.measures.later')}
                              </Text>
                            )}
                            <TrainingMeasureInput
                              measure={measure}
                              onRecord={record}
                              onToggleInvalid={record}
                              values={valuesFor(measure.key)}
                            />
                          </View>
                        ))}
                      </View>
                    </Repliable>
                  )}

                  {/* ─── RÉSULTAT DE LA SÉRIE ────────────────────────────────
                      🪤 Une valeur calculée n'affichait JAMAIS de résultat : on
                      voyait sa formule et rien d'autre. Et l'app ne peut pas la
                      calculer — la formule est écrite en français, pas en code.
                      Elle devient donc une case : on lit le chiffre sur le
                      logiciel, on le recopie, et le carnet le garde. */}
                  {familles.calculees.length > 0 && (
                    <View style={Spaces.gap[12]}>
                      <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                        {t('training.test.seriesResult')}
                      </Text>
                      {familles.calculees.map((measure) => (
                        <View
                          key={measure.key}
                          style={[
                            Spaces.gap[4],
                            {
                              borderColor: withAlpha(Colors.primary500, 0.2),
                              borderRadius: 10,
                              borderWidth: 1,
                              padding: 12,
                            },
                          ]}
                        >
                          {Boolean(measure.formula) && (
                            <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                              {measure.formula}
                            </Text>
                          )}
                          <TrainingMeasureInput
                            measure={{ ...measure, computed: false }}
                            onRecord={record}
                            onToggleInvalid={record}
                            values={valuesFor(measure.key)}
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ─── LE BANDEAU D'ENVOI, TROIS ÉTATS ────────────────────
                      Il n'en avait que deux, et il mélangeait « en attente » et
                      « gardé sur le téléphone » : on ne savait pas si le carnet
                      était à jour ou si quelque chose n'était pas parti. */}
                  <View
                    style={{
                      backgroundColor: withAlpha(
                        pending > 0 ? Colors.gold500 : Colors.success500,
                        0.12,
                      ),
                      borderColor: withAlpha(
                        pending > 0 ? Colors.gold500 : Colors.success500,
                        0.4,
                      ),
                      borderRadius: 10,
                      borderWidth: 1,
                      gap: 8,
                      padding: 12,
                    }}
                  >
                    <Text style={[Fonts.caption, {
                      color: pending > 0 ? Colors.gold500 : Colors.success500,
                    }]}
                    >
                      {pending > 0
                        ? t('training.sync.offline', { count: pending })
                        : t('training.sync.allSent')}
                    </Text>
                    {syncError && (
                      <Text style={[Fonts.caption, { color: Colors.error500 }]}>
                        {t('training.sync.failed')}
                      </Text>
                    )}
                    {pending > 0 && (
                      <Button
                        isLoading={results.sync.isPending}
                        onPress={send}
                        title={t('training.actions.sync')}
                        variant="Primary"
                      />
                    )}
                  </View>
                </View>
              )}

              {tab === 'learn' && (
                <View style={Spaces.gap[16]}>
                  <Block blocks={test.why} title={t('training.test.why')} />
                  <Block blocks={test.setup} title={t('training.test.setup')} />
                  <Block blocks={test.reading} title={t('training.test.reading')} />

                  {Array.isArray(test.links) && test.links.length > 0 && (
                    <View style={Spaces.gap[8]}>
                      <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                        {t('training.test.links')}
                      </Text>
                      {test.links.map((link) => (
                        <LienRange key={link.url || link.titre} link={link} />
                      ))}
                    </View>
                  )}

                  {/* ─── CE QUE CE TEST ALIMENTE ────────────────────────────
                      Déduit des FORMULES des autres tests, jamais écrit à la
                      main : la liste reste juste le jour où le programme change. */}
                  {alimente.length > 0 && (
                    <View style={Spaces.gap[8]}>
                      <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                        {t('training.test.feeds')}
                      </Text>
                      {alimente.map((cible) => (
                        <Text
                          key={`${cible.test}-${cible.measure}`}
                          style={[Fonts.p3, { color: Colors.neutral300 }]}
                        >
                          {`${cible.test} · ${cible.measure}`}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    disabled={index === 0}
                    onPress={() => {
                      setIndex((value) => Math.max(0, value - 1));
                      setTab('do');
                      setSaisieOuverte(false);
                    }}
                    title={t('training.actions.previous')}
                    variant="Secondary"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    disabled={index >= tests.length - 1}
                    onPress={() => {
                      setIndex((value) => Math.min(tests.length - 1, value + 1));
                      setTab('do');
                      setSaisieOuverte(false);
                    }}
                    title={t('training.actions.nextTest')}
                    variant="Primary"
                  />
                </View>
              </View>

              {/*
                🔎 LE POINT DE RETOUR. Le pack fait revenir ONZE pages du parcours
                guide sur le tableau de bord : c est la place du village, le seul
                endroit qui dise ce qui precede, ce qui suit et combien il reste.
                Un simple retour en arriere ne suffit pas — on peut etre arrive ici
                par le lien « Pourquoi » de la veille, et le tableau de bord n a
                alors aucun sens : la seance n a pas commence.
              */}
              {session?.status === 'in_progress' ? (
                <Button
                  onPress={() => allerDansLOnglet(navigation, RouteNames.TrainingSessionNow, {
                    sessionId,
                  })}
                  title={t('training.now.back')}
                  variant="Secondary"
                />
              ) : (
                index >= tests.length - 1 && (
                  <Button
                    onPress={() => navigation.goBack()}
                    title={t('training.actions.finishTest')}
                    variant="Secondary"
                  />
                )
              )}
            </View>
          ) : null}
        </WithDataWrapper>
      </ScrollView>

      {/* ─── LE COMPTEUR COLLANT ──────────────────────────────────────────────
          Il vit HORS du défilement, en bas, à portée de pouce : c'est le seul
          endroit où il reste lisible sur un test de soixante et une cases. Il
          n'apparaît que là où on peut se perdre. */}
      {test && saisieOuverte && cases.total > BEAUCOUP_DE_CASES && (
        <View
          style={{
            backgroundColor: 'rgba(9, 24, 35, 0.94)',
            borderTopColor: withAlpha(Colors.primary500, 0.2),
            borderTopWidth: 1,
            gap: 6,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>
            {t('training.test.cells', { done: cases.remplies, total: cases.total })}
          </Text>
          <TrainingProgressBar
            color={cases.remplies >= cases.total ? Colors.success500 : Colors.primary500}
            ratio={cases.total ? cases.remplies / cases.total : 0}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

export default TrainingTest;
