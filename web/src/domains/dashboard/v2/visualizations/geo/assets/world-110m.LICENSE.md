# Natural Earth 1:110m country boundaries

- Source: `ne_110m_admin_0_countries.geojson` from `nvkelso/natural-earth-vector`
- Source URL: https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_110m_admin_0_countries.geojson
- Retrieved: 2026-07-18
- Source revision: `ca96624a56bd078437bca8184e78163e5039ad19`
- Source SHA-256: `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`
- Generated SHA-256: `d3443323d16abf2af5487a1087c5193d10798fb6b28c54ab1c29839e19f4d0eb`
- License: Public domain. Natural Earth states that all versions of its raster and vector map data are in the public domain: https://www.naturalearthdata.com/about/terms-of-use/

The checked-in JSON is a deterministic equirectangular projection into the canonical `0 0 1000 500` SVG view box. It contains one stable SVG path per available ISO 3166-1 alpha-2 region and makes no network request at runtime.

Regenerate it from an explicitly downloaded source file:

```sh
bun scripts/build-dashboard-world-outline.ts \
  /path/to/ne_110m_admin_0_countries.geojson \
  web/src/domains/dashboard/v2/visualizations/geo/assets/world-110m.paths.json \
  web/src/domains/dashboard/v2/visualizations/geo/assets/world-110m.region-ids.ts
```
