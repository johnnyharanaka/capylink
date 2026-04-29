package com.nolink;

import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@ApplicationScoped
public class LinkService {

    private static final char[] ALPHABET =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".toCharArray();
    private static final int MAX_SLUG_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    @ConfigProperty(name = "nolink.ttl-days")
    int ttlDays;

    @ConfigProperty(name = "nolink.slug-length")
    int slugLength;

    @Transactional
    public Link create(String targetUrl) {
        Instant now = Instant.now();
        for (int attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
            String slug = generateSlug();
            if (Link.count("slug", slug) == 0) {
                Link link = new Link();
                link.slug = slug;
                link.targetUrl = targetUrl;
                link.createdAt = now;
                link.expiresAt = now.plus(ttlDays, ChronoUnit.DAYS);
                link.persist();
                return link;
            }
        }
        Log.errorf("Slug collision %d times in a row — bump nolink.slug-length", MAX_SLUG_ATTEMPTS);
        throw new WebApplicationException("Could not allocate slug", 503);
    }

    private String generateSlug() {
        char[] buf = new char[slugLength];
        for (int i = 0; i < slugLength; i++) {
            buf[i] = ALPHABET[RANDOM.nextInt(ALPHABET.length)];
        }
        return new String(buf);
    }
}
