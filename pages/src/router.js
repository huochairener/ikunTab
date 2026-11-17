// 极简路由：/api/groups/:gid 这种模式，字面量优先级高于动态段（注册顺序决定）。

function compile(pattern) {
  const keys = [];
  const normalized = String(pattern).replace(/\/+$/, '') || '/';
  const segments = normalized.split('/').map((seg) => {
    if (seg.startsWith(':')) {
      keys.push(seg.slice(1));
      return '([^/]+)';
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  const source = segments.join('/');
  return { regex: new RegExp(`^${source}/?$`), keys };
}

/**
 * @param {Array<[string, string, Function]>} definitions [method, pattern, handler]
 */
export function createRouter(definitions) {
  const routes = definitions.map(([method, pattern, handler]) => ({
    method: method.toUpperCase(),
    handler,
    ...compile(pattern),
  }));

  return (method, pathname) => {
    const verb = method.toUpperCase();
    for (const route of routes) {
      if (route.method !== verb) continue;
      const matched = route.regex.exec(pathname);
      if (!matched) continue;
      const params = {};
      route.keys.forEach((key, index) => {
        params[key] = matched[index + 1];
      });
      return { handler: route.handler, params };
    }
    return null;
  };
}
