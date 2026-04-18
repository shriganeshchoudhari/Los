package com.los.common.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import com.los.common.enums.UserRole;

/**
 * Annotation to specify allowed roles for an endpoint.
 * Applied to controller methods to restrict access based on user roles.
 */
@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface Roles {
    UserRole[] value();
}
