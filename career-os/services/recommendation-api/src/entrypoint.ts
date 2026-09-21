import "./utc.js";

/**
 * container 의 진입점.
 *
 * `serve` 는 HTTP 서버를 띄우고 `migrate` 는 migration 을 적용하고 끝난다.
 * 인프라 저장소의 배포 스크립트가 두 명령을 그대로 넘기므로 이름을 바꾸지 않는다.
 */
const command = process.argv[2] ?? "serve";

if (command === "serve") {
  await import("./main.js");
} else if (command === "migrate") {
  const { runMigrateDeploy } = await import("./migrate.js");
  process.exit(runMigrateDeploy());
} else {
  console.error(`알 수 없는 명령 ${command} 입니다. 사용법: entrypoint.js <serve|migrate>`);
  process.exit(2);
}
