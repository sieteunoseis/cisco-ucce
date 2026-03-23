const TICKS = "▁▂▃▄▅▆▇█";

export function sparkline(values) {
  if (!values.length) return "";
  const nums = values.map(Number).filter((n) => !isNaN(n));
  if (!nums.length) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  return nums
    .map((n) => TICKS[Math.round(((n - min) / range) * (TICKS.length - 1))])
    .join("");
}

export function clearScreen() {
  process.stdout.write("\x1B[2J\x1B[H");
}

export async function watchLoop({ fetchFn, fields, interval = 5, label = "" }) {
  const history = {}; // field -> number[]
  const maxPoints = 60; // keep last 60 samples

  for (const f of fields) {
    history[f] = [];
  }

  const tick = async () => {
    try {
      const data = await fetchFn();
      clearScreen();

      if (label) {
        console.log(`\x1B[1m${label}\x1B[0m`);
        console.log(
          `Polling every ${interval}s | ${new Date().toLocaleTimeString()}\n`,
        );
      }

      for (const f of fields) {
        const val = data[f];
        const num = Number(val);
        if (!isNaN(num)) {
          history[f].push(num);
          if (history[f].length > maxPoints) history[f].shift();
        }

        const spark = sparkline(history[f]);
        const current = val ?? "-";
        const padded = f.padEnd(24);
        console.log(`  ${padded} ${String(current).padStart(6)}  ${spark}`);
      }

      console.log(`\n\x1B[90mCtrl+C to stop\x1B[0m`);
    } catch (err) {
      console.error(`\x1B[31m${err.message}\x1B[0m`);
    }
  };

  await tick();
  const timer = setInterval(tick, interval * 1000);

  process.on("SIGINT", () => {
    clearInterval(timer);
    console.log("\nStopped.");
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}
