import { readFileSync, statSync } from "node:fs";

export type AccessCredentials = { clientId: string; clientSecret: string };

const headerValuePattern = /^\S+$/;

/**
 * Cloudflare Access service token 을 환경값에서 읽는다.
 * 모두 없으면 undefined 이고, 하나만 있거나 형식이 틀리면 던진다.
 * 오류 문구는 변수 이름만 말하고 값은 담지 않는다.
 */
export function resolveAccessCredentials(
  environment: Record<string, string | undefined>,
  prefix: "CAREER_BACKEND" | "FOS_ASSISTANT",
): AccessCredentials | undefined {
  const idName = `${prefix}_ACCESS_CLIENT_ID`;
  const secretName = `${prefix}_ACCESS_CLIENT_SECRET`;
  const fileName = `${secretName}_FILE`;
  const clientId = environment[idName]?.trim();
  const directSecret = environment[secretName]?.trim();
  const secretFile = environment[fileName]?.trim();

  if (directSecret && secretFile) throw new Error(`${secretName} 와 ${fileName} 은 함께 쓸 수 없다.`);
  if (!clientId && !directSecret && !secretFile) return undefined;
  if (!clientId) throw new Error(`${idName} 환경값이 필요하다. ID 와 secret 은 함께 있어야 한다.`);
  if (!directSecret && !secretFile) throw new Error(`${secretName} 또는 ${fileName} 환경값이 필요하다. ID 와 secret 은 함께 있어야 한다.`);

  let clientSecret: string;
  if (directSecret) {
    clientSecret = directSecret;
  } else {
    if ((statSync(secretFile!).mode & 0o777) !== 0o600) throw new Error(`${fileName} 파일 권한은 0600이어야 한다.`);
    clientSecret = readFileSync(secretFile!, "utf8").trim();
  }
  if (!headerValuePattern.test(clientId)) throw new Error(`${idName} 은 공백이 없는 한 단어여야 한다.`);
  if (!headerValuePattern.test(clientSecret)) throw new Error(`${secretName} 은 비어 있지 않고 공백이 없는 한 단어여야 한다.`);
  return { clientId, clientSecret };
}

export function accessHeaders(access: AccessCredentials | undefined): Record<string, string> {
  if (!access) return {};
  return { "CF-Access-Client-Id": access.clientId, "CF-Access-Client-Secret": access.clientSecret };
}
