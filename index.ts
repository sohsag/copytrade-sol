
import input from '@inquirer/input';
import number from '@inquirer/number';
import {copyTrade} from "./copyTrade.ts"
import fs from 'node:fs';
import path from 'path';

const mainMenuString  = "" +
    "███████╗████████╗ █████╗ ██████╗ ███████╗\n" +
    "██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══███╔╝\n" +
    "███████╗   ██║   ███████║██████╔╝  ███╔╝ \n" +
    "╚════██║   ██║   ██╔══██║██╔══██╗ ███╔╝  \n" +
    "███████║   ██║   ██║  ██║██║  ██║███████╗\n" +
    "╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════ \n"

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

}

async function main() {
    clear()



    const opt1 = "1. Copy trade"
    const opt2 = "2. Migration snipe"

    console.log(mainMenuString);
    console.log(opt1)
    console.log(opt2 + "\n")
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
            const choice = await number({ message: 'Select option ', min: 1, max: 1 } );
            if (choice === 1) {
                clear()
                return await main()
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





main()




