declare const __APP_BUILD_VERSION__: string | undefined;

export const APP_BUILD_VERSION =
  typeof __APP_BUILD_VERSION__ === "string" && __APP_BUILD_VERSION__.trim()
    ? __APP_BUILD_VERSION__
    : "dev";

export function versionedAssetUrl(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(APP_BUILD_VERSION)}`;
}
