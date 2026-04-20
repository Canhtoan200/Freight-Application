const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep native-only map libraries out of the web bundle.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    (moduleName === 'react-native-maps' || moduleName === '@rnmapbox/maps')
  ) {
    return {
      type: 'empty',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;