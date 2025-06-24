import { Application } from "./src/Application";
import { startServer } from "@newstack/framework/server";

const app = new Application();
startServer(app);
