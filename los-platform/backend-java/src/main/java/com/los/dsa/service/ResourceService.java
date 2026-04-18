package com.los.dsa.service;

import com.los.dsa.dto.ResourceAssignmentDto;
import com.los.dsa.entity.ResourceMapping;
import com.los.dsa.repository.ResourceMappingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class ResourceService {

    private final ResourceMappingRepository resourceMappingRepository;

    public ResourceMapping assignResource(ResourceAssignmentDto dto) {
        log.info("Assigning resource: {} to partner: {}", dto.getUserId(), dto.getPartnerId());

        ResourceMapping mapping = new ResourceMapping();
        mapping.setId(UUID.randomUUID().toString());
        mapping.setPartnerId(dto.getPartnerId());
        mapping.setUserId(dto.getUserId());
        mapping.setUserName(dto.getUserName());
        mapping.setDesignation(dto.getDesignation());
        mapping.setEmail(dto.getEmail());
        mapping.setMobile(dto.getMobile());
        mapping.setRole(dto.getRole());
        mapping.setIsActive(true);
        mapping.setAssignedAt(LocalDateTime.now().toString());

        return resourceMappingRepository.save(mapping);
    }

    public List<ResourceMapping> getResourcesByPartner(String partnerId) {
        log.info("Fetching resources for partner: {}", partnerId);

        return resourceMappingRepository.findActiveResourcesByPartnerId(partnerId);
    }

    public ResourceMapping updateResource(String resourceMappingId, Boolean isActive) {
        log.info("Updating resource: {}", resourceMappingId);

        ResourceMapping mapping = resourceMappingRepository.findById(resourceMappingId)
                .orElseThrow(() -> new IllegalArgumentException("Resource mapping not found"));

        mapping.setIsActive(isActive);
        return resourceMappingRepository.save(mapping);
    }

    public void removeResource(String resourceMappingId) {
        log.info("Removing resource: {}", resourceMappingId);

        resourceMappingRepository.deleteById(resourceMappingId);
    }
}
