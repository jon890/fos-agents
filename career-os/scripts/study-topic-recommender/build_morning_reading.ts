export * from "./morning_reading_cli.js";

if (import.meta.main) {
  const { main, reportMorningReadingError } = await import("./morning_reading_cli.js");
  await main().catch(reportMorningReadingError);
}
