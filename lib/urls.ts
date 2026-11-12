// NEXT_PUBLIC values are public build configuration, never credentials.
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const backend = process.env.NEXT_PUBLIC_DATA_SERVICE_URL?.replace(/\/$/, "");
export const dataUrl = (path: string) => `${backend ?? `${basePath}/api/earth`}/${path}`;
export const assetUrl = (path: string) => `${basePath}/${path}`;
