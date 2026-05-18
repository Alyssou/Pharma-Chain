import { ethers } from "hardhat";

async function main() {
  // Signers loaded from hardhat.config.ts accounts array (in order)
  const [manufacturer, distributor, pharmacist] = await ethers.getSigners();

  console.log("=== PharmaChain Deployment ===");
  console.log("Deployer (Manufacturer):", manufacturer.address);
  console.log("Distributor wallet:     ", distributor.address);
  console.log("Pharmacist wallet:      ", pharmacist.address);
  console.log("");

  // ── 1. Deploy ──────────────────────────────────────────────────────────────
  console.log("Deploying PharmaChain...");
  const pharmaChain = await ethers.deployContract("PharmaChain");
  await pharmaChain.waitForDeployment();

  const contractAddress = await pharmaChain.getAddress();
  console.log(`PharmaChain deployed to: ${contractAddress}`);
  console.log("");

  // ── 2. Grant Roles ─────────────────────────────────────────────────────────
  // The deployer (manufacturer[0]) is DEFAULT_ADMIN_ROLE and can grant roles.
  const MANUFACTURER_ROLE = await pharmaChain.MANUFACTURER_ROLE();
  const DISTRIBUTOR_ROLE  = await pharmaChain.DISTRIBUTOR_ROLE();
  const PHARMACIST_ROLE   = await pharmaChain.PHARMACIST_ROLE();

  console.log("Granting MANUFACTURER_ROLE to:", manufacturer.address);
  let tx = await pharmaChain.connect(manufacturer).grantRole(MANUFACTURER_ROLE, manufacturer.address);
  await tx.wait();
  console.log("  ✓ MANUFACTURER_ROLE granted");

  console.log("Granting DISTRIBUTOR_ROLE to: ", distributor.address);
  tx = await pharmaChain.connect(manufacturer).grantRole(DISTRIBUTOR_ROLE, distributor.address);
  await tx.wait();
  console.log("  ✓ DISTRIBUTOR_ROLE granted");

  console.log("Granting PHARMACIST_ROLE to:  ", pharmacist.address);
  tx = await pharmaChain.connect(manufacturer).grantRole(PHARMACIST_ROLE, pharmacist.address);
  await tx.wait();
  console.log("  ✓ PHARMACIST_ROLE granted");

  // ── 3. Summary ─────────────────────────────────────────────────────────────
  console.log("");
  console.log("=== Deployment Complete ===");
  console.log(`Contract:     ${contractAddress}`);
  console.log(`Manufacturer: ${manufacturer.address} → MANUFACTURER_ROLE`);
  console.log(`Distributor:  ${distributor.address} → DISTRIBUTOR_ROLE`);
  console.log(`Pharmacist:   ${pharmacist.address} → PHARMACIST_ROLE`);
  console.log("");
  console.log("Update your frontend .env:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});