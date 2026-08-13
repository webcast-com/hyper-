# API Versioning Policy

Creator Connect now exposes versioned API aliases.

## Current version

```text
v1
```

## Versioned base path

```text
/api/v1
```

Examples:

```text
/api/v1/health
/api/v1/posts?limit=6
/api/v1/auth/login
/api/v1/messages
/api/v1/marketplace
/api/v1/admin/reports
```

These map to the current implementation under `/api/*`.

## Compatibility

Unversioned routes still work:

```text
/api/posts
/api/auth/login
```

But external clients and future mobile apps should use:

```text
/api/v1/*
```

## Headers

Every API response includes:

```text
API-Version: v1
X-API-Version: v1
X-API-Versioned-Path: true|false
```

Unversioned API responses also include:

```text
Link: </api/v1>; rel="latest-version"
Deprecation: false
```

`Deprecation: false` means the unversioned routes are not currently removed, but clients should migrate to versioned paths.

## Future deprecation workflow

When a future version is introduced, for example `/api/v2`, the process should be:

1. Keep `/api/v1` stable.
2. Add `/api/v2` aliases or routes.
3. Update OpenAPI docs.
4. Add `Deprecation: true` to endpoints planned for removal.
5. Add a `Sunset` header with a date.
6. Keep migration notes in this document.

Example future headers:

```text
Deprecation: true
Sunset: Wed, 31 Dec 2027 23:59:59 GMT
Link: </api/v2>; rel="successor-version"
```

## OpenAPI

Current OpenAPI spec:

```text
/openapi.json
/api/openapi
```

Human-readable docs:

```text
/api-docs
```
