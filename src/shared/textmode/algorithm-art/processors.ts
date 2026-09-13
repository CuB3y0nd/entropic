import type { Algorithm, AlgorithmFrame, ArtLabel, Random } from "./frame";

const hex = (value: number, width = 2) => value.toString(16).toUpperCase().padStart(width, "0");
const byte = (random: Random) => Math.floor(random() * 256);
const label = (column: number, row: number, text: string, tone: ArtLabel["tone"] = "ink"): ArtLabel => ({
  column,
  row,
  text,
  tone
});
const rule = (row: number) => label(0, row, "─".repeat(23), "muted");
const frame = (labels: ArtLabel[]): AlgorithmFrame => ({ ink: "", accent: "", labels });

const bitOperations = ["XOR", "ROL", "SHR"] as const;
type BitOperation = (typeof bitOperations)[number];

export function applyBitOperation(value: number, operation: BitOperation, operand: number): number {
  switch (operation) {
    case "XOR":
      return (value ^ operand) & 255;
    case "ROL": {
      const count = operand & 7;
      return ((value << count) | (value >>> (8 - count))) & 255;
    }
    case "SHR":
      return value >>> operand;
  }
}

export function bits(random: Random): Algorithm {
  const registers = Array.from({ length: 4 }, () => byte(random));
  const operations = registers.map(() => "INIT");
  const columns = Array.from({ length: 8 }, (_, index) => ({ column: index * 3, mask: 128 >>> index, bit: 7 - index }));
  let tick = 0;
  return {
    intervalMs: 480,
    next() {
      tick = (tick + 1) & 65535;
      const active = Math.floor(random() * registers.length);
      const operation = bitOperations[Math.floor(random() * bitOperations.length)] ?? "XOR";
      const operand = operation === "XOR" ? 1 + Math.floor(random() * 255) : 1 + Math.floor(random() * 3);
      const previous = registers[active] ?? 0;
      registers[active] = applyBitOperation(previous, operation, operand);
      operations[active] = `${operation} ${hex(operand)}`;
      const labels = [label(0, 0, "BIT / 08"), label(17, 0, `T ${hex(tick, 4)}`, "muted"), rule(1)];
      for (const [index, value] of registers.entries()) {
        const row = 2 + index * 3;
        labels.push(
          label(0, row, `R${index}`, index === active ? "accent" : "ink"),
          label(3, row, operations[index] ?? "", index === active ? "accent" : "muted"),
          label(19, row, `0x${hex(value)}`)
        );
        for (const { column, mask } of columns) {
          const changed = index === active && (previous ^ value) & mask;
          const on = value & mask;
          for (const y of [row + 1, row + 2]) {
            labels.push(label(column, y, on ? "██" : "░░", changed ? "accent" : on ? "ink" : "muted"));
          }
        }
      }
      // Each digit shares its bit block's column, centered in the two-character cell.
      for (const { column, bit } of columns) labels.push(label(column + 0.5, 14, String(bit), "muted"));
      return frame(labels);
    }
  };
}

/** A small byte machine: its highlighted instruction and visible registers describe the same step. */
export function createByteMachine(random: Random) {
  const registers = [0, 0, 0, 0];
  let pc = 0;
  let zero = false;
  let carry = false;
  let seed = 0;
  let mask = 0;
  let count = 0;
  return {
    next() {
      const executed = pc;
      let changed = -1;
      if (pc === 0) {
        seed = byte(random);
        mask = 1 + Math.floor(random() * 255);
        count = 3 + Math.floor(random() * 5);
      }
      const a = registers[0] ?? 0;
      const c = registers[2] ?? 0;
      switch (pc) {
        case 0:
          registers[0] = seed;
          changed = 0;
          break;
        case 1:
          registers[1] = count;
          changed = 1;
          break;
        case 2:
          registers[0] = a ^ mask;
          zero = registers[0] === 0;
          carry = false;
          changed = 0;
          break;
        case 3:
          registers[0] = applyBitOperation(a, "ROL", 1);
          carry = Boolean(a & 128);
          changed = 0;
          break;
        case 4:
          registers[2] = (c + a) & 255;
          carry = c + a > 255;
          zero = registers[2] === 0;
          changed = 2;
          break;
        case 5:
          registers[1] = ((registers[1] ?? 0) - 1) & 255;
          zero = registers[1] === 0;
          changed = 1;
          break;
        case 7:
          registers[3] = c;
          changed = 3;
          break;
      }
      pc = pc === 8 ? 0 : pc === 6 && !zero ? 2 : pc + 1;
      return {
        executed,
        nextPc: pc,
        registers: [...registers],
        changed,
        zero,
        carry,
        instructions: [
          `mov r0, 0x${hex(seed)}`,
          `mov r1, 0x${hex(count)}`,
          `xor r0, 0x${hex(mask)}`,
          "rol r0, 1",
          "add r2, r0",
          "dec r1",
          "jnz 0x02",
          "mov r3, r2",
          "jmp 0x00"
        ]
      };
    }
  };
}

export function assembly(random: Random): Algorithm {
  const machine = createByteMachine(random);
  return {
    intervalMs: 520,
    next() {
      const state = machine.next();
      const labels = [label(0, 0, "ASM / 08"), label(18, 0, `PC ${hex(state.executed)}`, "accent"), rule(1)];
      for (const [index, instruction] of state.instructions.entries()) {
        const active = index === state.executed;
        labels.push(
          label(0, index + 2, active ? ">" : "", "accent"),
          label(2, index + 2, hex(index), "muted"),
          label(6, index + 2, instruction, active ? "accent" : "ink")
        );
      }
      labels.push(rule(11));
      for (const [index, value] of state.registers.entries()) {
        labels.push(
          label(
            (index % 2) * 12,
            12 + Math.floor(index / 2),
            `R${index} ${hex(value)}`,
            index === state.changed ? "accent" : "ink"
          )
        );
      }
      labels.push(
        label(0, 14, `Z${Number(state.zero)} C${Number(state.carry)}`, "muted"),
        label(15, 14, (state.registers[0] ?? 0).toString(2).padStart(8, "0"), "muted")
      );
      return frame(labels);
    }
  };
}

type QueueStatus = "queued" | "waiting" | "running" | "ready" | "retired";
type QueueEntry = {
  op: string;
  dependencies: number[];
  latency: number;
  remaining: number;
  status: QueueStatus;
};

/** Two execution slots share a six-entry reorder buffer; retirement always follows program order. */
export function createReorderQueue(random: Random) {
  let entries: QueueEntry[] = [];
  let tick = 0;
  let issued = 0;
  let retired = 0;
  let hold = 0;
  const reset = () => {
    const program: [string, number[]][] = [
      ["LD", []],
      ["XOR", []],
      ["ADD", [1]],
      ["ROL", []],
      ["XOR", [0]],
      ["ST", [2, 4]]
    ];
    entries = program.map(([op, dependencies], index) => {
      const latency = index === 0 ? 9 + Math.floor(random() * 4) : 2 + Math.floor(random() * 3);
      return { op, dependencies, latency, remaining: latency, status: "queued" };
    });
    tick = 0;
    issued = 0;
    retired = 0;
  };
  reset();
  return {
    next() {
      if (hold > 0) {
        hold -= 1;
        if (!hold) reset();
      } else {
        tick += 1;
        const head = entries[retired];
        if (head?.status === "ready") {
          head.status = "retired";
          retired += 1;
        }
        for (const entry of entries) {
          if (entry.status !== "running") continue;
          entry.remaining -= 1;
          if (!entry.remaining) entry.status = "ready";
        }
        const next = entries[issued];
        if (next) {
          next.status = "waiting";
          issued += 1;
        }
        let slots = 2 - entries.filter((entry) => entry.status === "running").length;
        for (const entry of entries) {
          if (!slots) break;
          if (
            entry.status === "waiting" &&
            entry.dependencies.every((index) => ["ready", "retired"].includes(entries[index]?.status ?? ""))
          ) {
            entry.status = "running";
            slots -= 1;
          }
        }
        if (retired === entries.length) hold = 5;
      }
      return { tick, retired, entries: entries.map((entry) => ({ ...entry, dependencies: [...entry.dependencies] })) };
    }
  };
}

export function reorder(random: Random): Algorithm {
  const queue = createReorderQueue(random);
  // The static frame already shows work in flight and an out-of-order completion.
  for (let step = 0; step < 6; step += 1) queue.next();
  const statuses: Record<QueueStatus, string> = {
    queued: "--",
    waiting: "WAIT",
    running: "RUN",
    ready: "RDY",
    retired: "RET"
  };
  return {
    intervalMs: 320,
    next() {
      const state = queue.next();
      const labels = [label(0, 0, "ROB / 06"), label(17, 0, `T ${hex(state.tick, 4)}`, "muted"), rule(1)];
      for (const [index, entry] of state.entries.entries()) {
        const row = 2 + index * 2;
        const running = entry.status === "running";
        const progress = Math.round((23 * (entry.latency - entry.remaining)) / entry.latency);
        labels.push(
          label(0, row, `${hex(index)} ${entry.op}`, entry.status === "retired" ? "muted" : "ink"),
          label(
            8,
            row,
            entry.dependencies.length ? `<${entry.dependencies.map((id) => hex(id)).join(",")}` : "",
            "muted"
          ),
          label(19, row, statuses[entry.status], running || entry.status === "ready" ? "accent" : "muted"),
          rule(row + 1),
          label(0, row + 1, "━".repeat(progress), entry.status === "retired" ? "muted" : "ink"),
          label(Math.min(progress, 22), row + 1, running ? "▪" : "", "accent")
        );
      }
      labels.push(
        label(0, 14, "RET", "muted"),
        label(4, 14, "■".repeat(state.retired) + "·".repeat(6 - state.retired), "accent"),
        label(16, 14, state.retired === 6 ? "DRAINED" : `NEXT ${hex(state.retired)}`, "muted")
      );
      return frame(labels);
    }
  };
}
