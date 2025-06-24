import type { Newstack, NewstackClientContext } from "./core";
import { Renderer } from "./renderer";

/**
 * @description
 * The context object that holds the current client-side state of the application,
 * such as the current path and more.
 */
const context: NewstackClientContext = {
  environment: "client",
} as NewstackClientContext;

/**
 * @description
 * The renderer instance that handles rendering Newstack components to HTML.
 * It manages the component lifecycle, including hydration and updates.
 */
const renderer = new Renderer(context);

/**
 * @description
 * Starts the Newstack application on the client side.
 * This function hydrates the application tree into the provided container,
 * sets up client-side routing, and patches links to handle navigation without full page reloads.
 *
 * @param app The Newstack application instance to start on the client side.
 */
export function startClient(app: Newstack) {
  const root = document.getElementById("app");
  if (!root) return;

  renderRoute(app, root, location.pathname);
}

/**
 * @description
 * Renders a specific route in the Newstack application.
 * This function prepares the application context, renders the HTML for the current route,
 * and hydrates the components. It also patches links to handle client-side navigation.
 *
 * @param app The Newstack application instance to render the route for.
 * @param root The root HTML element where the application is rendered.
 * @param href The URL path to render.
 */
function renderRoute(app: Newstack, root: HTMLElement, href: string) {
  context.path = href;
  renderer.components.forEach((c) => c.destroy?.(context));
  renderer.components.clear();

  app.prepare?.(context);
  const html = app.render?.(context) || {};

  root.innerHTML = renderer.html(html);
  assignElements(root);

  app.hydrate?.(context);

  patchLinks(app, root);

  renderer.components.forEach((component) => {
    component.prepare?.(context);
    component.hydrate?.(context);
  });
}

/**
 * @description
 * Patches links in the application to handle client-side navigation.
 * This function adds click event listeners to all anchor tags (`<a>`) in the document
 * to prevent the default browser behavior and instead use the Newstack application's routing.
 * It also listens for the `popstate` event to handle back/forward navigation.
 *
 * @param app The Newstack application instance to patch links for.
 * @param root The root HTML element where the application is rendered.
 */
function patchLinks(app: Newstack, root: HTMLElement) {
  document.querySelectorAll("a").forEach((link) => {
    link.onclick = (e) => {
      e.preventDefault();
      const href = link.getAttribute("href");
      if (!href) return;

      history.pushState({}, "", href);
      renderRoute(app, root, href);
    };
  });

  window.addEventListener(
    "popstate",
    () => {
      renderRoute(app, root, location.pathname);
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
 * @param root The root HTML element where the application is rendered.
 */
function assignElements(root: HTMLElement) {
  renderer.components.forEach((component) => {
    const { hash } = component.constructor as unknown as { hash: string };
    const element = root.querySelector(`[data-newstack="${hash}"]`);
    if (!element) return;

    element.removeAttribute("data-newstack");

    renderer.componentElements.set(hash, element);
    renderer.updateComponent(component);
  });
}
