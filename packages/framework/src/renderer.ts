import { Newstack, type NewstackClientContext } from "./core";

type VNode = {
  type: string | Function;
  props?: Record<string, unknown> & {
    route?: string;
    children?: VNode | VNode[];
  };
};

export class Renderer {
  /**
   * @description
   * The context object that holds the current state of the application,
   * such as the current path and other relevant data.
   * This context is used to determine how components should be rendered
   * based on the current application state.
   */
  context: NewstackClientContext;

  /**
   * @description
   * A set of all Newstack components that have been defined in the application.
   * This includes components that have not yet been rendered.
   */
  components: Map<string, { component: Newstack; reinitiate: () => Newstack }>;

  /**
   * @description
   * A set of hashes representing the components that are currently visible in the application.
   * This is used to track which components should be rendered based on the current route.
   */
  visibleHashes: Set<string> = new Set();

  /**
   * @description
   * A map that associates Newstack components with their corresponding HTML elements.
   * This is used to update the DOM when component properties change.
   */
  componentElements: Map<string, Element>;
  lastVNode: any;

  constructor(context: NewstackClientContext = {} as NewstackClientContext) {
    this.context = context;
    this.components = new Map();
    this.componentElements = new Map();
  }

  get hashes(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * @description
   * Finds a Newstack component by its static hash property.
   * This function iterates through the components map and checks if the
   * component's constructor has a matching hash. If found, it returns the component.
   *
   * @param hash The hash of the component to find.
   * @returns The Newstack component if found, otherwise null.
   */
  findComponentByHash(hash: string): Newstack {
    for (const [_, { component: c }] of this.components) {
      const component = c.constructor as typeof Newstack<{ hash: string }>;
      if (!component) continue;

      if (component.hash === hash) return c;
    }

    return null;
  }

  /**
   * @description
   * Renders a Newstack component tree to HTML.
   * This function recursively traverses the component tree, converting each component
   * and its properties into an HTML string. It handles both standard HTML elements
   * and Newstack components, allowing for dynamic rendering based on the current context.
   *
   * @param node The component or element to render.
   * @returns A string representing the rendered HTML.
   */
  html(node: VNode): string {
    if (typeof node === "string" || typeof node === "number")
      return String(node);
    if (node === null || typeof node !== "object") return "";

    const { type, props } = node;

    // Skip rendering if the route does not match
    if (props?.route) {
      const matchAll = props.route === "*";
      const matchPath = matchRoute(props.route, this.context);

      if (!matchAll && !matchPath) {
        // Skip with an HTML comment for context router.path changing
        return "<!---->";
      }
    }

    const isComponent = isComponentNode(node);

    // Rendering Newstack components
    if (isComponent) {
      const { hash } = type as unknown as { hash: string };
      let { component, reinitiate } = this.components.get(hash);
      if (this.context.environment === "client") {
        component = reinitiate();

        if (!this.lastVNode) {
          // First render in the client
          const snapshots = document.querySelector<HTMLScriptElement>(
            "script#__NEWSTACK_STATE__",
          );

          if (snapshots) {
            const states = JSON.parse(snapshots.textContent || "{}");
            this.addSnapshotStateData(component, states);
          }
        }
      }

      this.visibleHashes.add(hash);

      const isRenderable = isRenderableComponent(component);

      if (isRenderable) {
        const vnode = component.render?.(this.context);
        if (this.context.environment === "client") {
          vnode.props["data-newstack"] = hash;
        }

        const node = this.html(vnode);
        return node;
      }
    }

    const children = Array.isArray(props?.children)
      ? props.children.map((c) => this.html(c)).join("")
      : this.html(props?.children);

    const attrs = Object.entries(props || {})
      .filter(([key]) => !["route", "children"].includes(key))
      .filter(([key, val]) => {
        const isFunc = typeof val === "function";

        return !isFunc;
      })
      .map(([key, val]) => ` ${key}="${val}"`)
      .join("");

    return `<${type}${attrs}>${children}</${type}>`;
  }

  /**
   * @description
   * Adds state data from a snapshot to a Newstack component.
   * This function retrieves the state from the provided states object using the component's hash
   * and assigns the state properties to the component instance.
   *
   * @param component The Newstack component to which the state data should be added.
   * @param states An object containing state data indexed by component hashes.
   */
  addSnapshotStateData(
    component: Newstack,
    states: Record<string, { state: unknown }>,
  ) {
    const { hash } = component.constructor as typeof Newstack;
    const { state } = states[hash];

    if (!state) return;

    for (const [key, value] of Object.entries(state)) {
      this.components.get(hash).component[key] = value;
    }
  }

  /**
   * @description
   * Patches an existing route in the DOM with a new virtual node.
   * This function updates the HTML of the container element with the new virtual node,
   * replacing the old content while preserving the structure and attributes of the existing elements.
   *
   * @param newVNode The new virtual node to render.
   * @param container The HTML element where the new virtual node should be rendered.
   */
  patchRoute(newVNode: VNode, container: Element) {
    if (!this.lastVNode) {
      container.innerHTML = this.html(newVNode);
      this.lastVNode = newVNode;
      return;
    }

    const temp = document.createElement("div");
    temp.innerHTML = this.html(newVNode);
    const newEl = temp.firstElementChild;
    const oldEl = container.firstElementChild;

    if (newEl && oldEl) {
      patchElement(oldEl, newEl, newVNode, () => {});
    }

    this.lastVNode = newVNode;
  }

  /**
   * @description
   * Updates a Newstack component in the DOM.
   * This function finds the HTML element associated with the component,
   * renders the component to a new HTML string, and then patches the existing
   * element with the new HTML.
   *
   * @param component The Newstack component to update.
   */
  updateComponent(component: Newstack) {
    if (typeof document === "undefined") return;

    const staticComponent = component.constructor as typeof Newstack;

    const container = this.componentElements.get(staticComponent.hash);
    if (!container) return;

    const vnode = component.render(this.context);
    const html = this.html(vnode);

    const temp = document.createElement("div");
    temp.innerHTML = html;

    const newEl = temp.firstElementChild;
    if (!newEl) return;

    patchElement(container, newEl, vnode, () =>
      this.updateComponent(component),
    );
  }

  /**
   * @description
   * Sets up all components in the application, including the entrypoint component and its children.
   * This function initializes the components, creates proxies for them to ensure reactivity,
   * and recursively processes child components to add them to the renderer's component list.
   *
   * @param entrypoint The main entrypoint component of the application.
   * @param context The context object that holds the current state of the application.
   */
  setupAllComponents(entrypoint: Newstack) {
    /**
     * Sets up the entrypoint component as part of the renderer's components.
     */
    const setupEntrypoint = () => {
      const entrypointHash = (entrypoint.constructor as typeof Newstack).hash;
      const reinitiate = () => {
        const component = proxify(new (entrypoint.constructor as any)(), this);
        this.components.get(entrypointHash).component = component;
        return component;
      };

      this.components.set(entrypointHash, {
        component: proxify(entrypoint, this),
        reinitiate,
      });
    };

    /**
     * Sets up all child components recursively from a given virtual node.
     * This function traverses the virtual node tree, identifies Newstack components,
     * and adds them to the renderer's components map. It also handles the creation
     * of proxies for each component to ensure reactivity.
     *
     * @param vnode The virtual node to start processing from.
     */
    const setupChildrenRecursively = (vnode: VNode) => {
      const loop = (node: VNode) => {
        if (!node) return;
        if (typeof node !== "object") return;

        const { type, props } = node;

        if (isComponentNode(node)) {
          const hash = (type as unknown as { hash: string }).hash;
          const createComponent = () => proxify(new (type as any)(), this);
          const component = createComponent();
          const reinitiate = () => {
            const c = createComponent();
            this.components.get(hash).component = createComponent();
            return c;
          };

          this.components.set(hash, { component, reinitiate });

          if (isRenderableComponent(component)) {
            loop(component.render(this.context));
          }
        }

        if (Array.isArray(props?.children)) {
          for (const child of props.children) {
            loop(child);
          }

          return;
        }

        loop(props.children);
      };

      loop(vnode);
    };

    /**
     * Goes through all the tree and sets up the default visible hashes.
     */
    const setupDefaultVisibleHashes = (vnode: VNode) => {
      const loop = (node: VNode) => {
        if (!node || typeof node !== "object") return;

        const { type, props } = node;

        if (isComponentNode(node)) {
          const hash = (type as unknown as { hash: string }).hash;
          this.visibleHashes.add(hash);
        }

        if (Array.isArray(props?.children)) {
          for (const child of props.children) {
            loop(child);
          }
          return;
        }

        loop(props.children);
      };

      loop(vnode);
    };

    // Adding the entrypoint component to the components list
    setupEntrypoint();
    if (!isRenderableComponent(entrypoint)) return;

    const vnode = entrypoint.render(this.context);

    // Adding entrypoint children components to the components list
    setupChildrenRecursively(vnode);
    setupDefaultVisibleHashes(vnode);
  }
}

/**
 * @description
 * Creates a proxy for a Newstack component that automatically updates the component
 * when its properties are accessed or changed. This proxy intercepts property
 * access and modification, ensuring that the component is re-rendered whenever
 * its state changes. This is useful for maintaining reactivity in the application.
 *
 * @param component The Newstack component to be proxified.
 * @param renderer The renderer instance that will handle updates to the component.
 */
function proxify(component: Newstack, renderer: Renderer): Newstack {
  const proxy = new Proxy(component, {
    get(target, key) {
      // Automatically update the component when a property is accessed
      // renderer.updateComponent(target);

      return Reflect.get(target, key);
    },
    set(target, key, value) {
      target[key] = value;

      // Automatically update the component when a property changes
      // if (renderer.context.environment === "client") {
      renderer.updateComponent(target);
      target.update?.(renderer.context);
      // }

      return true;
    },
  });

  return proxy;
}

/**
 * @description
 * Patches an existing HTML element with a new one.
 * This function updates the attributes of the old element to match the new element,
 * removes any attributes that are no longer present, and recursively updates the children.
 *
 * @param oldEl The existing HTML element to be patched.
 * @param newEl The new HTML element that contains the updated content.
 * @param vnode The virtual node representation of the new element, used for event listeners and other properties.
 * @param update A callback function to call after the patching is complete, typically used to trigger a re-render or update in the application.
 */
function patchElement(
  oldEl: Element,
  newEl: Element,
  vnode?: VNode,
  update: () => void = () => {},
) {
  // Update attributes
  const oldAttrs = oldEl.attributes;
  const newAttrs = newEl.attributes;

  const vnodeChildren = Array.isArray(vnode?.props?.children)
    ? vnode.props.children
    : [vnode?.props?.children];

  // Remove old attributes
  Array.from(oldAttrs).forEach((attr) => {
    if (!newEl.hasAttribute(attr.name)) {
      oldEl.removeAttribute(attr.name);
    }
  });

  // Set new or changed attributes
  Array.from(newAttrs).forEach((attr) => {
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  });

  // Recursively patch children
  const oldChildren = Array.from(oldEl.childNodes);
  const newChildren = Array.from(newEl.childNodes);
  const len = Math.max(oldChildren.length, newChildren.length);

  // Attach event listeners from vnode to newEl
  if (vnode?.props) {
    Object.entries(vnode.props).forEach(([key, val]) => {
      if (key.startsWith("on") && typeof val === "function") {
        oldEl[key] = (e: Event) => {
          val(e);
          if (update) update();
        };
      }
    });
  }

  for (let i = 0; i < len; i++) {
    const oldChild = oldChildren[i];
    const newChild = newChildren[i];
    const vchild = vnodeChildren[i];

    if (!oldChild && newChild) {
      oldEl.appendChild(newChild.cloneNode(true));
      continue;
    }

    if (oldChild && !newChild) {
      oldEl.removeChild(oldChild);
      continue;
    }

    if (oldChild.nodeType !== newChild.nodeType) {
      oldEl.replaceChild(newChild.cloneNode(true), oldChild);
      continue;
    }

    if (
      oldChild.nodeType === Node.TEXT_NODE &&
      newChild.nodeType === Node.TEXT_NODE
    ) {
      if (oldChild.textContent !== newChild.textContent) {
        oldChild.textContent = newChild.textContent;
      }
      continue;
    }

    if (
      oldChild.nodeType === Node.ELEMENT_NODE &&
      newChild.nodeType === Node.ELEMENT_NODE &&
      (oldChild as Element).tagName === (newChild as Element).tagName
    ) {
      patchElement(oldChild as Element, newChild as Element, vchild, update);
    } else {
      oldEl.replaceChild(newChild.cloneNode(true), oldChild);
    }
  }
}

function matchRoute(
  routePattern: string,
  context: NewstackClientContext,
): boolean {
  const routeSegments = routePattern?.split("/").filter(Boolean) ?? [];
  const pathSegments = context.router.path?.split("/").filter(Boolean) ?? [];

  if (routeSegments.length !== pathSegments.length) return false;

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];

    if (routeSegment.startsWith(":")) {
      continue; // param match
    }
    if (routeSegment !== pathSegment) return false;
  }

  routeSegments.forEach((segment, index) => {
    if (!segment.startsWith(":")) return;
    const paramName = segment.slice(1);
    context.params[paramName] = pathSegments[index];
  });

  return true;
}

function isComponentNode(node: VNode): boolean {
  return (
    typeof node.type === "function" && node.type.prototype instanceof Newstack
  );
}

function isRenderableComponent(c: Newstack): boolean {
  return c.render && typeof c.render === "function";
}
