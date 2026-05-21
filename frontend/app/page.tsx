"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther, hexToString, isAddress, toHex } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { pharmaChainAbi, pharmaChainAddress } from "../lib/contract";

type BatchEvent = {
  txHash: string;
  actor: string;
  status: number;
  time: number;
};

type BatchSummary = {
  batchId: bigint;
  status: number;
  actor: string;
  time: number;
};

type TransferOption = {
  value: number;
  label: string;
  recipientHint: string;
};

const STATUS_LABEL: Record<number, string> = {
  0: "Manufactured",
  1: "InTransit",
  2: "Delivered",
  3: "Sold",
};

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const [batchIdInput, setBatchIdInput] = useState("555");
  const [medicineName, setMedicineName] = useState("Life-Save-Plus");
  const [newOwner, setNewOwner] = useState("");
  const [newStatus, setNewStatus] = useState("1");
  const [txMessage, setTxMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [events, setEvents] = useState<BatchEvent[]>([]);
  const [allBatches, setAllBatches] = useState<BatchSummary[]>([]);
  const [rawLogs, setRawLogs] = useState<{ txHash: string; batchId: string; actor: string; status: number; time: number }[]>([]);
  const [statusFilter, setStatusFilter] = useState<number | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [logsError, setLogsError] = useState<string>("");

  const batchId = useMemo(() => BigInt(batchIdInput || "0"), [batchIdInput]);

  const { data: manufacturerRole } = useReadContract({
    abi: pharmaChainAbi,
    address: pharmaChainAddress,
    functionName: "MANUFACTURER_ROLE",
    query: { enabled: isConnected },
  });

  const { data: distributorRole } = useReadContract({
    abi: pharmaChainAbi,
    address: pharmaChainAddress,
    functionName: "DISTRIBUTOR_ROLE",
    query: { enabled: isConnected },
  });

  const { data: pharmacistRole } = useReadContract({
    abi: pharmaChainAbi,
    address: pharmaChainAddress,
    functionName: "PHARMACIST_ROLE",
    query: { enabled: isConnected },
  });

  const { data: isManufacturer } = useReadContract({
    abi: pharmaChainAbi,
    address: pharmaChainAddress,
    functionName: "hasRole",
    args: manufacturerRole && address ? [manufacturerRole, address] : undefined,
    query: { enabled: Boolean(isConnected && manufacturerRole && address) },
  });

  const { data: isDistributor } = useReadContract({
    abi: pharmaChainAbi,
    address: pharmaChainAddress,
    functionName: "hasRole",
    args: distributorRole && address ? [distributorRole, address] : undefined,
    query: { enabled: Boolean(isConnected && distributorRole && address) },
  });

  const { data: isPharmacist } = useReadContract({
    abi: pharmaChainAbi,
    address: pharmaChainAddress,
    functionName: "hasRole",
    args: pharmacistRole && address ? [pharmacistRole, address] : undefined,
    query: { enabled: Boolean(isConnected && pharmacistRole && address) },
  });

  const { data: batchData, refetch } = useReadContract({
    abi: pharmaChainAbi,
    address: pharmaChainAddress,
    functionName: "batches",
    args: [batchId],
    query: { enabled: isConnected },
  });

  const currentStatus = Number(batchData?.[2] ?? 0);
  const currentOwner = String(batchData?.[1] ?? "").toLowerCase();
  const connectedAddress = (address ?? "").toLowerCase();
  const isCurrentOwner = Boolean(address && currentOwner && currentOwner === connectedAddress);

  const transferOptions = useMemo<TransferOption[]>(() => {
    if (!batchData) return [];

    if (currentStatus === 0 && isManufacturer && isCurrentOwner) {
      return [{ value: 1, label: "1 - InTransit", recipientHint: "Recipient must be a Distributor" }];
    }
    if (currentStatus === 1 && isDistributor && isCurrentOwner) {
      return [{ value: 2, label: "2 - Delivered", recipientHint: "Recipient must be a Pharmacist" }];
    }
    if (currentStatus === 2 && isPharmacist && isCurrentOwner) {
      return [{ value: 3, label: "3 - Sold", recipientHint: "Recipient can be a patient wallet" }];
    }
    return [];
  }, [batchData, currentStatus, isCurrentOwner, isDistributor, isManufacturer, isPharmacist]);

  const canTransfer = transferOptions.length > 0;

  useEffect(() => {
    if (transferOptions.length > 0) {
      setNewStatus(String(transferOptions[0].value));
    }
  }, [transferOptions]);

  // Single paginated fetch for ALL BatchUpdated events — no args filter so no
  // RPC topic-encoding issues. Both the dashboard and the timeline derive from this.
  useEffect(() => {
    async function loadAllLogs() {
      if (!publicClient) return;
      setLogsError("");
      try {
        const batchUpdatedEvent = pharmaChainAbi.find(
          (item) => item.type === "event" && item.name === "BatchUpdated"
        )!;
        const CHUNK = 9_999n;
        const latest = await publicClient.getBlockNumber();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all: any[] = [];
        for (let i = 0; i < 15; i++) {
          const toBlock = latest - BigInt(i) * CHUNK;
          const fromBlock = toBlock > CHUNK ? toBlock - CHUNK : 0n;
          try {
            const chunk = await publicClient.getLogs({
              address: pharmaChainAddress,
              event: batchUpdatedEvent,
              fromBlock,
              toBlock,
            });
            all.push(...chunk);
          } catch {
            break;
          }
          if (fromBlock === 0n) break;
        }

        type RawLog = { transactionHash: string | null; args: { batchId: unknown; actor: unknown; status: unknown; time: unknown } };
        const parsed = (all as unknown as RawLog[]).map((log) => ({
          txHash: log.transactionHash ?? "",
          batchId: String(log.args.batchId),
          actor: String(log.args.actor),
          status: Number(log.args.status),
          time: Number(log.args.time),
        }));

        setRawLogs(parsed);

        // Build dashboard summary (latest event per batchId)
        const map = new Map<string, BatchSummary>();
        for (const entry of parsed) {
          const existing = map.get(entry.batchId);
          if (!existing || entry.time > existing.time) {
            map.set(entry.batchId, {
              batchId: BigInt(entry.batchId),
              status: entry.status,
              actor: entry.actor,
              time: entry.time,
            });
          }
        }
        setAllBatches(Array.from(map.values()).sort((a, b) => b.time - a.time));
      } catch (err) {
        console.error("[pharma-chain] Failed to load logs:", err);
        setLogsError("Could not load on-chain events. Try switching MetaMask Sepolia RPC to https://rpc.sepolia.org");
      }
    }
    void loadAllLogs();
  }, [publicClient]);

  // Derive per-batch timeline from rawLogs whenever batchId changes
  useEffect(() => {
    const filtered = rawLogs
      .filter((log) => log.batchId === String(batchId))
      .sort((a, b) => a.time - b.time)
      .slice(-10)
      .reverse();
    setEvents(filtered);
  }, [batchId, rawLogs]);

  async function onManufacture(e: FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setTxMessage("");
    try {
      const hash = await writeContractAsync({
        abi: pharmaChainAbi,
        address: pharmaChainAddress,
        functionName: "manufactureBatch",
        args: [batchId, toHex(medicineName, { size: 32 })],
      });
      setTxMessage(`Manufacture submitted: ${hash}`);
      await refetch();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to manufacture batch."
      );
    }
  }

  async function onTransfer(e: FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setTxMessage("");
    if (!isAddress(newOwner)) {
      setErrorMessage("Please enter a valid recipient address.");
      return;
    }
    if (!transferOptions.some((option) => option.value === Number(newStatus))) {
      setErrorMessage("Selected status is not allowed for your role/current batch state.");
      return;
    }
    try {
      const hash = await writeContractAsync({
        abi: pharmaChainAbi,
        address: pharmaChainAddress,
        functionName: "transferBatch",
        args: [batchId, newOwner as `0x${string}`, Number(newStatus)],
      });
      setTxMessage(`Transfer submitted: ${hash}`);
      await refetch();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to transfer batch."
      );
    }
  }

  const STATUS_PILL: Record<number, string> = {
    0: "bg-emerald-100 text-emerald-700",
    1: "bg-blue-100 text-blue-700",
    2: "bg-amber-100 text-amber-700",
    3: "bg-violet-100 text-violet-700",
  };

  const TIMELINE_COLORS: Record<number, { dot: string; badge: string; label: string }> = {
    0: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700", label: "Manufactured" },
    1: { dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700",       label: "InTransit"    },
    2: { dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700",     label: "Delivered"    },
    3: { dot: "bg-violet-500",  badge: "bg-violet-100 text-violet-700",   label: "Sold"         },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky top nav */}
      <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-indigo-600">Pharma Chain</span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-500">
                Sepolia
              </span>
            </div>
            <Link
              href="/admin"
              className="text-sm text-gray-400 transition-colors hover:text-indigo-600"
            >
              Admin →
            </Link>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="mx-auto max-w-4xl space-y-5 px-6 py-6">

        {/* ── Wallet card ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Wallet
          </h2>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                <span className="text-gray-400">Address </span>
                <span className="font-mono text-gray-800">{address ?? "Not connected"}</span>
              </p>
              <p className="text-sm text-gray-600">
                <span className="text-gray-400">Balance </span>
                {balance ? `${formatEther(balance.value)} ETH` : "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isManufacturer ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                Manufacturer
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDistributor ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                Distributor
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPharmacist ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"}`}>
                Pharmacist
              </span>
            </div>
          </div>
          {txMessage && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {txMessage}
            </p>
          )}
          {errorMessage && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errorMessage}
            </p>
          )}
        </section>

        {/* ── All Batches ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              All Batches
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", 0, 1, 2, 3] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "border-indigo-200 bg-indigo-600 text-white shadow-none"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {s === "all" ? "All" : STATUS_LABEL[s]}
                </button>
              ))}
              <button
                onClick={() => setMineOnly((v) => !v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  mineOnly
                    ? "border-indigo-200 bg-indigo-600 text-white shadow-none"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Mine only
              </button>
            </div>
          </div>

          {(() => {
            const filtered = allBatches.filter((b) => {
              if (statusFilter !== "all" && b.status !== statusFilter) return false;
              if (mineOnly && b.actor.toLowerCase() !== connectedAddress) return false;
              return true;
            });

            if (filtered.length === 0) {
              return (
                <p className="text-sm text-gray-400">
                  {allBatches.length === 0
                    ? "No batches found. Make sure your wallet is connected to Sepolia."
                    : "No batches match the current filter."}
                </p>
              );
            }

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-100 text-gray-400">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Batch ID</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Last Actor</th>
                      <th className="pb-2 font-medium">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => {
                      const isSelected = batchIdInput === String(b.batchId);
                      return (
                        <tr
                          key={String(b.batchId)}
                          onClick={() => setBatchIdInput(String(b.batchId))}
                          className={`cursor-pointer border-b border-gray-50 transition-colors hover:bg-indigo-50 ${
                            isSelected ? "bg-indigo-50" : ""
                          }`}
                        >
                          <td className="py-2.5 pr-4 font-mono font-semibold text-gray-800">
                            #{String(b.batchId)}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {STATUS_LABEL[b.status] ?? b.status}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-gray-500">
                            {b.actor.slice(0, 6)}…{b.actor.slice(-4)}
                          </td>
                          <td className="py-2.5 text-gray-400">
                            {new Date(b.time * 1000).toLocaleDateString(undefined, {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </section>

        {/* ── Manufacture + Transfer side-by-side ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Manufacture Batch
            </h2>
            <form className="flex flex-col gap-3" onSubmit={onManufacture}>
              <input
                placeholder="Batch ID"
                value={batchIdInput}
                onChange={(e) => setBatchIdInput(e.target.value)}
              />
              <input
                placeholder="Medicine Name"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
              />
              <button
                type="submit"
                disabled={!isConnected || isPending || !isManufacturer}
                className="border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? "Submitting…" : "Create Batch"}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Transfer Batch
            </h2>
            <form className="flex flex-col gap-3" onSubmit={onTransfer}>
              <input
                placeholder="Recipient address (0x…)"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
              />
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                disabled={!canTransfer}
              >
                {transferOptions.length === 0 ? (
                  <option value="">No valid transitions</option>
                ) : (
                  transferOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
              {canTransfer ? (
                <p className="text-xs text-gray-400">
                  {transferOptions.find((o) => o.value === Number(newStatus))?.recipientHint}
                </p>
              ) : (
                <p className="text-xs text-amber-600">
                  You must be the current owner with the correct role to transfer.
                </p>
              )}
              <button
                type="submit"
                disabled={!isConnected || isPending || !canTransfer}
                className="border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? "Submitting…" : "Transfer Batch"}
              </button>
            </form>
          </section>
        </div>

        {/* ── Batch Snapshot ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Batch Snapshot — #{batchIdInput}
          </h2>
          {!batchData || Number(batchData[3]) === 0 ? (
            <p className="text-sm text-gray-400">No data. Select a batch or enter an ID above.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Name", value: hexToString(batchData[0], { size: 32 }).replace(/\0/g, "") || "—" },
                { label: "Owner", value: `${String(batchData[1]).slice(0, 6)}…${String(batchData[1]).slice(-4)}` },
                {
                  label: "Status",
                  value: (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[Number(batchData[2])] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[Number(batchData[2])] ?? "Unknown"}
                    </span>
                  ),
                },
                {
                  label: "Last Update",
                  value: new Date(Number(batchData[3]) * 1000).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  }),
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">{label}</p>
                  <div className="text-sm font-medium text-gray-800">{value}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Timeline ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Batch History Timeline
          </h2>
          {logsError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{logsError}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-400">No events found for this batch ID.</p>
          ) : (
            <ol className="relative ml-3 border-l-2 border-gray-100">
              {[...events].reverse().map((event, index) => {
                const color = TIMELINE_COLORS[event.status] ?? {
                  dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600", label: "Unknown",
                };
                const date = new Date(event.time * 1000);
                const formattedDate = date.toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric",
                });
                const formattedTime = date.toLocaleTimeString(undefined, {
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                });

                return (
                  <li key={`${event.txHash}-${event.time}`} className="mb-5 ml-6">
                    <span className={`absolute -left-[9px] h-4 w-4 rounded-full ring-4 ring-white ${color.dot}`} />
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${color.badge}`}>
                          Step {index + 1} — {color.label}
                        </span>
                        <span className="text-xs text-gray-400">{formattedDate} · {formattedTime}</span>
                      </div>
                      <p className="mt-2 text-gray-500">
                        Actor{" "}
                        <span className="font-mono text-gray-700">
                          {event.actor.slice(0, 6)}…{event.actor.slice(-4)}
                        </span>
                      </p>
                      <p className="mt-1 text-gray-500">
                        Tx{" "}
                        <a
                          href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-indigo-500 underline hover:text-indigo-700"
                        >
                          {event.txHash.slice(0, 10)}…{event.txHash.slice(-6)}
                        </a>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
