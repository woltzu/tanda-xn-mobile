// =============================================================================
// WalkthroughOverlay -- modal-style backdrop + Tooltip + Next/Skip wiring.
//
// Drives one walkthrough at a time. The screen owns the "should this be
// visible" decision (via useWalkthrough's isWalkthroughCompleted + a local
// useState for active step); this component just renders the current step.
//
// Pattern:
//   const [step, setStep] = useState(0);
//   const [active, setActive] = useState(false);
//   useEffect(() => {
//     (async () => {
//       const done = await isWalkthroughCompleted('circles_intro');
//       if (!done) setActive(true);
//     })();
//   }, []);
//
//   <WalkthroughOverlay
//     visible={active}
//     walkthroughId="circles_intro"
//     step={step}
//     onNext={() => setStep(s => s + 1)}
//     onComplete={async () => { setActive(false); await markWalkthroughCompleted('circles_intro'); }}
//     onSkip={async () => { setActive(false); await markWalkthroughCompleted('circles_intro'); }}
//   />
//
// Intentionally pure: no AsyncStorage calls inside. The screen calls the
// hook for persistence; the overlay just renders.
// =============================================================================

import React from "react";
import {
  Modal,
  View,
  TouchableWithoutFeedback,
  StyleSheet,
  Pressable,
} from "react-native";
import Tooltip from "./Tooltip";
import { WALKTHROUGHS, type WalkthroughId } from "../config/walkthroughs";

export interface WalkthroughOverlayProps {
  visible: boolean;
  walkthroughId: WalkthroughId;
  step: number;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export default function WalkthroughOverlay({
  visible,
  walkthroughId,
  step,
  onNext,
  onSkip,
  onComplete,
}: WalkthroughOverlayProps) {
  const walkthrough = WALKTHROUGHS[walkthroughId];
  if (!walkthrough) return null;

  const totalSteps = walkthrough.steps.length;
  // Guard step bounds defensively -- a caller bug shouldn't crash the screen.
  const safeStep = Math.max(0, Math.min(step, totalSteps - 1));
  const stepConfig = walkthrough.steps[safeStep];
  if (!stepConfig) return null;

  const isLast = safeStep === totalSteps - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
      accessibilityViewIsModal
    >
      {/* Tapping the dimmed backdrop is intentionally a no-op rather than
          a dismiss -- we want users to acknowledge or skip explicitly,
          not accidentally close the walkthrough mid-step. */}
      <TouchableWithoutFeedback onPress={() => {}}>
        <View style={styles.backdrop}>
          <Pressable
            style={styles.tooltipWrap}
            // Capture the tap so a tap inside the tooltip doesn't bubble
            // to the backdrop above (also a no-op today, but future-proof).
            onPress={() => {}}
          >
            <Tooltip
              stepLabel={`Step ${safeStep + 1} of ${totalSteps}`}
              title={stepConfig.title}
              description={stepConfig.description}
              position={stepConfig.position}
              onSkip={onSkip}
              skipLabel={isLast ? "Close" : "Skip"}
              onNext={isLast ? onComplete : onNext}
              nextLabel={isLast ? "Done" : "Next"}
            />
          </Pressable>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 35, 66, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  tooltipWrap: {
    // Keep the tooltip body off the edges on small screens; Tooltip
    // already caps itself at maxWidth=340.
    width: "100%",
    alignItems: "center",
  },
});
