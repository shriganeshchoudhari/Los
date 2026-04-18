package com.los.common.repository;

import com.los.common.entity.BaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

/**
 * Base repository with common CRUD operations for all entities.
 * Provides standard JpaRepository functionality.
 *
 * @param <T>  The entity type
 * @param <ID> The ID type
 */
@NoRepositoryBean
public interface BaseRepository<T extends BaseEntity> extends JpaRepository<T, String> {
    // Inherits all standard CRUD operations from JpaRepository
}
