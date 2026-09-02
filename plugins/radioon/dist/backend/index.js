"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = radioPlugin;
const database_1 = require("./database");
const routes_1 = require("./routes");
function radioPlugin(context) {
    context.ui.sidebar.register({
        id: "radio-dashboard",
        label: "Radioon",
        path: "/radioon",
        icon: context.plugin.icon,
        order: 10
    });
    context.events.on("radio.refresh", (payload) => {
        context.logger.info("radio.refresh event received", { payload });
    });
    context.scheduler.register("radio-cache-refresh", "*/15 * * * *", async () => {
        const refreshedAt = new Date().toISOString();
        const stations = await (0, database_1.resolveStationsForRequest)(context);
        await (0, database_1.writeRadioSnapshot)(context, "last-refresh.json", {
            refreshedAt,
            stations
        });
        await context.events.emit("radio.refresh", {
            source: "scheduler",
            refreshedAt
        });
        context.logger.info("radio cache refresh scheduled job executed", { refreshedAt });
    });
    context.websocket.register("radio:status", (payload) => {
        context.logger.info("radio websocket message", { payload });
    });
    (0, routes_1.registerRadioRoutes)(context, {
        getStations: async () => (0, database_1.resolveStationsForRequest)(context),
        onRequest: async ({ stations, refreshedAt }) => {
            await (0, database_1.writeRadioSnapshot)(context, "last-request.json", {
                refreshedAt,
                stations
            });
            await context.events.emit("radio.refresh", {
                source: "http",
                refreshedAt
            });
            await context.websocket.dispatch("radio:status", {
                source: "http",
                stations,
                refreshedAt
            });
        }
    });
    context.components.register({
        type: "radio.hero.banner",
        name: "Radio Hero Banner",
        version: "1.0.0",
        category: "content",
        frontendModule: "./components/HeroBanner.js",
        properties: [
            {
                name: "Radioon",
                type: "string",
                label: "Title",
                default: "Hello",
            },
        ],
    });
    context.logger.info("Radio plugin initialized");
}
//# sourceMappingURL=index.js.map