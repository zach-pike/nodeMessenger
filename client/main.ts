import * as chalk from "chalk";
import * as config from "./config.json";
import * as ws from "ws"
import * as types from "../types";

//serverData
var serverData: types.dataFromServer

//WS open flag
var socketOpen = false

//connection 
const connection = new ws(config.serverAddr)

//console.log but it don't add a \n to the end
function writeWithoutNewline(text: string): void {
    process.stdout.write(text)
}

//runs when WS successfully opens
function ready(): void {
    writeWithoutNewline(chalk.blue(">"))
}

//sends data over the ws
function send(data: types.recMessages): void {
    if (socketOpen == true) {
        connection.send(JSON.stringify(data))
    }
}

async function getUserText(message: string): Promise<string> {
    return new Promise((resolve) => {
        console.log(message)
        writeWithoutNewline(chalk.hex(config.selectColor)(">"))

        process.stdin.on("data", (text) => {
            let string = text.toString().replace(/\r?\n|\r/, "")
            if (string != "") {
                resolve(string)
            } else {
                process.stdout.clearLine(0)
                process.stdout.cursorTo(0)
                writeWithoutNewline(chalk.hex(config.selectColor)(">"))
            }
        })
    })
}

//runs everything needed to be run to get started
async function init(): Promise<void> {
    //name string
    var name: string

    //password, if needed
    var enteredPassword: string

    //wait until server data arrives
    await new Promise((resolve) => {
        connection.on("message", (msg) => {
            var _msg: types.recMessages = JSON.parse(msg.toString())
            if (_msg.intent == "serverData") {
                serverData = <types.dataFromServer>_msg.content.data
                resolve("")
            }
        })
    })

    //room greeting
    console.log(chalk.hex(serverData.greeting.color)(serverData.greeting.text))

    //prompt user for password if room requires password
    if (serverData.reqPassword == true) {

        //store password
        enteredPassword = await getUserText(chalk.whiteBright(`Enter password for ${serverData.roomName}`))

        //ask server to verify password
        connection.send(JSON.stringify({"intent": "checkPassword", "content": { "data": enteredPassword }}))

        //check if password is correct
        var passwordCorrect: boolean = await new Promise((resolve) => {

            //wait for a responce to that message from earlier
            connection.on("message", (msg) => {
                //parse the string
                var data: types.recMessages = JSON.parse(msg.toString())
                
                //resolve if the password is correct or not
                if (data.intent == "checkPassword") {
                    resolve(data.content.data == true)
                }
            })
        })

        //if password is incorrect, exit the proccess
        if (passwordCorrect != true) {
            console.log(chalk.red("Incorrect Password!"))
            process.exit(0)
        }
    }

    //gets name
    name = await getUserText(chalk.whiteBright("What do you want you username to be?"))

    //greet user
    console.log(chalk.whiteBright(`Hello ${name}!`))

    //on message
    connection.on("message", (msg) => {
        var data: types.recMessages = JSON.parse(msg.toString())
        switch (data.intent) {
            case "message":
                process.stdout.clearLine(0)
                process.stdout.cursorTo(0)
                console.log(`${chalk.hex(config.messageConfig.otherNameColor)(data.content.userid)}: ${chalk.hex(config.messageConfig.otherTextColor)(data.content.data)}`)
                ready()
                break;
        }   
    })

    //display caret
    ready()

    //on text input
    process.stdin.on("data", (data) => {
        //gets text recived
        var textrecived: string = data.toString().replace(/\r?\n|\r/, "")

        if (textrecived != "") {
            //show you sent data
            console.log(`${chalk.hex(config.messageConfig.myNameColor)(`${name} (ME)`)}: ${chalk.hex(config.messageConfig.myTextColor)(textrecived)}`)

            //send the message to the server
            send({ "intent": "message", "content": { "data": textrecived, "userid": name, "password": enteredPassword} })
        }

        //display cursor
        ready()
    })
}

//when the WS opens 
connection.on("open", () => {
    init()

    //set open flag
    socketOpen = true; 
})