// refresh_topic_inventory.ts — entrypoint shim. 본체는 cli.ts (ADR-035 분해 컨벤션, plan027).
export * from "./cli.js";
if (import.meta.main) {
  const { main } = await import("./cli.js");
  await main();
}
