import { ApplicationExample } from "./src/Application";
import { NewstackServer } from "@newstack/framework/server";

const app = new ApplicationExample();
new NewstackServer().start(app);
