const path = require('path');

/**
 * @react-native-community/datetimepicker : l'autolinking Android ne le voit pas tout seul.
 *
 * Pourquoi : @react-native-community/cli 15.0.1 identifie le package natif d'un module avec deux
 * expressions (findPackageClassName.js) — `class X implements ...ReactPackage` ou
 * `class X extends ...TurboReactPackage`. Or RNDateTimePickerPackage.java est en Java et declare
 * `extends BaseReactPackage`, la classe qui REMPLACE TurboReactPackage (@Deprecated dans RN 0.78).
 * Aucune des deux ne matche, le CLI conclut « ce module n'exporte aucun package » et rend
 * platforms.android = null : Gradle ne compile alors aucune tache pour lui, et l'app echoue a
 * l'execution sur « TurboModuleRegistry.getEnforcing(...): 'RNCDatePicker' could not be found ».
 * Les modules en Kotlin y echappent (`class X : BaseReactPackage()` — le `:` matche), tout comme
 * ceux qui gardent un `implements` sur la meme ligne (svg, reanimated).
 *
 * On redonne donc a la main exactement ce que le CLI aurait deduit si l'expression connaissait
 * BaseReactPackage. A retirer quand le CLI saura la lire — le correctif deviendra alors inutile,
 * pas nuisible.
 */
const datetimepickerAndroidDir = path.join(
  path.dirname(require.resolve('@react-native-community/datetimepicker/package.json')),
  'android',
);

module.exports = {
  assets: ['./assets/fonts/'],
  dependencies: {
    'react-native-keyboard-controller': {
      platforms: {
        android: null,
      },
    },
    '@react-native-community/datetimepicker': {
      platforms: {
        android: {
          sourceDir: datetimepickerAndroidDir,
          packageImportPath:
            'import com.reactcommunity.rndatetimepicker.RNDateTimePickerPackage;',
          packageInstance: 'new RNDateTimePickerPackage()',
          buildTypes: [],
          libraryName: 'RNDateTimePickerCGen',
          componentDescriptors: [],
          cmakeListsPath: path
            .join(
              datetimepickerAndroidDir,
              'build/generated/source/codegen/jni/CMakeLists.txt',
            )
            .replace(/\\/g, '/'),
        },
      },
    },
  },
  project: {
    android: {},
    ios: {},
  },
};
