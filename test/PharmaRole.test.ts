import { expect } from "chai";
import { ethers } from "hardhat";
import { PharmaChain } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("PharmaChain Full Supply Chain", function () {
  let pharmaChain: PharmaChain;
  let admin: SignerWithAddress;
  let manufacturer: SignerWithAddress;
  let distributor: SignerWithAddress;
  let pharmacist: SignerWithAddress;
  let patient: SignerWithAddress;

  // Role identifiers
  const MAN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANUFACTURER_ROLE"));
  const DIST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));
  const PHARMA_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PHARMACIST_ROLE"));

  beforeEach(async function () {
    [admin, manufacturer, distributor, pharmacist, patient] = await ethers.getSigners();

    const PharmaChainFactory = await ethers.getContractFactory("PharmaChain");
    pharmaChain = await PharmaChainFactory.deploy();
    await pharmaChain.waitForDeployment();

    // Setup initial roles
    await pharmaChain.grantRole(MAN_ROLE, manufacturer.address);
    await pharmaChain.grantRole(DIST_ROLE, distributor.address);
    await pharmaChain.grantRole(PHARMA_ROLE, pharmacist.address);
  });

  describe("Lifecycle Flow", function () {
    const batchId = 555;
    const medicineName = ethers.encodeBytes32String("Life-Save-Plus");

    it("Should follow the full path: Manufacturer -> Distributor -> Pharmacist -> Sold", async function () {
      // 1. Manufacture
      await pharmaChain.connect(manufacturer).manufactureBatch(batchId, medicineName);

      // 2. Transfer to Distributor (Status 1: InTransit)
      await expect(pharmaChain.connect(manufacturer).transferBatch(batchId, distributor.address, 1))
        .to.emit(pharmaChain, "BatchUpdated")
        .withArgs(batchId, manufacturer.address, 1, anyValue);

      // 3. Transfer to Pharmacist (Status 2: Delivered)
      await expect(pharmaChain.connect(distributor).transferBatch(batchId, pharmacist.address, 2))
        .to.emit(pharmaChain, "BatchUpdated")
        .withArgs(batchId, distributor.address, 2, anyValue);

      // 4. Mark as Sold to Patient (Status 3: Sold)
      await expect(pharmaChain.connect(pharmacist).transferBatch(batchId, patient.address, 3))
        .to.emit(pharmaChain, "BatchUpdated")
        .withArgs(batchId, pharmacist.address, 3, anyValue);

      // Final Verification
      const batch = await pharmaChain.batches(batchId);
      expect(batch.currentOwner).to.equal(patient.address);
      expect(batch.status).to.equal(3); // Sold
    });

    it("Should REJECT if Manufacturer tries to skip the Distributor", async function () {
      await pharmaChain.connect(manufacturer).manufactureBatch(batchId, medicineName);

      // Try to go straight to Pharmacist (Status 2: Delivered)
      // This should fail because the sender is a Manufacturer, not a Distributor
      await expect(
        pharmaChain.connect(manufacturer).transferBatch(batchId, pharmacist.address, 2)
      ).to.be.revertedWith("Current status must be InTransit");
    });

    it("Should REJECT if a batch is sent to someone without the proper role", async function () {
      await pharmaChain.connect(manufacturer).manufactureBatch(batchId, medicineName);

      // Trying to send to 'patient' as a Distributor (patient doesn't have DISTRIBUTOR_ROLE)
      await expect(
        pharmaChain.connect(manufacturer).transferBatch(batchId, patient.address, 1)
      ).to.be.revertedWith("Recipient must be Distributor");
    });

    it("Should REJECT status regression or same status updates", async function () {
      await pharmaChain.connect(manufacturer).manufactureBatch(batchId, medicineName);

      await expect(
        pharmaChain.connect(manufacturer).transferBatch(batchId, distributor.address, 0)
      ).to.be.revertedWith("Invalid status progression");
    });

    it("Should REJECT direct Manufacturer -> Sold transition", async function () {
      await pharmaChain.connect(manufacturer).manufactureBatch(batchId, medicineName);

      await expect(
        pharmaChain.connect(manufacturer).transferBatch(batchId, patient.address, 3)
      ).to.be.revertedWith("Current status must be Delivered");
    });
  });
});