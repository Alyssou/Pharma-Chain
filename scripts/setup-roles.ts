/**
 * setup-roles.ts
 *
 * Use this script to grant roles on an already-deployed PharmaChain contract.
 * Useful when you need to re-run role assignment without redeploying.
 *
 * Usage:
 *   npx hardhat run scripts/setup-roles.ts --network sepolia
 *
 * Make sure CONTRACT_ADDRESS below matches your deployed contract.
 */

import { ethers } from "hardhat";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Replace this with your deployed contract address
const CONTRACT_ADDRESS = "0xE6727A99b90364a15290B97aFA0401dE2437ab27";
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // accounts[0] = manufacturer (deployer/admin)
  // accounts[1] = distributor
  // accounts[2] = pharmacist
  const [manufacturer, distributor, pharmacist] = await ethers.getSigners();

  console.log("=== PharmaChain Role Setup ===");
  console.log("Admin (Manufacturer):", manufacturer.address);
  console.log("Distributor:         ", distributor.address);
  console.log("Pharmacist:          ", pharmacist.address);
  console.log("Contract:            ", CONTRACT_ADDRESS);
  console.log("");

  const pharmaChain = await ethers.getContractAt("PharmaChain", CONTRACT_ADDRESS);

  const MANUFACTURER_ROLE = await pharmaChain.MANUFACTURER_ROLE();
  const DISTRIBUTOR_ROLE  = await pharmaChain.DISTRIBUTOR_ROLE();
  const PHARMACIST_ROLE   = await pharmaChain.PHARMACIST_ROLE();
  const ADMIN_ROLE        = await pharmaChain.DEFAULT_ADMIN_ROLE();

  // ── Verify deployer is admin ───────────────────────────────────────────────
  const isAdmin = await pharmaChain.hasRole(ADMIN_ROLE, manufacturer.address);
  if (!isAdmin) {
    throw new Error(`${manufacturer.address} does not have DEFAULT_ADMIN_ROLE. Cannot grant roles.`);
  }
  console.log("✓ Admin role confirmed for deployer\n");

  // ── Grant MANUFACTURER_ROLE ────────────────────────────────────────────────
  if (!(await pharmaChain.hasRole(MANUFACTURER_ROLE, manufacturer.address))) {
    console.log("Granting MANUFACTURER_ROLE to:", manufacturer.address);
    const tx = await pharmaChain.connect(manufacturer).grantRole(MANUFACTURER_ROLE, manufacturer.address);
    await tx.wait();
    console.log("  ✓ Done");
  } else {
    console.log("  ⟳ MANUFACTURER_ROLE already set for:", manufacturer.address);
  }

  // ── Grant DISTRIBUTOR_ROLE ─────────────────────────────────────────────────
  if (!(await pharmaChain.hasRole(DISTRIBUTOR_ROLE, distributor.address))) {
    console.log("Granting DISTRIBUTOR_ROLE to: ", distributor.address);
    const tx = await pharmaChain.connect(manufacturer).grantRole(DISTRIBUTOR_ROLE, distributor.address);
    await tx.wait();
    console.log("  ✓ Done");
  } else {
    console.log("  ⟳ DISTRIBUTOR_ROLE already set for:", distributor.address);
  }

  // ── Grant PHARMACIST_ROLE ──────────────────────────────────────────────────
  if (!(await pharmaChain.hasRole(PHARMACIST_ROLE, pharmacist.address))) {
    console.log("Granting PHARMACIST_ROLE to:  ", pharmacist.address);
    const tx = await pharmaChain.connect(manufacturer).grantRole(PHARMACIST_ROLE, pharmacist.address);
    await tx.wait();
    console.log("  ✓ Done");
  } else {
    console.log("  ⟳ PHARMACIST_ROLE already set for:", pharmacist.address);
  }

  // ── Final Role Verification ────────────────────────────────────────────────
  console.log("\n=== Role Verification ===");
  console.log("Manufacturer has MANUFACTURER_ROLE:", await pharmaChain.hasRole(MANUFACTURER_ROLE, manufacturer.address));
  console.log("Distributor  has DISTRIBUTOR_ROLE: ", await pharmaChain.hasRole(DISTRIBUTOR_ROLE,  distributor.address));
  console.log("Pharmacist   has PHARMACIST_ROLE:  ", await pharmaChain.hasRole(PHARMACIST_ROLE,   pharmacist.address));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
