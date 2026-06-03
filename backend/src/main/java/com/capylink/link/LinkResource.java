package com.capylink.link;

import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/api/links")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class LinkResource {

    @Inject
    LinkService service;

    @ConfigProperty(name = "capylink.base-url")
    String baseUrl;

    @POST
    public Response create(@Valid CreateLinkRequest request) {
        Link link = service.create(request.url());
        CreateLinkResponse body = new CreateLinkResponse(
                link.slug,
                baseUrl + "/" + link.slug,
                link.expiresAt
        );
        return Response.status(Response.Status.CREATED).entity(body).build();
    }

    // Resolve a slug to its target as JSON. The Pages-hosted SPA calls this and
    // redirects in the browser, since GitHub Pages can't serve a 302 itself.
    // Same TTL semantics as the server-side redirect: 410 expired, 404 unknown.
    @GET
    @Path("/{slug:[A-Za-z0-9]+}")
    public Response resolve(@PathParam("slug") String slug) {
        return Link.findBySlug(slug)
                .map(link -> link.isExpired()
                        ? Response.status(Response.Status.GONE).build()
                        : Response.ok(new ResolveLinkResponse(link.slug, link.targetUrl, link.expiresAt)).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }
}
