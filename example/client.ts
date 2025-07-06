import { Application } from "./src/Application";
import { NewstackClient } from "@newstack/framework";

const app = new Application();
new NewstackClient().start(app);
