import { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";

const MANUFACTURER_PRIVATE_KEY = vars.get("MANUFACTURER_PRIVATE_KEY");
const DISTRIBUTOR_PRIVATE_KEY = vars.get("DISTRIBUTOR_PRIVATE_KEY");
const PHARMACIST_PRIVATE_KEY = vars.get("PHARMACIST_PRIVATE_KEY");
const SEPOLIA_RPC_URL = vars.get("SEPOLIA_RPC_URL");
const ETHERSCAN_API_KEY = vars.get("ETHERSCAN_API_KEY");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Higher runs = cheaper function execution, pricier deployment
      },
    },
  },
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [
        MANUFACTURER_PRIVATE_KEY.startsWith("0x") ? MANUFACTURER_PRIVATE_KEY : `0x${MANUFACTURER_PRIVATE_KEY}`,
        DISTRIBUTOR_PRIVATE_KEY.startsWith("0x") ? DISTRIBUTOR_PRIVATE_KEY : `0x${DISTRIBUTOR_PRIVATE_KEY}`,
        PHARMACIST_PRIVATE_KEY.startsWith("0x") ? PHARMACIST_PRIVATE_KEY : `0x${PHARMACIST_PRIVATE_KEY}`,
      ],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    L2: "arbitrum", // Simulates costs on a supported Layer 2
  },
};

export default config;
