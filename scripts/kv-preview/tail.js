
export default {
  fetch(request, env, ctx) {
    const shimEnv = Object.assign({}, env, { ASSETS: { fetch: (req) => serveKV(req instanceof Request ? req : new Request(req), env) } });
    return __site.fetch(request, shimEnv, ctx);
  },
};
