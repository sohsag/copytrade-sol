import path from "path";
import fs from "fs/promises";

export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export function getCurrentLocalTime(): string {
    const now = new Date();

    return now.getFullYear() + '-' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');
}

export async function logToFile(message: string) {
    const logFile = path.join(__dirname, 'errorLogs.txt');
    const timestamp = getCurrentLocalTime()
    const logMessage = `${timestamp} - ${message}\n`;

    try {
        await fs.appendFile(logFile, logMessage);
    } catch (error) {

    }
}