import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export class STTEngine extends EventEmitter {
  constructor() {
    super();
    this.pythonProcess = null;
    this.partials = [];
    this.respawning = false;
  }

  start() {
    if (this.pythonProcess) return;
    this.respawning = false;

    console.log('[STTEngine] Starting python stt_worker.py subsystem');
    
    // Spawn python from the system/venv
    this.pythonProcess = spawn('python', ['observer2/stt_worker.py'], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true
    });

    // Parse stdout line by line
    let buffer = '';
    this.pythonProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIdx).trim();
        buffer = buffer.substring(newlineIdx + 1);

        if (line) {
          try {
            const parsed = JSON.parse(line);
            this._handleVoskResult(parsed);
          } catch (e) {
            console.log(`[STTEngine/Python] ${line}`);
          }
        }
      }
    });

    this.pythonProcess.stderr.on('data', (data) => {
      console.error(`[STTEngine/Python STDERR] ${data.toString().trim()}`);
    });

    this.pythonProcess.on('close', (code) => {
      console.log(`[STTEngine] Python worker exited with code ${code}`);
      this.pythonProcess = null;
      if (!this.respawning) {
        this.respawning = true;
        console.log('[STTEngine] Respawning python worker in 2s...');
        setTimeout(() => this.start(), 2000);
      }
    });
  }

  feed(pcmBuffer) {
    if (this.pythonProcess && this.pythonProcess.stdin.writable) {
      this.pythonProcess.stdin.write(pcmBuffer);
    }
  }

  _handleVoskResult(result) {
    // Handle rejected transcripts (below confidence threshold)
    if (result.rejected) {
      console.log(`[STT] ✗ Rejected (conf=${result.confidence}): "${result.rejected}"`);
      return; // Don't emit — this is garbage
    }

    if (result.partial) {
      this.partials.push(result.partial);
    }
    if (result.text && result.text.trim()) {
      const text = result.text.trim();
      const conf = result.confidence !== undefined ? result.confidence : null;
      if (conf !== null) {
        console.log(`[STT] ← (conf=${conf})`);
      }
      this.emit('transcript', text);
    }
  }

  stop() {
    this.respawning = true;
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }
}
