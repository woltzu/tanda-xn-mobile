// components/AppFlashList.tsx
//
// Thin wrapper over @shopify/flash-list so every list surface in the
// app shares the same scroll/gesture defaults without every caller
// re-typing them. Pass FlashList props through — the wrapper only
// sets defaults, so a caller can override any of them.
//
// Notable difference from the FlatList-era wrappers: FlashList does
// not accept initialNumToRender / maxToRenderPerBatch / windowSize /
// removeClippedSubviews — it runs its own virtualization algorithm
// so those FlatList knobs would trigger noisy runtime warnings.
// This wrapper deliberately does not forward them; upgrade any
// screen that used to set them by dropping the props on migration.

import React from "react";
import { FlashList, FlashListProps, FlashListRef } from "@shopify/flash-list";

export function AppFlashList<T>(
  props: FlashListProps<T> & { flashListRef?: React.Ref<FlashListRef<T>> },
) {
  const { flashListRef, ...rest } = props;
  return (
    <FlashList
      ref={flashListRef}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
      {...rest}
    />
  );
}
