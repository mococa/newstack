/* ---------- Internal ---------- */
import Newstack, { type NewstackClientContext } from "@newstack/framework";

/**
 * @description
 * This is the About page of the Newstack example application.
 * It provides information about Newstack and includes a server function demonstration.
 * The page allows users to call a server function and display the response.
 */
export class About extends Newstack {
  msg: string;

  /**
   * @description
   * Example server function that can be called from the client.
   * This method in the client-side will be replaced by a fetch call to the server
   * during the build process, while the server will execute this function directly.
   */
  static async NiceServerFunction({ name }) {
    return `Hello from the server, ${name}!`;
  }

  prepare({ page }: NewstackClientContext) {
    page.title = "About Newstack";
    page.description = "Learn more about Newstack and its features.";
  }

  async callServerFunction() {
    const message = await About.NiceServerFunction({
      name: "Newstack User",
    });

    this.msg = message;
  }

  render() {
    return (
      <div>
        <h1>About Newstack</h1>

        <p>Newstack is a modern framework for building web applications.</p>

        <div>
          Server message: <pre>{this.msg || "..."}</pre>
        </div>

        <button type="button" onclick={() => this.callServerFunction()}>
          Call server function
        </button>

        <a href="/">Home</a>
      </div>
    );
  }
}
