import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Suppress deprecated style warnings for web compatibility
if (typeof window !== 'undefined') {
  console.warn = (function(originalWarn) {
    return function(...args) {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('shadow*')) {
        return;
      }
      if (args[0] && typeof args[0] === 'string' && args[0].includes('props.pointerEvents')) {
        return;
      }
      originalWarn.apply(console, args);
    };
  })(console.warn);
}
