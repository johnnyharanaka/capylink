package com.capylink.link;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.Test;

import jakarta.inject.Inject;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.startsWith;

@QuarkusTest
class LinkResourceTest {

    @ConfigProperty(name = "capylink.base-url")
    String baseUrl;

    @ConfigProperty(name = "capylink.slug-length")
    int slugLength;

    @Test
    void rejectsInvalidUrl() {
        given().contentType("application/json").body("{\"url\":\"notaurl\"}")
                .when().post("/api/links")
                .then().statusCode(400);
    }

    @Test
    void rejectsMissingUrl() {
        given().contentType("application/json").body("{}")
                .when().post("/api/links")
                .then().statusCode(400);
    }

    @Test
    void rejectsBlankUrl() {
        given().contentType("application/json").body("{\"url\":\"\"}")
                .when().post("/api/links")
                .then().statusCode(400);
    }

    @Test
    void rejectsTooLongUrl() {
        String longUrl = "https://example.com/" + "x".repeat(2100);
        given().contentType("application/json").body("{\"url\":\"" + longUrl + "\"}")
                .when().post("/api/links")
                .then().statusCode(400);
    }

    @Test
    void rejectsNonHttpScheme() {
        given().contentType("application/json").body("{\"url\":\"ftp://example.com/foo\"}")
                .when().post("/api/links")
                .then().statusCode(400);
    }

    @Test
    void rejectsUrlWithWhitespace() {
        given().contentType("application/json").body("{\"url\":\"https://foo bar.com\"}")
                .when().post("/api/links")
                .then().statusCode(400);
    }

    @Test
    void rejectsHostWithoutDot() {
        given().contentType("application/json").body("{\"url\":\"https://localhost\"}")
                .when().post("/api/links")
                .then().statusCode(400);
    }

    @Test
    void rejectsUserinfoPhishingTrick() {
        given().contentType("application/json").body("{\"url\":\"https://legit.com@evil.com\"}")
                .when().post("/api/links")
                .then().statusCode(400);
    }

    @Test
    void allowsAtSignInPath() {
        // '@' is legitimate in a path (e.g. Mastodon handles) — only the
        // authority must be free of it.
        given().contentType("application/json").body("{\"url\":\"https://example.com/@handle\"}")
                .when().post("/api/links")
                .then().statusCode(201);
    }

    @Test
    void shortensAndReturnsExpectedShape() {
        given().contentType("application/json").body("{\"url\":\"https://example.com/foo\"}")
                .when().post("/api/links")
                .then().statusCode(201)
                .body("slug", matchesPattern("[A-Za-z0-9]{" + slugLength + "}"))
                .body("shortUrl", startsWith(baseUrl + "/"))
                .body("expiresAt", notNullValue());
    }

    @Test
    void shortUrlEndsWithSlug() {
        String slug = given().contentType("application/json").body("{\"url\":\"https://example.com/bar\"}")
                .when().post("/api/links")
                .then().statusCode(201)
                .extract().path("slug");

        given().contentType("application/json").body("{\"url\":\"https://example.com/bar\"}")
                .when().post("/api/links")
                .then().body("shortUrl", matchesPattern(".+/[A-Za-z0-9]{" + slugLength + "}"));

        // Each call gets a distinct slug.
        String otherSlug = given().contentType("application/json").body("{\"url\":\"https://example.com/bar\"}")
                .when().post("/api/links")
                .then().statusCode(201)
                .extract().path("slug");
        assert !slug.equals(otherSlug) : "Subsequent calls should mint distinct slugs";
    }

    @Test
    void shortensAndRedirects() {
        String slug = given().contentType("application/json").body("{\"url\":\"https://example.com/foo\"}")
                .when().post("/api/links")
                .then().statusCode(201)
                .body("slug", matchesPattern("[A-Za-z0-9]{" + slugLength + "}"))
                .extract().path("slug");

        given().redirects().follow(false)
                .when().get("/" + slug)
                .then().statusCode(302)
                .header("Location", "https://example.com/foo");
    }

    @Test
    void resolveReturnsTargetUrlAsJson() {
        String slug = given().contentType("application/json").body("{\"url\":\"https://example.com/resolve\"}")
                .when().post("/api/links")
                .then().statusCode(201)
                .extract().path("slug");

        given().when().get("/api/links/" + slug)
                .then().statusCode(200)
                .body("slug", equalTo(slug))
                .body("targetUrl", equalTo("https://example.com/resolve"))
                .body("expiresAt", notNullValue());
    }

    @Test
    void resolveUnknownSlugReturns404() {
        given().when().get("/api/links/zzzzzzz")
                .then().statusCode(404);
    }

    @Test
    void resolveExpiredSlugReturns410() {
        String slug = "rexpired" + (System.nanoTime() % 100);
        QuarkusTransaction.requiringNew().run(() -> {
            Link link = new Link();
            link.slug = slug;
            link.targetUrl = "https://example.com/old";
            link.createdAt = Instant.now().minus(30, ChronoUnit.DAYS);
            link.expiresAt = Instant.now().minus(1, ChronoUnit.DAYS);
            link.persist();
        });

        given().when().get("/api/links/" + slug)
                .then().statusCode(410);
    }

    @Test
    void unknownSlugReturns404() {
        given().redirects().follow(false)
                .when().get("/zzzzzzz")
                .then().statusCode(404);
    }

    @Test
    void slugWithSpecialCharsIsNotMatched() {
        // The regex on RedirectResource forbids non-alphanumeric chars,
        // so JAX-RS does not match the route at all → 404 (not 405/redirect).
        given().redirects().follow(false)
                .when().get("/abc-123")
                .then().statusCode(404);
    }

    @Test
    void expiredSlugReturns410() {
        String slug = "expired" + (System.nanoTime() % 100);
        QuarkusTransaction.requiringNew().run(() -> {
            Link link = new Link();
            link.slug = slug;
            link.targetUrl = "https://example.com/old";
            link.createdAt = Instant.now().minus(30, ChronoUnit.DAYS);
            link.expiresAt = Instant.now().minus(1, ChronoUnit.DAYS);
            link.persist();
        });

        given().redirects().follow(false)
                .when().get("/" + slug)
                .then().statusCode(410);
    }

    @Test
    void linkEntityIsExpiredHelper() {
        Link past = new Link();
        past.expiresAt = Instant.now().minus(1, ChronoUnit.MINUTES);
        assert past.isExpired();

        Link future = new Link();
        future.expiresAt = Instant.now().plus(1, ChronoUnit.MINUTES);
        assert !future.isExpired();
    }

    @Test
    void findBySlugReturnsEmptyWhenAbsent() {
        // Sanity check on the Panache helper. Use a slug we know cannot exist
        // (lowercase 'q' is in the alphabet; we just assume nothing else inserted this exact value).
        var result = Link.findBySlug("definitely-not-a-real-slug");
        assert result.isEmpty();
    }

    // The injected Inject is here so QuarkusTest runs without complaining about empty scope.
    @Inject
    LinkService unused;
}
