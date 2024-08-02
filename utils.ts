import * as path from "path";
import * as fs from 'fs/promises';
import {Config} from "./interfaces/Config.ts";

export const SOL = "So11111111111111111111111111111111111111112";

export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export function getCurrentLocalTime(): string {
    const now = new Date();

    return now.getDate() + '-' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');
}

export async function logToFile(message: string) {
    const logFile = path.join(__dirname, 'errorLogs.txt');
    const timestamp = getCurrentLocalTime();
    const logMessage = `${timestamp} - ${message}\n`;

    try {
        await fs.appendFile(logFile, logMessage);
    } catch (error) {

    }
}

export const CURRENT_DIR = process.cwd();

export async function readFile<T>(fileName: string): Promise<T> {
    try {
        const data = await fs.readFile(`${fileName}`, "utf8");
        return JSON.parse(data) as T;
    } catch (err) {
        console.error('Error reading or parsing file:', err);
        throw err;
    }
}