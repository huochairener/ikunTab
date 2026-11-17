// /api/favicon /api/weather /api/hotlist：第三方数据代理（无需登录，与 Python 主站一致）
import { json, ok } from '../http.js';

const WEATHER_DESC = [
  [0, '晴'],
  [3, '多云'],
  [48, '雾'],
  [57, '毛毛雨'],
  [67, '雨'],
  [77, '雪'],
  [82, '阵雨'],
  [86, '阵雪'],
  [95, '雷阵雨'],
  [999, '未知'],
];

/** 简易 TTL 缓存（每个实例独立，够用） */
function createCache(ttlMinutes, maxSize = 256) {
  const store = new Map();
  const ttl = Math.max(1, ttlMinutes) * 60 * 1000;
  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return null;
      if (hit.expires <= Date.now()) {
        store.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key, value) {
      if (store.size >= maxSize) {
        const oldest = store.keys().next();
        if (!oldest.done) store.delete(oldest.value);
      }
      store.set(key, { value, expires: Date.now() + ttl });
    },
  };
}

function extractDomain(url) {
  if (!url) return null;
  const withScheme = url.includes('://') ? url : `http://${url}`;
  try {
    const host = new URL(withScheme).hostname;
    if (!host) return null;
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function wmoDesc(code) {
  for (const [limit, text] of WEATHER_DESC) {
    if (code <= limit) return text;
  }
  return '未知';
}

function safeTimeout(ms) {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    return undefined;
  }
}

export function createProxyRoutes(cfg) {
  const weatherCache = createCache(cfg.weatherCacheMinutes);
  const hotlistCache = createCache(cfg.hotlistCacheMinutes, 64);

  async function favicon(ctx) {
    const url = ctx.url.searchParams.get('url') || '';
    const domain = extractDomain(url);
    // 与 Python 主站一致：data 是 { url } 对象（前端 api.favicon 读取 r.data.url）
    return json(ok({ url: domain ? `https://icon.horse/icon/${domain}` : null }));
  }

  async function weather(ctx) {
    const city = ctx.url.searchParams.get('city');
    const latParam = ctx.url.searchParams.get('lat');
    const lonParam = ctx.url.searchParams.get('lon');
    let lat = latParam ? Number(latParam) : null;
    let lon = lonParam ? Number(lonParam) : null;
    if (Number.isNaN(lat)) lat = null;
    if (Number.isNaN(lon)) lon = null;

    const cacheKey = `${city || ''}::${lat}::${lon}`;
    const cached = weatherCache.get(cacheKey);
    if (cached !== null) return json(ok(cached));

    try {
      let resolvedCity = null;
      if ((lat === null || lon === null) && city) {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`,
          { signal: safeTimeout(8000) },
        );
        const geo = await geoRes.json();
        const hit = (geo?.results || [])[0];
        if (hit) {
          lat = hit.latitude;
          lon = hit.longitude;
          resolvedCity = hit.name;
        }
      }
      if (lat === null || lon === null) return json(ok(null));

      const forecastRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
          '&timezone=auto&forecast_days=1',
        { signal: safeTimeout(8000) },
      );
      const forecast = await forecastRes.json();
      const current = forecast?.current || {};
      const code = Number(current.weather_code || 0);
      const payload = JSON.stringify({
        city: resolvedCity,
        temperature: current.temperature_2m,
        description: wmoDesc(code),
        humidity: current.relative_humidity_2m,
        wind: current.wind_speed_10m,
      });
      weatherCache.set(cacheKey, payload);
      return json(ok(payload));
    } catch {
      return json(ok(null));
    }
  }

  async function hotlist(ctx) {
    const source = ctx.url.searchParams.get('source') || 'weibo';
    const cached = hotlistCache.get(source);
    if (cached !== null) return json(ok(cached));
    if (!cfg.hotlistApiUrl) return json(ok('[]'));

    try {
      const res = await fetch(`${cfg.hotlistApiUrl}/${encodeURIComponent(source)}`, { signal: safeTimeout(8000) });
      const text = await res.text();
      if (!text || text.trim().startsWith('<')) return json(ok('[]'));
      const node = JSON.parse(text);
      const items = (node?.data || []).map((item, index) => ({
        title: item?.title ?? '',
        hot: String(item?.hot ?? ''),
        url: item?.url || item?.mobileUrl || '',
        index: index + 1,
      }));
      const payload = JSON.stringify(items);
      if (payload !== '[]') hotlistCache.set(source, payload);
      return json(ok(payload));
    } catch {
      return json(ok('[]'));
    }
  }

  return [
    ['GET', '/api/favicon', favicon],
    ['GET', '/api/weather', weather],
    ['GET', '/api/hotlist', hotlist],
  ];
}
