import json, asyncio, urllib.request

try:
    import websockets
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'websockets', '-q'])
    import websockets

async def test():
    pages = json.loads(urllib.request.urlopen('http://localhost:9222/json').read())
    if not pages:
        print('No pages found')
        return
    ws_url = pages[0]['webSocketDebuggerUrl']
    page_url = pages[0]['url']
    print('Page:', page_url)
    
    async with websockets.connect(ws_url) as ws:
        js = (
            '(async()=>{'
            'const r=[];'
            'r.push("mediaDevices:"+!!navigator.mediaDevices);'
            'try{'
            'const d=await navigator.mediaDevices.enumerateDevices();'
            'const c=d.filter(x=>x.kind==="videoinput");'
            'r.push("cameras:"+c.length);'
            'c.forEach((x,i)=>r.push("cam"+i+": "+x.label))'
            '}catch(e){r.push("enumErr:"+e)}'
            'try{'
            'const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:160},height:{ideal:120}},audio:false});'
            'const t=s.getVideoTracks()[0];'
            'const st=t.getSettings();'
            'r.push("CAMERA_OPEN:"+st.width+"x"+st.height+" "+t.label);'
            's.getTracks().forEach(t=>t.stop())'
            '}catch(e){r.push("CAMERA_ERROR:"+e.name+" "+e.message)}'
            'return r.join("\\n")'
            '})()'
        )
        cmd = {
            'id': 1,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': js,
                'awaitPromise': True,
                'returnByValue': True,
            }
        }
        await ws.send(json.dumps(cmd))
        result = json.loads(await ws.recv())
        val = result.get('result', {}).get('result', {}).get('value', 'NO RESULT')
        err = result.get('result', {}).get('exceptionDetails')
        if err:
            print('EXCEPTION:', json.dumps(err, indent=2))
        else:
            print(val)

asyncio.run(test())
