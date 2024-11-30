//% color=#126180 icon="\uf0fb" block="ThisExtensionIsATest"
namespace ESP8266_IoT {

    /* Enumeration for the different possible commands we can use the ESP8266 for*/
    enum Cmd {
        None, //0
        ConnectWifi, //1
    }

    let wifi_connected: boolean = false
    let telloIP = "192.168.10.1"
    let recvString = ""
    let commandPort = 8889
    let scanWIFIAPFlag = 0
    let currentCmd: Cmd = Cmd.None // tracks current code used

    const EspEventSource = 3000
    const EspEventValue = {
        None: Cmd.None,
        ConnectWifi: Cmd.ConnectWifi
    }

    // Function to read and display response on the micro:bit
    function readResponse(): void {
        let response = serial.readString();
        if (response.includes("OK")) {
            basic.showString("Connected");
        } else {
            basic.showString("Failed");
            basic.showString(response); // Displays the actual error
        }
    }

    // Write AT command with CR+LF ending for esp8266 to read
    function sendAT(command: string, wait: number = 0) {
        serial.writeString(`${command}\u000D\u000A`)
        basic.pause(wait)
    }

    function restEsp8266() {
        sendAT("AT+RESTORE", 1000) // restore to factory settings
        sendAT("AT+RST", 1000) // rest
        serial.readString() // clears any leftover data from the serial input buffer
        sendAT("AT+CWMODE=1", 1000) // set to STA mode
        sendAT("AT+SYSTIMESTAMP=1634953609130", 100) // Set local timestamp.
        sendAT(`AT+CIPSNTPCFG=1,8,"ntp1.aliyun.com","0.pool.ntp.org","time.google.com"`, 100)
        basic.pause(3000)
    }
    /* After connected to Tello WiFi, have set up UDP connection and initialisd the Tello into SDK mode */
    function sendCommandToTello(command: string): void {
        sendAT(`AT+CIPSEND=${command.length}`, 500);  // Send command length and command
        serial.writeString(command + "\r\n"); // Send the actual command
        basic.pause(500);
        readResponse(); // Display Tello's response
    }


    function scanWIFIAP(ssid: string) {
        let scanflag = 0
        let mscnt = 0
        let recvString = " "
        sendAT(`AT+CWLAPOPT=1,2,-100,255`) //1=Shows all APs. 2=Displays signal strength(RSSI). -100,255=Defines signal strength range 
        sendAT(`AT+CWLAP`) //Initiates a Wi-Fi scan
        while (!(scanflag)) {

            recvString = recvString + serial.readString()
            basic.pause(1)
            mscnt += 1
            if (mscnt >= 5000) { //scans wifi for 5sec
                scanWIFIAPFlag = 0
                break
            }

            if (recvString.includes("+CWLAP:(")) {

                mscnt = 0
                recvString = recvString.slice(recvString.indexOf("+CWLAP:("))
                scanflag = 1
                while (1) {

                    recvString += serial.readString()
                    basic.pause(1)
                    mscnt += 1

                    // OLED.clear()
                    // OLED.writeStringNewLine(_recvString)
                    if (recvString.includes("OK") || mscnt >= 3000) {

                        if (mscnt >= 3000) {
                            scanWIFIAPFlag = 0
                        } else if (recvString.includes(ssid)) {
                            scanWIFIAPFlag = 1
                        } else {
                            scanWIFIAPFlag = 0
                        }
                        break
                    }
                }
            }

        }
        recvString = " "
    }

    

    /* Initialize ESP8266 module */
    //% block="Set ESP8266|RX %tx|TX %rx|Baud rate %baudrate"
    //% tx.defl=SerialPin.P8
    //% rx.defl=SerialPin.P12
    //% ssid.defl=your_ssid
    //% pw.defl=your_password weight=100
    export function initEsp(tx: SerialPin, rx: SerialPin, baudrate: BaudRate) {
        serial.redirect(tx, rx, BaudRate.BaudRate115200)
        basic.pause(100)
        serial.setTxBufferSize(64)  // Adjusted
        serial.setRxBufferSize(256) // Adjusted
        restEsp8266()
    }

    /* Connect to Wifi (1) */
    //% block="Connect Wifi SSID = %ssid|KEY = %pw"
    //% ssid.defl=your_ssid
    //% pw.defl=your_pwd weight=95
    export function connectWifi(ssid: string, pw: string) {

        while (1) {
            scanWIFIAP(ssid)
            if (scanWIFIAPFlag) {
                currentCmd = Cmd.ConnectWifi
                sendAT(`AT+CWJAP="${ssid}","${pw}"`) // connect to Wifi router
                control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                while (!wifi_connected) {
                    restEsp8266()
                    sendAT(`AT+CWJAP="${ssid}","${pw}"`)
                    control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                }
                break
            } else {
                restEsp8266()
                currentCmd = Cmd.ConnectWifi
                sendAT(`AT+CWJAP="${ssid}","${pw}"`)
                control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                if (wifi_connected) {
                    break
                }
            }
        }
    }

    /* Check if ESP8266 successfully connected to Wifi */
    //% block="Wifi connected %State" weight=70
    export function wifiState(state: boolean) {
        return wifi_connected === state
    }
    
    // Seting up UDP connection (2) and initialise the Tello into SDK mode (3)
    //% block="Initialise ESP and Tello connection"
    export function setupUDPConnection() {
        if (!wifi_connected) {
            basic.showString("No WiFi")
            return
        }

        // Setup UDP connection
        sendAT(`AT+CIPSTART="UDP","${telloIP}",${commandPort}`, 2000)
        if (!readResponse()) return

        // Enter SDK mode
        sendCommandToTello("command")
    }
}