import { ApplicationExample } from "./src/Application";
import { NewstackClient } from "@newstack/framework";

const app = new ApplicationExample();
new NewstackClient().start(app);
