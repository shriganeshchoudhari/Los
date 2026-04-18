package com.los.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI/Swagger configuration for API documentation.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("LOS Platform API")
                        .version("1.0.0")
                        .description("Loan Origination System - RESTful API Documentation")
                        .contact(new Contact()
                                .name("LOS Platform Team")
                                .email("support@los-platform.com"))
                        .license(new License()
                                .name("Proprietary License")
                                .url("http://los-platform.local/license")));
    }
}
