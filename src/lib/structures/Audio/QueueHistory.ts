import { Player, Queue, Track } from "#lib/audio";
import { isNullish } from "@sapphire/utilities";

export class QueueHistory {
    public tracks = new Queue("LIFO");
    public constructor(public player: Player) {}

    public get currentTrack() {
        return this.player.current;
    }

    public get nextTrack() {
        return this.player.queue.at(0) ?? null;
    }

    public get previousTrack() {
        return this.tracks.at(0) ?? null;
    }

    public get size() {
        return this.tracks.size;
    }

    public isEmpty() {
        return this.tracks.size < 1;
    }

    public push(track: Track | Track[]) {
        this.tracks.add(track);
        return true;
    }

    public clear() {
        this.tracks.clear();
    }

    public async next() {
        const track = this.nextTrack;
        if (isNullish(track)) {
            throw new Error("No next track in the queue");
        }

        this.player.skip();
    }

    public async previous(preserveCurrent = true) {
        const track = this.tracks.dispatch();
        if (isNullish(track)) {
            throw new Error("No previous track in the queue");
        }

        this.player.play(track);
        const current = this.currentTrack;
        if (current && preserveCurrent) this.player.queue.splice(0, 0, current);
    }
}
