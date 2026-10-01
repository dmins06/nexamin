// This text executes only inside a Worker belonging to an opaque-origin iframe.
// The JVM's generated JS never executes in the Nexamin origin or FastAPI.
export const javaGuest = String.raw`
self.window = self;
self.setImmediate = BrowserFS.setImmediate;
self.onerror = () => self.postMessage({ status: 'runtime-error', stdout: '', stderr: 'Java bị lỗi hoặc vượt khả năng trình chạy. Thử chương trình nhỏ hơn.', exitCode: null, executionTime: 0 });
for (const name of ['Worker','SharedWorker','fetch','XMLHttpRequest','WebSocket','EventSource','importScripts']) {
  Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false });
}
self.onmessage = ({ data }) => {
 const started = performance.now();
  let stdout = '', stderr = '', total = 0, written = 0;
 const finish = (status, exitCode) => {
  const encoder=new TextEncoder(),errorBytes=encoder.encode(stderr).subarray(0,65536),outputBytes=encoder.encode(stdout).subarray(0,65536-errorBytes.length);
  self.postMessage({ status, stdout:new TextDecoder().decode(outputBytes,{stream:true}), stderr:new TextDecoder().decode(errorBytes,{stream:true}), exitCode, executionTime: performance.now() - started });
 };
 try {
  BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
  const fs = BrowserFS.BFSRequire('fs'), Buffer = BrowserFS.BFSRequire('buffer').Buffer, proc = BrowserFS.BFSRequire('process');
  const bytes = fflate.gunzipSync(data.archive), decoder = new TextDecoder();
  const field = (off, n) => decoder.decode(bytes.subarray(off, off+n)).replace(/\0.*$/s,'').trim();
  const mkdir = path => { if (!path || fs.existsSync(path)) return; mkdir(path.slice(0,path.lastIndexOf('/'))); fs.mkdirSync(path); };
  for (let off=0; off+512<=bytes.length;) {
   const name=field(off,100), size=parseInt(field(off+124,12)||'0',8), kind=field(off+156,1);
   if (!name) break;
   if (name.includes('..') || name.startsWith('/') || !Number.isFinite(size) || size<0 || off+512+size>bytes.length) throw Error('ARCHIVE');
   if (kind==='0' || kind==='') { const path='/sys/'+name; mkdir(path.slice(0,path.lastIndexOf('/'))); fs.writeFileSync(path,Buffer.from(bytes.subarray(off+512,off+512+size))); }
   off += 512 + Math.ceil(size/512)*512;
  }
  fs.writeFileSync('/sys/java_home/lib/doppio.jar', Buffer.from(data.jar));
  mkdir('/tmp'); fs.writeFileSync('/tmp/Main.java', data.request.sourceCode);
  // Doppio reports zero for some uncaught exceptions. A trusted entry point
  // converts those exceptions to a real nonzero exit without parsing stderr.
  fs.writeFileSync('/tmp/__NexaminRunner.java', 'public final class __NexaminRunner { public static void main(String[] args) { try { Main.main(new String[0]); } catch (Throwable error) { error.printStackTrace(); System.exit(1); } } }');
  // Restrict writes after trusted runtime initialization, including javac output.
  const writeSync=fs.writeSync.bind(fs), write=fs.write.bind(fs), truncate=fs.ftruncate.bind(fs), open=fs.open.bind(fs);
  let opens=0;
  fs.open=(...args)=>{if(++opens>512)throw Error('FILE_LIMIT');return open(...args);};
  fs.ftruncate=(fd,size,cb)=>{if(size>8388608)throw Error('FILE_LIMIT');return truncate(fd,size,cb);};
  fs.writeSync=(fd,b,off,length,position)=>{written+=length;if(written>8388608)throw Error('FILE_LIMIT');return writeSync(fd,b,off,length,position);};
  fs.write=(fd,b,off,length,position,callback)=>{written+=length;if(written>8388608)throw Error('FILE_LIMIT');return write(fd,b,off,length,position,callback);};
  proc.chdir('/tmp'); proc.initializeTTYs();
  const out=(b,error)=>{const text=b.toString();total+=new TextEncoder().encode(text).length;if(total>65536){stderr='Output vượt giới hạn 64 KiB.';finish('limit',null);self.close();return;}if(error)stderr+=text;else stdout+=text;};
  proc.stdout.on('data', b=>out(b,false)); proc.stderr.on('data', b=>out(b,true));
  proc.stdin.write(data.request.stdin); proc.stdin.end();
  const opts={doppioHomePath:'/sys',javaHomePath:'/sys/java_home',bootstrapClasspath:Doppio.VM.JVM.getJDKInfo().classpath.map(p=>'/sys/java_home/'+p),classpath:['/tmp'],nativeClasspath:[],intMode:false,responsiveness:10,tmpDir:'/tmp'};
  self.postMessage({phase:'Đang biên dịch Java…'});
  new Doppio.VM.JVM(opts,(error,vm)=>{
   if(error){stderr+='Không khởi tạo được Java.';finish('unavailable',null);return;}
   vm.runClass('com.sun.tools.javac.Main',['-encoding','UTF-8','-d','/tmp','/tmp/Main.java','/tmp/__NexaminRunner.java'],code=>{
    if(code!==0 || !fs.existsSync('/tmp/Main.class') || !fs.existsSync('/tmp/__NexaminRunner.class')){finish('compile-error',code || 1);return;}
    self.postMessage({phase:'Đang chạy Java…'});
    // Register before the next JVM resolves native methods; loaded Method
    // objects cache their native function, so a late replacement is unsafe.
    const input=new TextEncoder().encode(data.request.stdin);let cursor=0;
    const readBytes=vm.getNative('Ljava/io/FileInputStream;','readBytes([BII)I'),readByte=vm.getNative('Ljava/io/FileInputStream;','read0()I');
    const stdinFD=obj=>obj['java/io/FileInputStream/fd']['java/io/FileDescriptor/fd']===0;
    Doppio.VM.JVM.registerNativeModule(()=>({
     'doppio/JavaScript':{'eval(Ljava/lang/String;)Ljava/lang/String;':thread=>{thread.throwNewException('Ljava/lang/SecurityException;','JavaScript bridge disabled in Code Lab.');return null;}},
     'java/io/FileInputStream':{
      'readBytes([BII)I':(thread,obj,array,offset,length)=>{
       if(!stdinFD(obj))return readBytes(thread,obj,array,offset,length);
       if(offset<0||length<0||offset+length>array.array.length){thread.throwNewException('Ljava/lang/IndexOutOfBoundsException;','');return;}
       if(length===0)return 0;if(cursor>=input.length)return -1;
       const count=Math.min(length,input.length-cursor);for(let i=0;i<count;i++){const b=input[cursor++];array.array[offset+i]=b>127?b-256:b;}return count;
      },
      'read0()I':(thread,obj)=>stdinFD(obj)?(cursor<input.length?input[cursor++]:-1):readByte(thread,obj),
     },
    }));
    new Doppio.VM.JVM(opts,(error2,vm2)=>{
     if(error2){stderr+='Không khởi tạo được Java.';finish('unavailable',null);return;}
     vm2.runClass('__NexaminRunner',[],code2=>finish(code2===0?'success':'runtime-error',code2));
    });
   });
  });
 } catch { stderr='Java vượt giới hạn tệp tạm hoặc runtime không khả dụng.';finish('limit',null); }
};
`
