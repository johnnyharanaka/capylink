package com.capylink.link;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class LinkCleanupJobTest {

    @Inject
    LinkCleanupJob job;

    @Test
    void purgesLinksOlderThanGraceWindow() {
        // graceDays defaults to 7 — anything older than 7 days past expiry is purged.
        String oldSlug = "purgeold" + (System.nanoTime() % 100);
        QuarkusTransaction.requiringNew().run(() -> {
            Link link = new Link();
            link.slug = oldSlug;
            link.targetUrl = "https://example.com/old";
            link.createdAt = Instant.now().minus(60, ChronoUnit.DAYS);
            link.expiresAt = Instant.now().minus(30, ChronoUnit.DAYS);
            link.persist();
        });

        assertTrue(QuarkusTransaction.requiringNew()
                .call(() -> Link.findBySlug(oldSlug).isPresent()));

        job.purge();

        assertFalse(QuarkusTransaction.requiringNew()
                .call(() -> Link.findBySlug(oldSlug).isPresent()));
    }

    @Test
    void keepsRecentlyExpiredWithinGraceWindow() {
        // Expired only 1 day ago → still inside the 7-day grace window → must NOT be purged.
        String recentSlug = "purgenew" + (System.nanoTime() % 100);
        QuarkusTransaction.requiringNew().run(() -> {
            Link link = new Link();
            link.slug = recentSlug;
            link.targetUrl = "https://example.com/recent";
            link.createdAt = Instant.now().minus(22, ChronoUnit.DAYS);
            link.expiresAt = Instant.now().minus(1, ChronoUnit.DAYS);
            link.persist();
        });

        job.purge();

        assertTrue(QuarkusTransaction.requiringNew()
                .call(() -> Link.findBySlug(recentSlug).isPresent()));
    }

    @Test
    void keepsLinksThatAreStillValid() {
        String activeSlug = "purgeact" + (System.nanoTime() % 100);
        QuarkusTransaction.requiringNew().run(() -> {
            Link link = new Link();
            link.slug = activeSlug;
            link.targetUrl = "https://example.com/active";
            link.createdAt = Instant.now();
            link.expiresAt = Instant.now().plus(21, ChronoUnit.DAYS);
            link.persist();
        });

        job.purge();

        assertTrue(QuarkusTransaction.requiringNew()
                .call(() -> Link.findBySlug(activeSlug).isPresent()));
    }
}
