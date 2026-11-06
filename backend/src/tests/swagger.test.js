import assert from 'node:assert/strict';
import test from 'node:test';
import { openApiDocument } from '../config/swagger.js';

const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

function resolveLocalReference(document, reference) {
  return reference
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, part) => value?.[part], document);
}

function collectLocalReferences(value, references = []) {
  if (!value || typeof value !== 'object') return references;
  if (typeof value.$ref === 'string' && value.$ref.startsWith('#/')) references.push(value.$ref);
  for (const child of Object.values(value)) collectLocalReferences(child, references);
  return references;
}

test('OpenAPI document is complete, uniquely addressable, and has valid local references', () => {
  assert.equal(openApiDocument.openapi, '3.1.0');
  assert.equal(openApiDocument.info.title, 'Ticketing System API');

  const operationIds = Object.values(openApiDocument.paths).flatMap((pathItem) =>
    Object.entries(pathItem)
      .filter(([method]) => httpMethods.has(method))
      .map(([, operation]) => operation.operationId),
  );

  assert.equal(operationIds.length, 61);
  assert.equal(new Set(operationIds).size, operationIds.length);
  assert.ok(operationIds.every(Boolean));

  for (const reference of collectLocalReferences(openApiDocument)) {
    assert.notEqual(resolveLocalReference(openApiDocument, reference), undefined, `Broken $ref: ${reference}`);
  }
});
