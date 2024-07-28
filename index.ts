import input from '@inquirer/input';
import number from '@inquirer/number';
import {copyTrade} from "./copyTrade.ts"
import fs from 'node:fs';
import path from 'path';
import axios from "axios";
import {machineId} from 'node-machine-id';
import {delay, readFile} from "./utils.ts";
import {migrationSnipe} from "./migrationSnipe.ts"
import {keysTypeMap} from "@metaplex-foundation/beet-solana";
import {Config} from "./interfaces/Config.ts"
import {MigrationSnipeConfig} from "./interfaces/migrationSnipeConfig.ts";

const mainMenuString  = "" +
    "██╗  ██╗██╗  ██╗ █████╗ ███╗   ██╗\n" +
    "██║ ██╔╝██║  ██║██╔══██╗████╗  ██║\n" +
    "█████╔╝ ███████║███████║██╔██╗ ██║\n" +
    "██╔═██╗ ██╔══██║██╔══██║██║╚██╗██║\n" +
    "██║  ██╗██║  ██║██║  ██║██║ ╚████║\n" +
    "╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝\n" +
    "                                  "

const copyTradeString = "" +
    " ██████╗ ██████╗ ██████╗ ██╗   ██╗    ████████╗██████╗  █████╗ ██████╗ ███████╗\n" +
    "██╔════╝██╔═══██╗██╔══██╗╚██╗ ██╔╝    ╚══██╔══╝██╔══██╗██╔══██╗██╔══██╗██╔════╝\n" +
    "██║     ██║   ██║██████╔╝ ╚████╔╝        ██║   ██████╔╝███████║██║  ██║█████╗  \n" +
    "██║     ██║   ██║██╔═══╝   ╚██╔╝         ██║   ██╔══██╗██╔══██║██║  ██║██╔══╝  \n" +
    "╚██████╗╚██████╔╝██║        ██║          ██║   ██║  ██║██║  ██║██████╔╝███████╗\n" +
    " ╚═════╝ ╚═════╝ ╚═╝        ╚═╝          ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝\n" +
    "                                                                               "

const migrationSnipeString = "" +
    "███╗   ███╗██╗ ██████╗ ██████╗  █████╗ ████████╗██╗ ██████╗ ███╗   ██╗\n" +
    "████╗ ████║██║██╔════╝ ██╔══██╗██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║\n" +
    "██╔████╔██║██║██║  ███╗██████╔╝███████║   ██║   ██║██║   ██║██╔██╗ ██║\n" +
    "██║╚██╔╝██║██║██║   ██║██╔══██╗██╔══██║   ██║   ██║██║   ██║██║╚██╗██║\n" +
    "██║ ╚═╝ ██║██║╚██████╔╝██║  ██║██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║\n" +
    "╚═╝     ╚═╝╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝\n" +
    "                                                                      "

const currentDir = process.cwd();

async function login() {
    let token = await inputString("Enter license key")
    let mid = await machineId();
    let data = {'c': mid, 'token': token}
    try {
        let response = await axios.post("https://artistic-locust-sincerely.ngrok-free.app/verify_license", data);
        if (response.status === 200) {
            await main()
        } else {
            console.log("Invalid key")
        }
    } catch (error) {
        console.log("Invalid key")
    }


}

async function inputNumber(message: string, min?: number, max?: number, step = 1) {
    const num = await number({ message: message, min: min, max: max, step: step});
    process.stdout.write("")
    if (typeof num === "undefined") {
        console.log("Something went wrong, try again")
        return await inputNumber(message, min, max, step)
    }
    return num
}

async function inputString(message: string) {
    const str = await input({ message: message });
    process.stdout.write("")
    if (str.length === 0) {
        console.log("Something went wrong, try again")
        return await inputString(message)
    }
    return str.trim()
}
// Tænker at vi skal have alle configs i en liste der hedder copyTradeConfig
// Så kan vi vælge 1. Use previous settings (If this is the first time press 2) som går i en anden menu
// Og herinde skal den kunne vælge en af de configs som findes og liste dem alle op og så skal man så bruge tal alt efter
// hvor mange der er.
// så f.eks 1. config.json, 2. config2.json osv.
// og vi får tallene ud fra længden af directory

/*
    Vi skal også have noget hvor man vælge hvilken plan er på for at få hurtigere rpc calls og om man kan bruge
    jito tip
 */

// Maybe one wallet which is good so we want to give it more sol to work with? e.g. the scalper.

async function selectFile(directory: string) {
    clear()
    const files = fs.readdirSync(path.join(currentDir, directory))
    console.log("Choose one of the settings below \n")
    for (let i = 0; i < files.length; i++) {
        console.log(`${i+1}. ${files[i]}`);
    }
    console.log()

    let num = await inputNumber('Select setting', 1, files.length);
    clear()
    return path.join(currentDir, directory, files[num-1])

}

async function copyTradeMenu() {
    clear()
    console.log(copyTradeString)
    console.log("1. Choose setting")
    console.log("2. New setting")
    console.log("3. Delete setting")
    console.log("4. Go back to main menu \n")
    switch (await inputNumber('Select option', 1, 4)) {
        case 1:
            let choiceOfFile = await selectFile("copyTradeSettings");

            return await copyTrade(choiceOfFile)

        case 2:
            const private_key = await inputString('Enter private key')
            let wallets_to_track = []
            let wallet;
            do {
                wallet = await inputString("Enter wallet to copy trade. When finished type 0")
                if (wallet !== '0') wallets_to_track.push(wallet);
            } while (wallet !== '0');
            const helius_api_key = await inputString("Enter helius api key")
            const shyft_api_key = await inputString("Enter shyft api key")
            const slippage = await inputNumber('Enter slippage (0-100)', 0, 100, 0.01)
            const priority_fee = await inputNumber('Enter priority fee in SOL', undefined, undefined, 0.0001)
            const amount = await inputNumber('Enter amount per buy in SOL', undefined, undefined, 0.0001)
            const webhook = await inputString('Enter discord webhook')
            const fileName = await inputString('Enter a name for this configuration')
            const filePath = path.join(currentDir, "copyTradeSettings", `${fileName}.json`);
            let config: Config = {
                "private_key": private_key,
                "wallets_to_track": wallets_to_track,
                "helius_api_key": helius_api_key,
                "shyft_api_key": shyft_api_key,
                "slippage": slippage,
                "priority_fee": priority_fee,
                "amount": amount,
                "webhook": webhook
            }
            fs.writeFileSync(filePath, JSON.stringify(config, null, 4))
            clear()
            console.log("1. Start copy trading")
            console.log("2. Go back to main menu")
            switch (await inputNumber('Select option', 1, 2)) {
                case 1:
                    return await copyTrade(filePath)

                case 2:
                    return await main()
            }
            break
        case 3:

            let choiceOfFile2 = await selectFile("copyTradeSettings")
            fs.rm(choiceOfFile2, (err) => {
                if (err) {
                    return console.error('Error writing file:', err);
                }
                console.log("Setting deleted")
            });
            await delay(1000)
            return await copyTradeMenu();

        case 4:
            return await main()


    }
}

async function migrationSnipeMenu() {
    clear()
    console.log(migrationSnipeString)

    console.log("1. Snipe")
    console.log("2. Display current settings")
    console.log("3. Edit slippage")
    console.log("4. New settings")
    console.log("5. Go back to main menu\n")
    let settings;
    const filePath = path.join(currentDir, `migrationSnipeSettings.json`);
    let config: MigrationSnipeConfig;
    switch (await inputNumber('Select option', 1, 5)) {

        case 1:
            clear()
            let output = await inputString("Enter contract address")
            let amount = await inputNumber('Enter amount in SOL', undefined, undefined, 0.0001)
            let priorityFee = await inputNumber('Enter priority fee in SOL', undefined, undefined, 0.0001)

            return migrationSnipe(output, amount, priorityFee)
        case 2:
            clear()
            settings = await readFile("migrationSnipeSettings.json") as MigrationSnipeConfig
            console.log(`private_key: ${settings.private_key}`)
            console.log(`shyft_api_key: ${settings.shyft_api_key}`)
            console.log(`quiknode_url: ${settings.quiknode_url}`)
            console.log(`slippage: ${settings.slippage}`)
            await inputNumber("1. Go back", 1,1);
            return await migrationSnipeMenu();
        case 3:
            clear()
            settings = await readFile("migrationSnipeSettings.json") as MigrationSnipeConfig
            console.log(`current slippage: ${settings.slippage}`)
            let new_slippage = await inputNumber("Input new slippage", 0, 100, 0.0001)
            config = {
                "private_key": settings.private_key,
                "shyft_api_key": settings.shyft_api_key,
                "slippage": new_slippage,
                "quiknode_url": settings.quiknode_url,

            }
            fs.writeFileSync(filePath, JSON.stringify(config, null, 4))
            console.log("Settings saved")
            await delay(2000)
            await migrationSnipeMenu();
            break
        case 4:
            clear()
            const private_key = await inputString("Enter api key")
            const shyft_api_key = await inputString("Enter shyft api key")
            const slippage = await inputNumber('Enter slippage (0-100)', 0, 100, 0.01)
            const quiknode_api_key = await inputString("Enter quiknode url");
            config = {
                "private_key": private_key,
                "shyft_api_key": shyft_api_key,
                "slippage": slippage,
                "quiknode_url": quiknode_api_key,
            }
            fs.writeFileSync(filePath, JSON.stringify(config, null, 4))
            console.log("Settings saved")
            await delay(2000)
            await migrationSnipeMenu();
            break
        case 5:
            await main();
            break;
    }

}

async function main() {
    clear()

    const opt1 = "1. Copy trade"
    const opt2 = "2. Migration snipe"
    const opt3 = "3. Find good wallets"

    console.log(mainMenuString);
    console.log(opt1)
    console.log(opt2)
    console.log(opt3 + "\n")

    switch (await inputNumber('Select option ', 1,3)) {
        case 1:
            await copyTradeMenu();
            break
        case 2:
            await migrationSnipeMenu();
            break;

        case 3:
            clear()
            console.log("Find wallets\n")
            console.log("Not implemented yet \n")
            console.log("1. Go back to main menu\n")
            await inputNumber('Select option', 1, 1)
            return await main()

            /*
            const helius_api_key = await input({ message: 'Enter helius api key' });
            process.stdout.write("")
            const timeframe = await number({ message: 'Enter time frame in days', min: 1, max: 30 });
            process.stdout.write("")
            const winrate = await number({ message: 'Enter minimum winrate in %', min: 1, max: 100 });
            process.stdout.write("")
            const minimumAmountOfTrades = await number({ message: 'Enter minimum amount of trades', min: 1 });
            process.stdout.write("")
            const maximumAmountOfTrades = await number({ message: 'Enter maximum amount of trades', min: 1 });
            process.stdout.write("")
            const minimumPnl = await number({ message: 'Enter minimum Pnl in $', min: 1 });
            process.stdout.write("")
            */

        default:
            console.log("Not valid option")
            break
    }

}

function clear() {
    let lines = process.stdout.getWindowSize()[1];
    for(let i = 0; i < lines; i++) {
        console.log('\r\n');
    }
}





login()




