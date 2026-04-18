package com.los.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * JPA and Hibernate configuration for the application.
 */
@Configuration
@EnableJpaRepositories(basePackages = "com.los")
@EnableJpaAuditing
@EnableTransactionManagement
public class JpaConfig {
    // Configuration handled through application.yml
}
