package com.nolink;

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

    @ConfigProperty(name = "nolink.base-url")
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
}
