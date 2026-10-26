const { withGradleProperties, withAndroidManifest } = require('expo/config-plugins');

/**
 * Plugin local do Expo para garantir que:
 * 1. O minSdkVersion seja 26 (exigido pelo Android Health Connect / Samsung Health)
 * 2. O warning de compileSdk 36/37 seja suprimido automaticamente
 * 3. A arquitetura padrão de build seja arm64-v8a (builds C++ 4x mais rápidos)
 * 4. A MainActivity tenha o intent-filter ACTION_SHOW_PERMISSIONS_RATIONALE exigido pelo Health Connect
 */
module.exports = function withAndroidGradleFixes(config) {
  config = withGradleProperties(config, (config) => {
    const props = config.modResults;

    const setProp = (key, value) => {
      const existing = props.find((item) => item.type === 'property' && item.key === key);
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: 'property', key, value });
      }
    };

    setProp('android.minSdkVersion', '26');
    setProp('android.suppressUnsupportedCompileSdk', '36,37');
    setProp('reactNativeArchitectures', 'arm64-v8a');
    setProp('RNLlama_ndkVersion', '27.1.12297006');

    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication) {
      mainApplication.$ = mainApplication.$ || {};
      mainApplication.$['android:largeHeap'] = 'true';
    }
    if (mainApplication && mainApplication.activity) {
      const mainActivity = mainApplication.activity.find(
        (act) => act.$?.['android:name'] === '.MainActivity'
      );
      if (mainActivity) {
        mainActivity['intent-filter'] = mainActivity['intent-filter'] || [];
        const hasRationale = mainActivity['intent-filter'].some((filter) =>
          filter.action?.some(
            (a) => a.$?.['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'
          )
        );
        if (!hasRationale) {
          mainActivity['intent-filter'].push({
            action: [
              {
                $: {
                  'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
                },
              },
            ],
          });
        }
      }
    }
    return config;
  });

  return config;
};
