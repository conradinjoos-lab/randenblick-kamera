/* Randenblick Kamera – reine Rechenfunktionen (ohne Bildschirm), auch in Node testbar. */
(function (g) {
  'use strict';

  // Missweisung Neunkirch SH, Ende 2026: etwa 3.4° Ost. Geografisch Nord = magnetisch Nord + Missweisung.
  const DEKLINATION = 3.4;
  const D = Math.PI / 180;
  const norm360 = a => ((a % 360) + 360) % 360;

  // Rotationsmatrix Gerät -> Erde (x Ost, y Nord, z oben), zeilenweise als Array mit 9 Werten.
  function matFromQuat(q) {
    const [x, y, z, w] = q;
    return [
      1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)
    ];
  }

  // W3C DeviceOrientation: R = Rz(alpha) · Rx(beta) · Ry(gamma)
  function matFromEuler(alpha, beta, gamma) {
    const ca = Math.cos(alpha * D), sa = Math.sin(alpha * D);
    const cb = Math.cos(beta * D), sb = Math.sin(beta * D);
    const cg = Math.cos(gamma * D), sg = Math.sin(gamma * D);
    return [
      ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg,
      sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg,
      -cb * sg, sb, cb * cg
    ];
  }

  const mul = (R, v) => [
    R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
    R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
    R[6] * v[0] + R[7] * v[1] + R[8] * v[2]
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalize = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };

  // Bildschirmdrehung (screen.orientation.angle) -> Bild-oben und Bild-rechts in Gerätekoordinaten.
  const SCREEN = {
    0: { up: [0, 1, 0], right: [1, 0, 0] },
    90: { up: [1, 0, 0], right: [0, -1, 0] },
    180: { up: [0, -1, 0], right: [-1, 0, 0] },
    270: { up: [-1, 0, 0], right: [0, 1, 0] }
  };
  const screenAxes = angle => SCREEN[norm360(Math.round(angle / 90) * 90)] || SCREEN[0];

  // Blickrichtung der Rückkamera (f), Bild-oben (u), Bild-rechts (r) in Erdkoordinaten.
  function cameraVectors(R, angle) {
    const s = screenAxes(angle);
    return { f: mul(R, [0, 0, -1]), u: mul(R, s.up), r: mul(R, s.right) };
  }

  // Mittelt mehrere Lagen (Vektormittel, dann rechtwinklig gemacht).
  function averagePose(list) {
    let f = [0, 0, 0], u = [0, 0, 0];
    for (const p of list) for (let i = 0; i < 3; i++) { f[i] += p.f[i]; u[i] += p.u[i]; }
    f = normalize(f);
    const d = dot(u, f);
    u = normalize([u[0] - d * f[0], u[1] - d * f[1], u[2] - d * f[2]]);
    return { f, u, r: cross(f, u) };
  }

  // Kompassrichtung, Neigung (+ = nach oben) und Kippung (+ = rechte Bildseite tiefer), in Grad.
  // Bei sehr steilem Blick (mehr als 75° nach oben/unten) gilt die Richtung von Bild-oben.
  function angles(p) {
    const steil = Math.hypot(p.f[0], p.f[1]) < 0.26;
    const h = steil ? (p.f[2] < 0 ? p.u : [-p.u[0], -p.u[1]]) : p.f;
    const headingMag = norm360(Math.atan2(h[0], h[1]) / D);
    const pitch = Math.asin(Math.max(-1, Math.min(1, p.f[2]))) / D;
    const roll = Math.atan2(-p.r[2], p.u[2]) / D;
    return { headingMag, headingTrue: norm360(headingMag + DEKLINATION), pitch, roll, steil };
  }

  // Kreisförmige Streuung einer Liste von Richtungen in Grad.
  function headingSpread(list) {
    if (list.length < 2) return null;
    let x = 0, y = 0;
    for (const h of list) { x += Math.cos(h * D); y += Math.sin(h * D); }
    const R = Math.min(1, Math.hypot(x, y) / list.length);
    return Math.sqrt(-2 * Math.log(Math.max(R, 1e-9))) / D;
  }

  const KARDINAL = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  const cardinal = h => KARDINAL[Math.round(norm360(h) / 45) % 8];

  // WGS84 -> LV95 (swisstopo-Näherung, etwa 1 m genau). h = ellipsoidische Höhe -> Gebrauchshöhe LN02.
  function lv95(lat, lon, h) {
    const p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
    const E = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l * l * l;
    const N = 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p * p * p;
    const H = h == null ? null : h - 49.55 + 2.73 * l + 6.94 * p;
    return { E, N, H };
  }

  function distM(a, b) {
    const x = (b.lon - a.lon) * D * Math.cos(a.lat * D) * 6371000;
    const y = (b.lat - a.lat) * D * 6371000;
    return Math.hypot(x, y);
  }

  // Bester Standort: gewichtetes Mittel der Messungen der letzten 10 s, die zum neusten Punkt passen.
  function positionEstimate(fixes, now) {
    if (!fixes.length) return null;
    const latest = fixes[fixes.length - 1];
    let use = fixes.filter(f => now - f.t <= 10000 && distM(f, latest) <= Math.max(3, 1.5 * latest.acc));
    if (!use.length) use = [latest];
    let sw = 0, la = 0, lo = 0, aw = 0, al = 0;
    for (const f of use) {
      const w = 1 / Math.max(f.acc, 0.5) ** 2;
      sw += w; la += w * f.lat; lo += w * f.lon;
      if (f.alt != null) { const wa = 1 / Math.max(f.altAcc || 10, 0.5) ** 2; aw += wa; al += wa * f.alt; }
    }
    return {
      lat: la / sw, lon: lo / sw, alt: aw ? al / aw : null,
      acc: Math.min(...use.map(f => f.acc)),
      altAcc: use.some(f => f.altAcc != null) ? Math.min(...use.filter(f => f.altAcc != null).map(f => f.altAcc)) : null,
      n: use.length, alter: Math.max(0, (now - latest.t) / 1000), t: latest.t
    };
  }

  // Canvas-Transformation: Quelle (W x H) um rot Grad im Uhrzeigersinn drehen, Ausschnitt ab (ox, oy), skalieren.
  function rotTransform(rot, W, H, ox, oy, sx, sy) {
    switch (norm360(rot)) {
      case 90: return [0, sy, -sx, 0, sx * (H - ox), -sy * oy];
      case 180: return [-sx, 0, 0, -sy, sx * (W - ox), sy * (H - oy)];
      case 270: return [0, -sy, sx, 0, -sx * ox, sy * (W - oy)];
      default: return [sx, 0, 0, sy, -sx * ox, -sy * oy];
    }
  }

  // ---------- EXIF ----------
  const asciiOnly = s => String(s)
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/[^\x20-\x7e]/g, '?');
  const enc = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
  const ascii = s => enc(asciiOnly(s) + '\0');
  function u16(...v) { const a = new Uint8Array(2 * v.length), d = new DataView(a.buffer); v.forEach((x, i) => d.setUint16(2 * i, x, true)); return a; }
  function u32(...v) { const a = new Uint8Array(4 * v.length), d = new DataView(a.buffer); v.forEach((x, i) => d.setUint32(4 * i, x >>> 0, true)); return a; }
  function rat(...pairs) {
    const a = new Uint8Array(8 * pairs.length), d = new DataView(a.buffer);
    pairs.forEach(([n, dn], i) => { d.setUint32(8 * i, Math.round(n) >>> 0, true); d.setUint32(8 * i + 4, dn >>> 0, true); });
    return a;
  }
  const BYTE = 1, ASCII = 2, SHORT = 3, LONG = 4, RATIONAL = 5, UNDEF = 7;
  const E = (tag, type, data, count) => ({ tag, type, data, count: count != null ? count : (type === SHORT ? data.length / 2 : type === LONG ? data.length / 4 : type === RATIONAL ? data.length / 8 : data.length) });

  function dms(v) {
    v = Math.abs(v);
    let d = Math.floor(v), m = Math.floor((v - d) * 60), s = Math.round(((v - d) * 60 - m) * 60 * 10000);
    if (s >= 600000) { s -= 600000; m += 1; }
    if (m >= 60) { m -= 60; d += 1; }
    return rat([d, 1], [m, 1], [s, 10000]);
  }

  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const ifdSize = es => 2 + 12 * es.length + 4 + es.reduce((s, e) => s + (e.data.length > 4 ? e.data.length + (e.data.length & 1) : 0), 0);

  function writeIFD(buf, off, es) {
    es = es.slice().sort((a, b) => a.tag - b.tag);
    const dv = new DataView(buf.buffer);
    dv.setUint16(off, es.length, true);
    let data = off + 2 + 12 * es.length + 4;
    es.forEach((e, i) => {
      const p = off + 2 + 12 * i;
      dv.setUint16(p, e.tag, true); dv.setUint16(p + 2, e.type, true); dv.setUint32(p + 4, e.count, true);
      if (e.data.length <= 4) buf.set(e.data, p + 8);
      else { dv.setUint32(p + 8, data, true); buf.set(e.data, data); data += e.data.length + (e.data.length & 1); }
    });
    dv.setUint32(off + 2 + 12 * es.length, 0, true);
  }

  // m: { local: Date, offset: '+01:00', software, description, width, height, comment, gps: {lat, lon, alt, acc, t}, dir }
  function buildTiff(m) {
    const L = m.local;
    const stamp = `${L.getFullYear()}:${pad(L.getMonth() + 1)}:${pad(L.getDate())} ${pad(L.getHours())}:${pad(L.getMinutes())}:${pad(L.getSeconds())}`;
    const ifd0 = [
      E(0x0112, SHORT, u16(1)),
      E(0x0131, ASCII, ascii(m.software || 'Randenblick Kamera')),
      E(0x0132, ASCII, ascii(stamp)),
      E(0x8769, LONG, u32(0))
    ];
    if (m.description) ifd0.push(E(0x010E, ASCII, ascii(m.description)));
    const comment = enc('ASCII\0\0\0' + asciiOnly(m.comment || ''));
    const exif = [
      E(0x9000, UNDEF, enc('0232')),
      E(0x9003, ASCII, ascii(stamp)),
      E(0x9011, ASCII, ascii(m.offset || '+00:00')),
      E(0x9286, UNDEF, comment),
      E(0xA002, LONG, u32(m.width)),
      E(0xA003, LONG, u32(m.height))
    ];
    let gps = null;
    if (m.gps) {
      const G = m.gps, T = new Date(G.t);
      gps = [
        E(0x0000, BYTE, new Uint8Array([2, 3, 0, 0])),
        E(0x0001, ASCII, ascii(G.lat >= 0 ? 'N' : 'S')),
        E(0x0002, RATIONAL, dms(G.lat)),
        E(0x0003, ASCII, ascii(G.lon >= 0 ? 'E' : 'W')),
        E(0x0004, RATIONAL, dms(G.lon)),
        E(0x0007, RATIONAL, rat([T.getUTCHours(), 1], [T.getUTCMinutes(), 1], [T.getUTCSeconds() * 1000 + T.getUTCMilliseconds(), 1000])),
        E(0x0012, ASCII, ascii('WGS-84')),
        E(0x001D, ASCII, ascii(`${T.getUTCFullYear()}:${pad(T.getUTCMonth() + 1)}:${pad(T.getUTCDate())}`)),
        E(0x001F, RATIONAL, rat([G.acc * 100, 100]))
      ];
      if (G.alt != null) gps.push(E(0x0005, BYTE, new Uint8Array([G.alt < 0 ? 1 : 0])), E(0x0006, RATIONAL, rat([Math.abs(G.alt) * 100, 100])));
      if (m.dir != null) gps.push(E(0x0010, ASCII, ascii('T')), E(0x0011, RATIONAL, rat([norm360(m.dir) * 100, 100])));
      ifd0.push(E(0x8825, LONG, u32(0)));
    }
    const s0 = ifdSize(ifd0), s1 = ifdSize(exif), s2 = gps ? ifdSize(gps) : 0;
    const exifOff = 8 + s0, gpsOff = exifOff + s1;
    ifd0.find(e => e.tag === 0x8769).data = u32(exifOff);
    if (gps) ifd0.find(e => e.tag === 0x8825).data = u32(gpsOff);
    const buf = new Uint8Array(8 + s0 + s1 + s2);
    buf.set([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]);
    writeIFD(buf, 8, ifd0);
    writeIFD(buf, exifOff, exif);
    if (gps) writeIFD(buf, gpsOff, gps);
    return buf;
  }

  // Setzt den EXIF-Block direkt hinter den JPEG-Anfang (alte APP0/APP1-Blöcke fallen weg).
  function insertExif(jpeg, tiff) {
    if (jpeg[0] !== 0xFF || jpeg[1] !== 0xD8) throw new Error('Kein JPEG');
    let p = 2;
    while (jpeg[p] === 0xFF && (jpeg[p + 1] === 0xE0 || jpeg[p + 1] === 0xE1)) p += 2 + ((jpeg[p + 2] << 8) | jpeg[p + 3]);
    const len = 2 + 6 + tiff.length;
    if (len > 65535) throw new Error('EXIF zu gross');
    const out = new Uint8Array(2 + 4 + 6 + tiff.length + (jpeg.length - p));
    out.set([0xFF, 0xD8, 0xFF, 0xE1, len >> 8, len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0]);
    out.set(tiff, 12);
    out.set(jpeg.subarray(p), 12 + tiff.length);
    return out;
  }

  // ---------- CSV ----------
  const CSV_SPALTEN = ['datei', 'zeit', 'lat', 'lon', 'hoehe_ell_m', 'gps_genau_m', 'hoehe_genau_m', 'gps_messungen', 'gps_alter_s',
    'lv95_e', 'lv95_n', 'hoehe_ln02_m', 'richtung_geo_grad', 'richtung_mag_grad', 'neigung_grad', 'kippung_grad', 'richtung_streuung_grad',
    'blick_x', 'blick_y', 'blick_z', 'oben_x', 'oben_y', 'oben_z', 'quelle', 'breite_px', 'hoehe_px', 'notiz'];
  function csv(rows) {
    const q = v => v == null ? '' : (/[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
    return '﻿' + [CSV_SPALTEN.join(';')].concat(rows.map(r => CSV_SPALTEN.map(k => q(r[k])).join(';'))).join('\r\n') + '\r\n';
  }

  const RB = { DEKLINATION, norm360, matFromQuat, matFromEuler, mul, cameraVectors, averagePose, angles, headingSpread, cardinal,
    lv95, distM, positionEstimate, rotTransform, buildTiff, insertExif, csv, CSV_SPALTEN, pad };
  if (typeof module !== 'undefined' && module.exports) module.exports = RB; else g.RB = RB;
})(typeof window !== 'undefined' ? window : globalThis);
