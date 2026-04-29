package com.nolink;

import java.time.Instant;

public record CreateLinkResponse(String slug, String shortUrl, Instant expiresAt) {}
