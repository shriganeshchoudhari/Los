package com.los.dsa.service;

import com.los.dsa.dto.*;
import com.los.dsa.entity.*;
import com.los.dsa.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class DsaAuthService {

    private final DsaPartnerRepository dsaPartnerRepository;

    public DsaPartner authenticate(DsaLoginDto dto) {
        log.info("Authenticating DSA partner: {}", dto.getPartnerCode());

        DsaPartner partner = dsaPartnerRepository.findByPartnerCode(dto.getPartnerCode())
                .orElseThrow(() -> new IllegalArgumentException("Partner not found"));

        if (!partner.getIsActive() || !partner.getStatus().equals(PartnerStatus.ACTIVE)) {
            throw new IllegalArgumentException("Partner account is inactive");
        }

        return partner;
    }

    public DsaPartner getPartner(String partnerId) {
        log.info("Fetching partner: {}", partnerId);

        return dsaPartnerRepository.findById(partnerId)
                .orElseThrow(() -> new IllegalArgumentException("Partner not found"));
    }

    public List<DsaPartner> getAllActivePartners() {
        log.info("Fetching all active partners");

        return dsaPartnerRepository.findByStatus(PartnerStatus.ACTIVE);
    }
}
