package com.nolink;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;

import java.net.URI;

@Path("/")
public class RedirectResource {

    // Strict regex (alphanumeric only) so this route does not swallow paths
    // like /index.html, /q/health, /api/links, or any future static asset.
    @GET
    @Path("/{slug:[A-Za-z0-9]+}")
    public Response resolve(@PathParam("slug") String slug) {
        return Link.findBySlug(slug)
                .map(link -> link.isExpired()
                        ? Response.status(Response.Status.GONE).build()
                        : Response.status(Response.Status.FOUND).location(URI.create(link.targetUrl)).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }
}
