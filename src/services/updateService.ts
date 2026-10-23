export const CURRENT_APP_VERSION = "1.1.1";
const GITHUB_LATEST_RELEASE_API =
  "https://api.github.com/repos/kikiexe/ILoveBesi-mobile/releases/latest";
const FALLBACK_DOWNLOAD_URL =
  "https://github.com/kikiexe/ILoveBesi-mobile/releases/latest/download/app-release.apk";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
}

export function parseSemver(versionString: string): number[] {
  const cleaned = versionString
    .replace(/^[^0-9]+/, "")
    .split("-")[0]
    .split("+")[0]
    .trim();

  if (!cleaned) {
    return [0, 0, 0];
  }

  const parts = cleaned.split(".").map((part) => {
    const parsed = parseInt(part, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  });

  while (parts.length < 3) {
    parts.push(0);
  }

  return parts;
}

export function isNewerVersion(current: string, remote: string): boolean {
  const currentParts = parseSemver(current);
  const remoteParts = parseSemver(remote);

  const maxLength = Math.max(currentParts.length, remoteParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const c = currentParts[index] ?? 0;
    const r = remoteParts[index] ?? 0;

    if (r > c) {
      return true;
    }
    if (r < c) {
      return false;
    }
  }

  return false;
}

export async function fetchLatestRelease(): Promise<UpdateCheckResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(GITHUB_LATEST_RELEASE_API, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const remoteTag = String(data.tag_name || data.name || "").trim();
    if (!remoteTag) {
      return null;
    }

    const apkAsset = Array.isArray(data.assets)
      ? data.assets.find((asset: { name?: string; browser_download_url?: string }) =>
          typeof asset.name === "string" && asset.name.toLowerCase().endsWith(".apk")
        )
      : null;

    const downloadUrl = apkAsset?.browser_download_url || FALLBACK_DOWNLOAD_URL;
    const hasUpdate = isNewerVersion(CURRENT_APP_VERSION, remoteTag);

    return {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: remoteTag,
      releaseNotes: typeof data.body === "string" ? data.body.trim() : "",
      downloadUrl,
      publishedAt: typeof data.published_at === "string" ? data.published_at : "",
    };
  } catch {
    return null;
  }
}
