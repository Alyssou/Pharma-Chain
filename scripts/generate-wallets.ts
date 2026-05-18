import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();
  console.log("=== Current Signers (from your hardhat vars) ===");
  const labels = ["MANUFACTURER_PRIVATE_KEY", "DISTRIBUTOR_PRIVATE_KEY", "PHARMACIST_PRIVATE_KEY"];
  for (let i = 0; i < Math.min(signers.length, 3); i++) {
    console.log(`  accounts[${i}] (${labels[i]}): ${signers[i].address}`);
  }

  const uniqueAddresses = new Set(signers.slice(0, 3).map(s => s.address));
  if (uniqueAddresses.size < 3) {
    console.log("\n PROBLEM DETECTED: Multiple vars point to the same wallet address!");
    console.log("   You need 3 distinct private keys. Generating fresh wallets below...\n");
  } else {
    console.log("\n✓ All 3 wallets are distinct. No action needed.\n");
    return;
  }

  // ── Generate 3 fresh wallets ───────────────────────────────────────────────
  const manufacturer = ethers.Wallet.createRandom();
  const distributor  = ethers.Wallet.createRandom();
  const pharmacist   = ethers.Wallet.createRandom();

  console.log("=== Generated Wallets — SAVE THESE SECURELY ===\n");

  console.log("--- MANUFACTURER ---");
  console.log(`  Address:     ${manufacturer.address}`);
  console.log(`  Private Key: ${manufacturer.privateKey}`);
  console.log(`  Mnemonic:    ${manufacturer.mnemonic?.phrase ?? "N/A"}\n`);

  console.log("--- DISTRIBUTOR ---");
  console.log(`  Address:     ${distributor.address}`);
  console.log(`  Private Key: ${distributor.privateKey}`);
  console.log(`  Mnemonic:    ${distributor.mnemonic?.phrase ?? "N/A"}\n`);

  console.log("--- PHARMACIST ---");
  console.log(`  Address:     ${pharmacist.address}`);
  console.log(`  Private Key: ${pharmacist.privateKey}`);
  console.log(`  Mnemonic:    ${pharmacist.mnemonic?.phrase ?? "N/A"}\n`);

  console.log("=== Next Steps ===");
  console.log("1. Copy each private key and run:");
  console.log("   npx hardhat vars set MANUFACTURER_PRIVATE_KEY");
  console.log("   npx hardhat vars set DISTRIBUTOR_PRIVATE_KEY");
  console.log("   npx hardhat vars set PHARMACIST_PRIVATE_KEY\n");
  console.log("2. Fund each address with Sepolia ETH from:");
  console.log("   https://sepoliafaucet.com  or  https://faucet.quicknode.com/ethereum/sepolia\n");
  console.log("3. Redeploy: npx hardhat run scripts/deploy.ts --network sepolia");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
