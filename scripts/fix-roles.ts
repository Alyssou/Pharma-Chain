import { ethers } from "hardhat";

const CONTRACT_ADDRESS = "0xE6727A99b90364a15290B97aFA0401dE2437ab27";

async function main() {
  const [manufacturer, distributor, pharmacist] = await ethers.getSigners();

  console.log("=== Fixing Roles ===");
  const pharmaChain = await ethers.getContractAt("PharmaChain", CONTRACT_ADDRESS);

  const DISTRIBUTOR_ROLE  = await pharmaChain.DISTRIBUTOR_ROLE();
  const PHARMACIST_ROLE   = await pharmaChain.PHARMACIST_ROLE();

  console.log("Manufacturer (Admin):", manufacturer.address);
  console.log("Distributor:         ", distributor.address);
  console.log("Pharmacist:          ", pharmacist.address);
  console.log("");

  
  if (!(await pharmaChain.hasRole(DISTRIBUTOR_ROLE, distributor.address))) {
    console.log("Granting DISTRIBUTOR_ROLE to actual Distributor...");
    const tx = await pharmaChain.connect(manufacturer).grantRole(DISTRIBUTOR_ROLE, distributor.address);
    await tx.wait();
    console.log("  ✓ Granted");
  }

  if (!(await pharmaChain.hasRole(PHARMACIST_ROLE, pharmacist.address))) {
    console.log("Granting PHARMACIST_ROLE to actual Pharmacist...");
    const tx = await pharmaChain.connect(manufacturer).grantRole(PHARMACIST_ROLE, pharmacist.address);
    await tx.wait();
    console.log("  ✓ Granted");
  }

 
  if (await pharmaChain.hasRole(DISTRIBUTOR_ROLE, manufacturer.address)) {
    console.log("Revoking DISTRIBUTOR_ROLE from Manufacturer...");
    const tx = await pharmaChain.connect(manufacturer).revokeRole(DISTRIBUTOR_ROLE, manufacturer.address);
    await tx.wait();
    console.log("  ✓ Revoked");
  }

  if (await pharmaChain.hasRole(PHARMACIST_ROLE, manufacturer.address)) {
    console.log("Revoking PHARMACIST_ROLE from Manufacturer...");
    const tx = await pharmaChain.connect(manufacturer).revokeRole(PHARMACIST_ROLE, manufacturer.address);
    await tx.wait();
    console.log("  ✓ Revoked");
  }

  console.log("\n=== Done! Roles have been corrected. ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
