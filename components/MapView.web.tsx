// Web shim for react-native-maps. That package's index re-exports
// codegenNativeCommands which throws on web ("Importing native-only
// module … from MapMarkerNativeComponent.js"), blocking the entire web
// bundle. Metro's platform-extension resolver picks THIS file when
// bundling for web, so callers that
//   `import MapView, { Marker } from "../components/MapView"`
// get no-op stubs and the react-native-maps graph is never traversed
// for the web target.
//
// VerificationMapScreen already renders a coords panel instead of a
// map when Platform.OS === "web" (see JSX around line 236), so these
// stubs are never actually mounted at runtime — they exist purely so
// the imports resolve during static analysis.

import React from "react";

const NoopMapView: React.FC<any> = () => null;

export default NoopMapView;
export const Marker: React.FC<any> = () => null;
export const Callout: React.FC<any> = () => null;
