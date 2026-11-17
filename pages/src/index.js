// ESA 函数和Pages 入口。
// 兼容两种运行时：
//   1. 边缘函数（V8 Isolate）：export default { fetch(request, context, env) }
//   2. 标准 Node.js 运行时（ESA 云函数 / 其他 Node 主机）：同上签名，env 可省略，走 process.env
import { createConfig } from './config.js';
import { handleRequest } from './app.js';

export default {
  async fetch(request, context, env) {
    const cfg = createConfig(env || {});
    return handleRequest(request, cfg);
  },
};
