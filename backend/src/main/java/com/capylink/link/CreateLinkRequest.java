package com.capylink.link;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateLinkRequest(
        @NotBlank
        @Size(max = 2048)
        // Scheme is required (the frontend prefixes https:// for bare hosts).
        @Pattern(regexp = "^https?://.+", message = "URL must start with http:// or https://")
        // Structural check: a dotted host with no whitespace anywhere, plus an
        // optional path/query. Rejects junk like "https://foo bar".
        @Pattern(regexp = "^https?://[^\\s/]+\\.[^\\s/]+\\S*$", message = "URL is not valid")
        String url
) {}
