import {
  Newstack,
  type NewstackClientContext,
  type NewstackServerContext,
} from "./core";

type VNode = {
  type: string | Function;
  props?: Record<string, unknown> & {
    route?: string;
    children?: VNode | VNode[];
  };
  children?: VNode[];
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
   * A set of components that have been rendered or are being rendered.
   * This is used to keep track of components for hydration and other purposes.
   */
  components: Map<Newstack, { visible: boolean }>;

  /**
   * @description
   * A map that associates Newstack components with their corresponding HTML elements.
   * This is used to update the DOM when component properties change.
   */
  componentElements: Map<string, Element>;

  constructor(context: NewstackClientContext = {} as NewstackClientContext) {
    this.context = context;
    this.components = new Map();
    this.componentElements = new Map();
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

      if (!matchAll && !matchPath) return "";
    }

    // Rendering Newstack components
    const isComponent =
      type && typeof type === "function" && type.prototype instanceof Newstack;
    if (isComponent) {
      const component = proxify(new (type as any)(), this);
      this.components.set(component, { visible: true });

      const isRenderable = typeof component.render === "function";
      if (isRenderable) {
        const vnode = component.render?.(this.context);
        if (typeof document !== "undefined") {
          vnode.props["data-newstack"] = (
            type as unknown as { hash: string }
          ).hash;
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
      renderer.updateComponent(target);
      target.update?.(renderer.context);

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
  const routeSegments = routePattern.split("/").filter(Boolean);
  const pathSegments = context.router.path.split("/").filter(Boolean);

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
