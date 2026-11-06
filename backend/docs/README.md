# Ticketing System API documentation

The API contract is maintained in [`openapi.yaml`](./openapi.yaml) using OpenAPI 3.1.

## View the interactive documentation

1. Install dependencies with `npm install`.
2. Start the backend with `npm start`.
3. Open `http://localhost:3000/api-docs`.

The raw machine-readable specification is available at:

- `http://localhost:3000/api-docs.json`
- `backend/docs/openapi.yaml`

Use the **Authorize** button for protected endpoints. Normal API endpoints use an access JWT. The outbound and inbound email webhooks use their separate documented credentials.

## Conventions

- JSON is used for every request and response.
- Dates use ISO 8601 strings.
- MongoDB identifiers are 24-character hexadecimal strings.
- Validation rejects unsupported request-body fields.
- List endpoints default to `page=1` and `limit=20`; the maximum limit is `100`.
- Errors have the shape `{ "error": "Human-readable message" }`.
- Role requirements are shown in each operation description.

Never put production tokens, API keys, passwords, or connection strings into this documentation.
