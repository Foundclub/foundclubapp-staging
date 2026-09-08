import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { nomDuFichier, outilDeLaMesure } from '@/views/training/trainingVideo';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useTrainingResults } from '@/hooks/useTraining';

/**
 * « RELEVÉS VIDÉO — UN ESSAI À LA FOIS » — l'écran du soir, une valeur par page.
 *
 * 🔎 POURQUOI UNE VALEUR PAR PAGE. On relève ces mesures en regardant DEUX écrans :
 * le logiciel sur l'ordinateur, image par image, et le téléphone pour noter. Chaque
 * aller-retour coûte, et une pile de vingt petits champs garantit qu'on se trompe de
 * ligne. Un seul champ, très grand, et le numéro d'essai en gros : on sait toujours
 * quelle valeur on est en train de reporter.
 *
 * ⌨️ LE PAVÉ NUMÉRIQUE EST À NOUS, ET IL RESTE OUVERT. Le clavier du système s'ouvre et
 * se ferme, cache le champ, et propose des lettres dont personne n'a besoin ici. Un pavé
 * posé en bas de l'écran ne bouge jamais : le champ reste visible, et la place qu'il
 * occupe est réservée dès le premier affichage.
 *
 * ⚠️ CE QUE CET ÉCRAN NE FAIT PAS : le CALCUL EN DIRECT (le chiffre bleu qui se met à
 * jour à chaque frappe). Il est impossible aujourd'hui, et pas par manque de temps : les
 * formules du programme sont écrites en français — « médiane des 3 valeurs de
 * images_chute (si l'écart dépasse 2 images, refaire les 3 chutes) ». Aucun moteur ne
 * les évalue, et en écrire un qui devine se tromperait en silence sur des mesures qu'on
 * ne peut plus refaire. Les valeurs calculées se saisissent donc à la main, comme sur
 * la fiche du test.
 */

/** Les touches du pavé, dans l'ordre de la grille. */
const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];

/**
 * Une touche du pavé.
 * @param {object} props
 * @param {string} props.libelle le caractère de la touche
 * @param {() => void} props.onPress ce qu'elle fait
 * @returns {React.ReactElement} la touche
 */
function Touche({ libelle, onPress }) {
  const { Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.primary500, 0.12),
        borderRadius: 8,
        // Trois par ligne, avec les écarts : chaque touche prend un tiers.
        flexBasis: '31%',
        flexGrow: 1,
        justifyContent: 'center',
        // 56 points : on tape ces chiffres vite, en regardant l'autre écran.
        minHeight: 56,
      }}
    >
      <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{libelle}</Text>
    </TouchableOpacity>
  );
}

/**
 * L'écran lui-même.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} [props.route]
 * @returns {React.ReactElement} le relevé d'un essai
 */
function TrainingVideoEntry({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  const sessionId = route?.params?.sessionId;
  const testIndex = Number(route?.params?.testIndex) || 0;

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

  const test = (Array.isArray(day?.tests) ? day.tests : [])[testIndex] || null;

  /** Les mesures de ce test qui se lisent sur la vidéo. */
  const mesures = useMemo(
    () => (Array.isArray(test?.measures) ? test.measures : [])
      .filter((m) => m?.moment !== 'terrain'),
    [test],
  );

  /** Les essais réellement faits sur le terrain : eux seuls ont une vidéo. */
  const essais = useMemo(() => {
    /** @type {Record<string, any>[]} */
    const lignes = Array.isArray(session?.results) ? session.results : [];
    const vus = new Set(lignes
      .filter((row) => row?.test?.code === test?.code)
      .map((row) => row.attempt ?? 1));
    return [...vus].sort((a, b) => a - b);
  }, [session, test]);

  const [rang, setRang] = useState(0);
  const [saisie, setSaisie] = useState('');
  const essai = essais[rang];
  const mesure = mesures[0] || null;
  const outil = mesure ? outilDeLaMesure(mesure) : null;

  /** Ce qui est déjà relevé, par essai. */
  const dejaRelevé = useMemo(() => {
    /** @type {Record<number, any>} */
    const parEssai = {};
    const brutes = Array.isArray(session?.results) ? session.results : [];
    const fusion = results.merge([...brutes]);
    /** @type {Record<string, any>[]} */ (Object.values(fusion)).forEach((row) => {
      if (row.measureKey !== mesure?.key) return;
      const rowTestId = row.test?.documentId || row.testDocumentId;
      if (rowTestId && test?.documentId && rowTestId !== test.documentId) return;
      parEssai[row.attempt ?? 1] = row;
    });
    return parEssai;
    // `results` est recréé à chaque rendu : le dépendre relancerait la boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesure?.key, session?.results, test?.documentId]);

  /**
   * En changeant d'essai, le champ reprend ce qui est déjà noté : sans ça, on
   * croit que la valeur a été perdue et on la ressaisit par-dessus.
   *
   * 🚨 IL NE DÉPEND QUE DE L'ESSAI, ET C'EST UN VRAI DÉFAUT ÉVITÉ. En dépendant
   * aussi de `dejaRelevé`, l'effet repartait dès que ce calcul changeait
   * d'identité — ce qui arrive à chaque envoi au serveur — et il EFFAÇAIT le
   * chiffre qu'on était en train de taper. Attrapé par le témoin du pavé
   * numérique : deux touches enfoncées, une seule visible.
   */
  const dernierEssaiRef = useRef(null);
  useEffect(() => {
    if (dernierEssaiRef.current === essai) return;
    dernierEssaiRef.current = essai;
    const existante = dejaRelevé[essai];
    setSaisie(existante?.value != null ? String(existante.value) : (existante?.textValue || ''));
  }, [dejaRelevé, essai]);

  const taper = useCallback((touche) => {
    setSaisie((avant) => {
      if (touche === '⌫') return avant.slice(0, -1);
      // Une seule virgule : « 1,2,3 » n'est pas un nombre, et le serveur le
      // refuserait après coup, quand la vidéo n'est plus ouverte.
      if (touche === ',' && avant.includes(',')) return avant;
      return avant + touche;
    });
  }, []);

  const enregistrer = useCallback(() => {
    if (!mesure?.key || !test?.documentId || !essai) return;
    const nombre = Number(String(saisie).replace(',', '.'));
    results.record({
      attempt: essai,
      measureKey: mesure.key,
      side: 'none',
      testDocumentId: test.documentId,
      unit: mesure.unit,
      value: Number.isFinite(nombre) ? nombre : null,
    });
    if (rang < essais.length - 1) setRang(rang + 1);
  }, [essai, essais, mesure, rang, results, saisie, test]);

  const restantes = essais.filter((n) => {
    const ligne = dejaRelevé[n];
    return !(ligne?.value != null || ligne?.textValue);
  }).length;

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[Spaces.paddingBottom[16]]}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
            {test && mesure && essai ? (
              <View style={Spaces.gap[12]}>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    accessibilityLabel={t('training.actions.back')}
                    accessibilityRole="button"
                    onPress={() => navigation.goBack()}
                    style={{
                      alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
                    }}
                  >
                    <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>‹</Text>
                  </TouchableOpacity>
                  <Text style={[Fonts.p3Bold, { color: Colors.neutral00, flex: 1 }]}>
                    {test.name}
                  </Text>
                  {/* LE REPÈRE : « T2 · 5 sur 12 ». Il dit toujours où on en est
                      dans la série, y compris quand on revient dessus demain. */}
                  <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                    {`${test.code} · ${rang + 1}/${essais.length}`}
                  </Text>
                  {Boolean(outil) && (
                    <View style={{
                      backgroundColor: withAlpha(Colors.gold500, 0.18),
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                    >
                      <Text style={[Fonts.caption, { color: Colors.gold500 }]}>{outil}</Text>
                    </View>
                  )}
                </View>

                {/* LE NOM DU FICHIER : c'est LUI qui dit quelle vidéo ouvrir dans
                    une pellicule de trois cents éléments. */}
                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {nomDuFichier(test.code, essai)}
                </Text>

                {/* LE RAIL DES ESSAIS : vert pour ce qui est relevé, or pour
                    l'essai en cours, gris pour la suite. */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {essais.map((numero, position) => {
                    const ligne = dejaRelevé[numero];
                    const fait = ligne?.value != null || ligne?.textValue;
                    const encours = position === rang;
                    return (
                      <TouchableOpacity
                        // 🪤 L etiquette porte le mot « essai » et pas le seul
                        // chiffre : sinon le trait « 1 » du rail et la touche
                        // « 1 » du pave portent la MEME etiquette vocale, et une
                        // personne qui n a que la voix appuie sur l une en
                        // croyant appuyer sur l autre.
                        accessibilityLabel={t('training.attempt.title', {
                          current: numero, total: essais.length,
                        })}
                        accessibilityRole="button"
                        accessibilityState={{ selected: encours }}
                        key={numero}
                        onPress={() => setRang(position)}
                        style={{
                          backgroundColor: (() => {
                            if (encours) return Colors.gold500;
                            return fait ? Colors.success500 : Colors.neutral700;
                          })(),
                          borderRadius: 3,
                          flexGrow: 1,
                          height: 6,
                          minWidth: 14,
                        }}
                      />
                    );
                  })}
                </View>

                <View style={{
                  backgroundColor: withAlpha(Colors.gold500, 0.08),
                  borderColor: withAlpha(Colors.gold500, 0.5),
                  borderRadius: 12,
                  borderWidth: 1,
                  gap: 10,
                  padding: 16,
                }}
                >
                  <Text style={{
                    color: Colors.gold500, fontSize: 34, fontWeight: '700', lineHeight: 40,
                  }}
                  >
                    {t('training.attempt.title', { current: essai, total: essais.length })}
                  </Text>
                  <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>{mesure.label}</Text>
                  {Boolean(mesure.helper) && (
                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                      {mesure.helper}
                    </Text>
                  )}

                  {/* LE GROS CHAMP UNIQUE. Il n'a pas de clavier système : le pavé
                      du bas écrit dedans, et rien ne peut le recouvrir. */}
                  <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 8 }}>
                    <Text
                      accessibilityLabel={mesure.label}
                      style={{
                        borderBottomColor: Colors.gold500,
                        borderBottomWidth: 2,
                        color: Colors.neutral00,
                        flex: 1,
                        fontSize: 44,
                        fontWeight: '700',
                        lineHeight: 52,
                      }}
                    >
                      {saisie || '—'}
                    </Text>
                    {Boolean(mesure.unit) && (
                      <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{mesure.unit}</Text>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              !isLoading && (
                <View style={Spaces.gap[8]}>
                  <Text style={[Fonts.h4Bold, { color: Colors.success500 }]}>
                    {t('training.video.allDone', { count: 0 })}
                  </Text>
                  <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                    {t('training.video.nothingHere')}
                  </Text>
                </View>
              )
            )}
          </WithDataWrapper>
        </ScrollView>

        {test && mesure && essai ? (
          <View style={[Spaces.gap[8], { paddingHorizontal: 16, paddingTop: 8 }]}>
            {/* ⌨️ LE PAVÉ, TOUJOURS OUVERT. Sa place est réservée dès le premier
                affichage : rien ne se déplace quand on commence à taper, et le
                champ ne peut pas se retrouver caché. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TOUCHES.map((touche) => (
                <Touche key={touche} libelle={touche} onPress={() => taper(touche)} />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={rang === 0}
                  onPress={() => setRang(Math.max(0, rang - 1))}
                  title={t('training.video.previous', { count: essais[rang - 1] || 1 })}
                  variant="Secondary"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={!saisie}
                  onPress={enregistrer}
                  title={t('training.video.save')}
                  variant="Primary"
                />
              </View>
            </View>

            <Text style={[Fonts.caption, {
              color: restantes > 0 ? Colors.gold500 : Colors.success500,
            }]}
            >
              {t(restantes > 0 ? 'training.video.remaining' : 'training.video.testDone', {
                count: restantes, test: test.code,
              })}
            </Text>
            {restantes === 0 && (
              <Button
                onPress={() => navigation.navigate(RouteNames.TrainingVideoQueue)}
                title={t('training.video.backToQueue')}
                variant="Secondary"
              />
            )}
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

export default TrainingVideoEntry;
