import { describe, expect, it } from 'vitest';
import { LogStreamer } from '../LogStreamer';

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
});