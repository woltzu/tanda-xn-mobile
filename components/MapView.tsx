// Native default: re-export react-native-maps. On web, Metro's
// platform-extension resolver picks the sibling MapView.web.tsx (a no-op
// shim), so this file is only ever loaded for iOS/Android builds.
export { default } from "react-native-maps";
export { Marker, Callout } from "react-native-maps";
