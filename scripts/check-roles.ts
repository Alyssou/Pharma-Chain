/**
 * check-roles.ts
 *
 * Checks which addresses currently hold each role on the deployed contract.
 * Reads RoleGranted events from chain history to show the full role state.
 *
 * Usage:
 *   npx hardhat run scripts/check-roles.ts --network sepolia
 */

import { ethers } from "hardhat";

// ── Update if you have a newer deployment ────────────────────────────────────
const CONTRACT_ADDRESS = "0xE6727A99b90364a15290B97aFA0401dE2437ab27";
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const [manufacturer, distributor, pharmacist] = await ethers.getSigners();

  console.log("=== Wallet Addresses from your vars ===");
  console.log("accounts[0] MANUFACTURER_PRIVATE_KEY →", manufacturer.address);
  console.log("accounts[1] DISTRIBUTOR_PRIVATE_KEY  →", distributor.address);
  console.log("accounts[2] PHARMACIST_PRIVATE_KEY   →", pharmacist.address);
  console.log("");

  // Check for duplicate addresses
  const addrs = [manufacturer.address, distributor.address, pharmacist.address];
  const uniqueAddrs = new Set(addrs);
  if (uniqueAddrs.size < 3) {
    console.log("⚠️  DUPLICATE ADDRESSES DETECTED:");
    addrs.forEach((addr, i) => {
      const dupeOf = addrs.findIndex((a, j) => a === addr && j !== i);
      if (dupeOf !== -1) {
        console.log(`   accounts[${i}] and accounts[${dupeOf}] are the same address: ${addr}`);
      }
    });
    console.log("\n→ Fix: Run 'npx hardhat vars set <VAR_NAME>' with a different private key for each role.\n");
  } else {
    console.log("✓ All 3 wallet addresses are distinct.\n");
  }

  // ── Query the contract ────────────────────────────────────────────────────
  console.log("=== On-chain Role Check (contract:", CONTRACT_ADDRESS, ") ===");
  const pharmaChain = await ethers.getContractAt("PharmaChain", CONTRACT_ADDRESS);

  const ADMIN_ROLE        = await pharmaChain.DEFAULT_ADMIN_ROLE();
  const MANUFACTURER_ROLE = await pharmaChain.MANUFACTURER_ROLE();
  const DISTRIBUTOR_ROLE  = await pharmaChain.DISTRIBUTOR_ROLE();
  const PHARMACIST_ROLE   = await pharmaChain.PHARMACIST_ROLE();

  const checkAddress = async (label: string, addr: string) => {
    const roles: string[] = [];
    if (await pharmaChain.hasRole(ADMIN_ROLE,        addr)) roles.push("DEFAULT_ADMIN");
    if (await pharmaChain.hasRole(MANUFACTURER_ROLE, addr)) roles.push("MANUFACTURER");
    if (await pharmaChain.hasRole(DISTRIBUTOR_ROLE,  addr)) roles.push("DISTRIBUTOR");
    if (await pharmaChain.hasRole(PHARMACIST_ROLE,   addr)) roles.push("PHARMACIST");
    const roleStr = roles.length ? roles.join(", ") : "none";
    console.log(`  ${label} (${addr}): [${roleStr}]`);
  };

  await checkAddress("accounts[0]", manufacturer.address);
  await checkAddress("accounts[1]", distributor.address);
  await checkAddress("accounts[2]", pharmacist.address);

  // Also check the problem address explicitly
  const problemAddr = "0x40973875093214659619B39e8e5c364c9a32e61a";
  console.log("");
  console.log("=== Checking reported problem address ===");
  await checkAddress("Problem addr", problemAddr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
