package com.nolink;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.matchesPattern;

@QuarkusTest
class LinkResourceTest {

    @Test
    void rejectsInvalidUrl() {
        given().contentType("application/json").body("{\"url\":\"notaurl\"}")
                .when().post("/api/links")
                .then().statusCode(400);
    }

    @Test
    void shortensAndRedirects() {
        String slug = given().contentType("application/json").body("{\"url\":\"https://example.com/foo\"}")
                .when().post("/api/links")
                .then().statusCode(201)
                .body("slug", matchesPattern("[A-Za-z0-9]{7}"))
                .extract().path("slug");

        given().redirects().follow(false)
                .when().get("/" + slug)
                .then().statusCode(302)
                .header("Location", "https://example.com/foo");
    }

    @Test
    void unknownSlugReturns404() {
        given().redirects().follow(false)
                .when().get("/zzzzzzz")
                .then().statusCode(404);
    }
}
