const path = require("path");
const fs = require("fs");
import { getCacheDir } from "./sys";

process.env.DIST_ELECTRON = path.join(__dirname, "..");
process.env.DIST = path.join(process.env.DIST_ELECTRON, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
	? path.join(process.env.DIST_ELECTRON, "../public")
	: process.env.DIST;
export const isDev = process.env.NODE_ENV !== "production";

export const homedir = require("os").homedir();

export const dirname = process.resourcesPath;
// @ts-ignore
export const appStatic = process.env.VITE_PUBLIC;
export const configStatic = getCacheDir();
fs.mkdirSync(configStatic, { recursive: true });