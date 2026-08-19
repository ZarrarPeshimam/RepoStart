import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { LogEntry, LogLevel } from '../types';
import { now, uid } from '../utils/fs';

const UNSUPPORTED_SHELL_PATTERNS = [
  /&&/,
  /&/,
  /;/,
  /\|\|/,
  /\|/,
  />/,
  /</,
  /`/,
  /\$\(/,
];

export class LogStreamer extends EventEmitter {
  private timestampLogs: boolean;

  constructor(options: { timestampLogs?: boolean } = {}) {
    super();
    this.timestampLogs = options.timestampLogs ?? false;
  }

  private emit_log(level: LogLevel, source: string, message: string): void {
    const entry: LogEntry = {
      id: uid(),
      level,
      source,
      message: message.trimEnd(),
      timestamp: now(),
    };
    this.emit('log', entry);
  }

  private validateCommand(command: string): boolean {
    return !UNSUPPORTED_SHELL_PATTERNS.some(
      pattern => pattern.test(command)
    );
  }

  system(message: string, source = 'repostart'): void {
    this.emit_log('system', source, message);
  }

  run(command: string, cwd: string, source: string): Promise<number> {
    return new Promise((resolve) => {
      this.emit_log('system', source, `▶ ${command}  (in ${cwd})`);

      if (!this.validateCommand(command)) {
        this.emit_log(
          'error',
          source,
          `Unsupported shell syntax detected: ${command}`
        );

        resolve(1);
        return;
      }
      const [bin, ...args] = this.parseCommand(command);

      const child = spawn(bin, args, {
        cwd,
        shell: false, // Execute commands directly to avoid unnecessary shell interpretation.
        env: { ...process.env },
      });

      child.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            this.emit_log('info', source, line);
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            // Heuristic: lines starting with 'ERR' or 'error' are errors
            const level: LogLevel =
              /^(ERR|error|Error)/i.test(line.trim()) ? 'error' : 'warn';
            this.emit_log(level, source, line);
          }
        }
      });

      child.on('error', (err) => {
        this.emit_log('error', source, `Process error: ${err.message}`);
        resolve(1);
      });

      child.on('close', (code) => {
        const exitCode = code ?? 1;
        const level: LogLevel = exitCode === 0 ? 'success' : 'error';
        this.emit_log(
          level,
          source,
          exitCode === 0
            ? `✓ Command finished successfully`
            : `✗ Command exited with code ${exitCode}`
        );
        resolve(exitCode);
      });
    });
  }

  private parseCommand(command: string): string[] {
    return command.trim().split(/\s+/);
  }
}
