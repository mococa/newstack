import { ApplicationExample } from "./src/Application";
import { startServer } from "@newstack/framework/server";

const app = new ApplicationExample();
startServer(app);
