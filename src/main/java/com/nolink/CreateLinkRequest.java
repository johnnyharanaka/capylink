package com.nolink;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateLinkRequest(
        @NotBlank
        @Size(max = 2048)
        @Pattern(regexp = "^https?://.+", message = "URL must start with http:// or https://")
        String url
) {}
