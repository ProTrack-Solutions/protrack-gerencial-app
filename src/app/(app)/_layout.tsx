import { Stack } from "expo-router";

import { BiometricOfferSheet } from "@/components/login/biometric-offer-sheet";
import { SideMenuProvider } from "@/contexts/side-menu-context";

export default function AppLayout() {
  return (
    <SideMenuProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <BiometricOfferSheet />
    </SideMenuProvider>
  );
}
