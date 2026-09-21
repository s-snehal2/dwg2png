import { spawn } from "node:child_process";
import process from "node:process";

// Runs a command with an enlarged V8 heap so large DWGs (multi-ten-MB with
// thousands of dimensions/hatches) parse, normalize and rasterize without
// hitting the default ~4 GB limit. The launcher itself does not need the flag;
// it is applied to the child process, which is created fresh and reads
// NODE_OPTIONS at startup.
const heapMb = process.env.NODE_HEAP_MB ?? "8192";
const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) {
  console.error("Usage: with-heap <command> [args...]");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--max-old-space-size=${heapMb}`].filter(Boolean).join(" "),
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
