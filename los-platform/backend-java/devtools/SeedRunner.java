package com.los.devtools;

import com.los.auth.entity.OtpSession;
import com.los.auth.entity.RefreshToken;
import com.los.auth.entity.User;
import com.los.auth.repository.OtpSessionRepository;
import com.los.auth.repository.RefreshTokenRepository;
import com.los.auth.repository.RolePermissionRepository;
import com.los.auth.repository.UserRepository;
import com.los.decision.entity.Decision;
import com.los.decision.entity.InterestRateConfig;
import com.los.decision.entity.MlModelConfig;
import com.los.decision.entity.RuleDefinition;
import com.los.decision.entity.RuleResultEntity;
import com.los.decision.repository.DecisionRepository;
import com.los.decision.repository.InterestRateConfigRepository;
import com.los.decision.repository.MlModelConfigRepository;
import com.los.decision.repository.RuleDefinitionRepository;
import com.los.decision.repository.RuleResultRepository;
import com.los.document.entity.Document;
import com.los.document.repository.DocumentRepository;
import com.los.dsa.entity.DsaPartner;
import com.los.dsa.entity.DsaUser;
import com.los.dsa.repository.DsaPartnerRepository;
import com.los.dsa.repository.DsaUserRepository;
import com.los.integration.entity.BureauReport;
import com.los.integration.entity.Disbursement;
import com.los.integration.entity.NachMandate;
import com.los.integration.repository.BureauReportRepository;
import com.los.integration.repository.DisbursementRepository;
import com.los.integration.repository.NachMandateRepository;
import com.los.kyc.entity.AadhaarKycResult;
import com.los.kyc.entity.ConsentRecord;
import com.los.kyc.entity.KycRecord;
import com.los.kyc.entity.PanVerificationResult;
import com.los.kyc.repository.AadhaarKycResultRepository;
import com.los.kyc.repository.ConsentRecordRepository;
import com.los.kyc.repository.KycRecordRepository;
import com.los.kyc.repository.PanVerificationResultRepository;
import com.los.loan.entity.ApplicationStageHistory;
import com.los.loan.entity.LoanAgreement;
import com.los.loan.entity.LoanAgreementSignature;
import com.los.loan.entity.LoanApplication;
import com.los.loan.entity.PddChecklist;
import com.los.loan.entity.PddChecklistItem;
import com.los.loan.repository.ApplicationStageHistoryRepository;
import com.los.loan.repository.LoanAgreementRepository;
import com.los.loan.repository.LoanAgreementSignatureRepository;
import com.los.loan.repository.LoanApplicationRepository;
import com.los.loan.repository.PddChecklistItemRepository;
import com.los.loan.repository.PddChecklistRepository;
import com.los.notification.entity.Notification;
import com.los.notification.entity.NotificationTemplate;
import com.los.notification.repository.NotificationRepository;
import com.los.notification.repository.NotificationTemplateRepository;
import com.los.shared.entity.AuditLog;
import com.los.shared.repository.AuditLogRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "los.seed.enabled", havingValue = "true", matchIfMissing = false)
public class SeedRunner {

    private final UserRepository userRepository;
    private final OtpSessionRepository otpSessionRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final KycRecordRepository kycRecordRepository;
    private final AadhaarKycResultRepository aadhaarKycResultRepository;
    private final PanVerificationResultRepository panVerificationResultRepository;
    private final ConsentRecordRepository consentRecordRepository;
    private final LoanApplicationRepository loanApplicationRepository;
    private final LoanAgreementRepository loanAgreementRepository;
    private final LoanAgreementSignatureRepository loanAgreementSignatureRepository;
    private final PddChecklistRepository pddChecklistRepository;
    private final PddChecklistItemRepository pddChecklistItemRepository;
    private final ApplicationStageHistoryRepository stageHistoryRepository;
    private final DecisionRepository decisionRepository;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final RuleResultRepository ruleResultRepository;
    private final InterestRateConfigRepository interestRateConfigRepository;
    private final MlModelConfigRepository mlModelConfigRepository;
    private final BureauReportRepository bureauReportRepository;
    private final DisbursementRepository disbursementRepository;
    private final NachMandateRepository nachMandateRepository;
    private final NotificationTemplateRepository notificationTemplateRepository;
    private final NotificationRepository notificationRepository;
    private final DsaPartnerRepository dsaPartnerRepository;
    private final DsaUserRepository dsaUserRepository;
    private final DocumentRepository documentRepository;
    private final AuditLogRepository auditLogRepository;

    private final Random random = new Random(42);

    @PostConstruct
    @Transactional
    public void seed() {
        if (userRepository.count() > 0) {
            log.info("Database already seeded, skipping...");
            return;
        }

        log.info("Starting database seed...");

        seedDsaPartners();
        seedUsers();
        seedKycRecords();
        seedLoanApplications();
        seedDecisions();
        seedBureauReports();
        seedDisbursements();
        seedNachMandates();
        seedNotificationTemplates();
        seedDocuments();
        seedAuditLogs();

        log.info("Database seed complete!");
    }

    private void seedDsaPartners() {
        List<DsaPartner> partners = new ArrayList<>();

        DsaPartner p1 = new DsaPartner();
        p1.setId(UUID.randomUUID());
        p1.setPartnerCode("DSA001");
        p1.setPartnerName("Rajesh Kumar");
        p1.setPartnerType("INDIVIDUAL");
        p1.setContactPerson("Rajesh Kumar");
        p1.setMobile("9876543001");
        p1.setEmail("rajesh.kumar@dsapartners.in");
        p1.setAddress("Flat 302, Tower A, Pacific Heights, Sector 62, Noida");
        p1.setCity("Noida");
        p1.setState("Uttar Pradesh");
        p1.setPincode("201301");
        p1.setPan("ABCPK1234C");
        p1.setStatus("ACTIVE");
        p1.setCommissionStructure("""
            {"personal_loan":{"slab_1":{"min_amount":100000,"max_amount":500000,"rate":1.5},"slab_2":{"min_amount":500001,"max_amount":1000000,"rate":1.8},"slab_3":{"min_amount":1000001,"rate":2.0}}}
            """);
        partners.add(p1);

        DsaPartner p2 = new DsaPartner();
        p2.setId(UUID.randomUUID());
        p2.setPartnerCode("DSA002");
        p2.setPartnerName("FinanceHub India Pvt Ltd");
        p2.setPartnerType("CORPORATE");
        p2.setContactPerson("Priya Sharma");
        p2.setMobile("9876543002");
        p2.setEmail("priya.sharma@financehub.in");
        p2.setAddress("B-901, Trade Centre, Bandra Kurla Complex, Mumbai");
        p2.setCity("Mumbai");
        p2.setState("Maharashtra");
        p2.setPincode("400051");
        p2.setPan("AABCF1234D");
        p2.setStatus("ACTIVE");
        p2.setCommissionStructure("""
            {"personal_loan":{"slab_1":{"min_amount":100000,"max_amount":500000,"rate":1.4},"slab_2":{"min_amount":500001,"max_amount":1000000,"rate":1.6},"slab_3":{"min_amount":1000001,"rate":1.8}}}
            """);
        partners.add(p2);

        DsaPartner p3 = new DsaPartner();
        p3.setId(UUID.randomUUID());
        p3.setPartnerCode("DSA003");
        p3.setPartnerName("Amit Verma");
        p3.setPartnerType("INDIVIDUAL");
        p3.setContactPerson("Amit Verma");
        p3.setMobile("9876543003");
        p3.setEmail("amit.verma@dsa.in");
        p3.setAddress("401, Green Park Apartments, MG Road, Pune");
        p3.setCity("Pune");
        p3.setState("Maharashtra");
        p3.setPincode("411001");
        p3.setPan("ABCPV5678E");
        p3.setStatus("ACTIVE");
        p3.setCommissionStructure("""
            {"personal_loan":{"slab_1":{"min_amount":100000,"max_amount":500000,"rate":1.5}}}
            """);
        partners.add(p3);

        dsaPartnerRepository.saveAll(partners);

        DsaUser u1 = new DsaUser();
        u1.setId(UUID.randomUUID());
        u1.setPartner(p1);
        u1.setFullName("Rajesh Kumar");
        u1.setMobile("9876543001");
        u1.setEmail("rajesh.kumar@dsapartners.in");
        u1.setEmployeeId("DSA001-001");
        u1.setStatus("ACTIVE");

        DsaUser u2 = new DsaUser();
        u2.setId(UUID.randomUUID());
        u2.setPartner(p2);
        u2.setFullName("Priya Sharma");
        u2.setMobile("9876543002");
        u2.setEmail("priya.sharma@financehub.in");
        u2.setEmployeeId("DSA002-001");
        u2.setStatus("ACTIVE");

        DsaUser u3 = new DsaUser();
        u3.setId(UUID.randomUUID());
        u3.setPartner(p3);
        u3.setFullName("Amit Verma");
        u3.setMobile("9876543003");
        u3.setEmail("amit.verma@dsa.in");
        u3.setEmployeeId("DSA003-001");
        u3.setStatus("ACTIVE");

        dsaUserRepository.saveAll(Arrays.asList(u1, u2, u3));

        log.info("Seeded {} DSA partners", partners.size());
    }

    private void seedUsers() {
        List<User> users = new ArrayList<>();

        String[] roles = {"LOAN_OFFICER", "BRANCH_MANAGER", "CREDIT_ANALYST", "ZONAL_CREDIT_HEAD", "CREDIT_HEAD", "COMPLIANCE_OFFICER"};
        String[] branches = {"BR001", "BR002", "BR003", "BR004", "BR005"};

        for (int i = 0; i < 30; i++) {
            User u = new User();
            u.setId(UUID.randomUUID());
            u.setEmployeeId(String.format("EMP%05d", i + 1));
            u.setFullName(generateName(i));
            u.setEmail("user" + (i + 1) + "@los.bank.com");
            u.setMobile("9876543" + String.format("%04d", i + 10));
            u.setMobileHash(hashMobile(u.getMobile()));
            u.setRole(roles[i % roles.length]);
            u.setStatus("ACTIVE");
            u.setBranchCode(branches[i % branches.length]);
            u.setPanNumberEncrypted(encryptPan("ABCPN" + String.format("%04d", i + 1) + "G"));
            users.add(u);
        }

        User admin = new User();
        admin.setId(UUID.randomUUID());
        admin.setEmployeeId("ADMIN001");
        admin.setFullName("System Administrator");
        admin.setEmail("admin@los.bank.com");
        admin.setMobile("9876543000");
        admin.setMobileHash(hashMobile("9876543000"));
        admin.setRole("CREDIT_HEAD");
        admin.setStatus("ACTIVE");
        admin.setBranchCode("BR001");
        admin.setPanNumberEncrypted(encryptPan("ABCPN0001G"));
        users.add(admin);

        userRepository.saveAll(users);
        log.info("Seeded {} users", users.size());
    }

    private void seedKycRecords() {
        List<User> users = userRepository.findAll();
        List<KycRecord> kycRecords = new ArrayList<>();

        for (User user : users.subList(0, 25)) {
            KycRecord kyc = new KycRecord();
            kyc.setId(UUID.randomUUID());
            kyc.setApplicationId("LOS" + String.format("%010d", users.indexOf(user) + 1));
            kyc.setUserId(user.getId());
            kyc.setStatus("VERIFIED");
            kyc.setOverallRiskScore((short) (random.nextInt(30) + 10));
            kycRecords.add(kyc);
        }

        kycRecordRepository.saveAll(kycRecords);

        for (KycRecord kyc : kycRecords) {
            AadhaarKycResult aadhaar = new AadhaarKycResult();
            aadhaar.setId(UUID.randomUUID());
            aadhaar.setKycId(kyc.getId());
            aadhaar.setTxnId("TXN" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            aadhaar.setUidaiRefId("UID" + random.nextInt(999999999));
            aadhaar.setAadhaarNumberHash(hashAadhaar("XXXXXX" + random.nextInt(9999)));
            aadhaar.setName(userRepository.findById(kyc.getUser().getId()).map(User::getFullName).orElse("Test User"));
            aadhaar.setDob(LocalDate.of(1985 + random.nextInt(20), random.nextInt(12) + 1, random.nextInt(28) + 1));
            aadhaar.setGender(random.nextBoolean() ? 'M' : 'F');
            aadhaar.setAddressJson("""
                {"address":"%d, %s, %s, %s - %s","state":"%s","pincode":"%d"}
                """.formatted(
                    random.nextInt(999) + 1,
                    generateStreet(),
                    generateLocality(),
                    userRepository.findById(kyc.getUser().getId()).isPresent() ? "Mumbai" : "Delhi",
                    String.format("%06d", random.nextInt(999999)),
                    userRepository.findById(kyc.getUser().getId()).isPresent() ? "Maharashtra" : "Delhi"
            ));
            aadhaar.setSignatureValid(true);
            aadhaar.setUidaiResponseCode("Y");
            aadhaar.setAuthCode("AUTH" + random.nextInt(999999));
            aadhaarKycResultRepository.save(aadhaar);

            PanVerificationResult pan = new PanVerificationResult();
            pan.setId(UUID.randomUUID());
            pan.setKycId(kyc.getId());
            pan.setPanNumberMasked("XXXXX" + random.nextInt(9999) + "X");
            pan.setPanNumberEncrypted(encryptPan("ABCPN" + String.format("%04d", random.nextInt(9999)) + "G"));
            pan.setNameMatchScore((short) (random.nextInt(20) + 80));
            pan.setNameOnPan(userRepository.findById(kyc.getUser().getId()).map(User::getFullName).orElse("Test User"));
            pan.setDobMatch(true);
            pan.setPanStatus("VALID");
            pan.setLinkedAadhaar(random.nextBoolean());
            pan.setAadhaarSeedingStatus("LINKED");
            pan.setNsdlTransactionId("NSDL" + random.nextInt(999999999));
            panVerificationResultRepository.save(pan);
        }

        for (User user : users.subList(0, 20)) {
            ConsentRecord consent = new ConsentRecord();
            consent.setId(UUID.randomUUID());
            consent.setUserId(user.getId());
            consent.setApplicationId("LOS" + String.format("%010d", users.indexOf(user) + 1));
            consent.setConsentType("BUREAU_CONSENT");
            consent.setConsentText("I consent to LOS Bank fetching my credit information from credit bureaus.");
            consent.setConsentVersion("v1.0");
            consent.setGrantedAt(LocalDateTime.now().minusDays(random.nextInt(30)));
            consentRecordRepository.save(consent);
        }

        log.info("Seeded KYC records for {} users", kycRecords.size());
    }

    private void seedLoanApplications() {
        List<User> users = userRepository.findAll();
        List<LoanApplication> applications = new ArrayList<>();

        String[] statuses = {"DRAFT", "SUBMITTED", "KYC_PENDING", "KYC_VERIFIED", "UNDER_REVIEW", "DOCUMENT_PENDING", "DOCUMENT_VERIFIED", "SANCTIONED", "AGREEMENT_PENDING", "AGREEMENT_SIGNED", "PDD_PENDING", "PDD_VERIFIED", "APPROVED", "DISBURSED", "REJECTED", "CANCELLED"};
        String[] loanTypes = {"PERSONAL_LOAN", "HOME_LOAN", "CAR_LOAN", "EDUCATION_LOAN", "BUSINESS_LOAN"};
        String[] segments = {"SALARIED", "SELF_EMPLOYED", "PENSIONER", "STUDENT"};
        String[] channels = {"BRANCH", "DIGITAL", "DSA", "REFERRAL", "MOBILE_APP"};
        String[] genders = {"M", "F", "O"};

        for (int i = 0; i < 60; i++) {
            User user = users.get(i % users.size());
            String status = statuses[random.nextInt(statuses.length)];
            String loanType = loanTypes[random.nextInt(loanTypes.length)];

            LoanApplication app = new LoanApplication();
            app.setId(UUID.randomUUID());
            app.setApplicationNumber("LOS" + String.format("%010d", i + 1));
            app.setStatus(status);
            app.setLoanType(loanType);
            app.setCustomerSegment(segments[random.nextInt(segments.length)]);
            app.setChannelCode(channels[random.nextInt(channels.length)]);
            app.setBranchCode("BR" + String.format("%03d", random.nextInt(5) + 1));
            app.setApplicantFullName(user.getFullName());
            app.setApplicantDob(LocalDate.of(1980 + random.nextInt(25), random.nextInt(12) + 1, random.nextInt(28) + 1));
            app.setApplicantMobile(user.getMobile());
            app.setApplicantMobileHash(user.getMobileHash());
            app.setApplicantPanHash(hashPan("PAN" + String.format("%04d", i)));
            app.setApplicantPanEncrypted(user.getPanNumberEncrypted());
            app.setApplicantGender(genders[random.nextInt(genders.length)]);
            app.setApplicantPincode(String.format("%06d", random.nextInt(999999)));
            app.setApplicantState(randomState());
            app.setUserId(user.getId());

            BigDecimal reqAmount = BigDecimal.valueOf(100000 + random.nextInt(9900000));
            app.setRequestedAmount(reqAmount);
            app.setSanctionedAmount(status.equals("REJECTED") || status.equals("DRAFT") || status.equals("SUBMITTED") ? null : reqAmount.multiply(BigDecimal.valueOf(0.8 + random.nextDouble() * 0.2)));
            app.setSanctionedTenureMonths(status.equals("REJECTED") || status.equals("DRAFT") || status.equals("SUBMITTED") ? null : 12 + random.nextInt(85));
            app.setSanctionedRoiBps(status.equals("REJECTED") || status.equals("DRAFT") || status.equals("SUBMITTED") ? null : 1200 + random.nextInt(600));

            app.setEmploymentDetails("""
                {"type":"%s","employer_name":"%s","designation":"%s","department":"%s","months_employed":%d,"income":%d}
                """.formatted(
                    segments[random.nextInt(segments.length)],
                    generateCompany(),
                    generateDesignation(),
                    "Operations",
                    6 + random.nextInt(240),
                    15000 + random.nextInt(985000)
            ));

            app.setLoanRequirement("""
                {"purpose":"%s","tenure_months":%d,"amount":%d,"processing_fee_pref":true}
                """.formatted(
                    generatePurpose(loanType),
                    12 + random.nextInt(84),
                    reqAmount.intValue()
            ));

            if (random.nextBoolean()) {
                app.setDsaCode("DSA00" + (random.nextInt(3) + 1));
                app.setDsaName(random.nextBoolean() ? "Rajesh Kumar" : "FinanceHub India Pvt Ltd");
            }

            app.setAssignedOfficerId(users.get(random.nextInt(Math.min(users.size(), 10))).getId());

            if (status.equals("REJECTED")) {
                app.setRejectionReasonCode(randomRejectionCode());
                app.setRejectionRemarks("Application rejected as per policy guidelines.");
            }

            app.setSubmittedAt(status.equals("DRAFT") ? null : LocalDateTime.now().minusDays(random.nextInt(60)));
            app.setSanctionedAt(List.of("SANCTIONED", "AGREEMENT_PENDING", "AGREEMENT_SIGNED", "PDD_PENDING", "PDD_VERIFIED", "APPROVED", "DISBURSED").contains(status) ? LocalDateTime.now().minusDays(random.nextInt(30)) : null);
            app.setDisbursedAt(status.equals("DISBURSED") ? LocalDateTime.now().minusDays(random.nextInt(20)) : null);

            applications.add(app);
        }

        loanApplicationRepository.saveAll(applications);

        for (LoanApplication app : applications) {
            ApplicationStageHistory stage = new ApplicationStageHistory();
            stage.setId(UUID.randomUUID());
            stage.setApplicationId(app.getId());
            stage.setFromStatus(null);
            stage.setToStatus("DRAFT");
            stage.setActionBy(app.getUser().getId());
            stage.setActionByRole(app.getUser().getRole());
            stage.setRemarks("Application created");
            stageHistoryRepository.save(stage);

            if (!app.getStatus().equals("DRAFT")) {
                ApplicationStageHistory stage2 = new ApplicationStageHistory();
                stage2.setId(UUID.randomUUID());
                stage2.setApplicationId(app.getId());
                stage2.setFromStatus("DRAFT");
                stage2.setToStatus("SUBMITTED");
                stage2.setActionBy(app.getUser().getId());
                stage2.setActionByRole(app.getUser().getRole());
                stage2.setRemarks("Application submitted for processing");
                stageHistoryRepository.save(stage2);
            }
        }

        List<LoanApplication> sanctionedApps = applications.stream()
            .filter(a -> List.of("SANCTIONED", "AGREEMENT_PENDING", "AGREEMENT_SIGNED", "PDD_PENDING", "PDD_VERIFIED", "APPROVED", "DISBURSED").contains(a.getStatus()))
            .toList();

        for (LoanApplication app : sanctionedApps) {
            LoanAgreement agreement = new LoanAgreement();
            agreement.setId(UUID.randomUUID());
            agreement.setApplicationId(app.getId());
            agreement.setAgreementNumber("AGR" + app.getApplicationNumber().substring(3));
            agreement.setDocumentKey("agreements/" + app.getApplicationNumber() + "/agreement.pdf");
            agreement.setLoanAccountNumber("LOSB" + String.format("%012d", Math.abs(app.getId().hashCode() % 1000000000000L)));
            agreement.setSanctionedAmount(app.getSanctionedAmount());
            agreement.setSanctionedAmountWords(toWords(app.getSanctionedAmount().intValue()));
            agreement.setRateOfInterest(app.getSanctionedRoiBps().intValue() / 100.0);
            agreement.setRateOfInterestBps(app.getSanctionedRoiBps());
            agreement.setTenureMonths(app.getSanctionedTenureMonths());
            BigDecimal emi = NumberUtils.calculateEmi(app.getSanctionedAmount(), app.getSanctionedRoiBps() / 100.0 / 12, app.getSanctionedTenureMonths());
            agreement.setEmiAmount(emi);
            agreement.setMoratoriumPeriodMonths(0);
            agreement.setProcessingFee(app.getSanctionedAmount().multiply(BigDecimal.valueOf(0.01)));
            agreement.setFirstEmiDate(LocalDate.now().plusDays(30));
            agreement.setLastEmiDate(LocalDate.now().plusMonths(app.getSanctionedTenureMonths()));
            agreement.setBranchName("LOS Bank - Main Branch");
            agreement.setBranchAddress("LOS Tower, Plot 123, Financial District, Mumbai - 400001");
            agreement.setDisbursementAccount("50100" + String.format("%07d", Math.abs(app.getId().hashCode() % 10000000)));
            agreement.setDisbursementIfsc("LOSB0000001");
            agreement.setDisbursementBank("LOS Bank");
            agreement.setDefaultInterestRate(24.0);
            agreement.setBounceCharge(BigDecimal.valueOf(500));
            agreement.setForeclosurePenaltyPercent(BigDecimal.valueOf(3));
            agreement.setForeclosureNoticePeriodDays(30);
            agreement.setJurisdiction("Mumbai, Maharashtra");
            agreement.setStatus("DRAFT");
            agreement.setCreatedBy(app.getUser().getId());
            loanAgreementRepository.save(agreement);

            LoanAgreementSignature sig = new LoanAgreementSignature();
            sig.setId(UUID.randomUUID());
            sig.setAgreement(agreement);
            sig.setSignerType("BORROWER");
            sig.setSignerName(app.getApplicantFullName());
            sig.setSignerMobile(app.getApplicantMobile());
            sig.setSignerRole("BORROWER");
            sig.setSignatureStatus("PENDING");
            loanAgreementSignatureRepository.save(sig);
        }

        List<LoanApplication> pddApps = applications.stream()
            .filter(a -> List.of("PDD_PENDING", "PDD_VERIFIED", "APPROVED", "DISBURSED").contains(a.getStatus()))
            .toList();

        for (LoanApplication app : pddApps) {
            PddChecklist pdd = new PddChecklist();
            pdd.setId(UUID.randomUUID());
            pdd.setApplicationId(app.getId());
            pdd.setLoanAccountNumber("LOSB" + String.format("%012d", Math.abs(app.getId().hashCode() % 1000000000000L)));
            pdd.setDisbursementDate(LocalDate.now().plusDays(7));
            pdd.setDueDate(LocalDate.now().plusDays(14));
            pdd.setStatus("VERIFIED");
            pdd.setTotalItems(8);
            pdd.setCompletedItems(8);
            pdd.setVerifiedItems(app.getStatus().equals("PDD_PENDING") ? 6 : 8);
            pdd.setInitiatedBy(app.getUser().getId());
            pdd.setCompletionDate(app.getStatus().equals("PDD_PENDING") ? null : LocalDateTime.now().minusDays(2));
            pddChecklistRepository.save(pdd);

            String[] categories = {"ADDRESS_VERIFICATION", "EMPLOYMENT_VERIFICATION", "INCOME_VERIFICATION", "BANK_STATEMENT", "IDENTITY_PROOF", "PHOTOGRAPH", "SIGNATURE", "NACH_MANDATE"};
            String[] codes = {"ADDR001", "EMP001", "INC001", "BANK001", "ID001", "PHOTO001", "SIG001", "NACH001"};
            String[] descriptions = {"Address Verification Report", "Employer Verification Call", "ITR / Salary Slips", "Last 6 Months Bank Statement", "Aadhaar / Voter ID", "Passport Size Photographs", "Specimen Signature", "NACH Mandate Form"};

            for (int j = 0; j < 8; j++) {
                PddChecklistItem item = new PddChecklistItem();
                item.setId(UUID.randomUUID());
                item.setChecklistId(pdd.getId());
                item.setCategory(categories[j]);
                item.setItemCode(codes[j]);
                item.setItemDescription(descriptions[j]);
                item.setStatus(j < (app.getStatus().equals("PDD_PENDING") ? 6 : 8) ? "VERIFIED" : "PENDING");
                item.setMandatory(true);
                item.setDueDate(LocalDate.now().plusDays(7));
                item.setSubmittedDate(LocalDateTime.now().minusDays(random.nextInt(7)));
                if (j < (app.getStatus().equals("PDD_PENDING") ? 6 : 8)) {
                    item.setVerifiedDate(LocalDateTime.now().minusDays(random.nextInt(5)));
                    item.setVerifiedBy(app.getUser().getId());
                }
                pddChecklistItemRepository.save(item);
            }
        }

        log.info("Seeded {} loan applications", applications.size());
    }

    private void seedDecisions() {
        List<LoanApplication> apps = loanApplicationRepository.findAll();

        List<RuleDefinition> rules = new ArrayList<>();

        String[][] ruleData = {
            {"AGE_CHECK", "Age Validation", "Applicant age must be between 21 and 65 years", "HARD", "AGE001", "age >= 21 && age <= 65"},
            {"MIN_INCOME", "Minimum Income", "Monthly income must be at least Rs.15,000", "HARD", "INC001", "monthlyIncome >= 15000"},
            {"CREDIT_SCORE", "Credit Score Check", "CIBIL score must be at least 550", "HARD", "CRED001", "creditScore >= 550"},
            {"MAX_LOAN_AMOUNT", "Maximum Loan Cap", "Loan amount cannot exceed Rs.5 Crores", "HARD", "LOAN001", "loanAmount <= 50000000"},
            {"FOIR_CHECK", "FOIR Validation", "Fixed Obligations to Income Ratio must be less than 60%", "SOFT", "FOIR001", "foir < 60"},
            {"EMPLOYMENT_STABILITY", "Employment Stability", "Minimum 6 months with current employer", "SOFT", "EMP001", "monthsEmployed >= 6"},
            {"BUREAU_GRADE", "Bureau Grade", "Bureau grade must be A/B/C for approval", "SOFT", "BGR001", "bureauGrade in ['A','B','C']"},
        };

        for (String[] rd : ruleData) {
            RuleDefinition rule = new RuleDefinition();
            rule.setId(UUID.randomUUID());
            rule.setRuleCode(rd[0]);
            rule.setRuleName(rd[1]);
            rule.setRuleDescription(rd[2]);
            rule.setCategory("ELIGIBILITY");
            rule.setLoanTypes("PERSONAL_LOAN,HOME_LOAN,CAR_LOAN,EDUCATION_LOAN,BUSINESS_LOAN");
            rule.setRuleExpression(rd[5]);
            rule.setPriority(random.nextInt(10));
            rule.setActive(true);
            rule.setHardRule(rd[3].equals("HARD"));
            rule.setErrorCode(rd[4]);
            rule.setErrorMessage(rd[2]);
            rule.setSeverity("ERROR");
            rules.add(rule);
        }
        ruleDefinitionRepository.saveAll(rules);

        List<InterestRateConfig> rates = new ArrayList<>();
        String[] loanTypes = {"PERSONAL_LOAN", "HOME_LOAN", "CAR_LOAN", "EDUCATION_LOAN", "BUSINESS_LOAN"};
        for (String lt : loanTypes) {
            InterestRateConfig config = new InterestRateConfig();
            config.setId(UUID.randomUUID());
            config.setLoanType(lt);
            config.setMinRateBps(1000);
            config.setMaxRateBps(2400);
            config.setBaseRateBps(1200);
            config.setSpreadBps(0);
            config.setValidFrom(LocalDate.of(2024, 1, 1));
            config.setActive(true);
            rates.add(config);
        }
        interestRateConfigRepository.saveAll(rates);

        MlModelConfig ml = new MlModelConfig();
        ml.setId(UUID.randomUUID());
        ml.setModelName("LOS_CREDIT_SCORING_V2");
        ml.setModelVersion("2.1.0");
        ml.setModelType("ENSEMBLE");
        ml.setActive(true);
        ml.setWeightInEnsemble(BigDecimal.valueOf(0.7));
        ml.setAccuracy(BigDecimal.valueOf(0.8234));
        ml.setPrecisionScore(BigDecimal.valueOf(0.81));
        ml.setRecallScore(BigDecimal.valueOf(0.79));
        ml.setFeaturesUsed("[\"income\",\"foir\",\"bureau_score\",\"tenure\",\"loan_type\",\"employment_type\",\"age\"]");
        mlModelConfigRepository.save(ml);

        List<LoanApplication> decisionApps = apps.stream()
            .filter(a -> !a.getStatus().equals("DRAFT"))
            .limit(30)
            .toList();

        for (LoanApplication app : decisionApps) {
            Decision decision = new Decision();
            decision.setId(UUID.randomUUID());
            decision.setApplicationId(app.getId());
            decision.setStatus("COMPLETED");

            int creditScore = 550 + random.nextInt(350);
            String grade = creditScore >= 750 ? "A" : creditScore >= 700 ? "B" : creditScore >= 650 ? "C" : creditScore >= 600 ? "D" : "E";

            decision.setCreditScore(creditScore);
            decision.setCreditGrade(grade);
            decision.setProbabilityOfDefault(BigDecimal.valueOf(0.02 + random.nextDouble() * 0.15));
            decision.setCombinedPd(BigDecimal.valueOf(0.03 + random.nextDouble() * 0.12));
            decision.setRuleHitsCount(random.nextInt(5));
            decision.setRuleFailCount(decision.getRuleFailCount() > 2 ? 1 : 0);
            decision.setRiskScore(BigDecimal.valueOf(10 + random.nextInt(70)));
            decision.setRecommendedAmount(app.getRequestedAmount().multiply(BigDecimal.valueOf(0.85)));
            decision.setRecommendedTenureMonths(app.getSanctionedTenureMonths() != null ? app.getSanctionedTenureMonths() : 36);
            decision.setRecommendedRoiBps(app.getSanctionedRoiBps() != null ? app.getSanctionedRoiBps() : 1440);
            decision.setFinalGrade(grade);
            decision.setApprovedAmount(decision.getRuleFailCount() > 0 ? null : app.getSanctionedAmount());
            decision.setSanctionedTenureMonths(decision.getRuleFailCount() > 0 ? null : app.getSanctionedTenureMonths());
            decision.setSanctionedRoiBps(decision.getRuleFailCount() > 0 ? null : app.getSanctionedRoiBps());
            decision.setDecisionResult(decision.getRuleFailCount() > 0 ? "CONDITIONALLY_APPROVED" : "APPROVED");
            decision.setConditions(decision.getRuleFailCount() > 0 ? "Submit additional income documents" : null);
            decision.setRejectionReasons(null);
            decision.setDecisionEngineVersion("v2.1.0");
            decision.setDecidedBy("SYSTEM");
            decision.setDecidedAt(LocalDateTime.now().minusDays(random.nextInt(20)));
            decisionRepository.save(decision);

            for (RuleDefinition rule : ruleDefinitionRepository.findAll()) {
                RuleResultEntity result = new RuleResultEntity();
                result.setId(UUID.randomUUID());
                result.setDecisionId(decision.getId());
                result.setRuleId(rule.getId());
                result.setRuleCode(rule.getRuleCode());
                result.setRuleName(rule.getRuleName());
                result.setPassed(random.nextBoolean());
                result.setEvaluatedValue(random.nextBoolean() ? "PASSED" : "FAILED");
                result.setErrorMessage(result.getPassed() ? null : rule.getErrorMessage());
                result.setEvaluatedAt(LocalDateTime.now().minusDays(random.nextInt(15)));
                ruleResultRepository.save(result);
            }
        }

        log.info("Seeded decision rules, rates, ML config, and {} decisions", decisionApps.size());
    }

    private void seedBureauReports() {
        List<LoanApplication> apps = loanApplicationRepository.findAll().stream()
            .filter(a -> !a.getStatus().equals("DRAFT"))
            .limit(25)
            .toList();

        String[] bureaus = {"CIBIL", "EXPERIAN", "EQUIFAX", "CRIF"};

        for (LoanApplication app : apps) {
            BureauReport report = new BureauReport();
            report.setId(UUID.randomUUID());
            report.setApplicationId(app.getId());
            report.setBureauType(bureaus[random.nextInt(bureaus.length)]);
            report.setConsentTaken(true);
            report.setConsentTimestamp(LocalDateTime.now().minusDays(random.nextInt(30)));
            report.setPullStatus("SUCCESS");
            report.setScore(550 + random.nextInt(350));
            report.setGrade(random.nextBoolean() ? "A" : random.nextBoolean() ? "B" : "C");
            report.setRawResponse("""
                {"report_id":"%s","enquiry_date":"%s","score":%d,"accounts":%d,"active_accounts":%d,"closed_accounts":%d,"total_outstanding":%d,"total_overdue":%d}
                """.formatted(
                    UUID.randomUUID().toString().substring(0, 8),
                    LocalDate.now().minusDays(random.nextInt(30)),
                    report.getScore(),
                    random.nextInt(10) + 1,
                    random.nextInt(8) + 1,
                    random.nextInt(5),
                    random.nextInt(5000000),
                    random.nextInt(100000)
            ));
            report.setAccountSummary("""
                {"total_accounts":%d,"active_accounts":%d,"closed_accounts":%d,"total_outstanding":%d,"total_overdue":%d,"avg_dpd":%d}
                """.formatted(
                    random.nextInt(10) + 1,
                    random.nextInt(8) + 1,
                    random.nextInt(5),
                    random.nextInt(5000000),
                    random.nextInt(100000),
                    random.nextInt(60)
            ));
            report.setCreditSummary("""
                {"total_enquiries_6m":%d,"total_enquiries_12m":%d,"new_accounts_6m":%d,"closed_accounts_12m":%d}
                """.formatted(
                    random.nextInt(5),
                    random.nextInt(10),
                    random.nextInt(3),
                    random.nextInt(3)
            ));
            report.setPullAttempts(1);
            report.setLastPulledAt(LocalDateTime.now().minusDays(random.nextInt(30)));
            report.setReportValidUntil(LocalDateTime.now().plusDays(30));
            bureauReportRepository.save(report);
        }

        log.info("Seeded {} bureau reports", apps.size());
    }

    private void seedDisbursements() {
        List<LoanApplication> disbursedApps = loanApplicationRepository.findAll().stream()
            .filter(a -> a.getStatus().equals("DISBURSED"))
            .toList();

        String[] modes = {"RTGS", "NEFT", "IMPS"};

        for (LoanApplication app : disbursedApps) {
            Disbursement disbursement = new Disbursement();
            disbursement.setId(UUID.randomUUID());
            disbursement.setApplicationId(app.getId());
            disbursement.setDisbursementNumber("DISB" + System.currentTimeMillis() + random.nextInt(999));
            disbursement.setAmount(app.getSanctionedAmount());
            disbursement.setDisbursementMode(modes[random.nextInt(modes.length)]);
            disbursement.setBeneficiaryAccount("50100" + String.format("%07d", Math.abs(app.getId().hashCode() % 10000000)));
            disbursement.setBeneficiaryIfsc("LOSB0000001");
            disbursement.setBeneficiaryName(app.getApplicantFullName());
            disbursement.setStatus("COMPLETED");
            disbursement.setUtrNumber("UTR" + System.currentTimeMillis());
            disbursement.setIdempotencyKey(UUID.randomUUID().toString());
            disbursement.setInitiationTimestamp(LocalDateTime.now().minusDays(random.nextInt(10)));
            disbursement.setCompletionTimestamp(LocalDateTime.now().minusDays(random.nextInt(9)));
            disbursementRepository.save(disbursement);
        }

        log.info("Seeded {} disbursements", disbursedApps.size());
    }

    private void seedNachMandates() {
        List<LoanApplication> disbursedApps = loanApplicationRepository.findAll().stream()
            .filter(a -> List.of("DISBURSED", "APPROVED", "PDD_VERIFIED").contains(a.getStatus()))
            .limit(20)
            .toList();

        for (LoanApplication app : disbursedApps) {
            NachMandate mandate = new NachMandate();
            mandate.setId(UUID.randomUUID());
            mandate.setApplicationId(app.getId());
            mandate.setMandateNumber("NACH" + String.format("%010d", Math.abs(app.getId().hashCode() % 10000000000L)));
            mandate.setEmiAmount(app.getSanctionedAmount().divide(BigDecimal.valueOf(app.getSanctionedTenureMonths() != null ? app.getSanctionedTenureMonths() : 36), 2, java.math.RoundingMode.HALF_UP));
            mandate.setFrequency("MONTHLY");
            mandate.setDebitDay(1);
            mandate.setAccountNumber("50100" + String.format("%07d", Math.abs(app.getId().hashCode() % 10000000)));
            mandate.setAccountIfsc("LOSB0000001");
            mandate.setAccountHolderName(app.getApplicantFullName());
            mandate.setBankName("LOS Bank");
            mandate.setStatus("ACTIVE");
            mandate.setRegistrationDate(LocalDate.now().minusDays(random.nextInt(15)));
            mandate.setStartDate(LocalDate.now().plusDays(1));
            mandate.setEndDate(LocalDate.now().plusYears(3));
            nachMandateRepository.save(mandate);
        }

        log.info("Seeded {} NACH mandates", disbursedApps.size());
    }

    private void seedNotificationTemplates() {
        List<NotificationTemplate> templates = new ArrayList<>();

        Object[][] templateData = {
            {"OTP_LOGIN", "OTP Login", "SMS", "Your LOS Bank OTP is {{otp_code}}. Valid for 5 minutes. Do not share.", true},
            {"APPLICATION_SUBMITTED", "Application Submitted", "EMAIL", "Your loan application {{application_number}} has been submitted successfully. We will keep you updated.", true},
            {"APPLICATION_APPROVED", "Application Approved", "EMAIL", "Congratulations! Your loan application {{application_number}} has been approved for Rs. {{amount}}.", true},
            {"APPLICATION_REJECTED", "Application Rejected", "EMAIL", "Your loan application {{application_number}} has been rejected. Reason: {{rejection_reason}}.", true},
            {"KYC_PENDING", "KYC Pending", "SMS", "Please complete your KYC verification for application {{application_number}}.", true},
            {"PDD_OVERDUE", "PDD Overdue", "SMS", "Your PDD checklist for application {{application_number}} is overdue. Please submit pending documents.", true},
            {"DOCUMENT_UPLOADED", "Document Uploaded", "EMAIL", "Document {{document_type}} uploaded successfully for application {{application_number}}.", true},
            {"DISBURSEMENT_COMPLETE", "Disbursement Complete", "SMS", "Rs. {{amount}} disbursed to your account. Loan Account: {{account_number}}.", true},
            {"EMI_REMINDER", "EMI Reminder", "SMS", "EMI of Rs. {{emi_amount}} due on {{due_date}}. Loan Account: {{account_number}}.", true},
            {"NACH_SETUP", "NACH Mandate", "EMAIL", "Your NACH mandate has been registered for Rs. {{emi_amount}} per month.", true},
            {"SANCTION_LETTER", "Sanction Letter", "EMAIL", "Your sanction letter for application {{application_number}} is ready. Please review and sign.", true},
            {"AGREEMENT_SIGNED", "Agreement Signed", "SMS", "Your loan agreement for application {{application_number}} has been signed successfully.", true},
        };

        for (Object[] td : templateData) {
            NotificationTemplate t = new NotificationTemplate();
            t.setId(UUID.randomUUID());
            t.setTemplateCode((String) td[0]);
            t.setTemplateName((String) td[1]);
            t.setChannel((String) td[2]);
            t.setSubject((String) td[3]);
            t.setBodyTemplate((String) td[3]);
            t.setActive((Boolean) td[4]);
            templates.add(t);
        }

        notificationTemplateRepository.saveAll(templates);

        List<User> users = userRepository.findAll();
        for (int i = 0; i < Math.min(20, users.size()); i++) {
            Notification n = new Notification();
            n.setId(UUID.randomUUID());
            n.setUserId(users.get(i).getId());
            n.setApplicationId("LOS" + String.format("%010d", i + 1));
            n.setNotificationType("APPLICATION_SUBMITTED");
            n.setChannel("EMAIL");
            n.setRecipient(users.get(i).getEmail());
            n.setSubject("Application Submitted");
            n.setBody("Your loan application LOS" + String.format("%010d", i + 1) + " has been submitted successfully.");
            n.setStatus("DELIVERED");
            n.setSentAt(LocalDateTime.now().minusDays(random.nextInt(30)));
            n.setDeliveredAt(n.getSentAt() != null ? n.getSentAt().plusMinutes(random.nextInt(5)) : null);
            notificationRepository.save(n);
        }

        log.info("Seeded {} notification templates and 20 notifications", templates.size());
    }

    private void seedDocuments() {
        List<LoanApplication> apps = loanApplicationRepository.findAll().stream().limit(20).toList();
        String[] docTypes = {"AADHAAR", "PAN", "BANK_STATEMENT", "SALARY_SLIP", "ITR", "ADDRESS_PROOF", "PHOTO", "SIGNATURE", "OFFER_LETTER", "FORM16"};
        String[] categories = {"IDENTITY", "INCOME", "ADDRESS", "PHOTO", "SIGNATURE", "LOAN_AGREEMENT"};

        for (LoanApplication app : apps) {
            for (int j = 0; j < 3 + random.nextInt(5); j++) {
                Document doc = new Document();
                doc.setId(UUID.randomUUID());
                doc.setApplicationId(app.getApplicationNumber());
                doc.setUserId(app.getUser().getId());
                doc.setDocumentType(docTypes[random.nextInt(docTypes.length)]);
                doc.setCategory(categories[random.nextInt(categories.length)]);
                doc.setFileName(doc.getDocumentType() + "_" + app.getApplicationNumber() + ".pdf");
                doc.setStorageKey("documents/" + app.getApplicationNumber() + "/" + doc.getDocumentType() + ".pdf");
                doc.setMimeType("application/pdf");
                doc.setFileSizeBytes(100000L + random.nextInt(900000));
                doc.setChecksum("sha256:" + UUID.randomUUID().toString().substring(0, 64));
                doc.setVerificationStatus(random.nextBoolean() ? "VERIFIED" : random.nextBoolean() ? "PENDING" : "REJECTED");
                if (doc.getVerificationStatus().equals("VERIFIED")) {
                    doc.setVerifiedBy(app.getUser().getId());
                    doc.setVerifiedAt(LocalDateTime.now().minusDays(random.nextInt(10)));
                }
                documentRepository.save(doc);
            }
        }

        log.info("Seeded documents for {} applications", apps.size());
    }

    private void seedAuditLogs() {
        List<User> users = userRepository.findAll();

        String[] actions = {"CREATE", "UPDATE", "READ", "DELETE", "APPROVE", "REJECT", "SUBMIT", "VERIFY"};
        String[] resources = {"loan_application", "kyc_record", "document", "decision", "disbursement", "user", "pdd_checklist"};

        for (int i = 0; i < 50; i++) {
            User actor = users.get(random.nextInt(users.size()));
            LoanApplication app = loanApplicationRepository.findAll().stream().skip(random.nextInt(Math.max(1, (int) loanApplicationRepository.count() - 10))).findFirst().orElse(null);

            AuditLog log = new AuditLog();
            log.setId(UUID.randomUUID());
            log.setUserId(actor.getId());
            log.setAction(actions[random.nextInt(actions.length)]);
            log.setEntityType(resources[random.nextInt(resources.length)]);
            log.setEntityId(app != null ? app.getId() : UUID.randomUUID());
            log.setIpAddress("192.168." + random.nextInt(256) + "." + random.nextInt(256));
            log.setUserAgent("LOS-WebApp/1.0");
            log.setDetails("""
                {"application_number":"%s","branch":"%s","role":"%s"}
                """.formatted(
                    app != null ? app.getApplicationNumber() : "N/A",
                    actor.getBranchCode(),
                    actor.getRole()
            ));
            log.setTimestamp(LocalDateTime.now().minusHours(random.nextInt(720)));
            auditLogRepository.save(log);
        }

        log.info("Seeded 50 audit logs");
    }

    private String generateName(int index) {
        String[] firstNames = {"Rajesh", "Priya", "Amit", "Sneha", "Vikram", "Anita", "Rahul", "Meera", "Suresh", "Deepa", "Arun", "Kavita", "Vijay", "Pooja", "Sanjay", "Nisha", "Ajay", "Sunita", "Mahesh", "Ritu", "Gaurav", "Swati", "Anil", "Garima", "Ravi", "Lakshmi", "Deepak", "Anjali", "Sanjay", "Neha"};
        String[] lastNames = {"Kumar", "Sharma", "Verma", "Patel", "Singh", "Reddy", "Nair", "Joshi", "Rao", "Gupta", "Mehta", "Shah", "Chatterjee", "Mukherjee", "Iyer", "Menon", "Pillai", "Nair", "Desai", "Bhatt", "Pandey", "Tiwari", "Yadav", "Thakur", "Choudhary", "Agarwal", "Khandelwal", "Bansal", "Mahajan", "Sood"};
        return firstNames[index % firstNames.length] + " " + lastNames[index % lastNames.length];
    }

    private String generateStreet() {
        String[] streets = {"MG Road", "Nehru Road", "Gandhi Street", "Park Street", "Main Market", "Civil Lines", "Station Road", "Lake Road"};
        return streets[random.nextInt(streets.length)];
    }

    private String generateLocality() {
        String[] localities = {"Vasant Kunj", "Koramangala", "Jubilee Hills", "Bandra West", "Salt Lake", "Whitefield", "HSR Layout", "Andheri East"};
        return localities[random.nextInt(localities.length)];
    }

    private String randomState() {
        String[] states = {"Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Gujarat", "Uttar Pradesh", "West Bengal", "Rajasthan", "Telangana", "Haryana"};
        return states[random.nextInt(states.length)];
    }

    private String generateCompany() {
        String[] companies = {"Infosys Ltd", "TCS", "HDFC Bank", "ICICI Bank", "Wipro", "Reliance Industries", "Tata Motors", "Larsen & Toubro", "Mahindra & Mahindra", "Axis Bank"};
        return companies[random.nextInt(companies.length)];
    }

    private String generateDesignation() {
        String[] designations = {"Software Engineer", "Senior Analyst", "Manager", "Senior Manager", "Business Analyst", "Accountant", "Marketing Executive", "Sales Manager", "HR Manager", "Operations Lead"};
        return designations[random.nextInt(designations.length)];
    }

    private String generatePurpose(String loanType) {
        return switch (loanType) {
            case "HOME_LOAN" -> "Home Purchase / Construction";
            case "CAR_LOAN" -> "Vehicle Purchase";
            case "EDUCATION_LOAN" -> "Higher Education";
            case "BUSINESS_LOAN" -> "Business Expansion";
            default -> "Personal Expenses / Debt Consolidation";
        };
    }

    private String randomRejectionCode() {
        String[] codes = {"LOW_CREDIT_SCORE", "HIGH_FOIR", "INSUFFICIENT_INCOME", "EMPLOYMENT_STABILITY", "DOCUMENT_INCOMPLETE", "AGE_NOT_ELIGIBLE", "MULTIPLE_EXISTING_DEFAULTS"};
        return codes[random.nextInt(codes.length)];
    }

    private String hashMobile(String mobile) {
        return sha256(mobile);
    }

    private String hashPan(String pan) {
        return sha256(pan.toUpperCase());
    }

    private String hashAadhaar(String aadhaar) {
        return sha256(aadhaar);
    }

    private String encryptPan(String pan) {
        return "{\"encrypted\":\"" + sha256(pan) + "\",\"key_ref\":\"pan-master-key\"}";
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    private String toWords(int number) {
        if (number == 0) return "Zero Rupees Only";
        String[] units = {"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
            "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"};
        String[] tens = {"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"};

        if (number < 20) return units[number];
        if (number < 100) return tens[number / 10] + (number % 10 > 0 ? " " + units[number % 10] : "");
        if (number < 1000) return units[number / 100] + " Hundred" + (number % 100 > 0 ? " " + toWords(number % 100) : "");
        if (number < 100000) return toWords(number / 1000) + " Thousand" + (number % 1000 > 0 ? " " + toWords(number % 1000) : "");
        if (number < 10000000) return toWords(number / 100000) + " Lakh" + (number % 100000 > 0 ? " " + toWords(number % 100000) : "");
        return toWords(number / 10000000) + " Crore" + (number % 10000000 > 0 ? " " + toWords(number % 10000000) : "");
    }
}
