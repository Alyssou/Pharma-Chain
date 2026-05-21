"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isAddress, keccak256, toBytes } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { pharmaChainAbi, pharmaChainAddress } from "../../lib/contract";

// Role definitions — hashes computed locally to avoid extra RPC calls
const ROLES = [
  {
    name: "Manufacturer",
    hash: keccak256(toBytes("MANUFACTURER_ROLE")),
    color: "emerald",
  },
  {
    name: "Distributor",
    hash: keccak256(toBytes("DISTRIBUTOR_ROLE")),
    color: "blue",
  },
  {
    name: "Pharmacist",
    hash: keccak256(toBytes("PHARMACIST_ROLE")),
    color: "yellow",
  },
] as const;

// OpenZeppelin DEFAULT_ADMIN_ROLE is bytes32(0)
const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

const COLOR_MAP: Record<string, { badge: string; revoke: string }> = {
  emerald: {
    badge: "bg-emerald-900 text-emerald-300",
    revoke: "bg-emerald-800 hover:bg-emerald-700 text-emerald-200",
  },
  blue: {
    badge: "bg-blue-900 text-blue-300",
    revoke: "bg-blue-800 hover:bg-blue-700 text-blue-200",
  },
  yellow: {
    badge: "bg-yellow-900 text-yellow-300",
    revoke: "bg-yellow-800 hover:bg-yellow-700 text-yellow-200",
  },
};

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  // Map of roleHash → current member addresses
  const [roleMembers, setRoleMembers] = useState<Record<string, string[]>>({});
  // Map of roleHash → address input value
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
        publicClient.getLogs({
          address: pharmaChainAddress,
          event: roleGrantedEvent,
          fromBlock,
          toBlock: "latest",
        }),
        publicClient.getLogs({
          address: pharmaChainAddress,
          event: roleRevokedEvent,
          fromBlock,
          toBlock: "latest",
        }),
      ]);

      const result: Record<string, string[]> = {};
      for (const role of ROLES) {
        const members = new Set<string>();
        for (const log of grantedLogs) {
          if (log.args.role === role.hash) {
            members.add(String(log.args.account).toLowerCase());
          }
        }
        for (const log of revokedLogs) {
          if (log.args.role === role.hash) {
            members.delete(String(log.args.account).toLowerCase());
          }
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
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Admin Panel</h1>
        </div>
        <ConnectButton />
      </header>

      {/* Feedback */}
      {txMessage && (
        <p className="rounded border border-emerald-800 bg-emerald-950 px-3 py-2 text-xs text-emerald-300">
          {txMessage}
        </p>
      )}
      {errorMessage && (
        <p className="rounded border border-rose-800 bg-rose-950 px-3 py-2 text-xs text-rose-300">
          {errorMessage}
        </p>
      )}

      {/* Guard */}
      {!isConnected && (
        <p className="text-sm text-slate-400">Connect your wallet to continue.</p>
      )}
      {isConnected && isAdmin === false && (
        <div className="rounded-lg border border-rose-800 bg-rose-950 p-4">
          <p className="text-sm text-rose-300">
            Your wallet does not hold <code>DEFAULT_ADMIN_ROLE</code>. Only the
            contract deployer can manage roles.
          </p>
        </div>
      )}

      {/* Role panels */}
      {isAdmin && (
        <>
          <p className="text-xs text-slate-500">
            Contract:{" "}
            <a
              href={`https://sepolia.etherscan.io/address/${pharmaChainAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-400 underline"
            >
              {pharmaChainAddress}
            </a>
          </p>

          {loading && (
            <p className="text-xs text-slate-400">Loading role members…</p>
          )}

          {ROLES.map((role) => {
            const colors = COLOR_MAP[role.color];
            const members = roleMembers[role.hash] ?? [];
            const input = grantInputs[role.hash] ?? "";

            return (
              <section
                key={role.hash}
                className="rounded-lg border border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors.badge}`}>
                    {role.name}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {role.hash.slice(0, 10)}…
                  </span>
                </div>

                {/* Current members */}
                {members.length === 0 ? (
                  <p className="text-xs text-slate-500">No current members.</p>
                ) : (
                  <ul className="space-y-1">
                    {members.map((m) => (
                      <li
                        key={m}
                        className="flex items-center justify-between gap-2 rounded bg-slate-800 px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono text-slate-300">{m}</span>
                        <button
                          onClick={() => void onRevoke(role.hash, m)}
                          disabled={isPending}
                          className={`rounded px-2 py-0.5 text-xs ${colors.revoke} disabled:opacity-40`}
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
                    className="flex-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-slate-600"
                    placeholder="0x… wallet address"
                    value={input}
                    onChange={(e) =>
                      setGrantInputs((prev) => ({ ...prev, [role.hash]: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => void onGrant(role.hash)}
                    disabled={isPending || !input}
                    className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-600 disabled:opacity-40"
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
  );
}
