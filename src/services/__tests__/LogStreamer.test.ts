import { describe, expect, it } from 'vitest';
import { LogStreamer, prepareSpawnCommand } from '../LogStreamer';

describe('LogStreamer command validation', () => {
    it('should reject commands containing shell operators', async () => {
        const streamer = new LogStreamer();
        const logs: string[] = [];

        streamer.on('log', (entry) => {
            logs.push(entry.message);
        });

        const exitCode = await streamer.run(
            'npm install && rm -rf /',
            process.cwd(),
            'test'
        );

        expect(exitCode).toBe(1);

        expect(
            logs.some((message) =>
                message.includes('Unsupported shell syntax detected')
            )
        ).toBe(true);
    });

    it('should allow normal commands', async () => {
        const streamer = new LogStreamer();

        const exitCode = await streamer.run(
            'node --version',
            process.cwd(),
            'test'
        );

        expect(exitCode).toBe(0);
    });

    it('should reject malicious commands', async () => {
        const streamer = new LogStreamer();
        const logs: string[] = [];

        streamer.on('log', (entry) => {
            logs.push(entry.message);
        });

        const exitCode = await streamer.run(
            'npm install; rm -rf /',
            process.cwd(),
            'test'
        );

        expect(exitCode).toBe(1);

        expect(
            logs.some((message) =>
                message.includes('Unsupported shell syntax detected')
            )
        ).toBe(true);
    });

    it('should prepare Windows package manager commands without enabling shell execution', () => {
        expect(
            prepareSpawnCommand(
                'npm',
                ['run', 'dev'],
                'win32',
                'C:\\Windows\\System32\\cmd.exe'
            )
        ).toEqual({
            executable: 'C:\\Windows\\System32\\cmd.exe',
            args: ['/d', '/s', '/c', 'npm.cmd', 'run', 'dev'],
        });

        expect(
            prepareSpawnCommand('npm', ['install'], 'win32', 'C:\\Windows\\System32\\cmd.exe')
        ).toEqual({
            executable: 'C:\\Windows\\System32\\cmd.exe',
            args: ['/d', '/s', '/c', 'npm.cmd', 'install'],
        });

        expect(
            prepareSpawnCommand('pnpm', ['install'], 'win32', 'C:\\Windows\\System32\\cmd.exe')
        ).toEqual({
            executable: 'C:\\Windows\\System32\\cmd.exe',
            args: ['/d', '/s', '/c', 'pnpm.cmd', 'install'],
        });

        expect(
            prepareSpawnCommand('yarn', ['install'], 'win32', 'C:\\Windows\\System32\\cmd.exe')
        ).toEqual({
            executable: 'C:\\Windows\\System32\\cmd.exe',
            args: ['/d', '/s', '/c', 'yarn.cmd', 'install'],
        });
    });

    it('should execute normal Unix commands directly without shell', () => {
        expect(
            prepareSpawnCommand('npm', ['install'], 'linux')
        ).toEqual({
            executable: 'npm',
            args: ['install'],
        });

        expect(
            prepareSpawnCommand('python', ['-m', 'venv', '.venv'], 'linux')
        ).toEqual({
            executable: 'python',
            args: ['-m', 'venv', '.venv'],
        });
    });

    it('should execute npm on Windows when running on Windows', async () => {
        if (process.platform !== 'win32') {
            return;
        }

        const streamer = new LogStreamer();

        const exitCode = await streamer.run(
            'npm --version',
            process.cwd(),
            'test'
        );

        expect(exitCode).toBe(0);
    });
});
