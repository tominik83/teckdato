"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = testPlugin;
async function testPlugin(context) {
    context.ui.sidebar.register({
        id: "test-dashboard",
        label: "TestOn",
        path: "/test",
        icon: context.plugin.icon,
        order: 10,
    });
    context.events.on("teston.refresh", (payload) => {
        context.logger.info("teston.refresh event received", { payload });
    });
    context.components.register({
        type: "hero.banner",
        name: "Hero Banner",
        version: "1.0.0",
        category: "content",
        frontendModule: "./components/HeroBanner.js",
        properties: [
            {
                name: "title",
                type: "string",
                label: "Title",
                default: "Hello",
            },
        ],
    });
    context.logger.info("TestOn plugin initialized");
}
//# sourceMappingURL=index.js.map