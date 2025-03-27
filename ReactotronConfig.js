import Reactotron, { trackGlobalErrors } from 'reactotron-react-native';
import mmkvPlugin from 'reactotron-react-native-mmkv';
import { storage } from './src/store/appContext';

Reactotron.configure({}) // controls connection & communication settings
  .use(mmkvPlugin({ storage }))
  .use(trackGlobalErrors({
    veto: (frame) => frame.fileName.indexOf('/node_modules/react-native/') >= 0,
  }))
  .useReactNative({
    asyncStorage: false, // there are more options to the async storage.
    networking: {
      ignoreUrls: /symbolicate/,
    },
  }) // add all built-in react native plugins
  .connect(); // let's connect!
