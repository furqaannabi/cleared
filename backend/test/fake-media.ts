/** A stand-in for reading a video file: it says what the test tells it the next file is. */
import type { Media } from "../src/media/port";

type Probe = Awaited<ReturnType<Media["probe"]>>;

export class FakeMedia implements Media {
  /** What every file is, unless a test says otherwise: a one-minute MP4. */
  file: Probe = { format: "mp4", durationSec: 60 };
  /** Every address it was asked to read. */
  readonly probed: string[] = [];

  async probe(address: string) {
    this.probed.push(address);
    return this.file;
  }
}
