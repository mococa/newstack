export function h(type, props, ...children) {
  return {
    type,
    props: {
      ...(props || {}),
      children: children.length === 1 ? children[0] : children,
    },
  };
}

export function Fragment({ children }) {
  return children;
}
