import input from '@inquirer/input';
import number from '@inquirer/number';
import {copyTrade} from "./copyTrade"
import fs from 'node:fs';
import path from 'path';
import axios from "axios";
import {machineId} from 'node-machine-id';

const mainMenuString  = "" +
    "███████╗████████╗ █████╗ ██████╗ \n" +
    "██╔════╝╚══██╔══╝██╔══██╗██╔══██╗\n" +
    "███████╗   ██║   ███████║██████╔╝\n" +
    "╚════██║   ██║   ██╔══██║██╔══██╗\n" +
    "███████║   ██║   ██║  ██║██║  ██║\n" +
    "╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝\n"

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

async function login() {
    let token = await input({ message: 'Enter license key' });
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

async function main() {
    clear()

    const opt1 = "1. Copy trade"
    const opt2 = "2. Migration snipe"
    const opt3 = "3. Find good wallets"

    console.log(mainMenuString);
    console.log(opt1)
    console.log(opt2)
    console.log(opt3 + "\n")
    const choice = await number({ message: 'Select option ', min: 1, max:2 } );
    switch (choice) {
        case 1:
            clear()
            console.log(copyTradeString)
            console.log("1. Use previous settings (If this is the first time press 2)")
            console.log("2. New settings")
            console.log("3. Go back to main menu \n")
            const choice1 = await number({ message: 'Select option ', min: 1, max:3 } );
            switch (choice1) {
                case 1:
                    clear()
                    return await copyTrade()
                case 2:
                    const private_key = await input({ message: 'Enter private key' });
                    process.stdout.write("")

                    let wallets_to_track = []
                    let wallet;
                    do {
                        wallet = await input({ message: 'Enter wallet to copy trade. When finished type 0' });
                        process.stdout.write("")
                        if (wallet !== '0') wallets_to_track.push(wallet);
                    } while (wallet !== '0');
                    const helius_api_key = await input({ message: 'Enter helius api key' });
                    process.stdout.write("")
                    const shyft_api_key = await input({message: 'Enter shyft api key' });
                    process.stdout.write("")
                    const slippage = await number({ message: 'Enter slippage (0-100)', min: 0, max: 100 });
                    process.stdout.write("")
                    const priority_fee = await number({ message: 'Enter priority fee in SOL' });
                    process.stdout.write("")
                    const amount = await number({ message: 'Enter amount per buy in SOL' });
                    process.stdout.write("")
                    const webhook = await input({ message: 'Enter discord webhook' });
                    process.stdout.write("")
                    let currentDir = process.cwd();
                    const filePath = path.join(currentDir, 'config2.json');
                    let config = {
                        "private_key": private_key,
                        "wallets_to_track": wallets_to_track,
                        "helius_api_key": helius_api_key,
                        "shyft_api_key": shyft_api_key,
                        "slippage": slippage,
                        "priority_fee": priority_fee,
                        "amount": amount,
                        "webhook": webhook
                    }
                    fs.writeFile(filePath, JSON.stringify(config, null, 4), (err) => {
                        if (err) {
                            return console.error('Error writing file:', err);
                        }
                        console.log('File has been written successfully. \n');
                    })
                    clear()
                    console.log("1. Start copy trading")
                    console.log("2. Go back to main menu")
                    const choice1 = await number({ message: 'Select option ', min: 1, max:2 } );
                    switch (choice1) {
                        case 1:
                            return await copyTrade()

                        case 2:
                            return await main()

                    }
                    break
                case 3:
                    return await main()


            }
            break
        case 2:
            clear()
            console.log(migrationSnipeString)
            console.log("Not implemented yet \n")
            console.log("1. Go back to main menu\n")
            let choice2 = await number({ message: 'Select option ', min: 1, max: 1 } );
            if (choice2 === 1) {
                clear()
                return await main()
            }
            break
        case 3:
            clear()
            console.log("Find wallets\n")
            console.log("Not implemented yet \n")
            console.log("1. Go back to main menu\n")
            let choice3 = await number({ message: 'Select option ', min: 1, max: 1 } );
            if (choice3 === 1) {
                clear()
                return await main()
            }
            break

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




