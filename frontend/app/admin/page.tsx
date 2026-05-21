"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isAddress, keccak256, toBytes } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { pharmaChainAbi, pharmaChainAddress } from "../../lib/contract";

const ROLES = [
  {
    name: "Manufacturer",
    hash: keccak256(toBytes("MANUFACTURER_ROLE")),
    colors: {
      badge: "bg-emerald-100 text-emerald-700",
      row: "bg-emerald-50",
      revoke: "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
      grant: "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700",
    },
  },
  {
    name: "Distributor",
    hash: keccak256(toBytes("DISTRIBUTOR_ROLE")),
    colors: {
      badge: "bg-blue-100 text-blue-700",
      row: "bg-blue-50",
      revoke: "border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-200",
      grant: "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700",
    },
  },
  {
    name: "Pharmacist",
    hash: keccak256(toBytes("PHARMACIST_ROLE")),
    colors: {
      badge: "bg-amber-100 text-amber-700",
      row: "bg-amber-50",
      revoke: "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-200",
      grant: "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700",
    },
  },
] as const;

const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const [roleMembers, setRoleMembers] = useState<Record<string, string[]>>({});
  const [grantInputs, setGrantInputs] = useState<Record<string, string>>({});
  const [txMessage, setTxMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: isAdmin } = useReadContract({
    abi: pharmaChainAbi,
    address: pharmaChainAddress,
    functionName: "hasRole",
    args: [DEFAULT_ADMIN_ROLE, address!],
    query: { enabled: Boolean(isConnected && address) },
  });

  async function loadRoleMembers() {
    if (!publicClient) return;
    setLoading(true);
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 9_999n ? latestBlock - 9_999n : 0n;

      const roleGrantedEvent = pharmaChainAbi.find(
        (item) => item.type === "event" && item.name === "RoleGranted"
      )!;
      const roleRevokedEvent = pharmaChainAbi.find(
        (item) => item.type === "event" && item.name === "RoleRevoked"
      )!;

      const [grantedLogs, revokedLogs] = await Promise.all([
        publicClient.getLogs({ address: pharmaChainAddress, event: roleGrantedEvent, fromBlock, toBlock: "latest" }),
        publicClient.getLogs({ address: pharmaChainAddress, event: roleRevokedEvent, fromBlock, toBlock: "latest" }),
      ]);

      const result: Record<string, string[]> = {};
      for (const role of ROLES) {
        const members = new Set<string>();
        for (const log of grantedLogs) {
          if (log.args.role === role.hash) members.add(String(log.args.account).toLowerCase());
        }
        for (const log of revokedLogs) {
          if (log.args.role === role.hash) members.delete(String(log.args.account).toLowerCase());
        }
        result[role.hash] = Array.from(members);
      }
      setRoleMembers(result);
    } catch (err) {
      console.error("[admin] Failed to load role members:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) void loadRoleMembers();
  }, [isAdmin, publicClient]);

  async function onGrant(roleHash: `0x${string}`) {
    const input = grantInputs[roleHash]?.trim() ?? "";
    if (!isAddress(input)) {
      setErrorMessage("Enter a valid address before granting.");
      return;
    }
    setErrorMessage("");
    setTxMessage("");
    try {
      const hash = await writeContractAsync({
        abi: pharmaChainAbi,
        address: pharmaChainAddress,
        functionName: "grantRole",
        args: [roleHash, input as `0x${string}`],
      });
      setTxMessage(`Role granted — tx: ${hash}`);
      setGrantInputs((prev) => ({ ...prev, [roleHash]: "" }));
      await loadRoleMembers();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Transaction failed.");
    }
  }

  async function onRevoke(roleHash: `0x${string}`, member: string) {
    setErrorMessage("");
    setTxMessage("");
    try {
      const hash = await writeContractAsync({
        abi: pharmaChainAbi,
        address: pharmaChainAddress,
        functionName: "revokeRole",
        args: [roleHash, member as `0x${string}`],
      });
      setTxMessage(`Role revoked — tx: ${hash}`);
      await loadRoleMembers();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Transaction failed.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-400 transition-colors hover:text-indigo-600">
              ← Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-indigo-600">Pharma Chain</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                Admin
              </span>
            </div>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-6 py-6">
        {/* Feedback */}
        {txMessage && (
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            {txMessage}
          </p>
        )}
        {errorMessage && (
          <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {errorMessage}
          </p>
        )}

        {/* Guard: not connected */}
        {!isConnected && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">Connect your wallet to manage roles.</p>
          </div>
        )}

        {/* Guard: connected but not admin */}
        {isConnected && isAdmin === false && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-rose-700">Not authorized</p>
            <p className="mt-1 text-xs text-rose-500">
              Your wallet does not hold <code className="font-mono">DEFAULT_ADMIN_ROLE</code>.
              Only the contract deployer can manage roles.
            </p>
          </div>
        )}

        {/* Admin panel */}
        {isAdmin && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Contract{" "}
                <a
                  href={`https://sepolia.etherscan.io/address/${pharmaChainAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-indigo-500 underline hover:text-indigo-700"
                >
                  {pharmaChainAddress.slice(0, 10)}…{pharmaChainAddress.slice(-6)}
                </a>
              </p>
              {loading && <p className="text-xs text-gray-400">Loading…</p>}
            </div>

            {ROLES.map((role) => {
              const members = roleMembers[role.hash] ?? [];
              const input = grantInputs[role.hash] ?? "";

              return (
                <section
                  key={role.hash}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  {/* Header */}
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${role.colors.badge}`}>
                      {role.name}
                    </span>
                    <span className="font-mono text-xs text-gray-300">
                      {role.hash.slice(0, 12)}…
                    </span>
                  </div>

                  {/* Current members */}
                  {members.length === 0 ? (
                    <p className="mb-4 text-xs text-gray-400">No current members.</p>
                  ) : (
                    <ul className="mb-4 space-y-2">
                      {members.map((m) => (
                        <li
                          key={m}
                          className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${role.colors.row}`}
                        >
                          <span className="font-mono text-xs text-gray-700">{m}</span>
                          <button
                            onClick={() => void onRevoke(role.hash, m)}
                            disabled={isPending}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium shadow-none ${role.colors.revoke} disabled:opacity-40`}
                          >
                            Revoke
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Grant input */}
                  <div className="flex gap-2">
                    <input
                      className="flex-1"
                      placeholder="0x… wallet address to grant"
                      value={input}
                      onChange={(e) =>
                        setGrantInputs((prev) => ({ ...prev, [role.hash]: e.target.value }))
                      }
                    />
                    <button
                      onClick={() => void onGrant(role.hash)}
                      disabled={isPending || !input}
                      className={`shrink-0 ${role.colors.grant} disabled:opacity-40`}
                    >
                      Grant
                    </button>
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
