import input from '@inquirer/input';
import number from '@inquirer/number';
import {copyTrade} from "./copyTrade"
import fs from 'node:fs';
import path from 'path';
import axios from "axios";
import {machineId} from 'node-machine-id';
import {delay, readFile, CURRENT_DIR, wrapSol} from "./utils";
import {migrationSnipe} from "./migrationSnipe"
import {Config} from "./interfaces/Config"
import {MigrationSnipeConfig} from "./interfaces/migrationSnipeConfig";
import {FindWallet} from "./interfaces/FindWallet";
import {goodWallets, OrderBy} from "./updateWallets";
import {migrationRaydiumSnipe} from "./raydiumMigrationSnipe";

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

const findWalletString = "" +
    "███████╗██╗███╗   ██╗██████╗     ██╗    ██╗ █████╗ ██╗     ██╗     ███████╗████████╗███████╗\n" +
    "██╔════╝██║████╗  ██║██╔══██╗    ██║    ██║██╔══██╗██║     ██║     ██╔════╝╚══██╔══╝██╔════╝\n" +
    "█████╗  ██║██╔██╗ ██║██║  ██║    ██║ █╗ ██║███████║██║     ██║     █████╗     ██║   ███████╗\n" +
    "██╔══╝  ██║██║╚██╗██║██║  ██║    ██║███╗██║██╔══██║██║     ██║     ██╔══╝     ██║   ╚════██║\n" +
    "██║     ██║██║ ╚████║██████╔╝    ╚███╔███╔╝██║  ██║███████╗███████╗███████╗   ██║   ███████║\n" +
    "╚═╝     ╚═╝╚═╝  ╚═══╝╚═════╝      ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝   ╚══════╝\n" +
    "                                                                                            "


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
    const files = fs.readdirSync(path.join(CURRENT_DIR, directory))
    console.log("Choose one of the settings below \n")
    for (let i = 0; i < files.length; i++) {
        console.log(`${i+1}. ${files[i]}`);
    }
    console.log()

    let num = await inputNumber('Select setting', 1, files.length);
    clear()
    return path.join(CURRENT_DIR, directory, files[num-1])

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
            const filePath = path.join(CURRENT_DIR, "copyTradeSettings", `${fileName}.json`);
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
    console.log("5. Wrap sol")

    console.log("6. Go back to main menu\n")

    let settings;
    const filePath = path.join(CURRENT_DIR, `migrationSnipeSettings.json`);
    let config: MigrationSnipeConfig;


    switch (await inputNumber('Select option', 1, 6)) {
        case 1:
            clear()
            let output = await inputString("Enter contract address")
            let amount = await inputNumber('Enter amount in SOL', 0, undefined, 0.0001)
            let priorityFee = await inputNumber('Enter priority fee in SOL', 0, undefined, 0.0001)

            await migrationRaydiumSnipe(output, amount, priorityFee)
        case 2:
            clear()
            settings = await readFile("migrationSnipeSettings.json") as MigrationSnipeConfig
            console.log(`private_key: ${settings.private_key}`)
            console.log(`RPC (node): ${settings.RPC}`)
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
                "RPC": settings.RPC,
                "slippage": new_slippage,
                "txn_per_sec": settings.txn_per_sec,
            }
            fs.writeFileSync(filePath, JSON.stringify(config, null, 4))
            console.log("Settings saved")
            await delay(2000)
            await migrationSnipeMenu();
            break
        case 4:
            clear()
            const private_key = await inputString("Enter private key")
            const RPC_URL = await inputString("RPC url")
            const slippage = await inputNumber('Enter slippage (0-100)', 0, 100, 0.01)
            const txn_per_second = await inputNumber('Transaction per second (View this from ur RPC)', 0, 1000, 1)
            config = {
                "private_key": private_key,
                "RPC": RPC_URL,
                "slippage": slippage,
                "txn_per_sec": txn_per_second
            }
            fs.writeFileSync(filePath, JSON.stringify(config, null, 4))
            console.log("Settings saved")
            await delay(2000)
            await migrationSnipeMenu();
            break
        case 5:
            clear()
            settings = await readFile("migrationSnipeSettings.json") as MigrationSnipeConfig
            let amount2 = await inputNumber('Enter amount in SOL', 0, undefined, 0.0001)
            await wrapSol(settings.RPC, settings.private_key, amount2)
            await delay(2000);
            await migrationSnipeMenu();
            break
        case 6:
            await main();
            break;
        default:
            break

    }

}

export async function main() {
    clear()

    const opt1 = "1. Copy trade"
    const opt2 = "2. Migration snipe"
    const opt3 = "3. Find good wallets"

    console.log(mainMenuString);
    console.log(opt1)
    console.log(opt2)
    console.log(opt3+ "\n")

    switch (await inputNumber('Select option ', 1,4)) {
        case 1:
            await copyTradeMenu();
            break
        case 2:
            await migrationSnipeMenu();
            break;

        case 3:
            clear()
            console.log(findWalletString)

            console.log("Patched for now")

            console.log("1. Start")

            console.log("2. Go back to main menu\n")


            switch (await inputNumber('Select option', 1, 2)) {
                case 1:
                    /*
                    let contractAddresses = [];
                    let contractAddress;
                    do {
                        contractAddress = await inputString("Enter contract addresses. When finished type 0")
                        if (contractAddress !== '0') contractAddresses.push(contractAddress);
                    } while (contractAddress !== '0');
                    const helius_api_key = await inputString('Enter helius api key')
                    const timeframe = await inputNumber('Enter time frame in days', 1, 30)
                    const winrate = await inputNumber('Enter minimum winrate in %', 0, 100)
                    const minimumAmountOfTrades = await inputNumber('Enter minimum amount of trades', 1)
                    const maximumAmountOfTrades =  await inputNumber('Enter maximum amount of trades', 1)
                    const minimumPnl = await inputNumber('Enter minimum Pnl in $')
                    const minimumROI = await inputNumber('Enter minimum ROI in %')
                    let listOfOrderBy: OrderBy[] = ['pnl', 'winrate', 'roi']
                    console.log("1. PNL")
                    console.log("2. winrate")
                    console.log("3. ROI")
                    let orderBy: OrderBy = listOfOrderBy[await inputNumber('What should the output be ordered by', 1, 3)]
                    let findWalletSettings: FindWallet = {
                        helius_api_key: helius_api_key,
                        timeframe: timeframe,
                        minimumWinrate: winrate,
                        minimumAmountOfTrades: minimumAmountOfTrades,
                        minimumPnl: minimumPnl,
                        minimumROI: minimumROI,
                        maximumAmountOfTrades: maximumAmountOfTrades,
                        orderBy: orderBy
                    }
                    for (const ca of contractAddresses) {
                        await goodWallets(findWalletSettings, ca)
                    }

                     */
                    await main();
                    break

                case 2:
                    await main()
            }
            break
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




