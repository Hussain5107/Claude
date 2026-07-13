import { startWebServer } from "./server.js";

const port = parseInt(process.env.PORT || "4300", 10);
startWebServer(port);
