const appJson = require('./app.json');

module.exports = () => {
  const app = appJson;
  app.expo = app.expo || {};
  app.expo.android = app.expo.android || {};
  app.expo.android.config = app.expo.android.config || {};
  app.expo.android.config.googleMaps = {
    apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  };
  app.expo.extra = {
    ...(app.expo.extra || {}),
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  };
  return app;
};
