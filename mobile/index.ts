import "react-native-get-random-values";
import "react-native-reanimated";
import { LogBox, Platform, unstable_batchedUpdates } from "react-native";
import { notifyManager } from "@tanstack/react-query";
import "./global.css";
import "expo-router/entry";

// Fix: ensure React Query batches state updates using React Native's mechanism.
// Only apply on native — web uses React 18's automatic batching and
// unstable_batchedUpdates is not a function there.
if (Platform.OS !== "web" && typeof unstable_batchedUpdates === "function") {
  notifyManager.setBatchNotifyFunction(unstable_batchedUpdates);
}

LogBox.ignoreLogs(["Expo AV has been deprecated", "Disconnected from Metro"]);
