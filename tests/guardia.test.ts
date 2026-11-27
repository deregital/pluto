/**
 * Lo delicado de la guardia que no necesita base ni red: quién entra a Pluto,
 * por qué dominio se le pregunta a cada instalación y cómo se arman las barras.
 *
 *   pnpm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getAllowedEmailEntries,
  isAllowedEmail,
} from "@/server/security/allowed-users";
import { rankCandidateDomains } from "@/server/services/guardia/instances";
import { entryBars, formatAgo } from "@/server/services/guardia/tonight";

describe("isAllowedEmail", () => {
  const entries = getAllowedEmailEntries(" Ana@Ejemplo.com , @deregital.com ,");

  it("acepta los mails y dominios de la lista, sin importar mayúsculas", () => {
    assert.equal(isAllowedEmail("ana@ejemplo.com", entries), true);
    assert.equal(isAllowedEmail("ANA@EJEMPLO.COM", entries), true);
    assert.equal(isAllowedEmail("quien@deregital.com", entries), true);
  });

  it("rechaza todo lo demás, incluidos los dominios parecidos", () => {
    assert.equal(isAllowedEmail("beto@ejemplo.com", entries), false);
    assert.equal(isAllowedEmail("x@notderegital.com", entries), false);
    assert.equal(isAllowedEmail("x@deregital.com.ar", entries), false);
    assert.equal(isAllowedEmail(null, entries), false);
    assert.equal(isAllowedEmail("sin-arroba", entries), false);
  });

  it("sin lista no entra nadie", () => {
    assert.deepEqual(getAllowedEmailEntries(undefined), []);
    assert.equal(isAllowedEmail("ana@ejemplo.com", []), false);
  });
});

describe("rankCandidateDomains", () => {
  it("prueba primero el dominio raíz y descarta el panel y los comodines", () => {
    assert.deepEqual(
      rankCandidateDomains([
        "admin.ejemplo.com",
        "*.ejemplo.com",
        "ejemplo-tickets.vercel.app",
        "fiesta.ejemplo.com",
        "ejemplo.com",
      ]),
      [
        "https://ejemplo.com",
        "https://fiesta.ejemplo.com",
        "https://ejemplo-tickets.vercel.app",
      ],
    );
  });

  it("prueba a lo sumo tres dominios", () => {
    assert.equal(
      rankCandidateDomains(["a.x.com", "b.x.com", "c.x.com", "d.x.com"]).length,
      3,
    );
  });
});

describe("entryBars", () => {
  const start = new Date("2026-11-27T01:00:00.000Z");
  const end = new Date("2026-11-27T07:00:00.000Z");
  const minute = (offset: number) =>
    new Date(start.getTime() + offset * 60_000).toISOString();

  it("agrupa los ingresos en tramos desde el primero, como mucho 36 barras", () => {
    const now = new Date(start.getTime() + 60 * 60_000);
    const { bars, bucketMinutes } = entryBars(
      [
        { minute: minute(-10), entries: 2 },
        { minute: minute(3), entries: 4 },
        { minute: minute(4), entries: 1 },
        { minute: minute(55), entries: 3 },
      ],
      start,
      end,
      now,
    );
    assert.equal(bucketMinutes, 5);
    assert.equal(bars.length, 14);
    assert.equal(
      bars.reduce((total, bar) => total + bar.entries, 0),
      10,
    );
    assert.equal(bars[0].entries, 2);
    assert.equal(bars[2].entries, 5);
  });

  it("con la noche larga, agranda los tramos", () => {
    const now = new Date(end.getTime() + 2 * 3_600_000);
    const { bars, bucketMinutes } = entryBars([], start, end, now);
    assert.ok(bars.length <= 36);
    assert.equal(bucketMinutes, 15);
  });
});

describe("formatAgo", () => {
  const now = new Date("2026-11-27T03:00:00.000Z");
  it("dice cuánto hace en minutos u horas", () => {
    assert.equal(formatAgo(null, now), "nunca");
    assert.equal(formatAgo(new Date(now.getTime() - 20_000), now), "recién");
    assert.equal(
      formatAgo(new Date(now.getTime() - 7 * 60_000), now),
      "hace 7 min",
    );
    assert.equal(
      formatAgo(new Date(now.getTime() - 125 * 60_000), now),
      "hace 2 h 5 min",
    );
  });
});
