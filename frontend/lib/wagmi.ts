import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000";

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn(
    "[pharma-chain] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. "
    + "Set it in .env.local before using the app."
  );
}

export const config = getDefaultConfig({
  appName: "Pharma Chain",
  projectId,
  chains: [sepolia],
  ssr: true,
});
