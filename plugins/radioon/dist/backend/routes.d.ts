import type { PluginContext } from "@teckdato/kernel";
import { type RadioStation } from "./database";
type RouteOptions = {
    getStations: () => Promise<RadioStation[]>;
    onRequest: (payload: {
        stations: RadioStation[];
        refreshedAt: string;
    }) => Promise<void>;
};
export declare function registerRadioRoutes(context: PluginContext, options: RouteOptions): void;
export {};
//# sourceMappingURL=routes.d.ts.map