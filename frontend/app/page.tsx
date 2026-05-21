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
  const [statusFilter, setStatusFilter] = useState<number | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);

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

  useEffect(() => {
    async function loadEvents() {
      if (!publicClient) return;
      try {
        // Extract the event before getLogs so TypeScript sees a concrete AbiEvent
        // (not AbiEvent | undefined). Only then does viem type log.args correctly.
        const batchUpdatedEvent = pharmaChainAbi.find(
          (item) => item.type === "event" && item.name === "BatchUpdated"
        )!;

        // fromBlock: 0n causes free RPC providers to reject the request (range too large).
        // Instead: go back 100 000 blocks from the latest — covers several days on Sepolia.
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 9_999n ? latestBlock - 9_999n : 0n;

        const logs = await publicClient.getLogs({
          address: pharmaChainAddress,
          event: batchUpdatedEvent,
          args: { batchId },
          fromBlock,
          toBlock: "latest",
        });

        const mapped = logs
          .slice(-10)
          .reverse()
          .map((log) => ({
            txHash: log.transactionHash,
            actor: String(log.args.actor),
            status: Number(log.args.status),
            time: Number(log.args.time),
          }));

        setEvents(mapped);
      } catch (err) {
        console.error("[pharma-chain] Failed to load batch events:", err);
        setEvents([]);
      }
    }

    void loadEvents();
  }, [batchId, publicClient]);

  useEffect(() => {
    async function loadAllBatches() {
      if (!publicClient) return;
      try {
        const batchUpdatedEvent = pharmaChainAbi.find(
          (item) => item.type === "event" && item.name === "BatchUpdated"
        )!;
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 9_999n ? latestBlock - 9_999n : 0n;

        const logs = await publicClient.getLogs({
          address: pharmaChainAddress,
          event: batchUpdatedEvent,
          fromBlock,
          toBlock: "latest",
        });

        // Keep only the latest event per batchId
        const map = new Map<string, BatchSummary>();
        for (const log of logs) {
          const key = String(log.args.batchId);
          const time = Number(log.args.time);
          const existing = map.get(key);
          if (!existing || time > existing.time) {
            map.set(key, {
              batchId: log.args.batchId as bigint,
              status: Number(log.args.status),
              actor: String(log.args.actor),
              time,
            });
          }
        }
        setAllBatches(
          Array.from(map.values()).sort((a, b) => b.time - a.time)
        );
      } catch (err) {
        console.error("[pharma-chain] Failed to load batch list:", err);
      }
    }
    void loadAllBatches();
  }, [publicClient]);

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

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Pharma Chain Dashboard</h1>
          <Link href="/admin" className="text-xs text-slate-400 hover:text-slate-200">
            Admin →
          </Link>
        </div>
        <ConnectButton />
      </header>

      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="mb-2 font-medium">Wallet</h2>
        <p className="text-sm text-slate-300">
          Address: {address ?? "Not connected"}
        </p>
        <p className="text-sm text-slate-300">
          Balance: {balance ? `${formatEther(balance.value)} ETH` : "-"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className={`rounded px-2 py-1 ${isManufacturer ? "bg-emerald-700" : "bg-slate-700"}`}>
            Manufacturer: {isManufacturer ? "yes" : "no"}
          </span>
          <span className={`rounded px-2 py-1 ${isDistributor ? "bg-emerald-700" : "bg-slate-700"}`}>
            Distributor: {isDistributor ? "yes" : "no"}
          </span>
          <span className={`rounded px-2 py-1 ${isPharmacist ? "bg-emerald-700" : "bg-slate-700"}`}>
            Pharmacist: {isPharmacist ? "yes" : "no"}
          </span>
        </div>
        {txMessage && <p className="mt-2 text-xs text-emerald-300">{txMessage}</p>}
        {errorMessage && <p className="mt-2 text-xs text-rose-300">{errorMessage}</p>}
      </section>

      <section className="rounded-lg border border-slate-800 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">All Batches</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status filter */}
            {(["all", 0, 1, 2, 3] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded px-2 py-1 ${
                  statusFilter === s ? "bg-slate-500 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABEL[s]}
              </button>
            ))}
            {/* Mine toggle */}
            <button
              onClick={() => setMineOnly((v) => !v)}
              className={`rounded px-2 py-1 ${mineOnly ? "bg-indigo-700 text-white" : "bg-slate-800 text-slate-400"}`}
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
              <p className="text-sm text-slate-400">
                {allBatches.length === 0
                  ? "No batches found in the last 10 000 blocks."
                  : "No batches match the current filter."}
              </p>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-700 text-slate-500">
                  <tr>
                    <th className="pb-2 pr-4">Batch ID</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Last Actor</th>
                    <th className="pb-2">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const statusColors: Record<number, string> = {
                      0: "text-emerald-400",
                      1: "text-blue-400",
                      2: "text-yellow-400",
                      3: "text-purple-400",
                    };
                    const isSelected = batchIdInput === String(b.batchId);
                    return (
                      <tr
                        key={String(b.batchId)}
                        onClick={() => setBatchIdInput(String(b.batchId))}
                        className={`cursor-pointer border-b border-slate-800 hover:bg-slate-800 ${
                          isSelected ? "bg-slate-800" : ""
                        }`}
                      >
                        <td className="py-2 pr-4 font-mono font-semibold">
                          #{String(b.batchId)}
                        </td>
                        <td className={`py-2 pr-4 font-medium ${statusColors[b.status] ?? "text-slate-300"}`}>
                          {STATUS_LABEL[b.status] ?? b.status}
                        </td>
                        <td className="py-2 pr-4 font-mono text-slate-400">
                          {b.actor.slice(0, 6)}…{b.actor.slice(-4)}
                        </td>
                        <td className="py-2 text-slate-500">
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

      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="mb-3 font-medium">Manufacture Batch</h2>
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
          <button type="submit" disabled={!isConnected || isPending || !isManufacturer}>
            Create Batch
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="mb-3 font-medium">Transfer Batch</h2>
        <form className="flex flex-col gap-3" onSubmit={onTransfer}>
          <input
            placeholder="New owner address"
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
            <p className="text-xs text-slate-400">
              {transferOptions.find((option) => option.value === Number(newStatus))?.recipientHint}
            </p>
          ) : (
            <p className="text-xs text-amber-300">
              Transfer disabled: wallet must be the current owner with the matching role for the next lifecycle step.
            </p>
          )}
          <button type="submit" disabled={!isConnected || isPending || !canTransfer}>
            Transfer Batch
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="mb-3 font-medium">Batch Snapshot</h2>
        {!batchData ? (
          <p className="text-sm text-slate-300">No data yet. Connect and load a batch ID.</p>
        ) : (
          <div className="space-y-1 text-sm text-slate-300">
            <p>Name: {hexToString(batchData[0], { size: 32 }).replace(/\0/g, "") || batchData[0]}</p>
            <p>Current owner: {batchData[1]}</p>
            <p>
              Status: {Number(batchData[2])} - {STATUS_LABEL[Number(batchData[2])] ?? "Unknown"}
            </p>
            <p>Timestamp: {Number(batchData[3])}</p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="mb-4 font-medium">Batch History Timeline</h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">No events found for this batch ID yet.</p>
        ) : (
          <ol className="relative border-l border-slate-700 ml-3 space-y-0">
            {[...events].reverse().map((event, index) => {
              const statusColors: Record<number, { dot: string; badge: string; label: string }> = {
                0: { dot: "bg-emerald-400", badge: "bg-emerald-900 text-emerald-300", label: "Manufactured" },
                1: { dot: "bg-blue-400",    badge: "bg-blue-900 text-blue-300",       label: "InTransit"    },
                2: { dot: "bg-yellow-400",  badge: "bg-yellow-900 text-yellow-300",   label: "Delivered"    },
                3: { dot: "bg-purple-400",  badge: "bg-purple-900 text-purple-300",   label: "Sold"         },
              };
              const color = statusColors[event.status] ?? {
                dot: "bg-slate-400", badge: "bg-slate-700 text-slate-300", label: "Unknown"
              };
              const date = new Date(event.time * 1000);
              const formattedDate = date.toLocaleDateString(undefined, {
                year: "numeric", month: "short", day: "numeric",
              });
              const formattedTime = date.toLocaleTimeString(undefined, {
                hour: "2-digit", minute: "2-digit", second: "2-digit",
              });
              const shortActor = `${event.actor.slice(0, 6)}...${event.actor.slice(-4)}`;
              const shortTx = `${event.txHash.slice(0, 10)}...${event.txHash.slice(-6)}`;

              return (
                <li key={`${event.txHash}-${event.time}`} className="mb-6 ml-6">
                  {/* Timeline dot */}
                  <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-slate-900 ${color.dot}`} />

                  {/* Card */}
                  <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color.badge}`}>
                        Step {index + 1} — {color.label}
                      </span>
                      <span className="text-xs text-slate-500">{formattedDate} · {formattedTime}</span>
                    </div>

                    {/* Actor */}
                    <p className="mt-2 text-slate-400">
                      <span className="text-slate-500">Actor: </span>
                      <span className="font-mono text-slate-300">{shortActor}</span>
                    </p>

                    {/* Tx hash — links to Sepolia Etherscan */}
                    <p className="mt-1 text-slate-400">
                      <span className="text-slate-500">Tx: </span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-400 underline hover:text-blue-300"
                      >
                        {shortTx}
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
  );
}
