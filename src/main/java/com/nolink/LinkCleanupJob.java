package com.nolink;

import io.quarkus.logging.Log;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

// Expired links return 410 Gone for `cleanup-grace-days` after expiration,
// then are deleted (becoming 404). The grace window keeps semantics correct
// for users who follow a link minutes/days after it expires.
@ApplicationScoped
public class LinkCleanupJob {

    @ConfigProperty(name = "nolink.cleanup-grace-days")
    int graceDays;

    @Scheduled(cron = "0 0 3 * * ?", identity = "link-cleanup")
    @Transactional
    void purge() {
        Instant cutoff = Instant.now().minus(graceDays, ChronoUnit.DAYS);
        long deleted = Link.delete("expiresAt < ?1", cutoff);
        if (deleted > 0) {
            Log.infof("Purged %d links that expired before %s", deleted, cutoff);
        }
    }
}
