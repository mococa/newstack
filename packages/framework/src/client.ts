import { proxifyContext } from "./context";
import type { Newstack, NewstackClientContext } from "./core";
import { Renderer } from "./renderer";

/**
 * @description
 * NewstackClient is a class that initializes and manages the Newstack application on the client side.
 * It handles rendering the application, managing the client-side state, and routing.
 */
export class NewstackClient {
  /**
   * @description
   * The root HTML element where the Newstack application is rendered.
   * It should have an id of "app" in the HTML document.
   */
  root: HTMLElement;

  /**
   * @description
   * The Newstack application instance entrypoint that is being served.
   */
  app: Newstack;

  /**
   * @description
   * The context object that holds the current client-side state of the application,
   * such as the current path and more.
   */
  context: NewstackClientContext;

  /**
   * @description
   * The renderer instance that handles rendering Newstack components to HTML.
   * It manages the component lifecycle, including hydration and updates.
   */
  renderer: Renderer;

  constructor() {
    this.root = document.getElementById("app") as HTMLElement;
    if (!this.root) {
      throw new Error("Root element with id 'app' not found.");
    }

    const ctx: Partial<NewstackClientContext> = {
      environment: "client",
      page: {
        title: document.title,
      } as NewstackClientContext["page"],
      router: {
        url: location.href,
        path: location.pathname,
        base: location.origin,
      } as NewstackClientContext["router"],
      params: {},
    };

    this.context = proxifyContext(ctx, this) as NewstackClientContext;

    this.renderer = new Renderer(this.context);
  }

  /**
   * @description
   * Starts the Newstack application on the client side.
   * This method hydrates the application tree into the root element,
   * sets up client-side routing, and patches links to handle navigation without full page reloads.
   *
   * @param app The Newstack application instance to start on the client side.
   */
  start(app: Newstack) {
    this.app = app;

    this.renderRoute(location.pathname);
  }

  /**
   * @description
   * Renders a specific route in the Newstack application.
   * This function prepares the application context, renders the HTML for the current route,
   * and hydrates the components. It also patches links to handle client-side navigation.
   *
   * @param href The URL path to render.
   */
  renderRoute(href: string) {
    this.context.path = href;
    this.renderer.components.forEach((c) => c.destroy?.(this.context));
    this.renderer.components.clear();

    this.app.prepare?.(this.context);
    const html = this.app.render?.(this.context) || {};

    this.root.innerHTML = this.renderer.html(html);
    this.assignElements();

    this.app.hydrate?.(this.context);

    this.patchLinks();

    this.renderer.components.forEach((component) => {
      component.prepare?.(this.context);
      component.hydrate?.(this.context);
    });
  }

  /**
   * @description
   * Patches links in the application to handle client-side navigation.
   * This function adds click event listeners to all anchor tags (`<a>`) in the document
   * to prevent the default browser behavior and instead use the Newstack application's routing.
   * It also listens for the `popstate` event to handle back/forward navigation.
   */
  private patchLinks() {
    document.querySelectorAll("a").forEach((link) => {
      link.onclick = (e) => {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (!href) return;

        history.pushState({}, "", href);
        this.renderRoute(href);
      };
    });

    window.addEventListener(
      "popstate",
      () => {
        this.renderRoute(location.pathname);
      },
      { once: true },
    );
  }

  /**
   * @description
   * Assigns HTML elements to their corresponding Newstack components.
   * This function finds all components in the renderer, queries the DOM for their associated elements,
   * and updates the component's element reference. It also calls the component's update method.
   *
   */
  private assignElements() {
    this.renderer.components.forEach((component) => {
      const { hash } = component.constructor as unknown as { hash: string };
      const element = this.root.querySelector(`[data-newstack="${hash}"]`);
      if (!element) return;

      element.removeAttribute("data-newstack");

      this.renderer.componentElements.set(hash, element);
      this.renderer.updateComponent(component);
    });
  }
}
