// ═══════════════════════════════════════════════════════════════════════════
// plugins/withMlKitManifestFix.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Local Expo config plugin — resolves the AndroidManifest merge conflict
// between expo-camera (contributes `barcode_ui`) and the Persona SDK
// (contributes `ocr,face,barcode`) over the shared
// `com.google.mlkit.vision.DEPENDENCIES` meta-data.
//
// The Android manifest merger fails when two libraries declare the same
// meta-data key with different values. Our merged value is the union
// (`ocr,face,barcode,barcode_ui`), applied with `tools:replace="android:value"`
// so the merger accepts our authoritative value instead of erroring.
//
// Applied at prebuild time via app.json's `plugins` array.
// ═══════════════════════════════════════════════════════════════════════════

const { withAndroidManifest } = require('@expo/config-plugins');

const META_DATA_NAME = 'com.google.mlkit.vision.DEPENDENCIES';
const MERGED_VALUE = 'ocr,face,barcode,barcode_ui';
const TOOLS_NS = 'http://schemas.android.com/tools';

function withMlKitManifestFix(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults && cfg.modResults.manifest;
    if (!manifest) return cfg;

    // (1) Ensure the tools namespace is declared on <manifest>. Required
    // so that `tools:replace` is meaningful downstream. Attributes live
    // under `$` per xml2js convention.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = TOOLS_NS;
    }

    // (2) Find the <application> node. Manifests always have one, but
    // guard defensively so a missing/atypical structure doesn't crash.
    const application = Array.isArray(manifest.application)
      ? manifest.application[0]
      : manifest.application;
    if (!application) return cfg;

    application['meta-data'] = application['meta-data'] || [];

    // (3) Look for an existing entry keyed on com.google.mlkit.vision.DEPENDENCIES.
    // If none, create one; if one exists, we overwrite its value + attrs.
    let entry = application['meta-data'].find(
      (m) => m && m.$ && m.$['android:name'] === META_DATA_NAME,
    );

    if (!entry) {
      entry = { $: { 'android:name': META_DATA_NAME } };
      application['meta-data'].push(entry);
    }

    // (4) Set the merged value + tools:replace so the manifest merger
    // uses our value instead of failing on the SDK conflict.
    entry.$['android:value'] = MERGED_VALUE;
    entry.$['tools:replace'] = 'android:value';

    return cfg;
  });
}

module.exports = withMlKitManifestFix;
