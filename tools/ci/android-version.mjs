import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function androidVersion(tag, previousCode) {
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag ?? '');
  if (!match) throw new Error('Use a release tag such as v2.0.1 (no prerelease or leading zeros).');
  const [major, minor, patch] = match.slice(1).map(Number);
  if (minor > 99 || patch > 99) throw new Error('Minor and patch must be between 0 and 99.');
  const code = major * 10000 + minor * 100 + patch;
  if (!Number.isSafeInteger(code) || code < 1 || code > 2100000000) {
    throw new Error('The derived versionCode must be between 1 and 2100000000.');
  }
  if (!/^(0|[1-9]\d*)$/.test(previousCode ?? '') || !Number.isSafeInteger(Number(previousCode)) || Number(previousCode) > 2100000000) {
    throw new Error('Set ANDROID_LAST_PUBLISHED_VERSION_CODE to the highest versionCode already uploaded in Play Console.');
  }
  if (code <= Number(previousCode)) throw new Error(`versionCode ${code} must exceed the previous Play build (${previousCode}).`);
  return { name: match.slice(1).join('.'), code };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const version = androidVersion(process.env.GITHUB_REF_NAME, process.env.ANDROID_LAST_PUBLISHED_VERSION_CODE);
    if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required.');
    appendFileSync(process.env.GITHUB_ENV, `ANDROID_VERSION_NAME=${version.name}\nANDROID_VERSION_CODE=${version.code}\n`);
    console.log(`Android ${version.name} (${version.code})`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
