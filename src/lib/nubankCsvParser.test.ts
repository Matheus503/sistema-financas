import assert from "node:assert/strict";
import test from "node:test";
import { parseNubankCsv } from "./nubankCsvParser";

test("parses a Nubank CSV with a Brazilian decimal amount", () => {
  const result = parseNubankCsv(
    'date,title,amount\n2026-11-12,QA teste,"1,25"',
  );

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].date, "2026-11-12");
  assert.equal(result.entries[0].amount, 1.25);
});

test("rejects an invalid CSV header", () => {
  assert.throws(
    () => parseNubankCsv("data,descricao,valor\n2026-11-12,QA,1,25"),
    /Formato invalido/,
  );
});

test("rejects impossible calendar dates", () => {
  for (const date of ["2026-99-99", "2026-02-30"]) {
    assert.throws(
      () => parseNubankCsv(`date,title,amount\n${date},QA teste,1.25`),
      /Data invalida na linha 2/,
    );
  }
});

test("rejects an empty amount", () => {
  assert.throws(
    () => parseNubankCsv("date,title,amount\n2026-11-12,QA teste,"),
    /Valor invalido no CSV do Nubank: vazio/,
  );
});

test("rejects a non-numeric amount", () => {
  assert.throws(
    () => parseNubankCsv("date,title,amount\n2026-11-12,QA teste,abc"),
    /Valor invalido no CSV do Nubank: abc/,
  );
});
