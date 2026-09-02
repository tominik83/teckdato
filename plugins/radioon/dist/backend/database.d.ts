import type { PluginContext } from "@teckdato/kernel";
export type RadioStation = {
    id: string;
    name: string;
    playlistUrl: string;
    station_logo?: string;
    streamUrl?: string;
};
export declare const DEFAULT_STATIONS: RadioStation[];
export declare function resolveStationsForRequest(context: PluginContext): Promise<RadioStation[]>;
export declare function saveStations(context: PluginContext, stations: RadioStation[]): Promise<void>;
export declare function writeRadioSnapshot(context: PluginContext, name: string, payload: unknown): Promise<void>;
//# sourceMappingURL=database.d.ts.map