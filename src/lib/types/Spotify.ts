export interface SpotifyOptions {
    /** The client ID of your Spotify application. */
    clientId: string;
    /** The client secret of your Spotify application. */
    clientSecret: string;
    /** 100 tracks per page */
    playlistPageLimit?: number;
    /** 50 tracks per page */
    albumPageLimit?: number;
    /** The track limit when searching track */
    searchLimit?: number;
    /** Enter the country you live in. ( Can only be of 2 letters. For eg: US, IN, EN) */
    searchMarket?: string;
}

export interface SearchResult {
    tracks: Tracks;
}

export interface TrackResult {
    album: Album;
    artists: Artist[];
    available_markets: string[];
    disc_number: number;

    duration_ms: number;
    explicit: boolean;
    external_ids: ExternalIds;
    external_urls: ExternalUrls;
    href: string;
    id: string;
    is_local: boolean;
    name: string;
    popularity: number;
    preview_url: string;
    track: any;
    track_number: number;
    type: string;
    uri: string;
}

export interface AlbumResult {
    album_type: string;
    artists: Artist[];
    available_markets: string[];
    copyrights: Copyright[];
    external_ids: ExternalIds;
    external_urls: ExternalUrls;
    genres: string[];
    href: string;
    id: string;
    images: Image[];
    label: string;
    name: string;
    popularity: number;
    release_date: string;
    release_date_precision: string;
    total_tracks: number;
    tracks: Tracks;
    type: string;
    uri: string;
}

export interface ArtistResult {
    tracks: Track[];
}

export interface PlaylistResult {
    collaborative: boolean;
    description: string;
    external_urls: ExternalUrls;
    followers: Followers;
    href: string;
    id: string;
    images: Image[];
    name: string;
    owner: Owner;
    primary_color: string | null;
    public: boolean;
    snapshot_id: string;
    tracks: PlaylistTracks;
    type: string;
    uri: string;
}

export interface Owner {
    display_name: string;
    external_urls: ExternalUrls;
    href: string;
    id: string;
    type: string;
    uri: string;
}

export interface Followers {
    href: string | null;
    total: number;
}
export interface Tracks {
    href: string;
    items: Track[];
    next: string | null;
}

export interface PlaylistTracks {
    href: string;
    items: SpecialTracks[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

export interface SpecialTracks {
    added_at: string;
    is_local: boolean;
    primary_color: string | null;
    track: Track;
}

export interface Copyright {
    text: string;
    type: string;
}

export interface ExternalUrls {
    spotify: string;
}

export interface ExternalIds {
    isrc: string;
}

export interface Album {
    album_type: string;
    artists: Artist[];
    available_markets: string[];
    external_urls: { [key: string]: string };
    href: string;
    id: string;
    images: Image[];
    name: string;
    release_date: string;
    release_date_precision: string;
    total_tracks: number;
    type: string;
    uri: string;
}

export interface Image {
    height: number;
    url: string;
    width: number;
}

export interface Artist {
    external_urls: {
        spotify: string;
    };
    followers: {
        href: string;
        total: number;
    };
    genres: [];
    href: string;
    id: string;
    images: Image[];
    name: string;
    popularity: number;
    type: string;
    uri: string;
}

export interface Track {
    album?: Album;
    artists: Artist[];
    available_markets: string[];
    disc_number: number;
    duration_ms: number;
    explicit: boolean;
    external_urls: ExternalUrls;
    href: string;
    id: string;
    is_local: boolean;
    name: string;
    preview_url: string;
    track_number: number;
    type: string;
    uri: string;
}
