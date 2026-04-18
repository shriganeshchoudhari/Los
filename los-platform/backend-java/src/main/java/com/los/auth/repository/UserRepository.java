package com.los.auth.repository;

import com.los.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    @Query("SELECT u FROM User u WHERE u.mobileHash = :mobileHash AND u.isDeleted = false")
    Optional<User> findByMobileHash(@Param("mobileHash") String mobileHash);

    @Query("SELECT u FROM User u WHERE u.mobile = :mobile AND u.isDeleted = false")
    Optional<User> findByMobile(@Param("mobile") String mobile);

    @Query("SELECT u FROM User u WHERE u.email = :email AND u.isDeleted = false")
    Optional<User> findByEmail(@Param("email") String email);

    @Query("SELECT u FROM User u WHERE u.employeeId = :employeeId AND u.isDeleted = false")
    Optional<User> findByEmployeeId(@Param("employeeId") String employeeId);

    @Query("SELECT u FROM User u WHERE u.id = :id AND u.isDeleted = false")
    Optional<User> findById(@Param("id") String id);

    @Query(value = "SELECT COUNT(*) > 0 FROM auth.users WHERE mobile_hash = :mobileHash AND is_deleted = false", nativeQuery = true)
    boolean existsByMobileHash(@Param("mobileHash") String mobileHash);
}
