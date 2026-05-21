import type { Address } from "viem";

export const pharmaChainAddress = (process.env
  .NEXT_PUBLIC_PHARMACHAIN_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;

if (!process.env.NEXT_PUBLIC_PHARMACHAIN_ADDRESS) {
  console.warn(
    "[pharma-chain] NEXT_PUBLIC_PHARMACHAIN_ADDRESS is not set. "
    + "Set it in .env.local before using the app."
  );
}

// Minimal ABI needed for initial UI flow
export const pharmaChainAbi = [
  {
    inputs: [],
    name: "MANUFACTURER_ROLE",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "DISTRIBUTOR_ROLE",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "PHARMACIST_ROLE",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" }
    ],
    name: "hasRole",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "batches",
    outputs: [
      { internalType: "bytes32", name: "name", type: "bytes32" },
      { internalType: "address", name: "currentOwner", type: "address" },
      { internalType: "uint8", name: "status", type: "uint8" },
      { internalType: "uint40", name: "timestamp", type: "uint40" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_id", type: "uint256" },
      { internalType: "bytes32", name: "_name", type: "bytes32" }
    ],
    name: "manufactureBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_id", type: "uint256" },
      { internalType: "address", name: "_newOwner", type: "address" },
      { internalType: "uint8", name: "_newStatus", type: "uint8" }
    ],
    name: "transferBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "batchId", type: "uint256" },
      { indexed: true, internalType: "address", name: "actor", type: "address" },
      { indexed: false, internalType: "uint8", name: "status", type: "uint8" },
      { indexed: false, internalType: "uint256", name: "time", type: "uint256" }
    ],
    name: "BatchUpdated",
    type: "event"
  },
  {
    inputs: [],
    name: "DEFAULT_ADMIN_ROLE",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" }
    ],
    name: "grantRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" }
    ],
    name: "revokeRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: true, internalType: "address", name: "sender", type: "address" }
    ],
    name: "RoleGranted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: true, internalType: "address", name: "sender", type: "address" }
    ],
    name: "RoleRevoked",
    type: "event"
  }
] as const;
