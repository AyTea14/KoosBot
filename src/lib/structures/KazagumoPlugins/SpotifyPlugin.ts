// https://github.com/Takiyo0/kazagumo-spotify

import {
    type AlbumResult,
    type Artist,
    type ArtistResult,
    type PlaylistResult,
    type PlaylistTracks,
    type Result,
    type SearchResult,
    type SpotifyOptions,
    type Track,
    type TrackResult,
} from "#lib/interfaces";
import { request } from "@aytea/request";
import { filterNullish } from "@sapphire/utilities";
import {
    Kazagumo,
    KazagumoError,
    KazagumoPlugin as Plugin,
    type KazagumoSearchOptions,
    type KazagumoSearchResult,
    KazagumoTrack,
    type SearchResultTypes,
} from "kazagumo";

const REGEX = /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?(track|playlist|album|artist)[\/:]([A-Za-z0-9]+)/;
export class KazagumoPlugin extends Plugin implements Plugin {
    /**
     * The options of the plugin.
     */
    public options: SpotifyOptions;

    private _search: ((query: string, options?: KazagumoSearchOptions) => Promise<KazagumoSearchResult>) | null;
    private kazagumo: Kazagumo | null;

    private readonly methods: Record<string, (id: string, requester: unknown) => Promise<Result>>;
    private requestManager: RequestManager;

    constructor(spotifyOptions: SpotifyOptions) {
        super();
        this.options = spotifyOptions;
        this.requestManager = new RequestManager(spotifyOptions);

        this.methods = {
            track: this.getTrack.bind(this),
            album: this.getAlbum.bind(this),
            artist: this.getArtist.bind(this),
            playlist: this.getPlaylist.bind(this),
        };
        this.kazagumo = null;
        this._search = null;
    }

    public load(kazagumo: Kazagumo) {
        this.kazagumo = kazagumo;
        this._search = kazagumo.search.bind(kazagumo);
        kazagumo.search = this.search.bind(this);
    }

    private async search(query: string, options?: KazagumoSearchOptions): Promise<KazagumoSearchResult> {
        if (!this.kazagumo || !this._search) throw new KazagumoError(1, "kazagumo-spotify is not loaded yet.");

        if (!query) throw new KazagumoError(3, "Query is required");
        const [, type, id] = REGEX.exec(query) || [];

        const isUrl = /^https?:\/\//.test(query);

        if (type in this.methods) {
            try {
                const _function = this.methods[type];
                const result: Result = await _function(id, options?.requester);

                const loadType = type === "track" ? "TRACK" : "PLAYLIST";
                const playlistName = result.name ?? undefined;

                const tracks = result.tracks.filter(filterNullish);
                return this.buildSearch(playlistName, tracks, loadType);
            } catch (e) {
                return this.buildSearch(undefined, [], "SEARCH");
            }
        } else if (options?.engine === "spotify" && !isUrl) {
            const result = await this.searchTrack(query, options?.requester);

            return this.buildSearch(undefined, result.tracks, "SEARCH");
        }

        return this._search(query, options);
    }

    private buildSearch(playlistName?: string, tracks: KazagumoTrack[] = [], type?: SearchResultTypes): KazagumoSearchResult {
        return {
            playlistName,
            tracks,
            type: type ?? "TRACK",
        };
    }

    private async searchTrack(query: string, requester: unknown): Promise<Result> {
        const limit =
            this.options.searchLimit && this.options.searchLimit > 0 && this.options.searchLimit < 50 ? this.options.searchLimit : 10;
        const tracks = await this.requestManager.makeRequest<SearchResult>(
            `/search?q=${decodeURIComponent(query)}&type=track&limit=${limit}&market=${this.options.searchMarket ?? "US"}`
        );
        return {
            tracks: tracks.tracks.items.map((track) => this.buildKazagumoTrack(track, requester)),
        };
    }

    private async getTrack(id: string, requester: unknown): Promise<Result> {
        const track = await this.requestManager.makeRequest<TrackResult>(`/tracks/${id}`);
        return { tracks: [this.buildKazagumoTrack(track, requester)] };
    }

    private async getAlbum(id: string, requester: unknown): Promise<Result> {
        const album = await this.requestManager.makeRequest<AlbumResult>(`/albums/${id}?market=${this.options.searchMarket ?? "US"}`);
        const tracks = album.tracks.items
            .filter(filterNullish)
            .map((track) => this.buildKazagumoTrack(track, requester, album.images[0]?.url));

        if (album && tracks.length) {
            let next = album.tracks.next;
            let page = 1;

            while (next && (!this.options.playlistPageLimit ? true : page < this.options.playlistPageLimit ?? 1)) {
                const nextTracks = await this.requestManager.makeRequest<PlaylistTracks>(next ?? "", true);
                page++;
                if (nextTracks.items.length) {
                    next = nextTracks.next;
                    tracks.push(
                        ...nextTracks.items
                            .filter(filterNullish)
                            .filter((a) => a.track)
                            .map((track) => this.buildKazagumoTrack(track.track!, requester, album.images[0]?.url))
                    );
                }
            }
        }

        return { tracks, name: album.name };
    }

    private async getArtist(id: string, requester: unknown): Promise<Result> {
        const artist = await this.requestManager.makeRequest<Artist>(`/artists/${id}`);
        const fetchedTracks = await this.requestManager.makeRequest<ArtistResult>(
            `/artists/${id}/top-tracks?market=${this.options.searchMarket ?? "US"}`
        );

        const tracks = fetchedTracks.tracks
            .filter(filterNullish)
            .map((track) => this.buildKazagumoTrack(track, requester, artist.images[0]?.url));

        return { tracks, name: artist.name };
    }

    private async getPlaylist(id: string, requester: unknown): Promise<Result> {
        const playlist = await this.requestManager.makeRequest<PlaylistResult>(
            `/playlists/${id}?market=${this.options.searchMarket ?? "US"}`
        );

        const tracks = playlist.tracks.items
            .filter(filterNullish)
            .map((track) => this.buildKazagumoTrack(track.track, requester, playlist.images[0]?.url));

        if (playlist && tracks.length) {
            let next = playlist.tracks.next;
            let page = 1;
            while (next && (!this.options.playlistPageLimit ? true : page < this.options.playlistPageLimit ?? 1)) {
                const nextTracks = await this.requestManager.makeRequest<PlaylistTracks>(next ?? "", true);
                page++;
                if (nextTracks.items.length) {
                    next = nextTracks.next;
                    tracks.push(
                        ...nextTracks.items
                            .filter(filterNullish)
                            .filter((a) => a.track)
                            .map((track) => this.buildKazagumoTrack(track.track!, requester, playlist.images[0]?.url))
                    );
                }
            }
        }
        return { tracks, name: playlist.name };
    }

    private buildKazagumoTrack(spotifyTrack: Track, requester: unknown, thumbnail?: string) {
        return new KazagumoTrack(
            {
                track: "",
                info: {
                    sourceName: "spotify",
                    identifier: spotifyTrack.id,
                    isSeekable: true,
                    author: spotifyTrack.artists[0] ? spotifyTrack.artists[0].name : "Unknown artist",
                    length: spotifyTrack.duration_ms,
                    isStream: false,
                    position: 0,
                    title: spotifyTrack.name,
                    uri: `https://open.spotify.com/track/${spotifyTrack.id}`,
                    thumbnail: thumbnail ? thumbnail : spotifyTrack.album?.images[0]?.url,
                },
            },
            requester
        );
    }
}

const BASE_URL = "https://api.spotify.com/v1";
class RequestManager {
    private token: string = "";
    private authorization: string = "";
    private nextRenew: number = 0;

    constructor(private options: SpotifyOptions) {
        this.authorization = `${Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString("base64")}`;
    }

    public async makeRequest<T>(endpoint: string, disableBaseUri: boolean = false): Promise<T> {
        await this.renew();

        const data = await request(disableBaseUri ? endpoint : `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`)
            .auth(this.token, "Bearer")
            .json<T>();

        return data;
    }

    private async renewToken(): Promise<void> {
        const data = await request("https://accounts.spotify.com/api/token?grant_type=client_credentials")
            .post()
            .auth(this.authorization, "Basic")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .json<{ access_token?: string; expires_in: number }>();

        const { access_token, expires_in } = data;

        if (!access_token) throw new KazagumoError(3, "Failed to get access token due to invalid spotify client");

        this.token = `${access_token}`;
        this.nextRenew = Date.now() + expires_in * 1000;
    }

    private async renew(): Promise<void> {
        if (Date.now() >= this.nextRenew) {
            await this.renewToken();
        }
    }
}
