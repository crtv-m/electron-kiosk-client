import { SerialPort, ReadlineParser } from "serialport";
let port=null, parser=null;

export async function list(){ return await SerialPort.list(); }
export async function open(devicePath, baudRate=9600){
    await close();
    port = new SerialPort({ path: devicePath, baudRate, autoOpen: true });
    parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
    parser.on("data",(line)=>console.log("[SERIAL-IN]",line));
    return { ok:true };
}
export async function write(data){
    if(!port) return { ok:false, error:"not_open" };
    await new Promise((res,rej)=>port.write(data,(e)=>e?rej(e):res()));
    return { ok:true };
}
export async function close(){
    if(parser){ parser.removeAllListeners(); parser=null; }
    if(!port) return { ok:true };
    await new Promise((res)=>port.close(()=>res(null)));
    port=null; return { ok:true };
}
