import { Application } from "./src/Application";
import { NewstackServer } from "@newstack/framework/server";

const app = new Application();
new NewstackServer().start(app);
