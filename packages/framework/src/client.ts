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

    const description = document.querySelector("meta[name='description']");

    const page = {
      title: document.title,
      description: description?.getAttribute("content") || "",
      locale: document.documentElement.lang,
    } as NewstackClientContext["page"];

    const router = {
      url: location.href,
      path: location.pathname,
      base: location.origin,
    } as NewstackClientContext["router"];

    const ctx: Partial<NewstackClientContext> = {
      environment: "client",
      page,
      router,
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
    this.renderer.setupAllComponents(this.app);

    this.app.prepare?.(this.context);
    this.renderRoute(location.pathname);
    this.app.hydrate?.(this.context);
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
    this.destroyComponents();

    const html = this.app.render?.(this.context) || {};
    if (!html) {
      console.error("No HTML returned from the application render method.");
      return;
    }

    this.renderer.patchRoute(html, this.root);

    this.assignElements();

    this.patchLinks();

    this.startComponents();
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
    const components = this.routeComponents();
    for (const component of components) {
      const { hash } = component.constructor as unknown as { hash: string };
      const element = this.root.querySelector(`[data-newstack="${hash}"]`);
      if (!element) continue;

      element.removeAttribute("data-newstack");
      this.renderer.componentElements.set(hash, element);
      this.renderer.updateComponent(component);
    }
  }

  /**
   * @description
   * Destroys all visible components in the renderer and set them as invisible.
   * This function iterates through the components map and calls the destroy method
   * on each component that is currently visible. It then marks the component as not visible.
   * This is used when changing routes.
   */
  private destroyComponents() {
    const components = this.routeComponents();

    for (const component of components) {
      component.destroy?.(this.context);
    }

    this.renderer.visibleHashes.clear();
  }

  /**
   * @description
   * Starts all visible components in the renderer that are visible.
   * This function prepares and hydrates all components that are currently visible in the route.
   * It is called after rendering a new route to ensure that all components are ready for interaction.
   */
  private startComponents() {
    const components = this.routeComponents();

    for (const component of components) {
      component.prepare?.(this.context);
      component.hydrate?.(this.context);
    }
  }

  /**
   * @description
   * Returns an array of all components that are currently visible in the route.
   * This function iterates through the renderer's allComponents map and collects
   * components that are marked as visible. It is used to manage the lifecycle of components
   * when rendering a new route.
   *
   * @returns {Newstack[]} An array of visible Newstack components.
   */
  private routeComponents() {
    const components: Newstack[] = [];

    this.renderer.components.forEach(({ component }, hash) => {
      if (hash === (this.app.constructor as typeof Newstack).hash) {
        // Skip the entrypoint component
        return;
      }

      if (!this.renderer.visibleHashes.has(hash)) return;

      components.push(component);
    });

    return components;
  }
}
