package com.capylink.link;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.Optional;

@Entity
@Table(name = "links")
public class Link extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, unique = true, length = 16)
    public String slug;

    @Column(name = "target_url", nullable = false, length = 2048)
    public String targetUrl;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    public Instant expiresAt;

    public boolean isExpired() {
        return expiresAt.isBefore(Instant.now());
    }

    public static Optional<Link> findBySlug(String slug) {
        return find("slug", slug).firstResultOptional();
    }
}
