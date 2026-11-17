import { Stack } from "expo-router";

import { BiometricOfferSheet } from "@/components/login/biometric-offer-sheet";
import { AppLockProvider } from "@/contexts/app-lock-context";
import { SideMenuProvider } from "@/contexts/side-menu-context";

export default function AppLayout() {
  return (
    <AppLockProvider>
      <SideMenuProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <BiometricOfferSheet />
      </SideMenuProvider>
    </AppLockProvider>
  );
}
