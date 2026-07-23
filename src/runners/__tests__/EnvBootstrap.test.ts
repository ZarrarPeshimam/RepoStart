import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { EnvBootstrap } from "../EnvBootstrap";

vi.mock("fs", () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

describe("EnvBootstrap", () => {
  let timeline: any;
  let streamer: any;

  beforeEach(() => {
    timeline = {
      addEvent: vi.fn().mockReturnValue({ id: "event-1" }),
      updateEvent: vi.fn(),
    };

    streamer = {
      system: vi.fn(),
    };

    vi.clearAllMocks();
  });

  it("should detect existing .env and skip generation", async () => {
    (fs.promises.access as any).mockResolvedValue(undefined);

    const bootstrap = new EnvBootstrap(
      "/project",
      timeline,
      streamer
    );

    const result = await bootstrap.run();

    expect(result).toBe("configured");
    expect(streamer.system).toHaveBeenCalled();
    expect(timeline.addEvent).toHaveBeenCalled();
    expect(timeline.updateEvent).toHaveBeenCalled();
  });

  it("should generate .env from .env.example", async () => {
    let call = 0;

    (fs.promises.access as any).mockImplementation(() => {
      call++;

      if (call === 1) {
        return Promise.reject(new Error("Not found"));
      }

      return Promise.resolve();
    });

    (fs.promises.readFile as any).mockResolvedValue(
      "API_KEY=test\nPORT=3000"
    );

    (fs.promises.writeFile as any).mockResolvedValue(undefined);

    const bootstrap = new EnvBootstrap(
      "/project",
      timeline,
      streamer
    );

    const result = await bootstrap.run();

    expect(result).toBe("configured");

    expect(fs.promises.readFile).toHaveBeenCalledTimes(1);
    expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);

    expect(streamer.system).toHaveBeenCalledWith(
      expect.stringContaining(".env generated"),
      "repostart"
    );

    expect(timeline.addEvent).toHaveBeenCalled();
    expect(timeline.updateEvent).toHaveBeenCalled();
  });

  it("should return not-required when neither .env nor .env.example exists", async () => {
    (fs.promises.access as any).mockRejectedValue(new Error("Not found"));

    const bootstrap = new EnvBootstrap(
      "/project",
      timeline,
      streamer
    );

    const result = await bootstrap.run();

    expect(result).toBe("not-required");

    expect(fs.promises.readFile).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).not.toHaveBeenCalled();

    expect(streamer.system).not.toHaveBeenCalled();

    expect(timeline.addEvent).not.toHaveBeenCalled();
    expect(timeline.updateEvent).not.toHaveBeenCalled();
  });
  it("should handle read/write failures gracefully", async () => {
  let call = 0;

  (fs.promises.access as any).mockImplementation(() => {
    call++;

    // .env doesn't exist
    if (call === 1) {
      return Promise.reject(new Error("Not found"));
    }

    // .env.example exists
    return Promise.resolve();
  });

  (fs.promises.readFile as any).mockRejectedValue(
    new Error("Read failed")
  );

  const bootstrap = new EnvBootstrap(
    "/project",
    timeline,
    streamer
  );

  const result = await bootstrap.run();

  expect(result).toBe("not-required");

  expect(streamer.system).toHaveBeenCalledWith(
    expect.stringContaining("Failed to generate .env"),
    "repostart"
  );

  expect(timeline.addEvent).toHaveBeenCalled();

  expect(timeline.updateEvent).toHaveBeenCalledWith(
    "event-1",
    "error",
    "Read failed"
  );
});
it("should log success messages and update timeline correctly", async () => {
  let call = 0;

  (fs.promises.access as any).mockImplementation(() => {
    call++;

    // .env missing
    if (call === 1) {
      return Promise.reject(new Error("Not found"));
    }

    // .env.example exists
    return Promise.resolve();
  });

  (fs.promises.readFile as any).mockResolvedValue(
    "API_KEY=test\nPORT=3000"
  );

  (fs.promises.writeFile as any).mockResolvedValue(undefined);

  const bootstrap = new EnvBootstrap(
    "/project",
    timeline,
    streamer
  );

  await bootstrap.run();

  expect(timeline.addEvent).toHaveBeenCalledWith(
    expect.stringContaining("Generating .env"),
    "running"
  );

  expect(timeline.updateEvent).toHaveBeenCalledWith(
    "event-1",
    "success",
    expect.stringContaining(".env generated")
  );

  expect(streamer.system).toHaveBeenCalledWith(
    expect.stringContaining(".env generated from .env.example"),
    "repostart"
  );
});
});