import Newstack from "@newstack/framework";
import type { Socket } from "socket.io-client";

class Counter extends Newstack {
  count = 0;
  io: Socket;
  interval: number;

  /**
   * @description
   * Example server function that can be called from the client.
   * This method in the client-side will be replaced by a fetch call to the server
   * during the build process.
   */
  static async NiceServerFunction() {
    console.log("Another server function called for Counter component");
  }

  async hydrate() {
    const { io } = await import("socket.io-client");
    this.io = io("");
    this.count = 0;

    this.interval = setInterval(() => {
      this.increase();
    }, 1000);
  }

  destroy() {
    clearInterval(this.interval);
    this.io.disconnect();
  }

  /**
   * @description
   * This method the count by 1.
   */
  increase() {
    this.count += 1;
  }

  render() {
    return (
      <div id="counter-component">
        <h2>Counter</h2>
        <p>This is a reusable component in the Newstack application.</p>
        <b>Current count: {this.count}</b>
      </div>
    );
  }
}

class ChangeString extends Newstack {
  str = "this is how the string comes from the server";

  hydrate() {
    this.str = "Hello, Newstack!";
  }

  render() {
    return (
      <div id="change-string-component">
        <h1>Change String Component</h1>

        <p>This component changes a string value.</p>

        <b>Current string: {this.str}</b>
      </div>
    );
  }
}

class ManualCounter extends Newstack {
  count = 0;

  /**
   * @description
   * This method is called when the button is clicked.
   * It increases the count by 1.
   */
  addItem() {
    this.count++;
  }

  update() {
    console.log("Updating ManualCounter component...");
  }

  render() {
    return (
      <div>
        <h2>Manual counter</h2>

        <p>
          This component demonstrates a counter that grows as we click.{" "}
          {this.count}
        </p>

        <button type="button" onclick={() => this.addItem()}>
          Click to increase {this.count}
        </button>
      </div>
    );
  }
}

class InputShow extends Newstack {
  inputValue = "";

  oninput(e: Event) {
    const target = e.target as HTMLInputElement;
    this.inputValue = target.value;
  }

  render() {
    return (
      <div id="input-show-component">
        <h2>Input Show</h2>

        <p>This component shows the input value.</p>

        <input type="text" oninput={this.oninput.bind(this)} />

        <b>Current input: {this.inputValue}</b>
      </div>
    );
  }
}

class List extends Newstack {
  items = ["Item 1", "Item 2", "Item 3"];

  /**
   * @description
   * This method adds a new item to the list.
   * It is called when the button is clicked.
   */
  addItem() {
    this.items.push(`Item ${this.items.length + 1}`);
  }

  render() {
    return (
      <div>
        <h2>List Component</h2>

        <p>This component displays a list of items.</p>

        <ul>
          {this.items.map((item) => (
            <li>{item}</li>
          ))}
        </ul>

        <button type="button" onclick={() => this.addItem()}>
          Add Item
        </button>
      </div>
    );
  }
}

class SayHello extends Newstack {
  message = "";

  /**
   * @description
   * This method is called when the button is clicked.
   * It appends a message to the existing message.
   */
  onclick = () => {
    console.log("Button clicked!");
    this.message += "Hello, Newstack!\n";
  };

  render() {
    return (
      <div>
        <pre>{this.message}</pre>

        <button type="button" onclick={this.onclick}>
          Say Hello
        </button>
      </div>
    );
  }
}

export class ApplicationExample extends Newstack {
  render() {
    return (
      <main>
        <div route="/">
          <h1>Welcome to Newstack! </h1>
          <p>This is a simple example of a Newstack application.</p>

          <Counter />
          <ChangeString />
          <ManualCounter />
          <InputShow />
          <List />
          <SayHello />

          <a href="/about">About</a>
        </div>

        <div route="/about">
          <h1>About Newstack</h1>

          <p>Newstack is a modern framework for building web applications.</p>

          <a href="/">Home</a>
        </div>
      </main>
    );
  }
}
