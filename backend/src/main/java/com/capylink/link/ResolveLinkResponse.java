package com.capylink.link;

import java.time.Instant;

// Returned by GET /api/links/{slug} so the GitHub Pages frontend can resolve a
// short link and redirect client-side (Pages cannot do server-side 302s).
public record ResolveLinkResponse(String slug, String targetUrl, Instant expiresAt) {}
